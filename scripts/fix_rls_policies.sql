-- ============================================================================
-- Fix RLS Policy Syntax for Analytical Tables
-- ============================================================================
-- ERROR FIX: PostgreSQL requires WITH CHECK for INSERT policies, not USING
-- Run this in Supabase SQL Editor

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON iv_percentile_cache;
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON market_regime_history;
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON gamma_exposure_snapshots;
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON options_flow_history;
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON historical_bars;
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON historical_greeks;

-- Drop and recreate public read policies (anon = unauthenticated users)
-- Analytical data is public, no user-specific filtering needed
DROP POLICY IF EXISTS "Allow public read access" ON iv_percentile_cache;
DROP POLICY IF EXISTS "Allow public read access" ON market_regime_history;
DROP POLICY IF EXISTS "Allow public read access" ON gamma_exposure_snapshots;
DROP POLICY IF EXISTS "Allow public read access" ON options_flow_history;
DROP POLICY IF EXISTS "Allow public read access" ON historical_bars;
DROP POLICY IF EXISTS "Allow public read access" ON historical_greeks;

CREATE POLICY "Allow public read access" 
  ON iv_percentile_cache 
  FOR SELECT 
  TO anon 
  USING (true);

CREATE POLICY "Allow public read access" 
  ON market_regime_history 
  FOR SELECT 
  TO anon 
  USING (true);

CREATE POLICY "Allow public read access" 
  ON gamma_exposure_snapshots 
  FOR SELECT 
  TO anon 
  USING (true);

CREATE POLICY "Allow public read access" 
  ON options_flow_history 
  FOR SELECT 
  TO anon 
  USING (true);

CREATE POLICY "Allow public read access" 
  ON historical_bars 
  FOR SELECT 
  TO anon 
  USING (true);

CREATE POLICY "Allow public read access" 
  ON historical_greeks 
  FOR SELECT 
  TO anon 
  USING (true);

-- Drop and recreate authenticated read policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON iv_percentile_cache;
DROP POLICY IF EXISTS "Allow authenticated read access" ON market_regime_history;
DROP POLICY IF EXISTS "Allow authenticated read access" ON gamma_exposure_snapshots;
DROP POLICY IF EXISTS "Allow authenticated read access" ON options_flow_history;
DROP POLICY IF EXISTS "Allow authenticated read access" ON historical_bars;
DROP POLICY IF EXISTS "Allow authenticated read access" ON historical_greeks;

CREATE POLICY "Allow authenticated read access" 
  ON iv_percentile_cache 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated read access" 
  ON market_regime_history 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated read access" 
  ON gamma_exposure_snapshots 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated read access" 
  ON options_flow_history 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated read access" 
  ON historical_bars 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated read access" 
  ON historical_greeks 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- ============================================================================
-- CRITICAL FIX: Use WITH CHECK for INSERT policies (not USING)
-- ============================================================================

-- Drop and recreate service role write policies
DROP POLICY IF EXISTS "Allow service role write" ON iv_percentile_cache;
DROP POLICY IF EXISTS "Allow service role write" ON market_regime_history;
DROP POLICY IF EXISTS "Allow service role write" ON gamma_exposure_snapshots;
DROP POLICY IF EXISTS "Allow service role write" ON options_flow_history;
DROP POLICY IF EXISTS "Allow service role write" ON historical_bars;
DROP POLICY IF EXISTS "Allow service role write" ON historical_greeks;

-- Allow service role to write (workers use service role key)
-- Note: Service role bypasses RLS, but these policies document intent
CREATE POLICY "Allow service role write" 
  ON iv_percentile_cache 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

CREATE POLICY "Allow service role write" 
  ON market_regime_history 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

CREATE POLICY "Allow service role write" 
  ON gamma_exposure_snapshots 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

CREATE POLICY "Allow service role write" 
  ON options_flow_history 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

CREATE POLICY "Allow service role write" 
  ON historical_bars 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

CREATE POLICY "Allow service role write" 
  ON historical_greeks 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

-- Drop and recreate service role update/delete policies
DROP POLICY IF EXISTS "Allow service role update" ON iv_percentile_cache;
DROP POLICY IF EXISTS "Allow service role delete" ON iv_percentile_cache;

-- Allow updates and deletes for service role
CREATE POLICY "Allow service role update" 
  ON iv_percentile_cache 
  FOR UPDATE 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow service role delete" 
  ON iv_percentile_cache 
  FOR DELETE 
  TO service_role 
  USING (true);

-- Repeat for other tables (market_regime_history, gamma_exposure_snapshots, etc.)
-- Add similar UPDATE/DELETE policies if needed

-- ============================================================================
-- Verify policies were created correctly
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS "USING expression",
  with_check AS "WITH CHECK expression"
FROM pg_policies 
WHERE tablename IN (
  'iv_percentile_cache',
  'market_regime_history', 
  'gamma_exposure_snapshots',
  'options_flow_history',
  'historical_bars',
  'historical_greeks'
)
ORDER BY tablename, policyname;
