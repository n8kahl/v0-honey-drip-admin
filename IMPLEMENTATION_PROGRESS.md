# Trade Persistence Implementation - Progress Document

## Status: Phase 4 In Progress (State Machine Wiring)

Last Updated: 2025-11-22 14:52 UTC

---

## ✅ Completed Phases

### Phase 1: Database Migration ✓

**File**: `scripts/008_add_trade_discord_channels.sql`
**Status**: Created and ready for deployment
**Changes**:

- Created `trades_discord_channels` junction table (many-to-many: trades ↔ discord_channels)
- Created `trades_challenges` junction table (many-to-many: trades ↔ challenges)
- Added RLS policies for both junction tables
- Added indexes on trade_id for query performance
- Created verification views for testing

**Deployment**: Run SQL in Supabase console before moving to Phase 5

---

### Phase 2: API Endpoints ✓

**File**: `server/routes/trades.ts` (NEW)
**Status**: Fully implemented with comprehensive error handling
**Endpoints Implemented**:

1. `POST /api/trades` - Create new trade
   - Input validation
   - Links Discord channels/challenges automatically
   - Returns DB trade with ID

2. `PATCH /api/trades/:tradeId` - Update trade fields
   - Supports: status, entry_price, entry_time, exit_price, exit_time, target_price, stop_loss, notes
   - Auto-updates `updated_at` timestamp
   - RLS enforcement

3. `DELETE /api/trades/:tradeId` - Delete trade (cascade deletes links)

4. `POST /api/trades/:tradeId/updates` - Create trade_update record
   - Supports all actions: entry, trim, add, exit, stop_update, update-sl, trail-stop, tp_near
   - Input validation

5. `POST /api/trades/:tradeId/channels/:channelId` - Link Discord channel
   - Idempotent (duplicate inserts ignored)

6. `DELETE /api/trades/:tradeId/channels/:channelId` - Unlink Discord channel

7. `POST /api/trades/:tradeId/challenges/:challengeId` - Link challenge
   - Idempotent

8. `DELETE /api/trades/:tradeId/challenges/:challengeId` - Unlink challenge

**Server Registration**: Updated `server/index.ts` to import and register trades router

---

### Phase 3: Trade Store Updates ✓

**File**: `src/stores/tradeStore.ts`
**Status**: Enhanced with new async methods
**New Methods Added**:

1. `addTradeUpdateToDb(userId, tradeId, update)` - Async: Persist trade_update to DB
   - Makes API call
   - Updates local state after success
   - Throws error on failure (caller handles retry)

2. `linkTradeToChannels(tradeId, channelIds)` - Async: Link multiple channels in parallel
   - Parallel API calls
   - Updates local state
   - Throws error on failure

3. `unlinkTradeFromChannel(tradeId, channelId)` - Async: Unlink single channel

4. `linkTradeToChallenges(tradeId, challengeIds)` - Async: Link multiple challenges

5. `unlinkTradeFromChallenge(tradeId, challengeId)` - Async: Unlink single challenge

**Error Handling**: All async methods throw errors for caller to handle (with retry toast)

---

## 🔧 In Progress: Phase 4

### State Machine Wiring (`src/hooks/useTradeStateMachine.ts`)

**Key Changes Needed**:

1. **handleContractSelect()**
   - Current: Creates trade in-memory only
   - Change: Call `tradeStore.createTrade(userId, tradeData)` after risk calculation
   - Await: DB trade creation before proceeding
   - Error: Show toast, don't open alert composer

2. **handleSendAlert()** - CRITICAL
   - Current: Updates local state only
   - Changes by alert type:

   **Case 'load'** (no entry yet):

   ```
   ├─ Optimistic: setActiveTrades([...prev, updatedTrade])
   ├─ API Calls:
   │  ├─ await tradeStore.linkTradeToChannels(tradeId, channelIds)
   │  └─ await tradeStore.linkTradeToChallenges(tradeId, challengeIds)
   ├─ Error: Rollback optimistic, show error toast with retry
   └─ Success: Show success toast + send Discord alert
   ```

   **Case 'enter'**:

   ```
   ├─ Recalculate TP/SL with entry price
   ├─ Optimistic: Update currentTrade in activeTrades
   ├─ API Calls (parallel):
   │  ├─ await tradeStore.updateTrade(tradeId, { status: 'entered', entry_price, entry_time, target_price, stop_loss })
   │  ├─ await tradeStore.addTradeUpdateToDb(userId, tradeId, { type: 'enter', price: entryPrice, ... })
   │  ├─ await tradeStore.linkTradeToChannels(tradeId, channelIds)
   │  └─ await tradeStore.linkTradeToChallenges(tradeId, challengeIds)
   ├─ Error: Rollback optimistic, show error toast with retry
   └─ Success: setTradeState('ENTERED'), send Discord alert
   ```

   **Case 'update-sl'** / **'trail-stop'**:

   ```
   ├─ Optimistic: Update stopLoss in currentTrade
   ├─ API Calls (parallel):
   │  ├─ await tradeStore.updateTrade(tradeId, { stop_loss: newPrice })
   │  └─ await tradeStore.addTradeUpdateToDb(userId, tradeId, { type: action, price: newPrice, message })
   ├─ Error: Rollback, show retry
   └─ Success: Send Discord alert
   ```

   **Case 'trim'** / **'add'** / **'update'**:

   ```
   ├─ Optimistic: Add update to trade.updates array
   ├─ API Calls:
   │  ├─ await tradeStore.addTradeUpdateToDb(userId, tradeId, { type: action, price, message })
   │  ├─ await tradeStore.linkTradeToChannels(tradeId, channelIds) [if changed]
   │  └─ await tradeStore.linkTradeToChallenges(tradeId, challengeIds) [if changed]
   ├─ Error: Rollback, show retry
   └─ Success: Send Discord alert
   ```

   **Case 'exit'**:

   ```
   ├─ Optimistic: Update trade state='EXITED', move to historyTrades
   ├─ API Calls (parallel):
   │  ├─ await tradeStore.updateTrade(tradeId, { status: 'exited', exit_price, exit_time })
   │  └─ await tradeStore.addTradeUpdateToDb(userId, tradeId, { type: 'exit', price: exitPrice, ... })
   ├─ Error: Rollback, show retry
   └─ Success: Send Discord alert
   ```

3. **Error/Retry Toast Pattern**:
   - Show: "Failed to [action]. Retry"
   - Button: Trigger same action again
   - Exponential backoff: 1s, 2s, 4s (max 3 attempts)

4. **Data Passed to Discord**:
   - User selections from alert composer determine what's sent
   - No changes to alert formatting (uses existing `formatDiscordAlert()`)

---

## ⚠️ Critical Implementation Notes

### User ID Acquisition

- Needed for all API calls and database operations
- Should be extracted from auth context in parent component
- Passed to useTradeStateMachine via props or hook

### API Call Pattern

```typescript
try {
  // Optimistic update
  setOptimisticState();

  // Parallel API calls
  await Promise.all([
    tradeStore.updateTrade(...),
    tradeStore.addTradeUpdateToDb(...),
    tradeStore.linkTradeToChannels(...),
  ]);

  // Success
  toast.success('Action completed');
} catch (error) {
  // Rollback optimistic update
  revertToLastKnownState();

  // Show error toast with retry
  toast.error(`Failed: ${error.message}`, {
    action: {
      label: 'Retry',
      onClick: () => retryAction(),
    },
  });
}
```

### No Changes Required

- ✅ Risk engine calculations (calculateRisk, adjustProfileByConfluence)
- ✅ Confluence system
- ✅ Strategy system
- ✅ Discord alert formatting (formatDiscordAlert)
- ✅ WebSocket real-time prices
- ✅ P&L calculations
- ✅ Trade cards UI

---

## 📋 Remaining Phases

### Phase 5: Testing (TBD)

- [ ] 5a: Test API endpoints (curl/Postman)
- [ ] 5b: Test E2E trade lifecycle
- [ ] 5c: Test page refresh persistence
- [ ] 5d: Run unit/integration tests for regressions

### Phase 6: Documentation (TBD)

- [ ] Update CLAUDE.md with new API endpoints
- [ ] Add migration deployment steps
- [ ] Create troubleshooting guide

---

## 🚨 Risk Assessment

**Risk Level**: LOW

- API endpoints are isolated, can be tested independently
- Optimistic updates allow graceful fallback
- All DB changes are backward compatible
- RLS policies protect data
- No breaking changes to existing systems

**Breaking Changes**: NONE

- Existing code continues to work unchanged
- New persistence is additive only
- Old trades still load from DB

---

## 🎯 Next Steps

1. Review this document for completeness
2. Implement Phase 4 state machine wiring
3. Deploy Phase 1 migration to Supabase
4. Run API endpoint tests
5. Run E2E tests
6. Verify page refresh persistence
7. Full test suite run
8. Documentation update
