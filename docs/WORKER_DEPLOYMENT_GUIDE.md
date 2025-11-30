# Worker Deployment Guide

This guide explains how to deploy the strategy optimization and data ingestion workers to Railway.

## Overview

Your system needs 4 workers running alongside the main app:

| Worker                   | Purpose                         | Schedule         |
| ------------------------ | ------------------------------- | ---------------- |
| **Composite Scanner**    | Detect trading signals          | Every 60 seconds |
| **Historical Ingestion** | Greeks, gamma, IV data          | Every 15 minutes |
| **Scheduled Optimizer**  | Optimize strategy parameters    | Sundays 6pm ET   |
| **Watchlist Backfill**   | Auto-fetch data for new symbols | Every hour       |

## Step 1: Verify Database Migrations

Before deploying workers, ensure all tables exist in Supabase.

1. Open **Supabase Dashboard** > **SQL Editor**
2. Run the verification query from `scripts/verify-and-apply-migrations.sql`
3. If any tables are missing, uncomment and run the corresponding CREATE TABLE section

**Required tables:**

- `historical_bars` - Price data for backtesting
- `historical_greeks` - Greeks and IV time-series
- `historical_ingestion_queue` - Auto-backfill queue
- `composite_signals` - Signal storage

## Step 2: Deploy Workers to Railway

### Option A: Deploy as Separate Services (Recommended)

In your Railway project, create 4 additional services:

#### Service 1: Composite Scanner (Already exists?)

```
Name: composite-scanner
Start Command: node server/dist/server/workers/compositeScanner.js
```

#### Service 2: Historical Ingestion

```
Name: historical-ingestion
Start Command: node server/dist/server/workers/historicalDataIngestion.js
```

#### Service 3: Scheduled Optimizer

```
Name: scheduled-optimizer
Start Command: node server/dist/server/workers/scheduledOptimizer.js
```

#### Service 4: Watchlist Backfill

```
Name: watchlist-backfill
Start Command: node server/dist/server/workers/flatFiles/WatchlistBackfill.js --worker
```

### Environment Variables (Same for all workers)

Copy these from your main app service:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MASSIVE_API_KEY`
- `NODE_ENV=production`

### Option B: Combined Worker (Lower cost)

If you want to minimize Railway costs, you can run multiple workers in one service using the "full" start command:

```
Start Command: node server/dist/server/workers/compositeScanner.js & node server/dist/server/workers/historicalDataIngestion.js & wait
```

However, Option A is recommended for better isolation and monitoring.

## Step 3: Run Initial Optimization

After deploying, run the optimizer once to generate optimized parameters:

### Option 1: Via Railway Console

1. Go to your `scheduled-optimizer` service
2. Open the **Deploy** tab
3. Click **Trigger Deploy** (this will run the optimizer)

### Option 2: Run Locally (Faster for testing)

If you have the codebase locally with environment variables:

```bash
# Quick test (5-10 minutes)
pnpm optimize:quick

# Full optimization (20-30 minutes)
pnpm optimize
```

After completion, the optimizer saves results to `config/optimized-params.json`.

## Step 4: Verify Workers Are Running

### Check Historical Ingestion

After 15 minutes, verify data is being stored:

```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM historical_greeks;
SELECT COUNT(*) FROM gamma_exposure_snapshots;
```

### Check Optimization Results

After Sunday 6pm ET (or manual run):

```sql
-- Check the optimized-params.json in your repo
-- Or check Railway logs for the scheduled-optimizer service
```

### Check Watchlist Auto-Backfill

Add a new symbol to your watchlist, then check:

```sql
-- Should show your new symbol in queue
SELECT * FROM historical_ingestion_queue ORDER BY requested_at DESC LIMIT 5;
```

## Worker Commands Reference

| Command                   | Description                    |
| ------------------------- | ------------------------------ |
| `pnpm dev:composite`      | Run composite scanner (dev)    |
| `pnpm dev:ingestion`      | Run historical ingestion (dev) |
| `pnpm dev:watchlist`      | Run watchlist backfill (dev)   |
| `pnpm optimize:scheduler` | Run scheduled optimizer (dev)  |
| `pnpm optimize`           | Run full optimization manually |
| `pnpm optimize:quick`     | Run quick optimization (5 min) |
| `pnpm backfill:watchlist` | Backfill all watchlist symbols |

## Troubleshooting

### Workers not starting

1. Check Railway logs for errors
2. Verify environment variables are set
3. Ensure `pnpm build` completed successfully

### No data in historical_greeks

1. Check Massive.com API key is valid
2. Verify `OPTIONS ADVANCED` subscription is active
3. Check worker logs for errors

### Optimization failing

1. Ensure `historical_bars` has at least 30 days of data
2. Check Supabase connection
3. Run `pnpm backfill:watchlist` first to populate data

### Queue not processing

1. Verify `on_watchlist_insert` trigger exists
2. Check `historical_ingestion_queue` table exists
3. Ensure historical-ingestion worker is running

## Cost Estimates

Railway pricing (as of 2024):

- Each worker: ~$5/month (low memory usage)
- Total for 4 workers: ~$20/month
- Combined worker option: ~$7/month

Supabase:

- Free tier: 500 MB storage (may need Pro for Greeks data)
- Pro tier ($25/month): 8 GB storage (sufficient for 2+ years)

## Next Steps After Deployment

1. Monitor workers for 24 hours to ensure stability
2. Check Discord for any optimization notifications
3. Review `optimization-results-*.json` files for performance metrics
4. After 1 week, check signal win rates in `signal_performance` table
