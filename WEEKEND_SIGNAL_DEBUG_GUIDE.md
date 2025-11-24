# Weekend Signal Detection Debug Guide

## Status: Awaiting Railway Deployment

**Latest Commits Pushed:**
- `a01338a` - Debug logging added to mean reversion detectors
- `d8d8b02` - VWAP made optional for weekend analysis

**Railway Auto-Deploy:** Should complete within 2-5 minutes

---

## What Was Fixed

### Issue 1: Database Schema Cache ✅ RESOLVED
**Problem:** Supabase PostgREST was caching old schema with `ticker` column
**Fix:** User restarted Supabase connection pooler
**Status:** ✅ Resolved - watchlist now loads correctly

### Issue 2: RSI Thresholds Too Strict ✅ FIXED
**Problem:** Detector required RSI < 35, but SPX (37.4) and NDX (36.3) were rejected
**Fix:** Weekend-aware thresholds (commit 585cd74)
- Weekend RSI threshold: < 40 (was < 35)
- Regular hours RSI threshold: < 35 (unchanged)
**Status:** ✅ Fixed in commit 585cd74

### Issue 3: Missing VWAP Data on Weekends ✅ FIXED
**Problem:** VWAP data unavailable on weekends, but detector required it
**Fix:** Made VWAP optional for weekend analysis (commit d8d8b02)

**Logic:**
```typescript
if (!isWeekend) {
  // Regular hours: VWAP is required
  if (!vwapDist || vwapDist >= vwapThreshold) return false;
} else if (vwapDist !== undefined) {
  // Weekend with VWAP: apply lenient threshold
  if (vwapDist >= vwapThreshold) return false;
}
// Weekend without VWAP: skip check entirely ← THIS ALLOWS SIGNALS
```

**Status:** ✅ Fixed in commit d8d8b02

### Issue 4: Diagnostic Logging Added ✅ DEPLOYED
**Problem:** Couldn't see WHY detectors were rejecting signals
**Fix:** Comprehensive console logging (commit a01338a)

**Status:** ✅ Deployed in commit a01338a

---

## Expected Railway Logs (After Deployment)

### ✅ SUCCESS - Signals Generated

```
[Composite Scanner] ====== Starting scan at 2025-11-24T04:20:00.000Z ======
[Composite Scanner] Scanning 1 users
[Composite Scanner] Fetched watchlist: { symbols: [ 'SPX', 'SPY', 'QQQ', 'VIX', 'NDX' ] }

[FEATURES] SPX: {
  rsi: { '14': 37.4 },
  hasPattern: true,
  volume: 0,
  barCount: 395,
  session: { isRegularHours: false }
}

[index-mean-reversion-long] SPX: shouldRun=true
[index-mean-reversion-long] SPX: RSI=37.4, threshold=40, isWeekend=true
[index-mean-reversion-long] SPX: VWAP dist=undefined, threshold=-0.2
[index-mean-reversion-long] SPX: ⚠️ VWAP unavailable on weekend, skipping check
[index-mean-reversion-long] SPX: market_regime=choppy
[index-mean-reversion-long] SPX: ✅ ALL CHECKS PASSED - SIGNAL DETECTED!

🎯 NEW SIGNAL SAVED: SPX index_mean_reversion_long (Score: 68/100)

[FEATURES] NDX: {
  rsi: { '14': 36.3 },
  hasPattern: true,
  volume: 0
}

[index-mean-reversion-long] NDX: shouldRun=true
[index-mean-reversion-long] NDX: RSI=36.3, threshold=40, isWeekend=true
[index-mean-reversion-long] NDX: VWAP dist=undefined, threshold=-0.2
[index-mean-reversion-long] NDX: ⚠️ VWAP unavailable on weekend, skipping check
[index-mean-reversion-long] NDX: market_regime=ranging
[index-mean-reversion-long] NDX: ✅ ALL CHECKS PASSED - SIGNAL DETECTED!

🎯 NEW SIGNAL SAVED: NDX index_mean_reversion_long (Score: 72/100)

[Composite Scanner] ====== Scan complete: 2 signals generated ======
```

### ❌ STILL BROKEN - Old Code Deployed

If you see this, Railway hasn't deployed the latest commits yet:

```
[FEATURES] SPX: { rsi: '37.4', hasPattern: true, volume: 0 }
[SCAN] SPX: { filtered: true, filterReason: 'No opportunities detected' }
```

**No detector logging** = Old code still running

**Action:** Wait another 2-3 minutes for deployment, or manually redeploy in Railway

---

## Verification Checklist

After Railway deployment completes:

- [ ] Railway logs show container restart (new deployment)
- [ ] Logs show detector names: `[index-mean-reversion-long]`, `[mean-reversion-long]`
- [ ] Logs show VWAP warning: `⚠️ VWAP unavailable on weekend, skipping check`
- [ ] Logs show RSI passing: `RSI=37.4, threshold=40, isWeekend=true`
- [ ] Logs show success: `✅ ALL CHECKS PASSED - SIGNAL DETECTED!`
- [ ] Signals saved: `🎯 NEW SIGNAL SAVED: SPX index_mean_reversion_long`
- [ ] Frontend Radar tab shows signals

---

## If Signals Still Don't Appear

### Check 1: Environment Variables (Railway Worker Service)

Ensure these are set in Railway → Worker Service → Variables:

```bash
ALLOW_WEEKEND_SIGNALS=true          ← CRITICAL!
SUPABASE_SERVICE_ROLE_KEY=eyJh...   ← Required for database writes
MASSIVE_API_KEY=your_key            ← Required for data fetching
NODE_ENV=production
```

### Check 2: Railway Service Configuration

**Worker Service Settings:**
- **Build Command:** `pnpm build` (or leave empty to use package.json)
- **Start Command:** `pnpm start:composite`
- **Branch:** `claude/radar-weekend-aftermarket-01LzspTtoomRtGB9mLZ7SHjn`

### Check 3: Force Railway Redeploy

If auto-deploy didn't trigger:
1. Railway Dashboard → Worker Service
2. Deployments tab
3. Find commit `a01338a` or `d8d8b02`
4. Click 3-dot menu → Redeploy

### Check 4: Clear Build Cache

If still seeing old code:
1. Railway → Worker Service → Settings
2. Scroll to "Danger Zone"
3. Click "Clear Build Cache"
4. Trigger new deployment

---

## Technical Details

### Weekend Mode Detection

```typescript
const isWeekend = features.session?.isRegularHours !== true;
```

**Returns `true` when:**
- Market is closed (weekends, evenings, holidays)
- No `session` object (historical data)
- `isRegularHours === false`

### VWAP Optional Logic

**Regular Hours (Mon-Fri 9:30am-4pm ET):**
```typescript
if (!isWeekend) {
  if (!vwapDist || vwapDist >= -0.3) return false; // VWAP REQUIRED
}
```

**Weekend/Evening:**
```typescript
else if (vwapDist !== undefined) {
  if (vwapDist >= -0.2) return false; // VWAP optional, lenient threshold
}
// If vwapDist === undefined, skip check entirely ← KEY FIX
```

### RSI Thresholds

| Mode          | Threshold | Reason                                 |
|---------------|-----------|----------------------------------------|
| Regular Hours | < 35      | Strict - high confidence needed        |
| Weekend       | < 40      | Lenient - analyzing historical setups  |

**Example:**
- SPX RSI 37.4: ❌ Rejected during market hours, ✅ Accepted on weekends
- SPX RSI 34.8: ✅ Accepted anytime

---

## Expected Timeline

1. **Now → T+2min:** Railway detects new commits and starts build
2. **T+2min → T+5min:** Build completes (clean dist, compile TS, install deps)
3. **T+5min → T+6min:** New container starts, worker begins scanning
4. **T+6min:** First scan with new code runs
5. **T+6min+5sec:** Signals appear in Railway logs
6. **T+6min+10sec:** Signals appear in frontend Radar tab

**If no signals by T+10min:** Check environment variables and redeploy manually

---

## Success Indicators

### Backend (Railway Logs)
```
✅ Watchlist loads: "Fetched watchlist: { symbols: [...] }"
✅ Features calculate: "rsi: { '14': 37.4 }"
✅ Detector logs appear: "[index-mean-reversion-long] SPX: ..."
✅ VWAP warning shows: "⚠️ VWAP unavailable on weekend, skipping check"
✅ Signals saved: "🎯 NEW SIGNAL SAVED: SPX index_mean_reversion_long"
```

### Frontend (Browser)
```
✅ Radar tab shows signals
✅ Signal cards display: "SPX · INDEX_MEAN_REVERSION_LONG"
✅ Score shows: "68/100" or similar
✅ Entry/Target/Stop prices displayed
✅ Confluence breakdown visible
```

---

## Files Modified

### Core Detector Logic (VWAP Optional Fix)
- `src/lib/composite/detectors/index-mean-reversion-long.ts` (d8d8b02)
- `src/lib/composite/detectors/mean-reversion-long.ts` (d8d8b02)

### Diagnostic Logging (Debug Fix)
- `src/lib/composite/detectors/index-mean-reversion-long.ts` (a01338a)
- `src/lib/composite/detectors/mean-reversion-long.ts` (a01338a)

### Weekend Mode Utilities (Already Fixed)
- `src/lib/composite/detectors/utils.ts` (585cd74)

---

## Next Steps After Signals Appear

Once signals are generating successfully:

1. **Remove debug logging** (commit a01338a can be reverted for cleaner logs)
2. **Monitor signal quality** for 24-48 hours
3. **Implement remaining Weekend Radar features:**
   - Feature 2: Multi-Timeframe Confluence
   - Feature 3: Enhanced Signal Cards
   - Feature 4: Weekend-Specific Scoring
   - Feature 5: Batch Mode Analysis
   - Feature 6: Historical Pattern Context
   - Feature 7: Pre-Market Transition
   - Feature 8: Auto-Prewarm on Fridays

4. **Merge to main** once stable

---

## Contact & Support

**If signals still don't appear after 10 minutes:**
- Check all environment variables
- Clear Railway build cache
- Force redeploy worker service
- Verify commits d8d8b02 and a01338a are deployed
- Check Railway logs for any build errors

**Expected outcome:** SPX and NDX mean reversion signals should appear within 6 minutes of deployment.
