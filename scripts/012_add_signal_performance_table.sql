-- Migration 012: Signal Performance Tracking
-- Phase 1.3: Historical win rate tracking infrastructure
--
-- Purpose: Track every signal's outcome for ML training and win rate analysis
-- This enables:
-- - Historical win rates by signal type, regime, VIX, time of day
-- - Expectancy calculations
-- - ML feature engineering
-- - Adaptive threshold optimization
--
-- Run this in Supabase SQL Editor

-- Create the signal_performance table
CREATE TABLE IF NOT EXISTS signal_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Signal identification
  signal_id UUID REFERENCES composite_signals(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),

  -- Context at signal time (critical for ML)
  signal_time TIMESTAMPTZ NOT NULL,
  time_of_day_window TEXT,  -- 'opening_drive', 'lunch_chop', 'power_hour', etc.
  vix_level TEXT CHECK (vix_level IN ('low', 'medium', 'high', 'extreme')),
  market_regime TEXT CHECK (market_regime IN ('trending', 'ranging', 'choppy', 'volatile')),
  iv_percentile NUMERIC(5,2),
  data_confidence NUMERIC(5,2),  -- Confidence score from Phase 1.4

  -- Signal scores at detection
  base_score NUMERIC(5,2) NOT NULL,
  scalp_score NUMERIC(5,2),
  day_trade_score NUMERIC(5,2),
  swing_score NUMERIC(5,2),
  recommended_style TEXT CHECK (recommended_style IN ('scalp', 'day_trade', 'swing')),
  confluence_count INTEGER,
  confluence_breakdown JSONB,  -- Full confluence factor breakdown

  -- Entry details
  entry_price NUMERIC(12,4),
  entry_time TIMESTAMPTZ,
  projected_stop NUMERIC(12,4),
  projected_t1 NUMERIC(12,4),
  projected_t2 NUMERIC(12,4),
  projected_t3 NUMERIC(12,4),
  projected_rr NUMERIC(5,2),

  -- Outcome tracking
  outcome TEXT CHECK (outcome IN (
    'WIN_T1',      -- Hit T1 target
    'WIN_T2',      -- Hit T2 target
    'WIN_T3',      -- Hit T3 target
    'STOP_HIT',    -- Stop loss triggered
    'TIME_STOP',   -- Time-based exit (e.g., end of day)
    'MANUAL_EXIT', -- Manual exit by user
    'EXPIRED',     -- Signal expired without action
    'PENDING'      -- Awaiting outcome
  )) DEFAULT 'PENDING',
  exit_price NUMERIC(12,4),
  exit_time TIMESTAMPTZ,
  actual_rr NUMERIC(5,2),
  hold_time_minutes INTEGER,

  -- Excursion tracking (for trade management analysis)
  max_favorable_excursion NUMERIC(12,4),   -- Highest profit point during trade
  max_adverse_excursion NUMERIC(12,4),     -- Worst drawdown point during trade
  mfe_time TIMESTAMPTZ,                    -- When MFE occurred
  mae_time TIMESTAMPTZ,                    -- When MAE occurred

  -- Computed metrics
  pnl_amount NUMERIC(12,2),
  pnl_percent NUMERIC(8,4),
  was_winner BOOLEAN,

  -- Additional context
  trade_type TEXT CHECK (trade_type IN ('SCALP', 'DAY', 'SWING', 'LEAP')),
  asset_class TEXT CHECK (asset_class IN ('INDEX', 'EQUITY_ETF', 'STOCK')),
  user_id UUID REFERENCES auth.users(id),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_signal_perf_symbol ON signal_performance(symbol);
CREATE INDEX IF NOT EXISTS idx_signal_perf_opportunity ON signal_performance(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_signal_perf_outcome ON signal_performance(outcome);
CREATE INDEX IF NOT EXISTS idx_signal_perf_regime ON signal_performance(market_regime);
CREATE INDEX IF NOT EXISTS idx_signal_perf_vix ON signal_performance(vix_level);
CREATE INDEX IF NOT EXISTS idx_signal_perf_time ON signal_performance(signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_signal_perf_tod ON signal_performance(time_of_day_window);
CREATE INDEX IF NOT EXISTS idx_signal_perf_user ON signal_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_perf_was_winner ON signal_performance(was_winner);

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_signal_perf_analytics ON signal_performance(
  opportunity_type, market_regime, vix_level, outcome
);

-- Index for win rate by context
CREATE INDEX IF NOT EXISTS idx_signal_perf_context ON signal_performance(
  opportunity_type, time_of_day_window, vix_level, market_regime, was_winner
);

-- Enable RLS
ALTER TABLE signal_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own signal performance"
  ON signal_performance FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own signal performance"
  ON signal_performance FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own signal performance"
  ON signal_performance FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Service role can do everything (for backend workers)
CREATE POLICY "Service role full access"
  ON signal_performance FOR ALL
  USING (auth.role() = 'service_role');

-- Create the update_updated_at() function if it doesn't exist
-- This function auto-updates the updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamp trigger
CREATE TRIGGER signal_performance_updated_at
  BEFORE UPDATE ON signal_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Materialized view for quick win rate lookups
-- This is refreshed periodically for fast queries
CREATE MATERIALIZED VIEW IF NOT EXISTS signal_win_rates AS
SELECT
  opportunity_type,
  market_regime,
  vix_level,
  time_of_day_window,
  recommended_style,
  asset_class,
  COUNT(*) as total_signals,
  SUM(CASE WHEN was_winner THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN NOT was_winner AND outcome != 'PENDING' AND outcome != 'EXPIRED' THEN 1 ELSE 0 END) as losses,
  SUM(CASE WHEN outcome = 'PENDING' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN outcome = 'EXPIRED' THEN 1 ELSE 0 END) as expired,
  ROUND(100.0 * SUM(CASE WHEN was_winner THEN 1 ELSE 0 END) / NULLIF(
    SUM(CASE WHEN outcome NOT IN ('PENDING', 'EXPIRED') THEN 1 ELSE 0 END), 0
  ), 2) as win_rate,
  ROUND(AVG(CASE WHEN outcome NOT IN ('PENDING', 'EXPIRED') THEN actual_rr ELSE NULL END), 2) as avg_rr,
  ROUND(AVG(CASE WHEN was_winner THEN pnl_percent ELSE NULL END), 2) as avg_win_pct,
  ROUND(AVG(CASE WHEN NOT was_winner AND outcome NOT IN ('PENDING', 'EXPIRED') THEN pnl_percent ELSE NULL END), 2) as avg_loss_pct,
  ROUND(AVG(CASE WHEN outcome NOT IN ('PENDING', 'EXPIRED') THEN hold_time_minutes ELSE NULL END), 0) as avg_hold_time_min,
  -- Expectancy = (win_rate * avg_win) - (loss_rate * avg_loss)
  ROUND(
    (SUM(CASE WHEN was_winner THEN 1 ELSE 0 END)::numeric / NULLIF(
      SUM(CASE WHEN outcome NOT IN ('PENDING', 'EXPIRED') THEN 1 ELSE 0 END), 0
    ) * AVG(CASE WHEN was_winner THEN pnl_percent ELSE NULL END))
    -
    ((1 - SUM(CASE WHEN was_winner THEN 1 ELSE 0 END)::numeric / NULLIF(
      SUM(CASE WHEN outcome NOT IN ('PENDING', 'EXPIRED') THEN 1 ELSE 0 END), 0
    )) * ABS(AVG(CASE WHEN NOT was_winner AND outcome NOT IN ('PENDING', 'EXPIRED') THEN pnl_percent ELSE NULL END)))
  , 2) as expectancy
FROM signal_performance
WHERE outcome != 'PENDING'
GROUP BY opportunity_type, market_regime, vix_level, time_of_day_window, recommended_style, asset_class;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_win_rates_unique ON signal_win_rates(
  COALESCE(opportunity_type, ''),
  COALESCE(market_regime, ''),
  COALESCE(vix_level, ''),
  COALESCE(time_of_day_window, ''),
  COALESCE(recommended_style, ''),
  COALESCE(asset_class, '')
);

-- Function to refresh the materialized view (call hourly)
CREATE OR REPLACE FUNCTION refresh_signal_win_rates()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY signal_win_rates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION refresh_signal_win_rates() TO authenticated;

-- View for simple win rate lookup by opportunity type
CREATE OR REPLACE VIEW signal_win_rate_summary AS
SELECT
  opportunity_type,
  SUM(total_signals) as total_signals,
  SUM(wins) as wins,
  SUM(losses) as losses,
  ROUND(100.0 * SUM(wins) / NULLIF(SUM(wins) + SUM(losses), 0), 2) as win_rate,
  ROUND(AVG(avg_rr), 2) as avg_rr,
  ROUND(AVG(expectancy), 2) as avg_expectancy
FROM signal_win_rates
GROUP BY opportunity_type
ORDER BY win_rate DESC;

-- View for win rate by context (regime + vix + time)
CREATE OR REPLACE VIEW signal_win_rate_by_context AS
SELECT
  opportunity_type,
  market_regime,
  vix_level,
  time_of_day_window,
  total_signals,
  wins,
  losses,
  win_rate,
  avg_rr,
  expectancy
FROM signal_win_rates
WHERE total_signals >= 5  -- Minimum sample size for reliability
ORDER BY expectancy DESC;

-- Comment for documentation
COMMENT ON TABLE signal_performance IS 'Tracks signal outcomes for ML training and win rate analysis. Phase 1.3 of enhancement plan.';
COMMENT ON MATERIALIZED VIEW signal_win_rates IS 'Pre-aggregated win rates by context. Refresh hourly with refresh_signal_win_rates().';
