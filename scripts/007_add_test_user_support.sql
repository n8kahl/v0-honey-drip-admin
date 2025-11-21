-- Migration 007: Add Test User Support
-- Date: 2025-11-21
--
-- Adds RLS policy exceptions for test/development mode to allow
-- operations with the test user UUID without requiring auth.uid()
--
-- Test User UUID: 00000000-0000-0000-0000-000000000001

-- ============================================================================
-- Test user RLS policies for composite_signals
-- ============================================================================

-- Allow test user to select their own signals without auth.uid()
CREATE POLICY composite_signals_test_select_policy ON composite_signals
  FOR SELECT
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

-- Allow test user to insert their own signals without auth.uid()
CREATE POLICY composite_signals_test_insert_policy ON composite_signals
  FOR INSERT
  WITH CHECK (owner = '00000000-0000-0000-0000-000000000001'::uuid);

-- Allow test user to update their own signals without auth.uid()
CREATE POLICY composite_signals_test_update_policy ON composite_signals
  FOR UPDATE
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (owner = '00000000-0000-0000-0000-000000000001'::uuid);

-- Allow test user to delete their own signals without auth.uid()
CREATE POLICY composite_signals_test_delete_policy ON composite_signals
  FOR DELETE
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

-- ============================================================================
-- Test user RLS policies for other tables
-- ============================================================================

-- Watchlist
CREATE POLICY IF NOT EXISTS watchlist_test_select_policy ON watchlist
  FOR SELECT
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS watchlist_test_insert_policy ON watchlist
  FOR INSERT
  WITH CHECK (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS watchlist_test_update_policy ON watchlist
  FOR UPDATE
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS watchlist_test_delete_policy ON watchlist
  FOR DELETE
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

-- Trades
CREATE POLICY IF NOT EXISTS trades_test_select_policy ON trades
  FOR SELECT
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS trades_test_insert_policy ON trades
  FOR INSERT
  WITH CHECK (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS trades_test_update_policy ON trades
  FOR UPDATE
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS trades_test_delete_policy ON trades
  FOR DELETE
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

-- Profiles (note: profiles references auth.users, so we need to handle this carefully)
-- Test profile can be selected but not inserted without auth trigger
CREATE POLICY IF NOT EXISTS profiles_test_select_policy ON profiles
  FOR SELECT
  USING (id = '00000000-0000-0000-0000-000000000001'::uuid);

-- User challenges
CREATE POLICY IF NOT EXISTS user_challenges_test_select_policy ON user_challenges
  FOR SELECT
  USING (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS user_challenges_test_insert_policy ON user_challenges
  FOR INSERT
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS user_challenges_test_update_policy ON user_challenges
  FOR UPDATE
  USING (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS user_challenges_test_delete_policy ON user_challenges
  FOR DELETE
  USING (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Discord channels
CREATE POLICY IF NOT EXISTS discord_channels_test_select_policy ON discord_channels
  FOR SELECT
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS discord_channels_test_insert_policy ON discord_channels
  FOR INSERT
  WITH CHECK (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS discord_channels_test_update_policy ON discord_channels
  FOR UPDATE
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY IF NOT EXISTS discord_channels_test_delete_policy ON discord_channels
  FOR DELETE
  USING (owner = '00000000-0000-0000-0000-000000000001'::uuid);

-- ============================================================================
-- Insert test profile (without auth.users dependency)
-- ============================================================================

-- Note: This requires temporarily disabling the foreign key constraint
-- or using service role key to insert. In production, the test user
-- should be created through proper Supabase authentication.

-- For development, we'll insert directly if the profile doesn't exist
DO $$
BEGIN
  -- Only insert if profile doesn't exist
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001'::uuid) THEN
    -- Temporarily disable trigger
    ALTER TABLE profiles DISABLE TRIGGER ALL;

    -- Insert test profile
    INSERT INTO profiles (
      id,
      display_name,
      discord_handle,
      voice_enabled,
      voice_require_confirmation,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000001'::uuid,
      'Test User',
      'test#0001',
      true,
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Re-enable trigger
    ALTER TABLE profiles ENABLE TRIGGER ALL;

    RAISE NOTICE 'Test user profile created successfully';
  ELSE
    RAISE NOTICE 'Test user profile already exists';
  END IF;
END $$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY composite_signals_test_select_policy ON composite_signals IS
  'Development only: Allow test user to query signals without auth.uid()';

COMMENT ON POLICY profiles_test_select_policy ON profiles IS
  'Development only: Allow test user profile access without auth.uid()';
