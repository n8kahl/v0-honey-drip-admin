-- ============================================================================
-- VERIFICATION AND MIGRATION SCRIPT
-- Run this in Supabase SQL Editor to ensure all tables exist
-- ============================================================================

-- Step 1: Check what tables already exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'historical_bars',
  'historical_greeks',
  'options_flow_history',
  'iv_percentile_cache',
  'gamma_exposure_snapshots',
  'market_regime_history',
  'historical_ingestion_queue',
  'signal_performance'
);

-- ============================================================================
-- If any tables are missing, run the corresponding section below
-- ============================================================================

-- MIGRATION 012: Historical Bars (for backtesting)
-- If historical_bars is missing, run this:
/*
CREATE TABLE IF NOT EXISTS historical_bars (
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume BIGINT,
  vwap NUMERIC,
  trades INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (symbol, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_historical_bars_symbol ON historical_bars(symbol);
CREATE INDEX IF NOT EXISTS idx_historical_bars_timeframe ON historical_bars(timeframe);
CREATE INDEX IF NOT EXISTS idx_historical_bars_timestamp ON historical_bars(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historical_bars_symbol_timeframe ON historical_bars(symbol, timeframe, timestamp DESC);

ALTER TABLE historical_bars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to all authenticated users" ON historical_bars FOR SELECT TO authenticated USING (true);
*/

-- MIGRATION 012: Historical Greeks (for IV percentile and Greeks tracking)
-- If historical_greeks is missing, run this:
/*
CREATE TABLE IF NOT EXISTS historical_greeks (
  symbol TEXT NOT NULL,
  contract_ticker TEXT NOT NULL,
  strike NUMERIC(10,2) NOT NULL,
  expiration DATE NOT NULL,
  timestamp BIGINT NOT NULL,
  delta NUMERIC(8,6),
  gamma NUMERIC(10,8),
  theta NUMERIC(10,6),
  vega NUMERIC(10,6),
  rho NUMERIC(10,6),
  implied_volatility NUMERIC(8,6),
  iv_rank NUMERIC(5,4),
  iv_percentile NUMERIC(5,4),
  underlying_price NUMERIC(12,4) NOT NULL,
  dte INTEGER NOT NULL,
  option_type TEXT CHECK (option_type IN ('call', 'put')),
  bid NUMERIC(12,4),
  ask NUMERIC(12,4),
  last NUMERIC(12,4),
  mid_price NUMERIC(12,4),
  volume INTEGER,
  open_interest INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contract_ticker, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_historical_greeks_symbol ON historical_greeks(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historical_greeks_expiration ON historical_greeks(expiration);
CREATE INDEX IF NOT EXISTS idx_historical_greeks_timestamp ON historical_greeks(timestamp DESC);

ALTER TABLE historical_greeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to all authenticated users" ON historical_greeks FOR SELECT TO authenticated USING (true);
*/

-- MIGRATION 014: Watchlist Ingestion Queue (auto-backfill on symbol add)
-- If historical_ingestion_queue is missing, run this:
/*
CREATE TABLE IF NOT EXISTS historical_ingestion_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL UNIQUE,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  days_to_backfill INTEGER DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_queue_status ON historical_ingestion_queue(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_symbol ON historical_ingestion_queue(symbol);

ALTER TABLE historical_ingestion_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view queue for their watchlist symbols"
  ON historical_ingestion_queue FOR SELECT
  USING (
    symbol IN (
      SELECT w.symbol FROM watchlist w WHERE w.user_id = auth.uid()
    )
  );

-- Trigger function to auto-add to queue when symbol added to watchlist
CREATE OR REPLACE FUNCTION trigger_historical_ingestion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO historical_ingestion_queue (symbol, requested_at)
  VALUES (NEW.symbol, NOW())
  ON CONFLICT (symbol) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_watchlist_insert ON watchlist;
CREATE TRIGGER on_watchlist_insert
  AFTER INSERT ON watchlist
  FOR EACH ROW
  EXECUTE FUNCTION trigger_historical_ingestion();
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to check data exists
-- ============================================================================

-- Check historical_bars data
SELECT
  'historical_bars' as table_name,
  COUNT(*) as row_count,
  COUNT(DISTINCT symbol) as symbols,
  MIN(to_timestamp(timestamp/1000)) as earliest,
  MAX(to_timestamp(timestamp/1000)) as latest
FROM historical_bars;

-- Check historical_greeks data
SELECT
  'historical_greeks' as table_name,
  COUNT(*) as row_count,
  COUNT(DISTINCT symbol) as symbols
FROM historical_greeks;

-- Check ingestion queue
SELECT * FROM historical_ingestion_queue ORDER BY requested_at DESC LIMIT 10;

-- Check trigger exists
SELECT tgname, tgrelid::regclass, tgtype, tgenabled
FROM pg_trigger
WHERE tgname = 'on_watchlist_insert';
