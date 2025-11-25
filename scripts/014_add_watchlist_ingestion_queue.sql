/**
 * Migration 014: Watchlist Ingestion Queue & Trigger
 * Phase 3: Automatic historical data backfill when new symbols added to watchlist
 *
 * Creates:
 * 1. historical_ingestion_queue table - Queue for background processing
 * 2. trigger_historical_ingestion() function - Triggered on watchlist INSERT
 * 3. on_watchlist_insert trigger - Calls function when symbol added
 *
 * Usage:
 *   1. Run this migration in Supabase SQL Editor
 *   2. Historical Data Ingestion Worker will process queue every 60 seconds
 *   3. When user adds symbol to watchlist → Auto-backfill 90 days data
 *
 * Example Flow:
 *   INSERT INTO watchlist (user_id, symbol) VALUES ('...', 'AAPL');
 *   ↓
 *   Trigger fires → Insert into historical_ingestion_queue
 *   ↓
 *   Worker processes queue → Fetch 90 days OHLCV data
 *   ↓
 *   Symbol ready for backtesting within 5 minutes
 */

-- ============================================================================
-- 1. Create historical_ingestion_queue table
-- ============================================================================

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_status ON historical_ingestion_queue(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_symbol ON historical_ingestion_queue(symbol);
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_requested ON historical_ingestion_queue(requested_at DESC);

-- ============================================================================
-- 2. RLS Policies (all users can read queue status for their symbols)
-- ============================================================================

ALTER TABLE historical_ingestion_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view queue entries for symbols in their watchlist
CREATE POLICY "Users can view queue for their watchlist symbols"
  ON historical_ingestion_queue FOR SELECT
  USING (
    symbol IN (
      SELECT w.symbol
      FROM watchlist w
      WHERE w.user_id = auth.uid()
    )
  );

-- Policy: Service role (workers) can do everything
CREATE POLICY "Service role can manage queue"
  ON historical_ingestion_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 3. Trigger Function: Add symbol to ingestion queue when added to watchlist
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_historical_ingestion()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into queue (ON CONFLICT DO NOTHING to handle duplicates)
  INSERT INTO historical_ingestion_queue (symbol, requested_at)
  VALUES (NEW.symbol, NOW())
  ON CONFLICT (symbol) DO NOTHING;

  -- Log for debugging
  RAISE NOTICE 'Watchlist symbol added to ingestion queue: %', NEW.symbol;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Trigger: Fire on watchlist INSERT
-- ============================================================================

DROP TRIGGER IF EXISTS on_watchlist_insert ON watchlist;

CREATE TRIGGER on_watchlist_insert
  AFTER INSERT ON watchlist
  FOR EACH ROW
  EXECUTE FUNCTION trigger_historical_ingestion();

-- ============================================================================
-- 5. Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ingestion_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ingestion_queue_updated_at ON historical_ingestion_queue;

CREATE TRIGGER ingestion_queue_updated_at
  BEFORE UPDATE ON historical_ingestion_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_ingestion_queue_updated_at();

-- ============================================================================
-- 6. Cleanup function (delete old completed/failed entries)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_ingestion_queue()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete completed entries older than 7 days
  DELETE FROM historical_ingestion_queue
  WHERE status IN ('completed', 'failed')
    AND completed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % old ingestion queue entries', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the trigger (should add to queue)
-- INSERT INTO watchlist (user_id, symbol) VALUES (auth.uid(), 'TEST');
-- SELECT * FROM historical_ingestion_queue WHERE symbol = 'TEST';

-- View current queue
-- SELECT * FROM historical_ingestion_queue ORDER BY requested_at DESC;

-- Cleanup old entries (run weekly via cron)
-- SELECT cleanup_old_ingestion_queue();

COMMENT ON TABLE historical_ingestion_queue IS 'Queue for automatic historical data backfill when new symbols added to watchlist';
COMMENT ON FUNCTION trigger_historical_ingestion() IS 'Trigger function: Add symbol to ingestion queue when added to watchlist';
COMMENT ON FUNCTION cleanup_old_ingestion_queue() IS 'Cleanup function: Delete old completed/failed queue entries (7+ days old)';
