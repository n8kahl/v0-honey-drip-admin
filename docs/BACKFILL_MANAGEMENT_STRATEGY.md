# Historical Data Management Strategy

## 📊 Overview

This guide covers how to manage historical data backfill for multiple tickers without overloading your Supabase database.

---

## 🎯 Storage Capacity Planning

### Supabase Free Tier Limits

- **Storage**: 500 MB (free tier)
- **Rows**: Unlimited (but storage-constrained)

### Storage Math

**Per Symbol Storage**:

```
1 minute bar = ~100-150 bytes (OHLCV + metadata)
1 trading day = 390 bars (6.5 hours × 60 minutes)
1 year = ~252 trading days

Storage per symbol per year:
252 days × 390 bars × 125 bytes = ~12 MB/year
```

**Your Current Setup** (90 days):

```
90 days × 390 bars × 125 bytes × 3 symbols (SPX, NDX, VIX) = ~13 MB
```

### How Many Symbols Can You Store?

| Timeframe  | Symbols        | Storage (90 days) | Storage (1 year)      |
| ---------- | -------------- | ----------------- | --------------------- |
| 3 symbols  | SPX, NDX, VIX  | ~13 MB            | ~36 MB                |
| 10 symbols | Top 10 indices | ~43 MB            | ~120 MB               |
| 20 symbols | Indices + ETFs | ~86 MB            | ~240 MB               |
| 50 symbols | Full watchlist | ~215 MB           | ~600 MB (over limit!) |

**Recommendation**: Keep **10-20 core symbols** with 1-year history (stays under 250 MB).

---

## 🔧 Management Strategies

### Strategy 1: Tiered Symbol Storage (Recommended)

Store different amounts of data based on symbol importance:

```typescript
// Tier 1: Core indices (1 year of data)
const tier1Symbols = ["SPX", "NDX", "VIX", "DJI", "RUT"];

// Tier 2: Major ETFs (90 days)
const tier2Symbols = ["SPY", "QQQ", "IWM", "TLT", "GLD"];

// Tier 3: Individual stocks (30 days only)
const tier3Symbols = ["AAPL", "MSFT", "TSLA", "NVDA"];
```

**Backfill Commands**:

```bash
# Tier 1: 1 year (365 days)
pnpm backfill:hybrid -- --symbols=SPX,NDX,VIX,DJI,RUT --days=365

# Tier 2: 90 days
pnpm backfill:hybrid -- --symbols=SPY,QQQ,IWM,TLT,GLD --days=90

# Tier 3: 30 days
pnpm backfill:hybrid -- --symbols=AAPL,MSFT,TSLA,NVDA --days=30
```

---

### Strategy 2: Automatic Cleanup (Built-in)

The migration includes a cleanup function that auto-deletes data older than 1 year:

```sql
-- Already in your migration (scripts/012_add_historical_bars.sql)
CREATE OR REPLACE FUNCTION cleanup_old_historical_bars()
RETURNS void AS $$
BEGIN
  DELETE FROM historical_bars
  WHERE timestamp < extract(epoch from now() - interval '1 year')::bigint * 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Manual Cleanup** (if needed):

```sql
-- Run in Supabase SQL Editor
SELECT cleanup_old_historical_bars();

-- Check how much was deleted
SELECT pg_size_pretty(pg_total_relation_size('historical_bars')) as size;
```

**Automated Cleanup** (optional - requires pg_cron extension):

```sql
-- Uncomment this line in migration 012 if pg_cron is available
SELECT cron.schedule('cleanup-old-bars', '0 2 * * 0', 'SELECT cleanup_old_historical_bars()');
```

---

### Strategy 3: Smart Symbol Selection

**Option A: Use Your Watchlist**

Only backfill symbols that users are actively watching:

```typescript
// Get symbols from watchlist table
const activeSymbols = await supabase
  .from('watchlist')
  .select('symbol')
  .limit(20); // Limit to top 20 most-watched

// Backfill only those
pnpm backfill:hybrid -- --symbols=${activeSymbols.join(',')} --days=90
```

**Option B: Strategy-Specific**

Only backfill symbols needed for your trading strategies:

```bash
# If you only trade indices
pnpm backfill:hybrid -- --symbols=SPX,NDX,VIX --days=365

# If you trade SPY options
pnpm backfill:hybrid -- --symbols=SPY,SPX,VIX --days=90
```

---

## 📅 Ongoing Maintenance

### Daily Incremental Updates

**Option 1: API Backfill (Lightweight)**

Add yesterday's data only (minimal storage growth):

```bash
# Run this daily via cron or Railway scheduled task
pnpm backfill:api -- --days=1
```

**Storage Growth**: ~43 KB/day for 3 symbols (negligible)

**Option 2: Weekly Hybrid Top-Up**

Download the past week every Monday:

```bash
# Run every Monday
pnpm backfill:hybrid -- --symbols=SPX,NDX,VIX --days=7
```

**Option 3: Railway Scheduled Task**

Set up a Railway cron job to run daily:

```json
// railway.json
{
  "schedules": [
    {
      "command": "pnpm backfill:api -- --days=1",
      "cron": "0 18 * * *" // 6pm daily (after market close)
    }
  ]
}
```

---

## 🗂️ Adding New Tickers

### Before Adding a New Ticker

**Check Current Storage**:

```sql
SELECT
  pg_size_pretty(pg_total_relation_size('historical_bars')) as total_size,
  COUNT(*) as total_bars,
  COUNT(DISTINCT symbol) as unique_symbols
FROM historical_bars;
```

**Estimate Impact**:

```
New symbol (90 days) = ~4.3 MB
New symbol (365 days) = ~12 MB
```

If you're close to 500 MB limit, run cleanup first:

```sql
SELECT cleanup_old_historical_bars();
```

### Add New Ticker (Example: GLD)

```bash
# Full 90-day backfill
pnpm backfill:hybrid -- --symbols=GLD --days=90

# Verify insertion
# (Run in Supabase SQL Editor)
SELECT COUNT(*) FROM historical_bars WHERE symbol = 'GLD';
```

---

## 🚨 Emergency: Database Too Large

### Step 1: Check Current Size

```sql
SELECT
  symbol,
  timeframe,
  COUNT(*) as bars,
  pg_size_pretty(
    pg_column_size(symbol) * COUNT(*)
  ) as approx_size
FROM historical_bars
GROUP BY symbol, timeframe
ORDER BY COUNT(*) DESC;
```

### Step 2: Delete Low-Priority Symbols

```sql
-- Delete all data for specific symbols
DELETE FROM historical_bars
WHERE symbol IN ('AAPL', 'MSFT', 'TSLA');

-- Reclaim space
VACUUM FULL historical_bars;
```

### Step 3: Shorten Retention Period

```sql
-- Keep only 30 days instead of 90
DELETE FROM historical_bars
WHERE timestamp < extract(epoch from now() - interval '30 days')::bigint * 1000;

VACUUM FULL historical_bars;
```

### Step 4: Upgrade Supabase Plan

If you need more:

- **Pro Plan**: $25/month → 8 GB storage
- **Team Plan**: $599/month → 100 GB storage

---

## 🎯 Recommended Setup for Your App

Based on your trading dashboard needs:

### Core Symbols (1 year history)

```bash
pnpm backfill:hybrid -- --symbols=SPX,NDX,VIX --days=365
```

**Storage**: ~36 MB

### Watchlist Symbols (90 days)

```bash
pnpm backfill:hybrid -- --symbols=SPY,QQQ,IWM,DJI,RUT --days=90
```

**Storage**: ~22 MB

### Daily Maintenance

```bash
# Add to cron or Railway schedule
pnpm backfill:api -- --days=1
```

**Total Storage**: ~60 MB (well under 500 MB limit)

---

## 📊 Monitoring

### Check Storage Usage (SQL)

Run this weekly to monitor growth:

```sql
-- Overall stats
SELECT
  pg_size_pretty(pg_total_relation_size('historical_bars')) as total_size,
  pg_size_pretty(pg_relation_size('historical_bars')) as table_size,
  pg_size_pretty(pg_indexes_size('historical_bars')) as indexes_size,
  COUNT(*) as total_bars,
  COUNT(DISTINCT symbol) as unique_symbols,
  MIN(TO_TIMESTAMP(timestamp / 1000)) as oldest_bar,
  MAX(TO_TIMESTAMP(timestamp / 1000)) as newest_bar
FROM historical_bars;

-- Per-symbol breakdown
SELECT
  symbol,
  COUNT(*) as bars,
  MIN(TO_TIMESTAMP(timestamp / 1000)) as oldest,
  MAX(TO_TIMESTAMP(timestamp / 1000)) as newest,
  pg_size_pretty(
    pg_column_size(symbol) * COUNT(*)
  ) as approx_size
FROM historical_bars
GROUP BY symbol
ORDER BY COUNT(*) DESC;
```

### Storage Alert Thresholds

Set up alerts when:

- Total size > 400 MB (80% of free tier limit)
- Total bars > 3 million rows
- Oldest bar > 2 years old

---

## 🔄 Migration to Paid Tier (If Needed)

If you outgrow the free tier:

### Supabase Pro ($25/month)

- 8 GB storage
- Support for **~600 symbols** (1 year each)
- Better performance

### Alternative: Time-Series Database

For massive scale (100+ symbols, multi-year history):

- **TimescaleDB** (PostgreSQL extension)
- **InfluxDB** (purpose-built for time-series)
- **QuestDB** (high-performance option)

---

## 📝 Quick Reference Commands

```bash
# Check current storage in Supabase
# (Run SQL from above in SQL Editor)

# Add new ticker (90 days)
pnpm backfill:hybrid -- --symbols=NEW_TICKER --days=90

# Daily incremental update
pnpm backfill:api -- --days=1

# Manual cleanup (run in Supabase SQL Editor)
SELECT cleanup_old_historical_bars();

# Delete specific symbol
DELETE FROM historical_bars WHERE symbol = 'UNWANTED_TICKER';
VACUUM FULL historical_bars;
```

---

## 🎓 Best Practices

1. **Start Small**: Begin with 3-5 core symbols, expand as needed
2. **Monitor Regularly**: Check storage weekly
3. **Tiered Approach**: Different retention periods for different symbol tiers
4. **Automate Maintenance**: Set up daily/weekly backfill cron jobs
5. **Clean Old Data**: Run cleanup function monthly
6. **Upgrade When Needed**: Don't hesitate to upgrade to Pro if you need more space

---

## 📞 Support

**Questions?**

- Check [HYBRID_BACKFILL_GUIDE.md](HYBRID_BACKFILL_GUIDE.md) for backfill usage
- Check [VERIFY_BACKFILL.md](VERIFY_BACKFILL.md) for verification methods

**Need More Storage?**

- Upgrade to Supabase Pro: https://supabase.com/pricing
- Consider time-series database for 50+ symbols

---

**You're now ready to manage historical data efficiently! 🚀**
