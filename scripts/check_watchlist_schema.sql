-- Check the actual watchlist table schema
-- Run this in Supabase SQL Editor to verify column names

-- Method 1: Check column information
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'watchlist'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Method 2: Quick check if 'ticker' or 'symbol' column exists
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'watchlist'
    AND column_name = 'ticker'
) as has_ticker_column,
EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'watchlist'
    AND column_name = 'symbol'
) as has_symbol_column;

-- Method 3: Show sample data (if any exists)
SELECT * FROM watchlist LIMIT 3;
