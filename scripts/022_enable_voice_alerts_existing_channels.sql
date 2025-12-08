-- Enable voice alert routing for all existing Discord channels
-- This sets is_default_enter, is_default_exit, and is_default_update to TRUE
-- for any existing channels that have NULL or FALSE values

UPDATE discord_channels
SET 
  is_default_enter = true,
  is_default_exit = true,
  is_default_update = true
WHERE 
  is_default_enter IS NULL 
  OR is_default_exit IS NULL 
  OR is_default_update IS NULL
  OR is_default_enter = false
  OR is_default_exit = false
  OR is_default_update = false;

-- Verify the update
SELECT 
  id,
  name,
  is_default_enter,
  is_default_exit,
  is_default_update
FROM discord_channels
ORDER BY created_at DESC;
