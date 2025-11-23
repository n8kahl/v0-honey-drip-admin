# Database Migration Guide: Phase 4 Risk Management Fields

**Date**: November 22, 2025
**Status**: Ready for Deployment
**Priority**: CRITICAL - Required for Trade Persistence System Phase 4

---

## Overview

This migration adds missing database columns and constraint updates required for the Trade Persistence System Phase 4 implementation. Without these changes, the API endpoints in `server/routes/trades.ts` will fail when attempting to store trade risk management data.

---

## Required Changes

### 1. New Columns in `trades` Table

| Column          | Type    | Purpose                  | Example |
| --------------- | ------- | ------------------------ | ------- |
| `target_price`  | numeric | Target exit price        | 155.50  |
| `stop_loss`     | numeric | Stop loss price          | 148.25  |
| `current_price` | numeric | Current underlying price | 152.75  |
| `move_percent`  | numeric | % move from entry        | 2.5     |

### 2. Expanded `trade_updates.action` Constraint

**Old** (4 actions):

- entry, trim, add, exit, stop_update

**New** (8 actions):

- entry, trim, add, exit, stop_update, update-sl, trail-stop, tp_near

### 3. Performance Indexes

Three new indexes on `trades` table:

- `idx_trades_target_price` (on `target_price`)
- `idx_trades_stop_loss` (on `stop_loss`)
- `idx_trades_current_price` (on `current_price`)

---

## Deployment Steps

### Step 1: Access Supabase SQL Editor

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**

### Step 2: Run the Migration

Copy the entire contents of `scripts/009_add_risk_management_fields.sql` and paste into the SQL Editor:

```bash
# To view the migration file:
cat scripts/009_add_risk_management_fields.sql
```

Then execute (click **Run** or Ctrl+Enter).

### Step 3: Verify Changes

Run verification queries:

```sql
-- Check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trades'
AND column_name IN ('target_price', 'stop_loss', 'current_price', 'move_percent');

-- Check action constraint was updated
SELECT constraint_name, check_clause
FROM information_schema_check_constraints
WHERE constraint_name = 'trade_updates_action_check';

-- Check indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'trades'
AND indexname LIKE 'idx_trades_%price';
```

**Expected Results**:

- ✅ 4 new columns visible with `numeric` type
- ✅ Updated action constraint with 8 allowed values
- ✅ 3 new indexes created

---

## API Endpoints That Require This Migration

### POST /api/trades (Create Trade)

**Now Supports**:

- `target_price`: Trade target price
- `stop_loss`: Trade stop loss
- `entry_time`: Entry timestamp

### PATCH /api/trades/:tradeId (Update Trade)

**Now Supports**:

- `target_price`: Update target
- `stop_loss`: Update stop loss
- `current_price`: Track current price
- `move_percent`: Track move %
- `exit_price`: Track exit
- `exit_time`: Track exit time

### POST /api/trades/:tradeId/updates (Record Action)

**New Actions Supported**:

- `update-sl`: Stop loss update
- `trail-stop`: Trailing stop adjustment
- `tp_near`: Target price near event

---

## Safety Considerations

### ✅ Safe Operations

- Using `IF NOT EXISTS` clauses (idempotent)
- No data loss (only adding columns)
- Backward compatible (new columns are nullable)
- Constraints use `IF NOT EXISTS` (safe if re-run)

### ⚠️ Production Checklist

- [ ] Backup database before migration
- [ ] Run migration in staging environment first
- [ ] Verify all 3 checks pass (Step 3)
- [ ] Test API endpoints with sample data
- [ ] Monitor error logs after deployment
- [ ] Redeploy backend after migration

---

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove new columns (WARNING: This loses data!)
ALTER TABLE public.trades
DROP COLUMN IF EXISTS target_price CASCADE,
DROP COLUMN IF EXISTS stop_loss CASCADE,
DROP COLUMN IF EXISTS current_price CASCADE,
DROP COLUMN IF EXISTS move_percent CASCADE;

-- Revert action constraint
ALTER TABLE public.trade_updates
DROP CONSTRAINT IF EXISTS trade_updates_action_check;

ALTER TABLE public.trade_updates
ADD CONSTRAINT trade_updates_action_check
CHECK (action = ANY (ARRAY['entry'::text, 'trim'::text, 'add'::text, 'exit'::text, 'stop_update'::text]));

-- Drop performance indexes
DROP INDEX IF EXISTS idx_trades_target_price;
DROP INDEX IF EXISTS idx_trades_stop_loss;
DROP INDEX IF EXISTS idx_trades_current_price;
```

---

## Deployment Timeline

| Phase                     | Status      | Timeline                  |
| ------------------------- | ----------- | ------------------------- |
| **Code Fix**              | ✅ Complete | Completed Nov 22          |
| **Migration Created**     | ✅ Complete | Completed Nov 22          |
| **Database Migration**    | ⏳ Pending  | Deploy at your discretion |
| **API Testing**           | ⏳ Pending  | After migration           |
| **Production Deployment** | ⏳ Pending  | After testing             |

---

## Support

### If Migration Fails

1. **Check error message** - Supabase will show specific SQL error
2. **Verify Supabase connection** - Ensure service role key is valid
3. **Check constraints** - Ensure no existing constraint conflicts
4. **Review logs** - Check Supabase dashboard logs for details

### Common Issues

| Issue                       | Solution                                    |
| --------------------------- | ------------------------------------------- |
| "Constraint already exists" | Safe - migration uses `IF NOT EXISTS`       |
| "Column already exists"     | Safe - migration uses `IF NOT EXISTS`       |
| "Foreign key violation"     | Verify trades table references are valid    |
| "Permission denied"         | Ensure using service role key, not anon key |

---

## Next Steps

1. **Deploy migration** to Supabase (Steps 1-3 above)
2. **Verify** the changes applied successfully
3. **Test API endpoints** with curl or Postman
4. **Monitor logs** for any errors
5. **Deploy updated backend** to production

---

## Files Related to This Migration

| File                                         | Purpose                          |
| -------------------------------------------- | -------------------------------- |
| `scripts/009_add_risk_management_fields.sql` | Migration SQL                    |
| `server/routes/trades.ts`                    | API endpoints using new columns  |
| `src/lib/api/tradeApi.ts`                    | API client methods               |
| `src/hooks/useTradeStateMachine.ts`          | State machine using these fields |

---

**Questions?** Check the CLAUDE.md file for more context about the Trade Persistence System architecture.
