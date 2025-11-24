# How to Verify Hybrid Backfill System

## Quick Verification Methods

### 1. Check Railway Deployment Status

**Railway Dashboard**:

1. Go to your Railway project
2. Check the **Deployments** tab
3. Look for the most recent deployment (should be triggered by commit `70a461ac`)
4. Status should show **Success** (green checkmark)
5. Click on the deployment to view build logs

**Expected Build Output**:

```
Building...
✓ TypeScript compilation successful
✓ Server build complete
Deploying...
✓ Deployment successful
```

### 2. Monitor Worker Logs in Railway

**For Ingestion Worker**:

1. Railway Dashboard → Select your worker service
2. Click **Logs** tab
3. Look for these messages:

```
[HybridBackfill] 🚀 Starting hybrid backfill...
[HybridBackfill] Symbols: SPX, NDX, VIX
[HybridBackfill] Lookback: 90 days

[FlatFileDownloader] 📥 Starting download...
[FlatFileDownloader] ⬇️  Downloading 2024-11-20...
[FlatFileDownloader] ✅ Downloaded 2024-11-20 (45123.2 KB)

[FlatFileParser] 📊 Starting parse...
[FlatFileParser] ✅ Inserted 10000 bars
[FlatFileParser] ✅ Parse Complete!
```

**If no logs appear**: The worker might not be configured to run automatically. See "Manual Trigger" section below.

### 3. Verify Data in Supabase

**Method A: Quick Check (SQL Editor)**

Run this in Supabase SQL Editor:

```sql
-- Check if any data exists
SELECT COUNT(*) as total_bars FROM historical_bars;

-- Check by symbol
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

-- Check recent insertions (last 5 minutes)
SELECT
  symbol,
  COUNT(*) as bars_inserted,
  MAX(created_at) as last_insert_time
FROM historical_bars
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY symbol;
```

**Expected Results**:

- If working: You'll see rows with symbols like SPX, NDX, VIX
- `bar_count` should be in the thousands (e.g., 6,241,600 for SPX over 90 days)
- `last_inserted` timestamp should be recent (within last hour)

**Method B: Detailed Check**

```sql
-- Check data completeness for a specific symbol
SELECT
  timeframe,
  COUNT(*) as bars,
  MIN(TO_TIMESTAMP(timestamp / 1000)) as start_date,
  MAX(TO_TIMESTAMP(timestamp / 1000)) as end_date
FROM historical_bars
WHERE symbol = 'SPX'
GROUP BY timeframe
ORDER BY timeframe;

-- Verify data quality (no null prices)
SELECT
  COUNT(*) as total_bars,
  SUM(CASE WHEN open IS NULL THEN 1 ELSE 0 END) as null_opens,
  SUM(CASE WHEN high IS NULL THEN 1 ELSE 0 END) as null_highs,
  SUM(CASE WHEN low IS NULL THEN 1 ELSE 0 END) as null_lows,
  SUM(CASE WHEN close IS NULL THEN 1 ELSE 0 END) as null_closes
FROM historical_bars;
```

### 4. Test Locally (If Railway Hasn't Triggered)

If you want to verify without waiting for Railway:

```bash
# Navigate to project directory
cd /Users/natekahl/Desktop/v0-honey-drip-admin

# Install dependencies (if needed)
pnpm install

# Test download only (1 day)
pnpm backfill:download -- --dataset=indices --startDate=2024-11-20 --endDate=2024-11-20

# Test full hybrid backfill (1 week)
pnpm backfill:hybrid -- --symbols=SPX,NDX --days=7
```

**Expected Terminal Output**:

```
[FlatFileDownloader] 📥 Starting download...
[FlatFileDownloader] Dataset: indices
[FlatFileDownloader] Date range: 2024-11-20 to 2024-11-20
[FlatFileDownloader] Dates to process: 1
[FlatFileDownloader] ⬇️  Downloading 2024-11-20...
[FlatFileDownloader] ✅ Downloaded 2024-11-20 (45123.2 KB)

[FlatFileDownloader] ✅ Download Complete!
==========================================
Dataset: indices
Files Downloaded: 1
Files Skipped: 0
Errors: 0
Duration: 15.3s
==========================================
```

## What If Nothing Is Running?

### Manual Trigger via Railway CLI

If the worker isn't configured to run automatically:

```bash
# Install Railway CLI (if not already)
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Manually trigger the ingestion worker
railway run pnpm backfill:hybrid -- --symbols=SPX,NDX,VIX --days=90
```

### Check Environment Variables

Verify these are set in Railway:

**Required for S3 Download**:

- `MASSIVE_AWS_ACCESS_KEY` - Your Massive.com S3 access key
- `MASSIVE_AWS_SECRET_KEY` - Your Massive.com S3 secret key
- `MASSIVE_S3_REGION` - Should be `us-east-1`

**Required for Database Insert**:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (not anon key)

**Check in Railway**:

1. Project → Settings → Variables
2. Verify all above variables exist
3. If missing, add them and redeploy

## Success Indicators

✅ **System is working if**:

- Railway deployment shows "Success"
- Worker logs show download and parse messages
- Supabase query returns rows in `historical_bars`
- `created_at` timestamps are recent (last hour)
- No errors in Railway logs

❌ **System is NOT working if**:

- Railway deployment failed (red X)
- No logs in Railway worker
- Supabase query returns 0 rows
- Errors in Railway logs about missing env vars or S3 auth

## Common Issues

### Issue: "S3 client not configured"

**Cause**: Missing `MASSIVE_AWS_ACCESS_KEY` or `MASSIVE_AWS_SECRET_KEY`
**Fix**: Add environment variables in Railway

### Issue: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"

**Cause**: Missing database credentials
**Fix**: Add environment variables in Railway

### Issue: "NoSuchKey" errors in logs

**Cause**: Requesting data for non-trading days (weekends/holidays)
**Fix**: This is expected behavior - system skips these days automatically

### Issue: No logs at all

**Cause**: Worker might not be set to run automatically
**Fix**: Either:

1. Configure Railway worker to run on deploy
2. Use manual trigger via Railway CLI (see above)
3. Set up cron job in Railway

## Performance Benchmarks

**Expected Performance** (based on local testing):

- **Download**: ~136 MB in 15-20 seconds
- **Parse**: ~371,000 rows/second
- **Full 90-day backfill**: ~5-10 minutes for 3 symbols

If your results are significantly slower, check:

- Railway instance size (upgrade if on free tier)
- Network latency to Massive.com S3
- Supabase connection speed

## Next Steps After Verification

Once you've confirmed the system is working:

1. **Monitor Storage**: Check Supabase dashboard → Database → Usage
2. **Set Up Cleanup**: The migration includes a `cleanup_old_historical_bars()` function
3. **Schedule Regular Runs**: Consider daily cron job for new data
4. **Test Frontend**: Verify charts load faster with cached data

## Questions?

Check these files for implementation details:

- [FlatFileDownloader.ts](server/workers/flatFiles/FlatFileDownloader.ts)
- [FlatFileParser.ts](server/workers/flatFiles/FlatFileParser.ts)
- [HybridBackfillOrchestrator.ts](server/workers/flatFiles/HybridBackfillOrchestrator.ts)
- [Database Migration](scripts/012_add_historical_bars.sql)
