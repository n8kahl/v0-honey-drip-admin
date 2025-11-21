-- Migration 006: Add Composite Signals Tables
-- Phase 6: Database & Backend
-- Date: 2025-11-21
--
-- This migration creates tables for the composite trade setup detection system:
-- 1. composite_signals: Primary signal tracking table
-- 2. signal_performance_metrics: Performance analytics and aggregation

-- ============================================================================
-- Table: composite_signals
-- ============================================================================
-- Purpose: Track all composite trade signals with full lifecycle
-- Features:
--   - Signal generation with confluence scoring
--   - Trade lifecycle tracking (ACTIVE -> FILLED -> EXITED)
--   - Risk/reward management
--   - Performance analytics (MFE/MAE)
--   - Deduplication via bar_time_key

CREATE TABLE IF NOT EXISTS composite_signals (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ownership (links to profiles table via auth.uid())
  owner UUID NOT NULL,
  symbol TEXT NOT NULL,

  -- Opportunity Classification
  opportunity_type TEXT NOT NULL CHECK (opportunity_type IN (
    -- Universal Equity
    'breakout_bullish', 'breakout_bearish',
    'mean_reversion_long', 'mean_reversion_short',
    'trend_continuation_long', 'trend_continuation_short',
    -- SPX/NDX Specific
    'gamma_squeeze_bullish', 'gamma_squeeze_bearish',
    'power_hour_reversal_bullish', 'power_hour_reversal_bearish',
    'index_mean_reversion_long', 'index_mean_reversion_short',
    'opening_drive_bullish', 'opening_drive_bearish',
    'gamma_flip_bullish', 'gamma_flip_bearish',
    'eod_pin_setup'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  asset_class TEXT NOT NULL CHECK (asset_class IN ('INDEX', 'EQUITY_ETF', 'STOCK')),

  -- Scoring (0-100 scale)
  base_score NUMERIC(5,2) NOT NULL CHECK (base_score >= 0 AND base_score <= 100),
  scalp_score NUMERIC(5,2) NOT NULL CHECK (scalp_score >= 0 AND scalp_score <= 100),
  day_trade_score NUMERIC(5,2) NOT NULL CHECK (day_trade_score >= 0 AND day_trade_score <= 100),
  swing_score NUMERIC(5,2) NOT NULL CHECK (swing_score >= 0 AND swing_score <= 100),
  recommended_style TEXT NOT NULL CHECK (recommended_style IN ('scalp', 'day_trade', 'swing')),
  recommended_style_score NUMERIC(5,2) NOT NULL CHECK (recommended_style_score >= 0 AND recommended_style_score <= 100),

  -- Confluence Breakdown (for transparency)
  -- Example: {"volume": 95, "flow": 88, "vwap": 75, "gamma_wall_proximity": 85}
  confluence JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Entry/Risk Management
  entry_price NUMERIC(12,4) NOT NULL,
  stop_price NUMERIC(12,4) NOT NULL,
  target_t1 NUMERIC(12,4) NOT NULL,
  target_t2 NUMERIC(12,4) NOT NULL,
  target_t3 NUMERIC(12,4) NOT NULL,
  risk_reward NUMERIC(5,2) NOT NULL CHECK (risk_reward > 0),

  -- Full Features (for analysis/backtesting)
  -- Stores complete SymbolFeatures snapshot at signal generation
  features JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Signal Lifecycle
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
    'ACTIVE',      -- Signal generated, awaiting entry
    'FILLED',      -- Trade entered
    'EXPIRED',     -- Signal expired without entry
    'DISMISSED',   -- User dismissed
    'STOPPED',     -- Stopped out
    'TARGET_HIT'   -- Target reached
  )),
  expires_at TIMESTAMPTZ NOT NULL,
  alerted_at TIMESTAMPTZ,          -- When Discord alert sent
  dismissed_at TIMESTAMPTZ,
  filled_at TIMESTAMPTZ,
  exited_at TIMESTAMPTZ,

  -- Trade Execution (populated after fill)
  fill_price NUMERIC(12,4),
  exit_price NUMERIC(12,4),
  exit_reason TEXT CHECK (exit_reason IN ('STOP', 'T1', 'T2', 'T3', 'MANUAL', 'EXPIRED')),
  contracts_traded INTEGER CHECK (contracts_traded > 0),
  realized_pnl NUMERIC(12,4),
  realized_pnl_pct NUMERIC(5,2),
  hold_time_minutes INTEGER CHECK (hold_time_minutes >= 0),

  -- Performance Tracking
  max_favorable_excursion NUMERIC(12,4), -- MFE: best price reached
  max_adverse_excursion NUMERIC(12,4),   -- MAE: worst price reached

  -- Metadata
  bar_time_key TEXT,               -- For idempotency: "ISO_timestamp_symbol_type"
  detector_version TEXT,           -- Track detector changes (e.g., "1.0.0")

  -- Constraints
  CONSTRAINT composite_signals_symbol_bar_unique UNIQUE (symbol, bar_time_key)
);

-- ============================================================================
-- Indexes for composite_signals
-- ============================================================================

-- Primary query patterns
CREATE INDEX IF NOT EXISTS composite_signals_owner_created_idx
  ON composite_signals(owner, created_at DESC);

CREATE INDEX IF NOT EXISTS composite_signals_symbol_created_idx
  ON composite_signals(symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS composite_signals_status_idx
  ON composite_signals(status);

CREATE INDEX IF NOT EXISTS composite_signals_opportunity_type_idx
  ON composite_signals(opportunity_type);

CREATE INDEX IF NOT EXISTS composite_signals_recommended_style_idx
  ON composite_signals(recommended_style);

CREATE INDEX IF NOT EXISTS composite_signals_asset_class_idx
  ON composite_signals(asset_class);

-- Performance analytics
CREATE INDEX IF NOT EXISTS composite_signals_filled_idx
  ON composite_signals(filled_at)
  WHERE filled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS composite_signals_exited_idx
  ON composite_signals(exited_at)
  WHERE exited_at IS NOT NULL;

-- Active signals (hot path)
CREATE INDEX IF NOT EXISTS composite_signals_active_idx
  ON composite_signals(symbol, status)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS composite_signals_active_expires_idx
  ON composite_signals(expires_at)
  WHERE status = 'ACTIVE';

-- Deduplication lookups
CREATE INDEX IF NOT EXISTS composite_signals_bar_time_key_idx
  ON composite_signals(bar_time_key)
  WHERE bar_time_key IS NOT NULL;

-- ============================================================================
-- RLS Policies for composite_signals
-- ============================================================================

ALTER TABLE composite_signals ENABLE ROW LEVEL SECURITY;

-- Users can only see their own signals
CREATE POLICY composite_signals_select_policy ON composite_signals
  FOR SELECT
  USING (owner = auth.uid());

-- Users can only insert their own signals
CREATE POLICY composite_signals_insert_policy ON composite_signals
  FOR INSERT
  WITH CHECK (owner = auth.uid());

-- Users can only update their own signals
CREATE POLICY composite_signals_update_policy ON composite_signals
  FOR UPDATE
  USING (owner = auth.uid())
  WITH CHECK (owner = auth.uid());

-- Users can only delete their own signals
CREATE POLICY composite_signals_delete_policy ON composite_signals
  FOR DELETE
  USING (owner = auth.uid());

-- ============================================================================
-- Table: signal_performance_metrics
-- ============================================================================
-- Purpose: Aggregate performance metrics by date/symbol/type/style
-- Features:
--   - Daily aggregation for fast queries
--   - Win rate and P&L tracking
--   - Exit distribution analysis
--   - Quality metrics (avg scores, MFE/MAE)

CREATE TABLE IF NOT EXISTS signal_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Aggregation Dimensions (NULL = all aggregated)
  date DATE NOT NULL,
  owner UUID,                      -- NULL = all users aggregate (for admins)
  symbol TEXT,                     -- NULL = all symbols aggregate
  opportunity_type TEXT,           -- NULL = all types aggregate
  recommended_style TEXT,          -- NULL = all styles aggregate

  -- Volume Stats
  total_signals INTEGER NOT NULL DEFAULT 0 CHECK (total_signals >= 0),
  signals_filled INTEGER NOT NULL DEFAULT 0 CHECK (signals_filled >= 0),
  signals_expired INTEGER NOT NULL DEFAULT 0 CHECK (signals_expired >= 0),
  signals_dismissed INTEGER NOT NULL DEFAULT 0 CHECK (signals_dismissed >= 0),

  -- Win Rate
  winners INTEGER NOT NULL DEFAULT 0 CHECK (winners >= 0),
  losers INTEGER NOT NULL DEFAULT 0 CHECK (losers >= 0),
  win_rate NUMERIC(5,2) CHECK (win_rate >= 0 AND win_rate <= 100),

  -- P&L Stats
  total_pnl NUMERIC(12,4),
  avg_winner_pnl NUMERIC(12,4),
  avg_loser_pnl NUMERIC(12,4),
  largest_winner NUMERIC(12,4),
  largest_loser NUMERIC(12,4),
  profit_factor NUMERIC(5,2),      -- Total wins / Total losses (if > 1, profitable)

  -- Execution Stats
  avg_hold_time_minutes INTEGER CHECK (avg_hold_time_minutes >= 0),
  avg_risk_reward NUMERIC(5,2),
  avg_fill_slippage_pct NUMERIC(5,2),

  -- Quality Metrics
  avg_base_score NUMERIC(5,2) CHECK (avg_base_score >= 0 AND avg_base_score <= 100),
  avg_style_score NUMERIC(5,2) CHECK (avg_style_score >= 0 AND avg_style_score <= 100),
  avg_mfe NUMERIC(12,4),           -- Average max favorable excursion
  avg_mae NUMERIC(12,4),           -- Average max adverse excursion

  -- Exit Distribution
  exits_t1 INTEGER DEFAULT 0 CHECK (exits_t1 >= 0),
  exits_t2 INTEGER DEFAULT 0 CHECK (exits_t2 >= 0),
  exits_t3 INTEGER DEFAULT 0 CHECK (exits_t3 >= 0),
  exits_stop INTEGER DEFAULT 0 CHECK (exits_stop >= 0),
  exits_manual INTEGER DEFAULT 0 CHECK (exits_manual >= 0),
  exits_expired INTEGER DEFAULT 0 CHECK (exits_expired >= 0),

  -- Constraints (unique per aggregation key)
  CONSTRAINT signal_performance_metrics_unique
    UNIQUE (date, owner, symbol, opportunity_type, recommended_style)
);

-- ============================================================================
-- Indexes for signal_performance_metrics
-- ============================================================================

CREATE INDEX IF NOT EXISTS signal_performance_metrics_date_idx
  ON signal_performance_metrics(date DESC);

CREATE INDEX IF NOT EXISTS signal_performance_metrics_owner_date_idx
  ON signal_performance_metrics(owner, date DESC);

CREATE INDEX IF NOT EXISTS signal_performance_metrics_symbol_idx
  ON signal_performance_metrics(symbol);

CREATE INDEX IF NOT EXISTS signal_performance_metrics_opportunity_type_idx
  ON signal_performance_metrics(opportunity_type);

CREATE INDEX IF NOT EXISTS signal_performance_metrics_style_idx
  ON signal_performance_metrics(recommended_style);

-- ============================================================================
-- RLS Policies for signal_performance_metrics
-- ============================================================================

ALTER TABLE signal_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Users can see their own metrics (or aggregated metrics with NULL owner)
CREATE POLICY signal_performance_metrics_select_policy ON signal_performance_metrics
  FOR SELECT
  USING (owner = auth.uid() OR owner IS NULL);

-- Only system can insert metrics (via service role)
-- Users cannot insert metrics directly

-- Only system can update metrics (via service role)
-- Users cannot update metrics directly

-- ============================================================================
-- Functions & Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for composite_signals
DROP TRIGGER IF EXISTS update_composite_signals_updated_at ON composite_signals;
CREATE TRIGGER update_composite_signals_updated_at
  BEFORE UPDATE ON composite_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for signal_performance_metrics
DROP TRIGGER IF EXISTS update_signal_performance_metrics_updated_at ON signal_performance_metrics;
CREATE TRIGGER update_signal_performance_metrics_updated_at
  BEFORE UPDATE ON signal_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON composite_signals TO authenticated;
GRANT SELECT ON signal_performance_metrics TO authenticated;

-- Grant full access to service role (for scanner worker)
GRANT ALL ON composite_signals TO service_role;
GRANT ALL ON signal_performance_metrics TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE composite_signals IS
  'Composite trade signals with full lifecycle tracking. Generated by Phase 5 CompositeScanner.';

COMMENT ON TABLE signal_performance_metrics IS
  'Aggregated performance metrics for composite signals. Updated daily by analytics worker.';

COMMENT ON COLUMN composite_signals.confluence IS
  'JSONB object with factor scores (0-100) showing why signal was generated. Example: {"volume": 95, "flow": 88}';

COMMENT ON COLUMN composite_signals.features IS
  'Complete SymbolFeatures snapshot at signal generation time. Used for backtesting and analysis.';

COMMENT ON COLUMN composite_signals.bar_time_key IS
  'Idempotency key: ISO_timestamp + _ + symbol + _ + opportunity_type. Prevents duplicate signals.';

COMMENT ON COLUMN signal_performance_metrics.profit_factor IS
  'Ratio of total wins to total losses. Values > 1.0 indicate profitability.';
