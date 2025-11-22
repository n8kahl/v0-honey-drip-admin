-- Migration: Add Trade-Discord/Challenge Linking Tables
-- Purpose: Enable many-to-many relationships between trades and Discord channels/challenges
-- Author: Claude
-- Date: 2025-11-22

-- ============================================================================
-- 1. CREATE LINKING TABLES
-- ============================================================================

-- Trades ↔ Discord Channels (many-to-many)
CREATE TABLE IF NOT EXISTS trades_discord_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  discord_channel_id UUID NOT NULL REFERENCES discord_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_id, discord_channel_id)
);

-- Trades ↔ Challenges (many-to-many)
CREATE TABLE IF NOT EXISTS trades_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_id, challenge_id)
);

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trades_discord_channels_trade_id ON trades_discord_channels(trade_id);
CREATE INDEX IF NOT EXISTS idx_trades_discord_channels_channel_id ON trades_discord_channels(discord_channel_id);

CREATE INDEX IF NOT EXISTS idx_trades_challenges_trade_id ON trades_challenges(trade_id);
CREATE INDEX IF NOT EXISTS idx_trades_challenges_challenge_id ON trades_challenges(challenge_id);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE trades_discord_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades_challenges ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES FOR trades_discord_channels
-- ============================================================================

-- Users can view their own trade's discord channels
CREATE POLICY "Users can view their own trade discord channels"
  ON trades_discord_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE id = trade_id AND user_id = auth.uid()
    )
  );

-- Users can create links for their own trades
CREATE POLICY "Users can create discord channel links for their own trades"
  ON trades_discord_channels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades
      WHERE id = trade_id AND user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM discord_channels
      WHERE id = discord_channel_id AND user_id = auth.uid()
    )
  );

-- Users can delete links for their own trades
CREATE POLICY "Users can delete discord channel links for their own trades"
  ON trades_discord_channels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE id = trade_id AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. RLS POLICIES FOR trades_challenges
-- ============================================================================

-- Users can view their own trade's challenge links
CREATE POLICY "Users can view their own trade challenge links"
  ON trades_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE id = trade_id AND user_id = auth.uid()
    )
  );

-- Users can create links for their own trades
CREATE POLICY "Users can create challenge links for their own trades"
  ON trades_challenges FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades
      WHERE id = trade_id AND user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM challenges
      WHERE id = challenge_id AND user_id = auth.uid()
    )
  );

-- Users can delete links for their own trades
CREATE POLICY "Users can delete challenge links for their own trades"
  ON trades_challenges FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE id = trade_id AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. VERIFICATION QUERIES (for testing)
-- ============================================================================

-- View 1: Get all trades with their discord channels
CREATE OR REPLACE VIEW trades_with_discord_channels AS
SELECT
  t.id,
  t.user_id,
  t.ticker,
  t.status,
  dc.id as channel_id,
  dc.name as channel_name,
  dc.webhook_url
FROM trades t
LEFT JOIN trades_discord_channels tdc ON t.id = tdc.trade_id
LEFT JOIN discord_channels dc ON tdc.discord_channel_id = dc.id;

-- View 2: Get all trades with their challenges
CREATE OR REPLACE VIEW trades_with_challenges AS
SELECT
  t.id,
  t.user_id,
  t.ticker,
  t.status,
  c.id as challenge_id,
  c.name as challenge_name
FROM trades t
LEFT JOIN trades_challenges tc ON t.id = tc.trade_id
LEFT JOIN challenges c ON tc.challenge_id = c.id;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE trades_discord_channels IS
'Junction table linking trades to Discord channels for alert routing. Enables many-to-many relationships.';

COMMENT ON TABLE trades_challenges IS
'Junction table linking trades to challenges for performance tracking. Enables many-to-many relationships.';

COMMENT ON COLUMN trades_discord_channels.trade_id IS
'Foreign key to trades table. Cascades on delete.';

COMMENT ON COLUMN trades_discord_channels.discord_channel_id IS
'Foreign key to discord_channels table. Cascades on delete.';

COMMENT ON COLUMN trades_challenges.trade_id IS
'Foreign key to trades table. Cascades on delete.';

COMMENT ON COLUMN trades_challenges.challenge_id IS
'Foreign key to challenges table. Cascades on delete.';
