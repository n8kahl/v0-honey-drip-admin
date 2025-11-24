# Automatic Watchlist Backfill System

## 📋 Overview

The Watchlist Backfill Worker automatically monitors your watchlist and backfills historical data for any new symbols added by any user. It also automatically cleans up old data (>1 year) to keep your database healthy.

---

## 🎯 How It Works

### Automatic Detection & Backfill

```
User adds ticker to watchlist (e.g., "AAPL")
          ↓
Worker checks every hour
          ↓
Detects AAPL has no historical data
          ↓
Auto-triggers hybrid backfill (90 days)
          ↓
AAPL now has full historical data
```

### Features

1. **Hourly Checks**: Scans watchlist every hour for new symbols
2. **Smart Detection**: Only backfills symbols without existing data
3. **Auto Cleanup**: Deletes data >1 year old (daily at 2am)
4. **Multi-User**: Works across all users' watchlists
5. **Resource Efficient**: Skips symbols that already have data

---

## 🚀 Usage

### Development (Local)

```bash
# Start watchlist worker in watch mode
pnpm dev:watchlist
```

**Output**:

```
🚀 Starting Watchlist Backfill Worker
Environment: development
Check interval: 1 hour
Cleanup interval: Daily at 2am

[WatchlistBackfill] 🔄 Starting cycle #1...
[WatchlistBackfill] Found 5 symbols: SPX, NDX, VIX, SPY, QQQ
[WatchlistBackfill] Symbols with existing data: 3
[WatchlistBackfill] Symbols needing backfill: 2
[WatchlistBackfill] Symbols to backfill: SPY, QQQ

[HybridBackfill] 🚀 Starting hybrid backfill...
[FlatFileDownloader] ✅ Downloaded 2024-11-21 (142577.4 KB)
[FlatFileParser] ✅ Inserted 786 bars
...
```

### Production (Railway)

Deploy as a separate worker service:

**Railway Configuration**:

```json
{
  "build": "pnpm build",
  "start": "pnpm start:watchlist",
  "healthCheck": "ps aux | grep WatchlistBackfill"
}
```

### Manual Run (One-Time)

```bash
# Backfill all watchlist symbols (90 days)
pnpm backfill:watchlist

# Custom lookback period
pnpm backfill:watchlist -- --days=365

# Force re-backfill (even if data exists)
pnpm backfill:watchlist -- --force

# Limit to first N symbols
pnpm backfill:watchlist -- --limit=10
```

---

## ⚙️ Configuration

### Defaults

| Setting          | Value     | Description                 |
| ---------------- | --------- | --------------------------- |
| Check Interval   | 1 hour    | How often to scan watchlist |
| Lookback Period  | 90 days   | Historical data depth       |
| Cleanup Schedule | Daily 2am | When to delete old data     |
| Retention Period | 1 year    | Max data age before cleanup |

### Customizing Settings

Edit [WatchlistBackfill.ts](server/workers/flatFiles/WatchlistBackfill.ts):

```typescript
// Change check interval (default: 1 hour)
setInterval(runCycle, 60 * 60 * 1000); // Change to 30 min: 30 * 60 * 1000

// Change lookback period (default: 90 days)
const stats = await backfill.backfill({
  days: 365, // Change to 1 year
  force: false,
});

// Change cleanup time (default: 2am)
next2AM.setHours(4, 0, 0, 0); // Change to 4am
```

---

## 📊 Monitoring

### Check Worker Status

**Railway Dashboard**:

1. Go to your Railway project
2. Select "Watchlist Worker" service
3. Click **Logs** tab
4. Look for cycle completion messages:

```
[WatchlistBackfill] Cycle #5 complete:
  Symbols checked: 8
  Symbols backfilled: 2
  Rows inserted: 1,570
```

### Database Verification

Run this in Supabase SQL Editor:

```sql
-- Check which symbols have data
SELECT
  symbol,
  COUNT(*) as bars,
  MIN(TO_TIMESTAMP(timestamp / 1000)) as earliest,
  MAX(TO_TIMESTAMP(timestamp / 1000)) as latest
FROM historical_bars
WHERE timeframe = '1m'
GROUP BY symbol
ORDER BY symbol;

-- Check cleanup log (if enabled)
SELECT * FROM cleanup_logs ORDER BY run_at DESC LIMIT 10;
```

---

## 🔧 How It Handles Different Scenarios

### Scenario 1: New Symbol Added

```
1. User adds "TSLA" to watchlist
2. Next hour cycle runs
3. Worker detects TSLA not in historical_bars
4. Auto-backfills 90 days of TSLA data
5. Next cycle: TSLA skipped (already has data)
```

### Scenario 2: Symbol Already Has Data

```
1. User adds "SPX" to watchlist
2. Next hour cycle runs
3. Worker detects SPX already in historical_bars
4. Skips SPX (no duplicate work)
```

### Scenario 3: Multiple Users Add Same Symbol

```
1. User A adds "AAPL" to watchlist
2. User B adds "AAPL" to watchlist
3. Worker runs
4. Detects 1 unique symbol: AAPL
5. Backfills AAPL once (shared data for all users)
```

### Scenario 4: Old Data Cleanup

```
Every day at 2am:
1. Worker runs cleanup_old_historical_bars()
2. Deletes all bars with timestamp > 1 year old
3. Frees up database storage
4. Logs cleanup results
```

---

## 🎯 Best Practices

### For Production

1. **Monitor Logs**: Check Railway logs weekly for errors
2. **Watch Storage**: Run storage query monthly (see above)
3. **Adjust Interval**: If watchlist rarely changes, increase check interval to reduce overhead
4. **Resource Limits**: Set Railway worker to 512 MB RAM (enough for this task)

### For Development

1. **Test New Symbols**: Add a test symbol, wait for next cycle, verify backfill
2. **Force Mode**: Use `--force` to test without waiting for new symbols
3. **Local Testing**: Run `pnpm backfill:watchlist --days=1` for quick tests

---

## 🐛 Troubleshooting

### Worker Not Running

**Symptom**: No logs in Railway dashboard

**Solution**:

```bash
# Check if worker is running
railway ps

# If not running, restart
railway restart

# Check build logs
railway logs --build
```

### Symbols Not Backfilling

**Symptom**: New symbols added but no data

**Possible Causes**:

1. **Worker not deployed**: Deploy watchlist worker to Railway
2. **S3 credentials missing**: Check env vars in Railway
3. **Symbol not in watchlist**: Verify symbol was actually saved to DB
4. **Data already exists**: Worker skips symbols with existing data

**Debug**:

```bash
# Check if symbol is in watchlist
SELECT * FROM watchlist WHERE symbol = 'AAPL';

# Check if symbol has data
SELECT COUNT(*) FROM historical_bars WHERE symbol = 'AAPL';

# Manual trigger (bypasses hourly wait)
pnpm backfill:watchlist -- --symbols=AAPL --days=90
```

### Cleanup Not Running

**Symptom**: Old data (>1 year) still in database

**Solution**:

```sql
-- Manual cleanup
SELECT cleanup_old_historical_bars();

-- Verify it worked
SELECT
  MIN(TO_TIMESTAMP(timestamp / 1000)) as oldest_bar,
  MAX(TO_TIMESTAMP(timestamp / 1000)) as newest_bar
FROM historical_bars;
```

### Storage Growing Too Fast

**Symptom**: Database approaching 500 MB limit

**Solutions**:

1. **Reduce lookback period**:

   ```typescript
   // In WatchlistBackfill.ts
   days: 30, // Instead of 90
   ```

2. **Limit symbols**:

   ```typescript
   // Only backfill top 20 most-watched
   const watchlistSymbols = await this.getWatchlistSymbols(20);
   ```

3. **Manual cleanup**:

   ```sql
   -- Delete symbols you don't need
   DELETE FROM historical_bars WHERE symbol = 'UNWANTED';

   -- Reclaim space
   VACUUM FULL historical_bars;
   ```

---

## 📈 Performance Impact

### Resource Usage

| Resource     | Development              | Production                |
| ------------ | ------------------------ | ------------------------- |
| **CPU**      | ~5% during cycle         | ~10% during cycle         |
| **RAM**      | ~100 MB baseline         | ~200 MB during backfill   |
| **Network**  | ~50 KB/s during download | ~100 KB/s during download |
| **Database** | 1 query/hour             | 1 query/hour              |

### Timing

| Operation                           | Duration     |
| ----------------------------------- | ------------ |
| Watchlist check                     | <1 second    |
| Symbol backfill (1 symbol, 90 days) | ~30 seconds  |
| Full cycle (5 new symbols)          | ~2-3 minutes |
| Daily cleanup                       | ~5 seconds   |

---

## 🔄 Integration with Other Systems

### Works With

- ✅ **Hybrid Backfill System**: Uses same infrastructure
- ✅ **Composite Scanner**: Scans newly backfilled symbols
- ✅ **Backtest Engine**: Uses watchlist data for backtests
- ✅ **Weekend Pre-Warm**: Both systems work independently

### Deployment Setup

**Railway Services**:

1. Main App (port 8080)
2. Composite Scanner Worker
3. Historical Ingestion Worker
4. **Watchlist Worker** ← New!

---

## 📞 Support

**Questions?**

- Check [BACKFILL_MANAGEMENT_STRATEGY.md](BACKFILL_MANAGEMENT_STRATEGY.md)
- Check [HYBRID_BACKFILL_GUIDE.md](HYBRID_BACKFILL_GUIDE.md)

**Issues?**

- Check Railway logs first
- Verify S3 credentials
- Test manually: `pnpm backfill:watchlist`

---

**You now have fully automatic watchlist backfill! 🎉**
