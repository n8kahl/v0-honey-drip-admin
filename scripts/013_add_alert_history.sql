-- Migration: 013_add_alert_history.sql
-- Purpose: Track Discord alert history for debugging and audit trail
-- Created: 2025-11-24

-- Create alert_history table
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('load', 'enter', 'trim', 'update', 'update-sl', 'trail-stop', 'add', 'exit', 'summary', 'challenge')),
  channel_ids TEXT[] NOT NULL,  -- Array of Discord channel IDs
  challenge_ids TEXT[] DEFAULT '{}',  -- Array of challenge IDs (if applicable)
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,  -- Store error if alert failed
  trade_ticker TEXT,  -- Denormalized for easier querying
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX idx_alert_history_trade_id ON alert_history(trade_id);
CREATE INDEX idx_alert_history_alert_type ON alert_history(alert_type);
CREATE INDEX idx_alert_history_created_at ON alert_history(created_at DESC);
CREATE INDEX idx_alert_history_user_created ON alert_history(user_id, created_at DESC);

-- Enable Row-Level Security
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own alert history
CREATE POLICY "Users can view own alert history"
  ON alert_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert history"
  ON alert_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: No update or delete policies - alert history is append-only for audit trail

-- Add comment for documentation
COMMENT ON TABLE alert_history IS 'Audit trail of all Discord alerts sent by users. Helps debug failed alerts and provides usage analytics.';
COMMENT ON COLUMN alert_history.success_count IS 'Number of channels that successfully received the alert';
COMMENT ON COLUMN alert_history.failed_count IS 'Number of channels that failed to receive the alert';
COMMENT ON COLUMN alert_history.error_message IS 'Error message if alert completely failed (not per-channel failures)';
