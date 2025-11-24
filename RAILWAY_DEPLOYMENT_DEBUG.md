# Railway Deployment Debug Guide

## Problem
Railway logs show error: `column watchlist.ticker does not exist`

But our code (commit 35f8773) uses `.select("symbol")` - so Railway is running **OLD CODE**.

---

## Step 1: Check Database Schema

**In Supabase SQL Editor**, run:

```sql
-- Check if column is named 'ticker' or 'symbol'
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'watchlist' AND column_name = 'ticker'
) as has_ticker_column,
EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'watchlist' AND column_name = 'symbol'
) as has_symbol_column;
```

**Expected Result:**
```
has_ticker_column: false
has_symbol_column: true
```

**If you see `has_ticker_column: true`**, run this to fix:

```sql
ALTER TABLE watchlist RENAME COLUMN ticker TO symbol;
```

---

## Step 2: Verify Railway Deployment

### Check Which Commit Railway is Running

1. Go to **Railway Dashboard** → Your Project
2. Click on **Main App Service** (not worker)
3. Click **Deployments** tab
4. Look at the **Active** deployment (green checkmark)
5. Check the **Commit SHA** - should be `35f8773`

### If Railway Shows OLD Commit (Not 35f8773)

**Option A: Wait for Auto-Deploy**
- Railway auto-deploys on git push
- May take 2-5 minutes
- Check deployments tab for new deployment

**Option B: Force Redeploy** (Recommended)
1. Railway Dashboard → Deployments
2. Find deployment with commit `35f8773`
3. Click **3-dot menu** → **Redeploy**
4. Wait 2-3 minutes for deployment to complete

**Option C: Trigger New Deployment via Git**
```bash
git commit --allow-empty -m "chore: Force Railway redeploy"
git push -u origin claude/radar-weekend-aftermarket-01LzspTtoomRtGB9mLZ7SHjn
```

---

## Step 3: Verify Fix in Railway Logs

After redeployment, Railway logs should show:

**✅ SUCCESS:**
```
[Composite Scanner] ====== Starting scan at 2025-11-24T...
[Composite Scanner] Scanning 1 users
[Watchlist] Fetched 5 symbols: SPY, SPX, NDX, QQQ, IWM  ← No errors!
[FEATURES] SPX: { hasPattern: true, rsi: { '14': 37.4 } }
[SCAN] SPX: { filtered: false, hasSignal: true }
🎯 NEW SIGNAL SAVED: SPX mean_reversion_long (Score: 72/100)
```

**❌ STILL BROKEN:**
```
[Composite Scanner] Error fetching watchlist for user xxx: {
  code: '42703',
  message: 'column watchlist.ticker does not exist'  ← Old code still running
}
```

---

## Step 4: Check Environment Variables

In Railway → Variables tab, verify these are set:

```bash
ALLOW_WEEKEND_SIGNALS=true        # ← CRITICAL for weekend signals
MASSIVE_API_KEY=<your-key>
SUPABASE_SERVICE_ROLE_KEY=<your-key>
NODE_ENV=production
```

If `ALLOW_WEEKEND_SIGNALS` is missing:
1. Add it: `ALLOW_WEEKEND_SIGNALS=true`
2. Railway will auto-redeploy
3. Wait 2-3 minutes

---

## Step 5: Worker Service (Separate Deployment)

If **Worker Service** also shows `ticker` errors:

1. Railway Dashboard → **Worker Service**
2. Deployments → Find commit `35f8773`
3. Click **Redeploy**

---

## Common Issues

### Issue: Railway Not Auto-Deploying

**Cause**: Railway may not be watching this branch

**Fix**:
1. Railway Dashboard → Settings
2. Check **GitHub Repo** settings
3. Verify branch: `claude/radar-weekend-aftermarket-01LzspTtoomRtGB9mLZ7SHjn`
4. Or merge to `main` branch

### Issue: Database Has Both `ticker` AND `symbol` Columns

**Cause**: Migration created new column without dropping old one

**Fix**:
```sql
-- Only run if you have BOTH columns
ALTER TABLE watchlist DROP COLUMN ticker;
```

### Issue: Railway Shows "Deployment Failed"

**Check Build Logs**:
1. Railway → Deployments → Failed deployment
2. Click to expand logs
3. Look for TypeScript or build errors
4. Share logs for help

---

## Quick Checklist

- [ ] Database column is named `symbol` (not `ticker`)
- [ ] Railway is deploying commit `35f8773` or later
- [ ] Environment variable `ALLOW_WEEKEND_SIGNALS=true` is set
- [ ] Railway logs show no more `ticker` column errors
- [ ] Scanner generates signals (check logs for "NEW SIGNAL SAVED")
- [ ] Worker service also redeployed (if running separately)

---

## Still Not Working?

Run this diagnostic and share the output:

```bash
# Check local code
grep -n "\.select.*symbol" server/workers/compositeScanner.ts

# Check git status
git log --oneline -3
git status

# Should show:
# Line 446: .select("symbol")
# Latest commit: 35f8773
# Working tree clean
```

Then check Railway:
- Screenshot of Deployments page showing active deployment commit
- Screenshot of Environment Variables page
- Copy/paste latest Railway logs (last 50 lines)
