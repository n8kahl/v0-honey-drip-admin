-- Migration 012: Add historical_bars table for persistent bar storage
-- This enables weekend analysis and backtesting without refetching data

-- Create historical_bars table
CREATE TABLE IF NOT EXISTS historical_bars (
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL, -- '1m', '5m', '15m', '1h', '4h', 'day'
  timestamp BIGINT NOT NULL, -- Epoch milliseconds
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume BIGINT,
  vwap NUMERIC,
  trades INTEGER, -- Number of trades in this bar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (symbol, timeframe, timestamp)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_historical_bars_symbol ON historical_bars(symbol);
CREATE INDEX IF NOT EXISTS idx_historical_bars_timeframe ON historical_bars(timeframe);
CREATE INDEX IF NOT EXISTS idx_historical_bars_timestamp ON historical_bars(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historical_bars_symbol_timeframe ON historical_bars(symbol, timeframe, timestamp DESC);

-- Composite index for date range queries (removed WHERE clause - causes IMMUTABLE error)
-- Note: Full index without predicate - still fast due to B-tree structure
CREATE INDEX IF NOT EXISTS idx_historical_bars_range ON historical_bars(symbol, timeframe, timestamp DESC);

-- Enable RLS (no user-specific restrictions - this is global market data)
ALTER TABLE historical_bars ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read historical bars
CREATE POLICY "All users can read historical bars"
  ON historical_bars FOR SELECT
  USING (true); -- All authenticated users can read

-- Policy: Only service role can insert/update (server-side workers only)
-- No explicit policy needed - non-service users can't write by default

-- Add comments for documentation
COMMENT ON TABLE historical_bars IS 'Persistent storage for historical OHLCV bars. Enables fast backtesting and weekend analysis without refetching from Massive.com';
COMMENT ON COLUMN historical_bars.timestamp IS 'Epoch milliseconds (matches Massive.com format)';
COMMENT ON COLUMN historical_bars.timeframe IS 'Bar timeframe: 1m, 5m, 15m, 1h, 4h, day';
COMMENT ON COLUMN historical_bars.vwap IS 'Volume-weighted average price for this bar';

-- Create function to clean up old bars (keep last 1 year only)
CREATE OR REPLACE FUNCTION cleanup_old_historical_bars()
RETURNS void AS $$
BEGIN
  DELETE FROM historical_bars
  WHERE timestamp < extract(epoch from now() - interval '1 year')::bigint * 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create cron job to cleanup old bars (runs weekly on Sundays at 2am)
-- Note: Requires pg_cron extension (available on Supabase)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('cleanup-old-bars', '0 2 * * 0', 'SELECT cleanup_old_historical_bars()');

-- Grant execute on cleanup function to authenticated users (for manual trigger if needed)
GRANT EXECUTE ON FUNCTION cleanup_old_historical_bars() TO authenticated;
