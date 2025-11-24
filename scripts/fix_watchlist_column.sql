-- Fix watchlist table: Rename 'ticker' column to 'symbol'
-- Run this ONLY if check_watchlist_schema.sql shows you still have 'ticker' column

-- Step 1: Rename the column
ALTER TABLE watchlist
RENAME COLUMN ticker TO symbol;

-- Step 2: Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'watchlist'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 3: Check sample data
SELECT * FROM watchlist LIMIT 5;
