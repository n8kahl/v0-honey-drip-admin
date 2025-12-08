-- Migration 018: Add public portal fields
-- Adds super admin role and trade visibility controls for public engagement page
-- Date: 2025-12-07

-- Add super admin flag to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Add public visibility controls to trades
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS show_on_public BOOLEAN DEFAULT true;

ALTER TABLE trades
ADD COLUMN IF NOT EXISTS public_comment TEXT;

-- Create index for public trade queries
CREATE INDEX IF NOT EXISTS idx_trades_public_visible
ON trades(user_id, show_on_public, state)
WHERE show_on_public = true AND state IN ('entered', 'loaded');

-- Create RLS policy allowing anonymous users to view public trades
CREATE POLICY "trades_public_select" ON trades
  FOR SELECT
  TO anon
  USING (show_on_public = true AND state IN ('entered', 'loaded'));

-- Comment on columns for documentation
COMMENT ON COLUMN profiles.is_super_admin IS 'Super admin flag - can control public portal visibility';
COMMENT ON COLUMN trades.show_on_public IS 'If true, trade is visible on public engagement portal (default: true)';
COMMENT ON COLUMN trades.public_comment IS 'Admin comment about the trade displayed on public portal';
