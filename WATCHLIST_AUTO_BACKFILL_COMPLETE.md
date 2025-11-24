# ✅ Automatic Watchlist Backfill - COMPLETE

## 🎉 What Was Implemented

You now have a **fully automatic system** that:

1. ✅ Monitors watchlist for new symbols (every hour)
2. ✅ Auto-backfills historical data for new tickers
3. ✅ Works for all users (not just one)
4. ✅ Auto-cleans up old data (>1 year) daily at 2am
5. ✅ Skips symbols that already have data (smart!)

---

## 🚀 Quick Start

### Local Testing

```bash
# Start the watchlist worker
pnpm dev:watchlist
```

**What happens**:

- Runs immediately on startup
- Checks watchlist every hour
- Cleans up old data daily at 2am

### Production Deployment (Railway)

1. **Create new worker service** in Railway
2. **Set environment variables** (same as main app)
3. **Set start command**: `pnpm start:watchlist`
4. **Deploy!**

---

## 📋 How It Works

```
┌──────────────────────────────────────────────────┐
│  USER ADDS TICKER TO WATCHLIST                    │
│  (Any user, anywhere in the app)                  │
└───────────────────┬──────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│  WATCHLIST WORKER (runs every hour)               │
│  1. Queries all symbols in watchlist table        │
│  2. Checks which symbols have historical data     │
│  3. Identifies new symbols without data           │
└───────────────────┬──────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│  AUTO-BACKFILL NEW SYMBOLS                        │
│  - Downloads 90 days of flat files from S3        │
│  - Parses and inserts into historical_bars        │
│  - Skips symbols that already have data           │
└───────────────────┬──────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│  DAILY CLEANUP (2am)                              │
│  - Deletes data older than 1 year                 │
│  - Keeps database under storage limits            │
└──────────────────────────────────────────────────┘
```

---

## 📝 Commands

### Development

```bash
# Start worker (auto-runs hourly + cleanup)
pnpm dev:watchlist

# Manual one-time run
pnpm backfill:watchlist

# Custom lookback
pnpm backfill:watchlist -- --days=365

# Force re-backfill (even if data exists)
pnpm backfill:watchlist -- --force
```

### Production

```bash
# Start worker (Railway)
pnpm start:watchlist

# Check if running
railway ps

# View logs
railway logs
```

---

## 🎯 Example Flow

### Scenario: User adds "TSLA" to watchlist

**Timeline**:

```
3:00pm - User clicks "Add to Watchlist" → TSLA saved to database
3:30pm - Watchlist worker checks (scheduled hourly run)
         ↓
         Detects TSLA not in historical_bars
         ↓
3:31pm - Downloads TSLA data from S3 (90 days)
         ↓
3:33pm - Parses 35,100 bars (90 days × 390 bars/day)
         ↓
3:35pm - Inserts 35,100 bars into historical_bars
         ↓
3:35pm - ✅ TSLA now has full historical data!

4:00pm - Next cycle runs
         ↓
         TSLA already has data → skips (no duplicate work)
```

---

## 🔧 Configuration

### Where to Change Settings

File: [server/workers/flatFiles/WatchlistBackfill.ts](server/workers/flatFiles/WatchlistBackfill.ts)

**Check Interval** (default: 1 hour):

```typescript
// Line 258
setInterval(runCycle, 60 * 60 * 1000); // 1 hour

// Change to 30 minutes:
setInterval(runCycle, 30 * 60 * 1000);
```

**Lookback Period** (default: 90 days):

```typescript
// Line 269
days: 90,

// Change to 1 year:
days: 365,
```

**Cleanup Time** (default: 2am):

```typescript
// Line 287
next2AM.setHours(2, 0, 0, 0); // 2am

// Change to 4am:
next2AM.setHours(4, 0, 0, 0);
```

---

## 📊 Monitoring

### Check Worker Status

**In Railway**:

1. Project → Watchlist Worker service
2. Logs tab
3. Look for: `[WatchlistBackfill] Cycle #X complete`

**Expected Logs**:

```
🚀 Starting Watchlist Backfill Worker
Environment: production
Check interval: 1 hour
Cleanup interval: Daily at 2am
Cleanup scheduled for 11/25/2025, 2:00:00 AM

[WatchlistBackfill] 🔄 Starting cycle #1...
[WatchlistBackfill] Found 8 symbols: SPX, NDX, VIX, SPY, QQQ, IWM, DIA, TSLA
[WatchlistBackfill] Symbols with existing data: 6
[WatchlistBackfill] Symbols needing backfill: 2
[WatchlistBackfill] Symbols to backfill: TSLA, NVDA

[HybridBackfill] 🚀 Starting hybrid backfill...
[FlatFileDownloader] ✅ Downloaded 2024-11-21 (142577.4 KB)
[FlatFileParser] ✅ Inserted 786 bars
...

[WatchlistBackfill] Cycle #1 complete:
  Symbols checked: 8
  Symbols backfilled: 2
  Rows inserted: 1,572
```

### Check Database

```sql
-- See which symbols have data
SELECT
  symbol,
  COUNT(*) as bars,
  MIN(TO_TIMESTAMP(timestamp / 1000)) as earliest,
  MAX(TO_TIMESTAMP(timestamp / 1000)) as latest
FROM historical_bars
WHERE timeframe = '1m'
GROUP BY symbol
ORDER BY symbol;

-- Check storage usage
SELECT
  pg_size_pretty(pg_total_relation_size('historical_bars')) as total_size,
  COUNT(*) as total_bars,
  COUNT(DISTINCT symbol) as unique_symbols
FROM historical_bars;
```

---

## ✅ Benefits

### Before (Manual)

```bash
# Every time you add a new ticker:
pnpm backfill:hybrid -- --symbols=NEW_TICKER --days=90

# Problems:
❌ Easy to forget
❌ Requires manual intervention
❌ Inconsistent (some users backfill, others don't)
❌ No automatic cleanup (database grows forever)
```

### After (Automatic)

```bash
# Just add ticker to watchlist (UI or API)
✓ Done!

# Benefits:
✅ Automatic backfill (no manual work)
✅ Works for all users
✅ Never forget to backfill
✅ Automatic cleanup (keeps database healthy)
✅ Smart skipping (no duplicate work)
```

---

## 🎯 Next Steps

### 1. Deploy to Railway

**Create Worker Service**:

1. Railway Dashboard → New Service
2. Name: "Watchlist Worker"
3. Build Command: `pnpm build`
4. Start Command: `pnpm start:watchlist`
5. Environment Variables: Copy from main app
6. Deploy!

### 2. Test It Works

```bash
# Add a test symbol to watchlist
# (via your app UI)

# Wait 1 hour (or check Railway logs immediately)

# Verify in Supabase
SELECT * FROM historical_bars WHERE symbol = 'YOUR_TEST_SYMBOL';

# Should see ~35,000 bars (90 days × 390 bars/day)
```

### 3. Monitor for a Week

- Check Railway logs daily
- Verify new symbols get backfilled
- Watch storage usage (should stay under limits)

---

## 📚 Documentation

- **Full Guide**: [docs/WATCHLIST_AUTO_BACKFILL.md](docs/WATCHLIST_AUTO_BACKFILL.md)
- **Management Strategy**: [docs/BACKFILL_MANAGEMENT_STRATEGY.md](docs/BACKFILL_MANAGEMENT_STRATEGY.md)
- **Verification**: [docs/VERIFY_BACKFILL.md](docs/VERIFY_BACKFILL.md)

---

## 🎉 Summary

**You now have**:

- ✅ Automatic watchlist monitoring
- ✅ Automatic data backfill
- ✅ Automatic cleanup
- ✅ Multi-user support
- ✅ Production-ready worker

**No more manual backfills!** Just add tickers to your watchlist and the system handles the rest. 🚀
