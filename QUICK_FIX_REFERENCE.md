# Quick Fix Reference

## 🚀 What to Run

### 1. SQL Fix (Run in Supabase SQL Editor)

```bash
# File: scripts/fix_rls_policies.sql
# Copy entire contents and execute in: https://app.supabase.com → SQL Editor
```

### 2. Deploy Code Changes

```bash
git add server/workers/ingestion/greeksIngestion.ts server/ws/hub.ts scripts/
git commit -m "fix: RLS policies, index Greeks extraction, WS debugging"
git push origin main

# Railway will auto-deploy, or:
railway up
```

### 3. Monitor Logs

```bash
railway logs --follow

# Look for these success indicators:
# ✅ Extracted underlying price for SPX: $...
# ✅ Greeks ingested for SPX: 250 contracts
# ✅ Authentication successful!
```

---

## 🔍 What Was Fixed

### Issue #1: SQL Syntax Error ✅

- **File:** `scripts/fix_rls_policies.sql` (new)
- **Problem:** `FOR INSERT USING (...)` → PostgreSQL rejects this
- **Solution:** Changed to `FOR INSERT WITH CHECK (...)`
- **Impact:** Allows worker to write to 6 analytical tables

### Issue #2: Index Greeks Failing ✅

- **File:** `server/workers/ingestion/greeksIngestion.ts`
- **Problem:** Checked `chain.underlying_price` (doesn't exist)
- **Solution:** Removed that check, prioritized `underlying_asset.price`
- **Impact:** SPX/NDX Greeks should now ingest (9/9 success)

### Issue #3: WebSocket 1008 🔍

- **File:** `server/ws/hub.ts`
- **Problem:** Code 1008 = Policy Violation (upstream rejects)
- **Solution:** Added detailed diagnostic logging
- **Impact:** Logs will show why Massive rejects auth

---

## 🎯 Expected Results

### After SQL Fix

```sql
-- Query to verify (included in fix script):
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'historical_greeks';

-- Should show:
-- | Allow public read access | SELECT
-- | Allow service role write | INSERT ← This is the fix
```

### After Code Deploy

```
[v0] ✅ Extracted underlying price for SPX: $5890.75
✅ Greeks ingested for SPX: 250 contracts processed, 250 stored

[v0] ✅ Extracted underlying price for NDX: $21234.50
✅ Greeks ingested for NDX: 250 contracts processed, 250 stored

[WS options] Upstream connected, sending auth...
[WS options] ✅ Authentication successful!  ← If this appears, 1008 is fixed
```

### If WebSocket Still Shows 1008

Check the new error message for diagnosis:

```
[WS options] ❌ Code 1008 = Policy Violation. Possible causes:
  1. Invalid API key format or expired key
  2. Insufficient permissions (need OPTIONS ADVANCED tier)
  ...
  Current API key: X1yfaGtpB0ga...
  Authenticated before close: false  ← Key indicator
```

**If `Authenticated before close: false`** → API key issue

- Check https://massive.com/dashboard/keys
- Verify tier shows OPTIONS ADVANCED + INDICES ADVANCED
- Try regenerating key

**If `Authenticated before close: true`** → Protocol issue

- Contact Massive support (auth worked, then rejected)

---

## 📊 Success Metrics

| Metric              | Before                   | After (Expected)         |
| ------------------- | ------------------------ | ------------------------ |
| Greeks Success Rate | 7/9 (78%)                | 9/9 (100%)               |
| SPX Greeks          | ❌ "No underlying price" | ✅ 250 contracts         |
| NDX Greeks          | ❌ "No underlying price" | ✅ 250 contracts         |
| RLS Policies        | ❌ SQL error             | ✅ Created successfully  |
| WebSocket Auth      | ❌ 1008 (unknown cause)  | 🔍 Diagnostic logs added |

---

## 🆘 Troubleshooting

### If Greeks Still Fail

Check logs for the new debug output:

```
[v0] Could not extract underlying price for SPX. First contract underlying_asset:
{
  "price": 5890.75,          ← If this exists, fix worked
  "last_updated_price": ...,
  ...
}
```

If object is `null` or missing `price` field → Massive API issue, try Option C:

```typescript
// In greeksIngestion.ts, add at top of function:
if (["SPX", "NDX"].includes(symbol)) {
  console.log(`[v0] ⏭️ Skipping Greeks for index ${symbol}`);
  return { success: true, symbol, contractsProcessed: 0 };
}
```

### If 429 Errors Increase

**This is normal during high-volume periods.** The retry logic handles it automatically.

---

## ⏱️ Timeline

1. **SQL Fix:** 2 minutes (copy/paste to Supabase)
2. **Code Deploy:** 5-10 minutes (git push + Railway deploy)
3. **Verification:** 15 minutes (wait for next worker cycle)

**Total:** ~20-30 minutes

---

## 📁 Files Modified

```
scripts/fix_rls_policies.sql                       NEW - Run in Supabase
server/workers/ingestion/greeksIngestion.ts        MODIFIED - Lines 66-88
server/ws/hub.ts                                   MODIFIED - Lines 60-125
FIXES_APPLIED.md                                   NEW - Full documentation
QUICK_FIX_REFERENCE.md                             NEW - This file
```

---

## 🔗 Links

- **Full Documentation:** `FIXES_APPLIED.md`
- **Supabase Dashboard:** https://app.supabase.com
- **Railway Dashboard:** https://railway.app
- **Massive API Status:** https://massive.com/system
- **Massive Support:** https://massive.com/contact

---

## ✅ Completion Checklist

- [ ] Executed `scripts/fix_rls_policies.sql` in Supabase
- [ ] Verified SQL ran without errors
- [ ] Committed changes to git
- [ ] Pushed to `main` branch
- [ ] Confirmed Railway deployed successfully
- [ ] Waited for next worker cycle (15 min)
- [ ] Checked logs for SPX/NDX success messages
- [ ] Verified `historical_greeks` table has new records
- [ ] Noted WebSocket auth status (success or diagnostic info)

---

**Need Help?** See `FIXES_APPLIED.md` for detailed explanations and debugging steps.
