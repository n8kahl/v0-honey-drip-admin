# Scheduled Optimizer - Weekly Automatic Parameter Tuning

## Overview

The Scheduled Optimizer automatically runs parameter optimization **every Sunday at 6pm ET** to keep trading strategies tuned for the upcoming week.

## Features

- ✅ **Automatic weekly optimization** - Runs every Sunday at 6pm Eastern Time
- ✅ **Watchlist integration** - Automatically uses all symbols from your watchlist
- ✅ **Discord notifications** - Sends results to your Discord channel
- ✅ **Smart duplicate prevention** - Won't run twice in the same week
- ✅ **Error recovery** - Continues running even if one optimization fails
- ✅ **Full genetic algorithm** - 20 population × 10 generations for best results

## How It Works

```
┌─────────────────────────────────────────────────────┐
│  Every Sunday at 6pm ET                             │
│     ↓                                                │
│  1. Fetch all symbols from watchlist                │
│  2. Load 90 days of 15m historical data            │
│  3. Test 17 detectors with genetic algorithm       │
│  4. Find parameters with 65%+ win rate             │
│  5. Save to config/optimized-params.json           │
│  6. Send Discord notification                       │
│     ↓                                                │
│  Scanner automatically uses new params              │
└─────────────────────────────────────────────────────┘
```

## Deployment on Railway

### Option 1: Separate Service (Recommended)

Deploy the scheduler as a **separate Railway service** so it runs independently:

1. **Create new service** in Railway dashboard
2. **Connect repository** (same repo as main app)
3. **Set start command:**
   ```bash
   pnpm start:optimizer-scheduler
   ```
4. **Add environment variables:**
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   MASSIVE_API_KEY=your_api_key
   ```
5. **Deploy** - Service will run 24/7 checking for Sunday 6pm

### Option 2: Combined Service

Run scheduler alongside the composite scanner in one service:

1. **Update start command** in Railway:
   ```bash
   concurrently "node server/dist/server/workers/compositeScanner.js" "node server/dist/server/workers/scheduledOptimizer.js"
   ```
2. Both scanner and scheduler run in same container

### Option 3: Railway Cron (Native Scheduling)

Railway supports cron jobs natively:

1. Create a new **cron service**
2. Set schedule: `0 18 * * 0` (6pm every Sunday, UTC adjusted)
3. Set command: `pnpm optimize`

**Note:** You'll need to manually adjust for ET timezone vs UTC.

## Local Development

### Run Scheduler Locally

```bash
# Start scheduler in dev mode (checks every 5 minutes)
pnpm optimize:scheduler

# Or run one-time optimization
pnpm optimize
```

### Test Sunday Trigger

To test without waiting for Sunday, temporarily modify the schedule in `scheduledOptimizer.ts`:

```typescript
const OPTIMIZATION_SCHEDULE = {
  dayOfWeek: new Date().getDay(), // Current day
  hour: new Date().getHours(), // Current hour
  minute: new Date().getMinutes(), // Current minute
  timezone: "America/New_York",
};
```

## Discord Notifications

The scheduler sends notifications to your first configured Discord webhook:

### Success Notification

```
✅ Weekly Optimization Complete

Win Rate: 67.3%
Profit Factor: 2.45
Total Trades: 156
Symbols Tested: SPX, NDX, SPY, QQQ, VIX

Next Optimization: Next Sunday at 6pm ET
```

### Failure Notification

```
❌ Optimization Failed

Error: Database connection timeout

Please check logs for details.
```

## Monitoring

### Check Scheduler Status

```bash
# On Railway, view service logs:
railway logs --service optimizer-scheduler

# Look for:
[Scheduler] ⏳ Waiting for next scheduled time...
[Scheduler] 🎯 Scheduled optimization time reached!
```

### Verify Last Run

Check `config/optimized-params.json`:

```json
{
  "parameters": { ... },
  "performance": {
    "winRate": 0.673,
    "profitFactor": 2.45
  },
  "timestamp": "2025-11-24T23:00:00.000Z"  // Last optimization time
}
```

## Troubleshooting

### Scheduler Not Running on Sunday

1. **Check timezone:**

   ```bash
   # Scheduler uses America/New_York timezone
   # Verify server time matches
   date
   TZ=America/New_York date
   ```

2. **Check logs for duplicate prevention:**

   ```
   [Scheduler] Already optimized 2.3 days ago, skipping
   ```

3. **Manual trigger:**
   ```bash
   # Force immediate run
   pnpm optimize
   ```

### Discord Notifications Not Sending

1. **Verify webhook exists in database:**

   ```sql
   SELECT * FROM discord_channels LIMIT 1;
   ```

2. **Check webhook URL is valid:**
   ```bash
   curl -X POST https://discord.com/api/webhooks/xxx/yyy \
     -H "Content-Type: application/json" \
     -d '{"content": "Test message"}'
   ```

### Optimization Fails with DNS Errors

If you see `EAI_AGAIN` or `ENOTFOUND` errors:

1. **Verify cross-fetch is installed:**

   ```bash
   pnpm add cross-fetch
   ```

2. **Check network connectivity:**
   ```bash
   curl https://api.massive.com/v2/snapshot/indices
   curl https://xxx.supabase.co
   ```

## Schedule Customization

To change the optimization schedule, edit `scheduledOptimizer.ts`:

```typescript
const OPTIMIZATION_SCHEDULE = {
  dayOfWeek: 0, // 0=Sunday, 1=Monday, etc.
  hour: 18, // 6pm ET
  minute: 0,
  timezone: "America/New_York",
};

// Check interval (how often to check if it's time)
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
```

### Examples

**Daily at midnight ET:**

```typescript
dayOfWeek: -1,  // -1 = every day
hour: 0,
minute: 0,
```

**Twice a week (Wed & Sun at 6pm):**
Deploy two scheduler instances with different configs:

- Instance 1: `dayOfWeek: 0` (Sunday)
- Instance 2: `dayOfWeek: 3` (Wednesday)

## Performance Impact

- **CPU:** High during optimization (10-15 min), idle otherwise
- **Memory:** ~512MB during optimization
- **Database:** Reads 90 days of historical data
- **API Calls:** Minimal (only if database fallback needed)
- **Cost:** ~$5/month on Railway (separate service)

## Best Practices

1. ✅ **Deploy as separate service** - Isolates optimizer from scanner
2. ✅ **Monitor Discord notifications** - Know when optimization completes
3. ✅ **Review parameters monthly** - Ensure they make sense for market conditions
4. ✅ **Keep 90 days of data** - More data = better optimization
5. ✅ **Test locally first** - Run `pnpm optimize` before deploying scheduler

## FAQ

**Q: What if optimization fails?**
A: Scheduler continues running and tries again next Sunday. Scanner uses last known good parameters.

**Q: Can I run optimization more frequently?**
A: Yes, but weekly is recommended to avoid overfitting to short-term noise.

**Q: Does scanner automatically restart?**
A: No, scanner needs manual restart to pick up new parameters. Or wait for next deploy/restart.

**Q: What if I add new symbols to watchlist?**
A: They're automatically included in next Sunday's optimization.

**Q: Can I skip a week?**
A: Yes, duplicate prevention ensures it won't run if already optimized within 6 days.

## Support

- Check Railway logs for errors
- Review Discord notifications for results
- Run `pnpm optimize` manually to test
- Open GitHub issue for bugs

---

**Last Updated:** November 25, 2025
**Version:** 1.0.0
