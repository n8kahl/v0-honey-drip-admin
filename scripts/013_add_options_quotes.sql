-- Migration 013: Add options_quotes table for realistic backtest fills
-- Stores bid/ask data from Massive.com flat files for accurate slippage simulation

-- Create options_quotes table
-- Stores aggregated minute-level snapshots (not every tick)
CREATE TABLE IF NOT EXISTS options_quotes (
  id BIGSERIAL,
  underlying TEXT NOT NULL,           -- Underlying symbol (SPY, SPX, QQQ, etc.)
  option_ticker TEXT NOT NULL,        -- Full option ticker (e.g., "SPY250117C00500000")
  timestamp BIGINT NOT NULL,          -- Epoch milliseconds (minute boundary)

  -- Bid/Ask prices
  bid_price NUMERIC NOT NULL,
  ask_price NUMERIC NOT NULL,

  -- Size (in round lots of 100)
  bid_size INTEGER NOT NULL DEFAULT 0,
  ask_size INTEGER NOT NULL DEFAULT 0,

  -- Computed fields for fast filtering
  spread NUMERIC GENERATED ALWAYS AS (ask_price - bid_price) STORED,
  spread_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN bid_price > 0 THEN ((ask_price - bid_price) / bid_price) * 100 ELSE 0 END
  ) STORED,
  mid_price NUMERIC GENERATED ALWAYS AS ((bid_price + ask_price) / 2) STORED,

  -- Exchange info (optional)
  bid_exchange INTEGER,
  ask_exchange INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (underlying, option_ticker, timestamp)
);

-- Indexes for fast queries
-- Query pattern: Get quotes for underlying at specific time
CREATE INDEX IF NOT EXISTS idx_options_quotes_underlying
  ON options_quotes(underlying, timestamp DESC);

-- Query pattern: Get quotes for specific option
CREATE INDEX IF NOT EXISTS idx_options_quotes_ticker
  ON options_quotes(option_ticker, timestamp DESC);

-- Query pattern: Filter by spread
CREATE INDEX IF NOT EXISTS idx_options_quotes_spread
  ON options_quotes(underlying, timestamp, spread_percent)
  WHERE spread_percent <= 5.0;

-- Query pattern: Filter by liquidity
CREATE INDEX IF NOT EXISTS idx_options_quotes_liquidity
  ON options_quotes(underlying, timestamp, bid_size, ask_size)
  WHERE bid_size >= 10 AND ask_size >= 10;

-- Composite index for backtest queries
CREATE INDEX IF NOT EXISTS idx_options_quotes_backtest
  ON options_quotes(underlying, timestamp, spread_percent, mid_price);

-- Enable RLS (global market data - all users can read)
ALTER TABLE options_quotes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read
CREATE POLICY "All users can read options quotes"
  ON options_quotes FOR SELECT
  USING (true);

-- Comments
COMMENT ON TABLE options_quotes IS 'Options bid/ask quotes from Massive.com flat files. Used for realistic backtest fills.';
COMMENT ON COLUMN options_quotes.underlying IS 'Underlying symbol (SPY, SPX, QQQ, etc.)';
COMMENT ON COLUMN options_quotes.option_ticker IS 'Full OCC option ticker format';
COMMENT ON COLUMN options_quotes.timestamp IS 'Epoch milliseconds at minute boundary';
COMMENT ON COLUMN options_quotes.spread_percent IS 'Bid-ask spread as percentage of bid';
COMMENT ON COLUMN options_quotes.mid_price IS 'Mid-point between bid and ask';

-- Function to get best quote for an underlying at a specific time
-- Returns the most liquid ATM option quote
CREATE OR REPLACE FUNCTION get_best_quote_at_time(
  p_underlying TEXT,
  p_timestamp BIGINT,
  p_max_spread_pct NUMERIC DEFAULT 2.0,
  p_min_size INTEGER DEFAULT 10
)
RETURNS TABLE (
  option_ticker TEXT,
  bid_price NUMERIC,
  ask_price NUMERIC,
  mid_price NUMERIC,
  spread_percent NUMERIC,
  bid_size INTEGER,
  ask_size INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    oq.option_ticker,
    oq.bid_price,
    oq.ask_price,
    oq.mid_price,
    oq.spread_percent,
    oq.bid_size,
    oq.ask_size
  FROM options_quotes oq
  WHERE oq.underlying = p_underlying
    AND oq.timestamp = (
      -- Get closest timestamp at or before requested time
      SELECT MAX(timestamp)
      FROM options_quotes
      WHERE underlying = p_underlying
        AND timestamp <= p_timestamp
    )
    AND oq.spread_percent <= p_max_spread_pct
    AND oq.bid_size >= p_min_size
    AND oq.ask_size >= p_min_size
  ORDER BY (oq.bid_size + oq.ask_size) DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get average spread for an underlying over a time range
CREATE OR REPLACE FUNCTION get_avg_spread_stats(
  p_underlying TEXT,
  p_start_ts BIGINT,
  p_end_ts BIGINT
)
RETURNS TABLE (
  avg_spread_pct NUMERIC,
  min_spread_pct NUMERIC,
  max_spread_pct NUMERIC,
  avg_bid_size NUMERIC,
  avg_ask_size NUMERIC,
  quote_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(oq.spread_percent)::NUMERIC as avg_spread_pct,
    MIN(oq.spread_percent)::NUMERIC as min_spread_pct,
    MAX(oq.spread_percent)::NUMERIC as max_spread_pct,
    AVG(oq.bid_size)::NUMERIC as avg_bid_size,
    AVG(oq.ask_size)::NUMERIC as avg_ask_size,
    COUNT(*)::BIGINT as quote_count
  FROM options_quotes oq
  WHERE oq.underlying = p_underlying
    AND oq.timestamp BETWEEN p_start_ts AND p_end_ts
    AND oq.bid_price > 0
    AND oq.ask_price > 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- Cleanup function (keep last 90 days for backtest)
CREATE OR REPLACE FUNCTION cleanup_old_options_quotes()
RETURNS void AS $$
BEGIN
  DELETE FROM options_quotes
  WHERE timestamp < extract(epoch from now() - interval '90 days')::bigint * 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_best_quote_at_time(TEXT, BIGINT, NUMERIC, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_avg_spread_stats(TEXT, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_options_quotes() TO authenticated;
