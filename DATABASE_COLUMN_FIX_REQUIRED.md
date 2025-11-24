# 🚨 DATABASE MIGRATION REQUIRED: watchlist.ticker → watchlist.symbol

## Problem Identified

The Railway logs show our **NEW CODE is deployed correctly** (we see the debug log), but the database still has the old column name:

```
[Composite Scanner] DEBUG: Querying watchlist with column='symbol' for user 2ec7...
[Composite Scanner] Error fetching watchlist: column watchlist.ticker does not exist
```

**This confirms**: The code is trying to query `symbol`, but the **database column is still named `ticker`**.

---

## Immediate Workaround (DEPLOYED)

**Commit**: `126c95d` - "fix: Add fallback to 'ticker' column with detailed logging"

The scanner now:
1. ✅ Tries `symbol` column first (correct)
2. ✅ If that fails, falls back to `ticker` column (temporary workaround)
3. ✅ Maps `ticker → symbol` for code compatibility
4. ✅ Logs clear instructions when fallback is used

**This will make signals work immediately** while clearly identifying the database issue.

---

## What Railway Logs Will Show (After Deploy)

### Success with Fallback:
```
[Composite Scanner] DEBUG: Querying watchlist with column='symbol' ...
[Composite Scanner] 'symbol' column not found, trying fallback to 'ticker' column...
[Composite Scanner] ✅ SUCCESS with 'ticker' column - DATABASE NEEDS MIGRATION!
[Composite Scanner] Run this SQL in Supabase: ALTER TABLE watchlist RENAME COLUMN ticker TO symbol;
[Composite Scanner] Scanning 5 symbols for user 2ec7...: SPY, SPX, NDX, QQQ, IWM
🎯 NEW SIGNAL SAVED: SPX mean_reversion_long (Score: 72/100)
```

**Signals will start generating!** ✅

---

## Permanent Fix Required

**You mentioned you already ran the column rename in Supabase**, but the error suggests it didn't work or wasn't applied.

### Step 1: Verify Current Schema

Run this in **Supabase SQL Editor**:

```sql
-- Check current column name
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'watchlist'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Expected output:**
```
column_name | data_type
--------------------------
id          | uuid
user_id     | uuid
symbol      | text        ← Should be 'symbol'
added_at    | timestamp
```

**If you see `ticker` instead of `symbol`:**
The rename didn't apply. Run the migration below.

---

### Step 2: Run Database Migration

**In Supabase SQL Editor**, run:

```sql
-- Rename the column
ALTER TABLE watchlist
RENAME COLUMN ticker TO symbol;

-- Verify the change
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'watchlist'
  AND column_name IN ('ticker', 'symbol');

-- Should return only 'symbol', not 'ticker'
```

---

### Step 3: Verify in Supabase Table Editor

1. Go to **Supabase Dashboard**
2. Click **Table Editor**
3. Select **watchlist** table
4. Check column headers - should show **`symbol`**, not `ticker`

---

### Step 4: Clear Supabase Schema Cache (If Needed)

If the column rename was already done but error persists:

**PostgREST (Supabase API layer) caches table schemas.**

**Option A: Wait for Cache to Expire**
- PostgREST schema cache expires after ~10 minutes
- Wait 10 minutes, then redeploy Railway

**Option B: Force Schema Reload (Supabase Dashboard)**
1. Supabase Dashboard → **Settings**
2. **API** section
3. Click **Reload schema cache** (if available)

**Option C: Restart Supabase Instance** (Nuclear option)
- This forces a complete schema reload
- Only if cache won't clear otherwise

---

## Why This Happened

The database column was created as `ticker` in the original schema, but our code evolution moved to using `symbol` for consistency across the codebase.

**Timeline:**
1. Original schema: `watchlist.ticker`
2. Code updated to use: `watchlist.symbol`
3. Database migration script created: `scripts/fix_watchlist_column.sql`
4. Migration needed to be run: `ALTER TABLE watchlist RENAME COLUMN ticker TO symbol`
5. **But migration wasn't applied or didn't take effect**

---

## Verification After Fix

Once the database column is correctly renamed to `symbol`, Railway logs should show:

```
[Composite Scanner] DEBUG: Querying watchlist with column='symbol' ...
[Composite Scanner] Scanning 5 symbols for user 2ec7...: SPY, SPX, NDX, QQQ, IWM
🎯 NEW SIGNAL SAVED: SPX mean_reversion_long (Score: 72/100)
```

**No fallback warnings!** ✅

---

## Status

- ✅ Code is correct (queries `symbol`)
- ✅ Fallback deployed (will work with `ticker` temporarily)
- ⏳ Database migration needed (rename `ticker` → `symbol`)
- ⏳ Waiting for you to run SQL migration in Supabase

---

## Summary

**The scanner will work NOW with the fallback**, but you should still run the database migration to use the correct column name going forward.

**Run this SQL in Supabase:**
```sql
ALTER TABLE watchlist RENAME COLUMN ticker TO symbol;
```

Then redeploy Railway or wait for schema cache to expire (~10 min).
