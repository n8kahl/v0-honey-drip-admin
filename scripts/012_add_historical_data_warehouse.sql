-- Migration 012: Historical Data Warehouse
-- Phase 1: Enhanced Strategy Engine with Massive.com Historical Data
-- Date: 2025-11-24
--
-- This migration creates tables for institutional-grade data analysis:
-- 1. historical_greeks: Time-series Greeks and IV data
-- 2. options_flow_history: Smart money tracking (sweeps, blocks)
-- 3. iv_percentile_cache: 52-week IV percentile calculations
-- 4. gamma_exposure_snapshots: Dealer positioning and gamma walls
-- 5. market_regime_history: VIX, breadth, correlation tracking

-- ============================================================================
-- Table: historical_greeks
-- ============================================================================
-- Purpose: Store historical Greeks and IV data for percentile calculations
-- Enables: IV rank/percentile, time decay analysis, Greeks tracking
-- Frequency: Updated every 15 minutes during market hours

CREATE TABLE IF NOT EXISTS historical_greeks (
  -- Identity
  symbol TEXT NOT NULL,
  contract_ticker TEXT NOT NULL,     -- e.g., O:SPX251219C06475000
  strike NUMERIC(10,2) NOT NULL,
  expiration DATE NOT NULL,
  timestamp BIGINT NOT NULL,          -- Epoch milliseconds

  -- Greeks (from Massive.com options snapshot)
  delta NUMERIC(8,6),
  gamma NUMERIC(10,8),
  theta NUMERIC(10,6),
  vega NUMERIC(10,6),
  rho NUMERIC(10,6),

  -- IV Metrics
  implied_volatility NUMERIC(8,6),
  iv_rank NUMERIC(5,4),               -- Calculated: (current - low) / (high - low)
  iv_percentile NUMERIC(5,4),         -- Calculated: % of days below current

  -- Context
  underlying_price NUMERIC(12,4) NOT NULL,
  dte INTEGER NOT NULL,               -- Days to expiration
  option_type TEXT CHECK (option_type IN ('call', 'put')),

  -- Pricing
  bid NUMERIC(12,4),
  ask NUMERIC(12,4),
  last NUMERIC(12,4),
  mid_price NUMERIC(12,4),            -- (bid + ask) / 2

  -- Volume & OI
  volume INTEGER,
  open_interest INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (contract_ticker, timestamp)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_historical_greeks_symbol
  ON historical_greeks(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historical_greeks_expiration
  ON historical_greeks(expiration);
CREATE INDEX IF NOT EXISTS idx_historical_greeks_timestamp
  ON historical_greeks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historical_greeks_strike
  ON historical_greeks(symbol, strike, timestamp DESC);

-- Cleanup function: Delete data older than 1 year
CREATE OR REPLACE FUNCTION cleanup_old_greeks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM historical_greeks
  WHERE timestamp < EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 year'))::BIGINT * 1000;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Table: options_flow_history
-- ============================================================================
-- Purpose: Track institutional options flow (sweeps, blocks, large trades)
-- Enables: Smart money alignment, sentiment analysis, unusual activity detection
-- Frequency: Real-time (processed from Massive.com trade feed)

CREATE TABLE IF NOT EXISTS options_flow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  symbol TEXT NOT NULL,
  contract_ticker TEXT NOT NULL,
  timestamp BIGINT NOT NULL,          -- Epoch milliseconds

  -- Trade Details
  price NUMERIC(12,4) NOT NULL,
  size INTEGER NOT NULL,
  premium NUMERIC(16,2) NOT NULL,     -- price × size × 100

  -- Classification
  trade_type TEXT CHECK (trade_type IN ('SWEEP', 'BLOCK', 'SPLIT', 'LARGE', 'REGULAR')),
  sentiment TEXT CHECK (sentiment IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  aggressiveness TEXT CHECK (aggressiveness IN ('PASSIVE', 'NORMAL', 'AGGRESSIVE')),

  -- Context
  strike NUMERIC(10,2),
  expiration DATE,
  option_type TEXT CHECK (option_type IN ('call', 'put')),
  underlying_price NUMERIC(12,4),
  dte INTEGER,

  -- Detection Flags
  is_sweep BOOLEAN DEFAULT false,
  is_block BOOLEAN DEFAULT false,
  is_above_ask BOOLEAN DEFAULT false,  -- Aggressive buy
  is_below_bid BOOLEAN DEFAULT false,  -- Aggressive sell
  is_unusual_volume BOOLEAN DEFAULT false,

  -- Percentiles (relative to recent activity)
  size_percentile NUMERIC(5,2),       -- Size relative to 20-day avg
  premium_percentile NUMERIC(5,2),    -- Premium relative to 20-day avg

  -- Exchange & Conditions
  exchange TEXT,
  conditions TEXT[],                   -- Trade conditions/flags

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_flow_symbol_time
  ON options_flow_history(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_flow_contract
  ON options_flow_history(contract_ticker, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_flow_sweep
  ON options_flow_history(is_sweep, timestamp DESC) WHERE is_sweep = true;
CREATE INDEX IF NOT EXISTS idx_flow_sentiment
  ON options_flow_history(sentiment, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_flow_type
  ON options_flow_history(trade_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_flow_timestamp
  ON options_flow_history(timestamp DESC);

-- Cleanup function: Delete data older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_flow()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM options_flow_history
  WHERE timestamp < EXTRACT(EPOCH FROM (NOW() - INTERVAL '90 days'))::BIGINT * 1000;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Table: iv_percentile_cache
-- ============================================================================
-- Purpose: Cache IV percentile calculations (expensive to compute)
-- Enables: IV rank/percentile context for entry timing
-- Frequency: Calculated daily at market close, updated intraday if needed

CREATE TABLE IF NOT EXISTS iv_percentile_cache (
  symbol TEXT NOT NULL,
  date DATE NOT NULL,

  -- Current IV (from ATM options)
  current_iv NUMERIC(8,6) NOT NULL,
  current_iv_call NUMERIC(8,6),
  current_iv_put NUMERIC(8,6),

  -- 52-week statistics
  iv_52w_high NUMERIC(8,6) NOT NULL,
  iv_52w_low NUMERIC(8,6) NOT NULL,
  iv_52w_mean NUMERIC(8,6) NOT NULL,
  iv_52w_median NUMERIC(8,6) NOT NULL,
  iv_52w_stddev NUMERIC(8,6),

  -- Calculated metrics
  iv_rank NUMERIC(5,4) NOT NULL,           -- (current - low) / (high - low)
  iv_percentile NUMERIC(5,4) NOT NULL,     -- % of days IV was below current
  iv_zscore NUMERIC(6,3),                  -- (current - mean) / stddev

  -- Regime classification
  iv_regime TEXT CHECK (iv_regime IN ('EXTREMELY_LOW', 'LOW', 'NORMAL', 'ELEVATED', 'HIGH', 'EXTREMELY_HIGH')),

  -- Trend analysis (5-day, 20-day changes)
  iv_change_5d NUMERIC(8,6),
  iv_change_20d NUMERIC(8,6),
  iv_trend TEXT CHECK (iv_trend IN ('EXPANDING', 'STABLE', 'CONTRACTING')),

  -- Call/Put skew
  iv_skew NUMERIC(8,6),                    -- call_iv - put_iv
  skew_percentile NUMERIC(5,4),

  -- Sample size
  data_points_52w INTEGER,

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (symbol, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_iv_cache_symbol
  ON iv_percentile_cache(symbol, date DESC);
CREATE INDEX IF NOT EXISTS idx_iv_cache_date
  ON iv_percentile_cache(date DESC);
CREATE INDEX IF NOT EXISTS idx_iv_cache_regime
  ON iv_percentile_cache(iv_regime);

-- ============================================================================
-- Table: gamma_exposure_snapshots
-- ============================================================================
-- Purpose: Store dealer gamma positioning and gamma walls
-- Enables: Price pinning detection, breakout/breakdown probability
-- Frequency: Every 15 minutes during market hours

CREATE TABLE IF NOT EXISTS gamma_exposure_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  symbol TEXT NOT NULL,
  timestamp BIGINT NOT NULL,          -- Epoch milliseconds
  underlying_price NUMERIC(12,4) NOT NULL,

  -- Aggregate gamma metrics
  total_gamma NUMERIC(16,4),
  total_gamma_notional NUMERIC(20,2), -- Gamma × price^2 × 100
  call_gamma NUMERIC(16,4),
  put_gamma NUMERIC(16,4),
  gamma_skew NUMERIC(8,4),            -- call_gamma / put_gamma

  -- Open interest aggregates
  total_call_oi INTEGER,
  total_put_oi INTEGER,
  put_call_oi_ratio NUMERIC(6,4),

  -- Volume aggregates
  total_call_volume INTEGER,
  total_put_volume INTEGER,
  put_call_volume_ratio NUMERIC(6,4),

  -- By strike (JSONB for flexibility)
  gamma_by_strike JSONB NOT NULL DEFAULT '{}'::jsonb,       -- {"6400": -1500000, "6450": 2300000}
  oi_by_strike JSONB NOT NULL DEFAULT '{}'::jsonb,         -- {"6400": 50000, "6450": 75000}
  volume_by_strike JSONB NOT NULL DEFAULT '{}'::jsonb,     -- {"6400": 12000, "6450": 8500}

  -- Key strike levels
  max_call_oi_strike NUMERIC(10,2),
  max_put_oi_strike NUMERIC(10,2),
  max_call_volume_strike NUMERIC(10,2),
  max_put_volume_strike NUMERIC(10,2),

  -- Gamma walls (critical for price prediction)
  gamma_wall_resistance NUMERIC(10,2),      -- Strike with most negative gamma above price
  gamma_wall_support NUMERIC(10,2),         -- Strike with most positive gamma below price
  gamma_wall_resistance_strength NUMERIC(16,4), -- Magnitude of gamma at resistance
  gamma_wall_support_strength NUMERIC(16,4),    -- Magnitude of gamma at support

  -- Dealer positioning (negative gamma = dealers short = bullish for price)
  dealer_net_gamma NUMERIC(16,4),
  dealer_positioning TEXT CHECK (dealer_positioning IN ('LONG_GAMMA', 'SHORT_GAMMA', 'NEUTRAL')),
  positioning_strength TEXT CHECK (positioning_strength IN ('WEAK', 'MODERATE', 'STRONG', 'EXTREME')),

  -- Expected behavior based on gamma
  expected_behavior TEXT CHECK (expected_behavior IN ('PINNING', 'TRENDING', 'VOLATILE', 'RANGE_BOUND')),

  -- Distance to gamma walls (%)
  distance_to_resistance_pct NUMERIC(6,3),
  distance_to_support_pct NUMERIC(6,3),

  -- Metadata
  expiration_focus DATE,              -- Which expiration dominated this snapshot
  expirations_included TEXT[],        -- All expirations in calculation
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (symbol, timestamp)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gamma_symbol_time
  ON gamma_exposure_snapshots(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gamma_timestamp
  ON gamma_exposure_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gamma_positioning
  ON gamma_exposure_snapshots(dealer_positioning, timestamp DESC);

-- Cleanup function: Delete data older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_gamma()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM gamma_exposure_snapshots
  WHERE timestamp < EXTRACT(EPOCH FROM (NOW() - INTERVAL '90 days'))::BIGINT * 1000;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Table: market_regime_history
-- ============================================================================
-- Purpose: Track overall market regime (VIX, breadth, correlation)
-- Enables: Strategy selection based on market conditions
-- Frequency: Calculated daily at market close

CREATE TABLE IF NOT EXISTS market_regime_history (
  date DATE PRIMARY KEY,

  -- VIX Metrics
  vix_level NUMERIC(6,3) NOT NULL,
  vix_change NUMERIC(6,3),            -- Change from previous day
  vix_change_pct NUMERIC(6,3),
  vix_regime TEXT CHECK (vix_regime IN ('EXTREMELY_LOW', 'LOW', 'NORMAL', 'ELEVATED', 'HIGH', 'EXTREME')),

  -- VIX term structure (if VX futures available)
  vix_front_month NUMERIC(6,3),
  vix_back_month NUMERIC(6,3),
  vix_term_structure TEXT CHECK (vix_term_structure IN ('STEEP_CONTANGO', 'CONTANGO', 'FLAT', 'BACKWARDATION', 'STEEP_BACKWARDATION')),
  vix_term_spread NUMERIC(6,3),      -- back - front

  -- Market Breadth
  tick_index NUMERIC(8,2),            -- NYSE TICK (intraday average)
  tick_regime TEXT CHECK (tick_regime IN ('EXTREME_SELLING', 'WEAK', 'NEUTRAL', 'STRONG', 'EXTREME_BUYING')),

  advancers INTEGER,
  decliners INTEGER,
  unchanged INTEGER,
  advance_decline_ratio NUMERIC(6,4),
  advance_decline_diff INTEGER,      -- advancers - decliners

  new_highs INTEGER,
  new_lows INTEGER,
  high_low_ratio NUMERIC(6,4),

  breadth_regime TEXT CHECK (breadth_regime IN ('EXTREMELY_BEARISH', 'BEARISH', 'NEUTRAL', 'BULLISH', 'EXTREMELY_BULLISH')),

  -- Correlation & Leadership
  spy_ndx_correlation NUMERIC(6,4),   -- 20-day rolling correlation
  spy_rut_correlation NUMERIC(6,4),   -- Large cap vs small cap
  correlation_regime TEXT CHECK (correlation_regime IN ('DIVERGING', 'LOW', 'NORMAL', 'HIGH', 'EXTREMELY_HIGH')),

  -- Sector performance (leaders/laggards)
  leading_sector TEXT,                -- XLK, XLF, XLE, etc.
  lagging_sector TEXT,
  sector_rotation TEXT CHECK (sector_rotation IN ('DEFENSIVE', 'CYCLICAL', 'GROWTH', 'VALUE', 'MIXED')),

  -- Put/Call Ratios
  put_call_ratio_equity NUMERIC(6,4),
  put_call_ratio_index NUMERIC(6,4),
  put_call_ratio_total NUMERIC(6,4),
  pc_regime TEXT CHECK (pc_regime IN ('EXTREME_FEAR', 'FEAR', 'NEUTRAL', 'GREED', 'EXTREME_GREED')),

  -- Index performance
  spy_close NUMERIC(12,4),
  spy_change_pct NUMERIC(6,3),
  ndx_close NUMERIC(12,4),
  ndx_change_pct NUMERIC(6,3),
  rut_close NUMERIC(12,4),
  rut_change_pct NUMERIC(6,3),

  -- Volume
  spy_volume BIGINT,
  spy_volume_ratio NUMERIC(6,4),     -- vs 20-day average

  -- Overall Market Regime Classification
  market_regime TEXT CHECK (market_regime IN (
    'STRONG_UPTREND',
    'WEAK_UPTREND',
    'CHOPPY_BULLISH',
    'RANGE_BOUND',
    'CHOPPY_BEARISH',
    'WEAK_DOWNTREND',
    'STRONG_DOWNTREND',
    'BREAKOUT',
    'BREAKDOWN',
    'CAPITULATION',
    'EUPHORIA'
  )),

  confidence_score NUMERIC(5,2),      -- 0-100 confidence in regime classification

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_market_regime_date
  ON market_regime_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_market_regime_vix
  ON market_regime_history(vix_regime);
CREATE INDEX IF NOT EXISTS idx_market_regime_overall
  ON market_regime_history(market_regime);

-- ============================================================================
-- Row-Level Security (RLS)
-- ============================================================================
-- These tables contain global market data, not user-specific
-- Allow all authenticated users to READ
-- Only service role can WRITE (via workers)

ALTER TABLE historical_greeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to all authenticated users"
  ON historical_greeks FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE options_flow_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to all authenticated users"
  ON options_flow_history FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE iv_percentile_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to all authenticated users"
  ON iv_percentile_cache FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE gamma_exposure_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to all authenticated users"
  ON gamma_exposure_snapshots FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE market_regime_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to all authenticated users"
  ON market_regime_history FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Function to get latest IV percentile for a symbol
CREATE OR REPLACE FUNCTION get_latest_iv_percentile(p_symbol TEXT)
RETURNS TABLE (
  symbol TEXT,
  current_iv NUMERIC,
  iv_rank NUMERIC,
  iv_percentile NUMERIC,
  iv_regime TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ivc.symbol,
    ivc.current_iv,
    ivc.iv_rank,
    ivc.iv_percentile,
    ivc.iv_regime
  FROM iv_percentile_cache ivc
  WHERE ivc.symbol = p_symbol
  ORDER BY ivc.date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent options flow summary
CREATE OR REPLACE FUNCTION get_flow_summary(
  p_symbol TEXT,
  p_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  symbol TEXT,
  total_sweeps BIGINT,
  bullish_sweeps BIGINT,
  bearish_sweeps BIGINT,
  total_premium NUMERIC,
  smart_money_bias TEXT
) AS $$
DECLARE
  cutoff_time BIGINT;
BEGIN
  cutoff_time := EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 minute' * p_minutes))::BIGINT * 1000;

  RETURN QUERY
  SELECT
    p_symbol::TEXT,
    COUNT(*) FILTER (WHERE is_sweep = true),
    COUNT(*) FILTER (WHERE is_sweep = true AND sentiment = 'BULLISH'),
    COUNT(*) FILTER (WHERE is_sweep = true AND sentiment = 'BEARISH'),
    SUM(premium)::NUMERIC,
    CASE
      WHEN COUNT(*) FILTER (WHERE sentiment = 'BULLISH') > COUNT(*) FILTER (WHERE sentiment = 'BEARISH') * 1.5
        THEN 'BULLISH'
      WHEN COUNT(*) FILTER (WHERE sentiment = 'BEARISH') > COUNT(*) FILTER (WHERE sentiment = 'BULLISH') * 1.5
        THEN 'BEARISH'
      ELSE 'NEUTRAL'
    END::TEXT
  FROM options_flow_history
  WHERE
    options_flow_history.symbol = p_symbol
    AND timestamp >= cutoff_time;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest gamma exposure
CREATE OR REPLACE FUNCTION get_latest_gamma_exposure(p_symbol TEXT)
RETURNS TABLE (
  symbol TEXT,
  dealer_positioning TEXT,
  gamma_wall_resistance NUMERIC,
  gamma_wall_support NUMERIC,
  expected_behavior TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ges.symbol,
    ges.dealer_positioning,
    ges.gamma_wall_resistance,
    ges.gamma_wall_support,
    ges.expected_behavior
  FROM gamma_exposure_snapshots ges
  WHERE ges.symbol = p_symbol
  ORDER BY ges.timestamp DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get current market regime
CREATE OR REPLACE FUNCTION get_current_market_regime()
RETURNS TABLE (
  date DATE,
  vix_level NUMERIC,
  vix_regime TEXT,
  breadth_regime TEXT,
  market_regime TEXT,
  confidence_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mrh.date,
    mrh.vix_level,
    mrh.vix_regime,
    mrh.breadth_regime,
    mrh.market_regime,
    mrh.confidence_score
  FROM market_regime_history mrh
  ORDER BY mrh.date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Data Retention & Cleanup
-- ============================================================================
-- Schedule these functions to run periodically (via cron or worker)

-- Master cleanup function
CREATE OR REPLACE FUNCTION cleanup_all_historical_data()
RETURNS TABLE (
  table_name TEXT,
  rows_deleted INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'historical_greeks'::TEXT, cleanup_old_greeks();

  RETURN QUERY
  SELECT 'options_flow_history'::TEXT, cleanup_old_flow();

  RETURN QUERY
  SELECT 'gamma_exposure_snapshots'::TEXT, cleanup_old_gamma();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE historical_greeks IS
  'Time-series Greeks and IV data from Massive.com options chain. Updated every 15 minutes during market hours. Enables IV percentile calculations and Greeks tracking.';

COMMENT ON TABLE options_flow_history IS
  'Institutional options flow tracking (sweeps, blocks, large trades). Real-time processing from Massive.com trade feed. Enables smart money alignment detection.';

COMMENT ON TABLE iv_percentile_cache IS
  'Cached IV percentile calculations (expensive to compute). Updated daily at market close. Provides IV rank/percentile context for entry timing decisions.';

COMMENT ON TABLE gamma_exposure_snapshots IS
  'Dealer gamma positioning and gamma wall detection. Updated every 15 minutes. Enables price pinning prediction and breakout probability analysis.';

COMMENT ON TABLE market_regime_history IS
  'Overall market regime tracking (VIX, breadth, correlation, put/call ratios). Calculated daily. Enables regime-aware strategy selection.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Next Steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Build data ingestion workers (server/workers/historicalDataIngestion.ts)
-- 3. Backfill historical data (3-6 months recommended)
-- 4. Build context engines to query this data
-- 5. Integrate with CompositeScanner for enhanced signal detection
