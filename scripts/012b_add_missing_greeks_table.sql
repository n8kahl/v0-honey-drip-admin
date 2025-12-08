-- Add missing historical_greeks table
-- This table already exists in 012_add_historical_data_warehouse.sql
-- but may have been skipped during migration

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_historical_greeks_symbol
  ON historical_greeks(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historical_greeks_expiration
  ON historical_greeks(expiration);
CREATE INDEX IF NOT EXISTS idx_historical_greeks_timestamp
  ON historical_greeks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historical_greeks_strike
  ON historical_greeks(symbol, strike, timestamp DESC);

-- RLS
ALTER TABLE historical_greeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON historical_greeks;
CREATE POLICY "Allow read access to all authenticated users"
  ON historical_greeks FOR SELECT
  TO authenticated
  USING (true);

-- Cleanup function
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

-- Utility function
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

COMMENT ON TABLE historical_greeks IS
  'Time-series Greeks and IV data from Massive.com options chain. Updated every 15 minutes during market hours. Enables IV percentile calculations and Greeks tracking.';
