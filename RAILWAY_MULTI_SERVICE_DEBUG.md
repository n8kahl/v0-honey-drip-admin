# Railway Multi-Service Deployment Debug

## Problem: "column watchlist.ticker does not exist" persists

The error is coming from the **Composite Scanner Worker**, which is a **SEPARATE Railway service** from the main web app.

---

## Railway Service Architecture

```
┌─────────────────────────────────┐
│  Service 1: Main App            │
│  - Runs: server/dist/server/index.js │
│  - Port: 8080                   │
│  - Build: pnpm build            │
│  - Start: pnpm start            │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Service 2: Worker              │  ← ERROR IS HERE
│  - Runs: server/dist/server/workers/compositeScanner.js │
│  - Build: pnpm build            │
│  - Start: pnpm start:composite  │
└─────────────────────────────────┘
```

**Key Issue**: These services deploy **independently** and might be on **different commits**!

---

## Diagnostic Steps

### Step 1: Check BOTH Services in Railway Dashboard

1. Go to Railway Dashboard
2. You should see **TWO services** (or two deployments)
3. Click on **WORKER SERVICE** (the one running composite scanner)
4. Go to **Deployments** tab
5. Check the **Commit SHA** of the Active deployment

**Expected**: Should show commit `0331b8f` or later
**If not**: Worker is deploying OLD code

### Step 2: Check Worker Service Build Command

In Railway → Worker Service → Settings:

**Build Command**: Should be `pnpm build` (or empty to use package.json)
**Start Command**: Should be `pnpm start:composite`

If different, the worker might not be running the clean:dist step!

### Step 3: Force Worker Redeploy

In Railway → Worker Service:
1. Go to Deployments
2. Find deployment with commit `0331b8f`
3. Click **3-dot menu** → **Redeploy**
4. Wait 2-3 minutes

### Step 4: Check Worker Service Environment Variables

Worker service needs:
```bash
ALLOW_WEEKEND_SIGNALS=true
SUPABASE_SERVICE_ROLE_KEY=<key>
MASSIVE_API_KEY=<key>
NODE_ENV=production
```

If these aren't set in the worker service, signals won't generate even if watchlist loads.

---

## Verification Commands

**After deployment, run these in Railway Worker service:**

### Option A: Check Logs
Look for:
```
✅ SUCCESS:
[Composite Scanner] Fetched 5 symbols: SPY, SPX, ...

❌ STILL BROKEN:
[Composite Scanner] Error fetching watchlist: column watchlist.ticker does not exist
```

### Option B: SSH into Worker (if Railway allows)
```bash
# Check compiled code
cat server/dist/server/workers/compositeScanner.js | grep "\.select" | head -5

# Should show: .select("symbol")
# NOT: .select("ticker")
```

---

## Common Issues

### Issue 1: Worker Deploying from Different Branch

**Symptom**: Main service updated, worker still broken

**Fix**:
1. Railway → Worker Service → Settings
2. Check **Source**
3. Ensure branch is: `claude/radar-weekend-aftermarket-01LzspTtoomRtGB9mLZ7SHjn`
4. Or merge to main and point both services to main

### Issue 2: Worker Not Running Prebuild Hook

**Symptom**: clean:dist doesn't run

**Fix**:
1. Railway → Worker Service → Settings
2. Set Build Command: `pnpm run clean:dist && pnpm build`
3. This forces the clean step

### Issue 3: Worker Using Old Cached Dist

**Symptom**: Even after redeploy, still sees ticker error

**Fix**:
1. Railway → Worker Service → Settings
2. Click **Clear Build Cache**
3. Trigger new deployment

### Issue 4: Separate Supabase Client in Worker

**Symptom**: Worker uses different Supabase client

**Check**: Ensure worker environment variables match main service

---

## Quick Fix Checklist

For the **WORKER SERVICE** (not main service):

- [ ] Check deployment is on commit `0331b8f` or later
- [ ] Verify branch matches main service
- [ ] Environment variable `ALLOW_WEEKEND_SIGNALS=true` is set
- [ ] Build command includes `pnpm build` (which runs clean:dist)
- [ ] Clear build cache
- [ ] Redeploy worker service
- [ ] Check logs for watchlist fetch success

---

## If Still Broken After All This

**There may be a Railway-specific issue.** Try:

1. **Delete and recreate worker service**:
   - Railway → Worker Service → Settings → Delete Service
   - Create new service from same repo
   - Set start command: `pnpm start:composite`
   - Deploy

2. **Merge to main branch**:
   ```bash
   git checkout main
   git merge claude/radar-weekend-aftermarket-01LzspTtoomRtGB9mLZ7SHjn
   git push origin main
   ```
   Then point Railway to main branch

3. **Add runtime verification**:
   Add this to compositeScanner.ts to verify at runtime:
   ```typescript
   console.log('[DEBUG] Query column:', 'symbol'); // Should log 'symbol'
   ```

---

## Expected Success Log

After successful worker deployment:

```
[Composite Scanner] ====== Starting scan at 2025-11-24T...
[Composite Scanner] Scanning 1 users
[Composite Scanner] Fetched watchlist: { symbols: [ 'SPY', 'SPX', 'NDX', 'QQQ', 'IWM' ] }
[FEATURES] SPX: { hasPattern: true, rsi: { '14': 37.4 } }
[shouldRunDetector] SPX: { regularHours: false, weekendMode: true, shouldRun: true }
[SCAN] SPX: { filtered: false, hasSignal: true }
🎯 NEW SIGNAL SAVED: SPX mean_reversion_long (Score: 72/100)
```

No more `ticker` column errors!
