-- Migration 028: Allow anonymous users to read options_flow_history
-- This is market data that should be accessible to all users (logged in or not)

-- Add SELECT policy for anon users
DROP POLICY IF EXISTS "Allow anon read access" ON options_flow_history;
CREATE POLICY "Allow anon read access"
  ON options_flow_history FOR SELECT
  TO anon
  USING (true);

-- Verify both policies exist
-- SELECT * FROM pg_policies WHERE tablename = 'options_flow_history';

COMMENT ON POLICY "Allow anon read access" ON options_flow_history IS
  'Options flow is market data - allow all users (including anonymous) to read it.';
