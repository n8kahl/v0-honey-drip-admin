-- Migration 016: Add channel enhancements
-- Adds description and default channel fields to discord_channels table
-- Date: 2025-12-07

-- Add description field for channel documentation
ALTER TABLE discord_channels
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add is_global_default flag (only one per user can be true)
ALTER TABLE discord_channels
ADD COLUMN IF NOT EXISTS is_global_default BOOLEAN DEFAULT false;

-- Create index for fast default channel lookup
CREATE INDEX IF NOT EXISTS idx_discord_channels_default
ON discord_channels(user_id, is_global_default)
WHERE is_global_default = true;

-- Function to ensure only one default channel per user
CREATE OR REPLACE FUNCTION ensure_single_default_channel()
RETURNS TRIGGER AS $$
BEGIN
  -- If this channel is being set as default
  IF NEW.is_global_default = true THEN
    -- Clear default flag from all other channels for this user
    UPDATE discord_channels
    SET is_global_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_global_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for re-running migration)
DROP TRIGGER IF EXISTS trigger_single_default_channel ON discord_channels;

-- Create trigger to maintain single default
CREATE TRIGGER trigger_single_default_channel
  BEFORE INSERT OR UPDATE OF is_global_default ON discord_channels
  FOR EACH ROW
  WHEN (NEW.is_global_default = true)
  EXECUTE FUNCTION ensure_single_default_channel();

-- Comment on columns for documentation
COMMENT ON COLUMN discord_channels.description IS 'User-provided description of the channel purpose';
COMMENT ON COLUMN discord_channels.is_global_default IS 'If true, this is the default channel for alerts (only one per user)';
