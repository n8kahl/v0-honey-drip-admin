-- Migration 023: Public Portal Enhancements
-- Adds admin attribution, daily stats, share tokens, and public timeline support
-- Date: 2025-12-09

-- ============================================================================
-- 0. ENSURE REQUIRED COLUMNS EXIST (from migration 018)
-- ============================================================================

-- Trade type column (Scalp, Day, Swing, LEAP)
-- Note: ADD COLUMN IF NOT EXISTS doesn't support inline CHECK constraints
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_type TEXT DEFAULT 'Scalp';

-- Add CHECK constraint separately (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trades_trade_type_check'
  ) THEN
    ALTER TABLE trades ADD CONSTRAINT trades_trade_type_check
      CHECK (trade_type IN ('Scalp', 'Day', 'Swing', 'LEAP'));
  END IF;
END $$;

-- Public visibility flag
ALTER TABLE trades ADD COLUMN IF NOT EXISTS show_on_public BOOLEAN DEFAULT true;

-- Public comment for trade
ALTER TABLE trades ADD COLUMN IF NOT EXISTS public_comment TEXT;

-- ============================================================================
-- 1. ADD ADMIN ATTRIBUTION TO TRADES
-- ============================================================================

-- Admin who called the trade (references profiles)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES profiles(id);

-- Denormalized admin name for fast public queries (no joins needed)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS admin_name TEXT;

-- Shareable token for public trade links (e.g., /t/abc123def456)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Generate share tokens for existing trades
UPDATE trades
SET share_token = encode(gen_random_bytes(6), 'hex')
WHERE share_token IS NULL;

-- Create index for share token lookups
CREATE INDEX IF NOT EXISTS idx_trades_share_token ON trades(share_token);

-- ============================================================================
-- 2. CREATE DAILY STATS AGGREGATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  admin_id UUID REFERENCES profiles(id), -- NULL = group totals
  trade_type TEXT, -- NULL = all types combined (Scalp, Day, Swing, LEAP)

  -- Trade counts
  total_trades INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,

  -- Performance metrics
  total_gain_percent NUMERIC(10,2) DEFAULT 0, -- Sum of all % gains
  avg_gain_percent NUMERIC(10,2) DEFAULT 0,
  best_trade_percent NUMERIC(10,2) DEFAULT 0,
  best_trade_id UUID REFERENCES trades(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, admin_id, trade_type)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_admin_id ON daily_stats(admin_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date_admin ON daily_stats(date, admin_id);

-- Enable RLS
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Public read access for daily stats
CREATE POLICY "daily_stats_public_select" ON daily_stats
  FOR SELECT TO anon USING (true);

-- Authenticated users can also read
CREATE POLICY "daily_stats_authenticated_select" ON daily_stats
  FOR SELECT TO authenticated USING (true);

-- Only service role can write (background worker)
-- No INSERT/UPDATE/DELETE policies for anon/authenticated

-- ============================================================================
-- 3. EXTEND TRADE_UPDATES FOR PUBLIC TIMELINE
-- ============================================================================

-- Trim percentage for partial exits (25, 50, 75, 100)
ALTER TABLE trade_updates ADD COLUMN IF NOT EXISTS trim_percent INTEGER;

-- Track if update was sent to Discord
ALTER TABLE trade_updates ADD COLUMN IF NOT EXISTS sent_to_discord BOOLEAN DEFAULT FALSE;

-- Discord message ID for reference
ALTER TABLE trade_updates ADD COLUMN IF NOT EXISTS discord_message_id TEXT;

-- ============================================================================
-- 4. PUBLIC RLS POLICIES
-- ============================================================================

-- Allow anonymous users to view trade updates for public trades
-- First, check if policy exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trade_updates' AND policyname = 'trade_updates_public_select'
  ) THEN
    DROP POLICY "trade_updates_public_select" ON trade_updates;
  END IF;
END $$;

CREATE POLICY "trade_updates_public_select" ON trade_updates
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_updates.trade_id
      AND trades.show_on_public = true
    )
  );

-- ============================================================================
-- 5. INDEXES FOR PUBLIC PORTAL QUERIES
-- ============================================================================

-- Index for fetching public trades by type
CREATE INDEX IF NOT EXISTS idx_trades_public_type
ON trades(trade_type, created_at DESC)
WHERE show_on_public = true;

-- Index for fetching public trades by admin
CREATE INDEX IF NOT EXISTS idx_trades_public_admin
ON trades(admin_id, created_at DESC)
WHERE show_on_public = true;

-- Index for recent trade updates (alert feed)
CREATE INDEX IF NOT EXISTS idx_trade_updates_recent
ON trade_updates(created_at DESC);

-- ============================================================================
-- 6. HELPER FUNCTION: Auto-populate admin fields on trade insert
-- ============================================================================

CREATE OR REPLACE FUNCTION set_trade_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Set admin_id to user_id if not already set
  IF NEW.admin_id IS NULL THEN
    NEW.admin_id := NEW.user_id;
  END IF;

  -- Set admin_name from profiles if not already set
  IF NEW.admin_name IS NULL THEN
    SELECT COALESCE(display_name, 'Admin')
    INTO NEW.admin_name
    FROM profiles
    WHERE id = NEW.admin_id;
  END IF;

  -- Generate share token if not set
  IF NEW.share_token IS NULL THEN
    NEW.share_token := encode(gen_random_bytes(6), 'hex');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_trade_admin_fields_trigger ON trades;

CREATE TRIGGER set_trade_admin_fields_trigger
  BEFORE INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION set_trade_admin_fields();

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN trades.admin_id IS 'The admin who called this trade (references profiles.id)';
COMMENT ON COLUMN trades.admin_name IS 'Denormalized admin display name for fast public queries';
COMMENT ON COLUMN trades.share_token IS 'Unique 12-char token for shareable trade links (/t/abc123)';

COMMENT ON COLUMN trade_updates.trim_percent IS 'For trim updates: percentage of position closed (25, 50, 75, 100)';
COMMENT ON COLUMN trade_updates.sent_to_discord IS 'Whether this update was sent to Discord';
COMMENT ON COLUMN trade_updates.discord_message_id IS 'Discord message ID for reference/editing';

COMMENT ON TABLE daily_stats IS 'Pre-aggregated daily performance stats for public portal';
