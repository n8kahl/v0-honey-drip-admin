-- Migration 026: Discord Alert Failures Audit Table
-- Simple audit log for failed Discord webhook deliveries (no automatic retry)

CREATE TABLE discord_alert_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,

  -- Alert details
  alert_type TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,

  -- Payload for manual retry
  payload JSONB NOT NULL,

  -- Error information
  error_message TEXT,
  http_status INTEGER,

  -- Timestamps
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retried_at TIMESTAMPTZ,
  succeeded_at TIMESTAMPTZ,

  -- Metadata
  user_notified BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_discord_failures_user_id ON discord_alert_failures(user_id);
CREATE INDEX idx_discord_failures_trade_id ON discord_alert_failures(trade_id);
CREATE INDEX idx_discord_failures_failed_at ON discord_alert_failures(failed_at DESC);
CREATE INDEX idx_discord_failures_pending ON discord_alert_failures(user_id, succeeded_at)
  WHERE succeeded_at IS NULL;

-- RLS Policies
ALTER TABLE discord_alert_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own failures"
  ON discord_alert_failures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own failures"
  ON discord_alert_failures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own failures"
  ON discord_alert_failures FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own failures"
  ON discord_alert_failures FOR DELETE
  USING (auth.uid() = user_id);

-- Cleanup function: Delete old successful retries (keep failures for audit)
CREATE OR REPLACE FUNCTION cleanup_old_discord_failures()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete successful retries older than 7 days
  DELETE FROM discord_alert_failures
  WHERE succeeded_at IS NOT NULL
    AND succeeded_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE discord_alert_failures IS 'Audit log for failed Discord webhook deliveries - manual retry only';
COMMENT ON COLUMN discord_alert_failures.payload IS 'Full Discord message payload for manual retry';
COMMENT ON COLUMN discord_alert_failures.user_notified IS 'Whether user has been shown a toast notification';
