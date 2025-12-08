-- Migration 014: Add INSERT policies for historical data warehouse tables
-- Workers need to be able to insert data into these tables
-- Date: 2024-12-08

-- Allow anon and authenticated users to INSERT into historical_greeks
DROP POLICY IF EXISTS "Allow insert for all users" ON historical_greeks;
CREATE POLICY "Allow insert for all users"
  ON historical_greeks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon and authenticated users to INSERT into options_flow_history
DROP POLICY IF EXISTS "Allow insert for all users" ON options_flow_history;
CREATE POLICY "Allow insert for all users"
  ON options_flow_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon and authenticated users to INSERT into iv_percentile_cache
DROP POLICY IF EXISTS "Allow insert for all users" ON iv_percentile_cache;
CREATE POLICY "Allow insert for all users"
  ON iv_percentile_cache FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon and authenticated users to UPDATE iv_percentile_cache (for upserts)
DROP POLICY IF EXISTS "Allow update for all users" ON iv_percentile_cache;
CREATE POLICY "Allow update for all users"
  ON iv_percentile_cache FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon and authenticated users to INSERT into gamma_exposure_snapshots
DROP POLICY IF EXISTS "Allow insert for all users" ON gamma_exposure_snapshots;
CREATE POLICY "Allow insert for all users"
  ON gamma_exposure_snapshots FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon and authenticated users to INSERT into market_regime_history
DROP POLICY IF EXISTS "Allow insert for all users" ON market_regime_history;
CREATE POLICY "Allow insert for all users"
  ON market_regime_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon and authenticated users to UPDATE market_regime_history (for upserts)
DROP POLICY IF EXISTS "Allow update for all users" ON market_regime_history;
CREATE POLICY "Allow update for all users"
  ON market_regime_history FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow insert for all users" ON historical_greeks IS
  'Workers need INSERT access to populate historical Greeks data';

COMMENT ON POLICY "Allow insert for all users" ON options_flow_history IS
  'Workers need INSERT access to populate options flow data';

COMMENT ON POLICY "Allow insert for all users" ON gamma_exposure_snapshots IS
  'Workers need INSERT access to populate gamma exposure snapshots';
