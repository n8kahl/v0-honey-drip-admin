-- Migration: Add confluence tracking columns to trades table
-- Purpose: Store real-time confluence data and setup type for each trade
-- This enables live confluence monitoring and visual indicators in the UI

-- Add setup_type column for the detected pattern (e.g., "BREAK_AND_RETEST", "MOMENTUM")
ALTER TABLE trades ADD COLUMN IF NOT EXISTS setup_type TEXT;

-- Add confluence JSONB column for storing breakdown of all confluence factors
-- Structure: { score: number, factors: { ivPercentile: {...}, mtfAlignment: {...}, ... }, updatedAt: timestamp }
ALTER TABLE trades ADD COLUMN IF NOT EXISTS confluence JSONB;

-- Add column to track when confluence was last updated (for staleness detection)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS confluence_updated_at TIMESTAMPTZ;

-- Add index for querying trades by setup type
CREATE INDEX IF NOT EXISTS idx_trades_setup_type ON trades(setup_type);

-- Add GIN index for querying confluence JSONB
CREATE INDEX IF NOT EXISTS idx_trades_confluence ON trades USING GIN (confluence);

-- Add composite index for finding trades needing confluence updates
CREATE INDEX IF NOT EXISTS idx_trades_confluence_stale ON trades(user_id, state, confluence_updated_at)
  WHERE state IN ('LOADED', 'ENTERED');

-- Add comments to document schema
COMMENT ON COLUMN trades.setup_type IS 'Detected signal pattern type: BREAKOUT, REVERSAL, MOMENTUM, BREAK_AND_RETEST, etc.';
COMMENT ON COLUMN trades.confluence IS 'JSONB containing confluence score and factor breakdown: { score, factors: { ivPercentile, mtfAlignment, flowPressure, gammaExposure, regime }, updatedAt }';
COMMENT ON COLUMN trades.confluence_updated_at IS 'Timestamp of last confluence calculation for staleness detection';
