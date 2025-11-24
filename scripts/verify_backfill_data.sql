-- ============================================================
-- Verification Script: Check if Hybrid Backfill Data Exists
-- ============================================================
-- Run this in Supabase SQL Editor to verify the backfill worked

-- 1. Quick Check: Do we have ANY data?
SELECT
  COUNT(*) as total_bars,
  COUNT(DISTINCT symbol) as unique_symbols,
  MIN(TO_TIMESTAMP(timestamp / 1000)) as earliest_bar,
  MAX(TO_TIMESTAMP(timestamp / 1000)) as latest_bar
FROM historical_bars;

-- Expected Result:
-- If backfill worked: total_bars > 0, unique_symbols >= 1
-- If backfill NOT run: total_bars = 0

-- ============================================================

-- 2. Check by Symbol (detailed breakdown)
SELECT
  symbol,
  COUNT(*) as bar_count,
  MIN(TO_TIMESTAMP(timestamp / 1000)) as earliest_bar,
  MAX(TO_TIMESTAMP(timestamp / 1000)) as latest_bar,
  MAX(created_at) as last_inserted
FROM historical_bars
WHERE timeframe = '1m'
GROUP BY symbol
ORDER BY symbol;

-- Expected Result:
-- SPX: ~24,570 bars per day (6.5 hours × 60 min × 63 trading days)
-- NDX: Similar count
-- VIX: Similar count

-- ============================================================

-- 3. Check Recent Insertions (last hour)
SELECT
  symbol,
  COUNT(*) as bars_inserted,
  MAX(created_at) as last_insert_time,
  EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60 as minutes_ago
FROM historical_bars
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY symbol;

-- Expected Result:
-- If backfill just ran: You'll see rows with minutes_ago < 60
-- If no recent activity: 0 rows returned

-- ============================================================

-- 4. Check Data Quality (verify no null prices)
SELECT
  COUNT(*) as total_bars,
  SUM(CASE WHEN open IS NULL THEN 1 ELSE 0 END) as null_opens,
  SUM(CASE WHEN high IS NULL THEN 1 ELSE 0 END) as null_highs,
  SUM(CASE WHEN low IS NULL THEN 1 ELSE 0 END) as null_lows,
  SUM(CASE WHEN close IS NULL THEN 1 ELSE 0 END) as null_closes
FROM historical_bars;

-- Expected Result:
-- All null_* columns should be 0

-- ============================================================

-- 5. Check Coverage by Date (find gaps)
WITH date_series AS (
  SELECT generate_series(
    DATE_TRUNC('day', MIN(TO_TIMESTAMP(timestamp / 1000))),
    DATE_TRUNC('day', MAX(TO_TIMESTAMP(timestamp / 1000))),
    INTERVAL '1 day'
  )::date as date
  FROM historical_bars
),
daily_counts AS (
  SELECT
    DATE_TRUNC('day', TO_TIMESTAMP(timestamp / 1000))::date as date,
    symbol,
    COUNT(*) as bars
  FROM historical_bars
  WHERE timeframe = '1m'
  GROUP BY DATE_TRUNC('day', TO_TIMESTAMP(timestamp / 1000))::date, symbol
)
SELECT
  ds.date,
  COALESCE(dc.bars, 0) as bars,
  CASE
    WHEN COALESCE(dc.bars, 0) = 0 THEN '❌ Missing (likely weekend/holiday)'
    WHEN COALESCE(dc.bars, 0) < 300 THEN '⚠️ Partial data'
    ELSE '✅ Complete'
  END as status
FROM date_series ds
LEFT JOIN daily_counts dc ON ds.date = dc.date
ORDER BY ds.date DESC
LIMIT 30;

-- Expected Result:
-- Weekdays: 300+ bars (full trading day)
-- Weekends: 0 bars (markets closed)
-- Holidays: 0 bars (markets closed)

-- ============================================================

-- 6. Sample Data Check (view actual bars)
SELECT
  symbol,
  timeframe,
  TO_TIMESTAMP(timestamp / 1000) as bar_time,
  open,
  high,
  low,
  close,
  volume,
  created_at
FROM historical_bars
WHERE symbol = 'SPX'
  AND timeframe = '1m'
ORDER BY timestamp DESC
LIMIT 10;

-- Expected Result:
-- 10 recent bars with realistic price data
-- Open/High/Low/Close should be reasonable (e.g., SPX ~5800-6000)

-- ============================================================

-- 7. Storage Usage Check
SELECT
  pg_size_pretty(pg_total_relation_size('historical_bars')) as total_size,
  pg_size_pretty(pg_relation_size('historical_bars')) as table_size,
  pg_size_pretty(pg_indexes_size('historical_bars')) as indexes_size
FROM historical_bars
LIMIT 1;

-- Expected Result:
-- 90 days × 3 symbols × ~390 bars/day × ~100 bytes/row ≈ 10 MB
-- Indexes add ~3-5 MB

-- ============================================================
-- END OF VERIFICATION SCRIPT
-- ============================================================

-- INTERPRETATION GUIDE:
--
-- ✅ BACKFILL WORKED:
-- - Query 1 shows total_bars > 0
-- - Query 2 shows SPX, NDX with thousands of bars
-- - Query 3 shows recent created_at timestamps (< 60 min ago)
--
-- ❌ BACKFILL NOT RUN YET:
-- - Query 1 shows total_bars = 0
-- - Query 2 returns no rows
-- - Query 3 returns no rows
--
-- ⚠️ PARTIAL SUCCESS:
-- - Query 1 shows some data but low count
-- - Query 2 shows only 1-2 symbols (expected 3+)
-- - Check Railway logs for errors
