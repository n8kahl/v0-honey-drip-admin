-- Migration 027: Option Price Tracking
-- Purpose: Separate entry snapshot from live price tracking to fix P&L calculations
-- Issue: P&L showing 0.0% because fallback logic uses stale contract snapshot prices

-- 1. Entry Snapshot Fields (Immutable - stored once at entry, never changes)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_bid NUMERIC;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_ask NUMERIC;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_mid NUMERIC;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_timestamp TIMESTAMPTZ;

-- 2. Live Price Tracking Fields (Mutable - updated as market moves)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS last_option_price NUMERIC;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS last_option_price_at TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS price_data_source TEXT;
-- Values: 'websocket', 'rest', 'closing', 'snapshot'

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_last_option_price_at
  ON trades(last_option_price_at DESC)
  WHERE last_option_price_at IS NOT NULL;

-- 4. Add column comments for documentation
COMMENT ON COLUMN trades.entry_bid IS 'Bid price at entry time (immutable snapshot)';
COMMENT ON COLUMN trades.entry_ask IS 'Ask price at entry time (immutable snapshot)';
COMMENT ON COLUMN trades.entry_mid IS 'Mid price at entry time (immutable snapshot)';
COMMENT ON COLUMN trades.entry_timestamp IS 'Timestamp when entry snapshot was taken';
COMMENT ON COLUMN trades.last_option_price IS 'Most recent option price (updated in real-time)';
COMMENT ON COLUMN trades.last_option_price_at IS 'Timestamp of last_option_price';
COMMENT ON COLUMN trades.price_data_source IS 'Source: websocket/rest/closing/snapshot';

-- 5. Backfill existing trades from contract JSONB
UPDATE trades
SET
  entry_bid = COALESCE((contract->>'bid')::numeric, 0),
  entry_ask = COALESCE((contract->>'ask')::numeric, 0),
  entry_mid = COALESCE((contract->>'mid')::numeric, 0),
  entry_timestamp = COALESCE(entry_time, created_at),
  last_option_price = entry_price,
  last_option_price_at = entry_time,
  price_data_source = 'snapshot'
WHERE contract IS NOT NULL
  AND state IN ('ENTERED', 'LOADED')
  AND entry_bid IS NULL;

-- Verify the update
SELECT
  COUNT(*) as total_trades,
  COUNT(entry_bid) as trades_with_entry_bid,
  COUNT(last_option_price) as trades_with_last_price
FROM trades
WHERE state IN ('ENTERED', 'LOADED');
