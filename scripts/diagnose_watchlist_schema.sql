-- DIAGNOSTIC: Find actual watchlist table schema
-- Run this in Supabase SQL Editor to see what columns actually exist

-- Method 1: Show ALL columns in watchlist table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'watchlist'
ORDER BY ordinal_position;

-- Method 2: Check if watchlist table exists at all
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'watchlist'
) as watchlist_table_exists;

-- Method 3: If table exists, show sample row structure
SELECT * FROM watchlist LIMIT 1;

-- Method 4: Check for any column with 'symbol' or 'ticker' in the name
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'watchlist'
  AND (column_name LIKE '%symbol%' OR column_name LIKE '%ticker%');
