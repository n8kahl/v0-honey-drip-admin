# Repository Audit Report

> **Generated**: December 16, 2025
> **Auditor**: Senior Staff Engineer Review
> **Scope**: Honey Drip Admin Trading Dashboard

---

## 1. Frontend Entry Points

### Framework & Build

| Component     | File                             | Line Range     |
| ------------- | -------------------------------- | -------------- |
| Framework     | React 18 + Vite                  | `package.json` |
| Entry Point   | [src/main.tsx](src/main.tsx)     | 1-22           |
| Router Config | [src/router.tsx](src/router.tsx) | 1-107          |
| App Shell     | [src/App.tsx](src/App.tsx)       | 1-500+         |

### Main Entry (`src/main.tsx:1-22`)

```tsx
<AuthProvider>
  <RouterProvider router={router} />
</AuthProvider>
```

- Wraps entire app in `AuthProvider` for authentication context
- Uses `createBrowserRouter` from react-router-dom v7

### Router Configuration (`src/router.tsx:1-107`)

| Route         | Component         | Loading  |
| ------------- | ----------------- | -------- |
| `/`           | `App`             | Eager    |
| `/active`     | `App`             | Eager    |
| `/history`    | `App`             | Eager    |
| `/settings`   | `App`             | Eager    |
| `/monitoring` | `App`             | Eager    |
| `/public`     | `PublicPortal`    | Eager    |
| `/wins`       | `WinsPage`        | Eager    |
| `/member`     | `MemberDashboard` | Eager    |
| `/profile`    | `ProfilePage`     | **Lazy** |
| `/radar`      | `RadarPage`       | **Lazy** |
| `/plan`       | `PlanPage`        | **Lazy** |
| `/trades/:id` | `TradeDetailPage` | **Lazy** |

---

## 2. Backend Entry Points

### Server Entry (`server/index.ts:1-267`)

| Component              | Line Range |
| ---------------------- | ---------- |
| Express App Setup      | 23-59      |
| Security (Helmet/CORS) | 28-57      |
| Rate Limiting          | 69-79      |
| Route Mounting         | 81-88      |
| Static SPA Serving     | 213-228    |
| HTTP Server + WS       | 238-264    |

### Router Wiring (`server/index.ts:81-88`)

```typescript
app.use("/api", apiRouter); // Main API routes
app.use(tradesRouter); // /api/trades/* (self-handled paths)
app.use(tradeThreadsRouter); // /api/trade-threads/*
app.use("/api/calendar", calendarRouter);
app.use("/api/youtube", youtubeRouter);
app.use("/api/ai", aiRouter);
app.use("/api/public", publicRouter);
```

### REST Route Files

| File                                                           | Path Prefix          | Line Count | Key Endpoints                                                              |
| -------------------------------------------------------------- | -------------------- | ---------- | -------------------------------------------------------------------------- |
| [server/routes/api.ts](server/routes/api.ts)                   | `/api/`              | ~1400      | `/health`, `/ws-token`, `/quotes`, `/bars`, `/options/chain`, `/massive/*` |
| [server/routes/trades.ts](server/routes/trades.ts)             | `/api/trades`        | ~950       | CRUD trades, updates, channel/challenge linking                            |
| [server/routes/tradeThreads.ts](server/routes/tradeThreads.ts) | `/api/trade-threads` | ~700       | Thread management, member trades                                           |
| [server/routes/public.ts](server/routes/public.ts)             | `/api/public/`       | ~650       | Public portal data (no auth)                                               |
| [server/routes/calendar.ts](server/routes/calendar.ts)         | `/api/calendar/`     | ~500       | Economic events, earnings                                                  |
| [server/routes/ai.ts](server/routes/ai.ts)                     | `/api/ai/`           | ~350       | AI coaching sessions                                                       |
| [server/routes/youtube.ts](server/routes/youtube.ts)           | `/api/youtube/`      | ~100       | Pre-market video                                                           |
| [server/routes/strategies.ts](server/routes/strategies.ts)     | `/strategies/`       | ~100       | Scanner triggers                                                           |

---

## 3. State Management (Zustand Stores)

### Store Files (`src/stores/`)

| Store                     | File                                                                       | Line | Primary Responsibility                                                            |
| ------------------------- | -------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| **tradeStore**            | [src/stores/tradeStore.ts](src/stores/tradeStore.ts)                       | 177  | Trade lifecycle (WATCHING→LOADED→ENTERED→EXITED), CRUD, channel/challenge linking |
| **marketDataStore**       | [src/stores/marketDataStore.ts](src/stores/marketDataStore.ts)             | 437  | Real-time market data, candles, indicators, MTF trends                            |
| **settingsStore**         | [src/stores/settingsStore.ts](src/stores/settingsStore.ts)                 | 104  | Discord channels, challenges, TP/SL settings                                      |
| **marketStore**           | [src/stores/marketStore.ts](src/stores/marketStore.ts)                     | 78   | Watchlist management, quotes                                                      |
| **uiStore**               | [src/stores/uiStore.ts](src/stores/uiStore.ts)                             | 80   | UI state (dialogs, view modes, voice)                                             |
| **alertEscalationStore**  | [src/stores/alertEscalationStore.ts](src/stores/alertEscalationStore.ts)   | 370  | Alert escalation logic                                                            |
| **tradeThreadStore**      | [src/stores/tradeThreadStore.ts](src/stores/tradeThreadStore.ts)           | 203  | Trade threads, member subscriptions                                               |
| **activeTradesDockStore** | [src/stores/activeTradesDockStore.ts](src/stores/activeTradesDockStore.ts) | 22   | Active trades dock visibility                                                     |

### Database Layer (`src/lib/supabase/`)

| File                                                                                 | Purpose                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [src/lib/supabase/client.ts](src/lib/supabase/client.ts)                             | Singleton Supabase client (browser + Node)                         |
| [src/lib/supabase/database.ts](src/lib/supabase/database.ts)                         | CRUD operations: profiles, channels, challenges, trades, watchlist |
| [src/lib/supabase/auth.ts](src/lib/supabase/auth.ts)                                 | Authentication helpers                                             |
| [src/lib/supabase/compositeSignals.ts](src/lib/supabase/compositeSignals.ts)         | Composite signal queries                                           |
| [src/lib/supabase/performanceAnalytics.ts](src/lib/supabase/performanceAnalytics.ts) | Performance analytics queries                                      |

### API Client Layer (`src/lib/api/`)

| File                                                           | Purpose                                 |
| -------------------------------------------------------------- | --------------------------------------- |
| [src/lib/api/tradeApi.ts](src/lib/api/tradeApi.ts)             | Trade REST API calls with retry/backoff |
| [src/lib/api/tradeThreadApi.ts](src/lib/api/tradeThreadApi.ts) | Trade thread API calls                  |

---

## 4. WebSocket Entry Points

### Server-Side WS (`server/ws/`)

| File                                     | Line   | Purpose                                         |
| ---------------------------------------- | ------ | ----------------------------------------------- |
| [server/ws/index.ts](server/ws/index.ts) | 1-92   | WebSocket server attachment, token verification |
| [server/ws/hub.ts](server/ws/hub.ts)     | 1-200+ | MassiveHub proxy to `wss://socket.massive.com`  |

### WS Server Setup (`server/ws/index.ts:30-92`)

```typescript
// Two WebSocket servers:
wssOptions.on("connection", handleOptionsConnection);   // /ws/options
wssIndices.on("connection", handleIndicesConnection);  // /ws/indices

// Proxy to upstream Massive.com sockets
new MassiveHub("wss://socket.massive.com/options", ...)
new MassiveHub("wss://socket.massive.com/indices", ...)
```

### Client-Side WS (`src/lib/massive/`)

| File                                                                         | Purpose                              |
| ---------------------------------------------------------------------------- | ------------------------------------ |
| [src/lib/massive/websocket.ts](src/lib/massive/websocket.ts)                 | WebSocket client with auto-reconnect |
| [src/lib/massive/streaming-manager.ts](src/lib/massive/streaming-manager.ts) | Centralized subscription manager     |
| [src/lib/massive/unifiedWebSocket.ts](src/lib/massive/unifiedWebSocket.ts)   | Unified WebSocket handler            |

---

## 5. Domain Object Map

### Trade Domain (`src/types/index.ts:133-182`)

```typescript
interface Trade {
  id: string;
  ticker: string;
  contract: Contract;
  tradeType: TradeType; // "Scalp" | "Day" | "Swing" | "LEAP"
  state: TradeState; // "WATCHING" | "LOADED" | "ENTERED" | "EXITED"
  setupType?: SetupType; // 17 types (BREAKOUT, REVERSAL, etc.)
  entryPrice?: number;
  exitPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  movePercent?: number; // P&L calculation result
  confluence?: TradeConfluence; // Rich confluence data
  discordChannels: string[]; // Linked Discord channel IDs
  challenges: string[]; // Linked challenge IDs
  updates: TradeUpdate[]; // Trade history updates
  // ... 20+ additional fields
}
```

**State Machine**: `WATCHING` → `LOADED` → `ENTERED` → `EXITED`

### Contract Domain (`src/types/index.ts:40-58`)

```typescript
interface Contract {
  id: string;
  strike: number;
  expiry: string;
  type: OptionType; // "C" | "P"
  mid: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  iv?: number;
}
```

### Challenge Domain (`src/types/index.ts:60-74`)

```typescript
interface Challenge {
  id: string;
  name: string;
  description?: string;
  startingBalance: number;
  currentBalance: number;
  targetBalance: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  scope?: ChallengeScope; // "admin" | "honeydrip-wide"
  defaultChannel?: string;
}
```

### Watchlist Domain (`src/stores/marketStore.ts`)

```typescript
interface WatchlistItem {
  id: string;
  symbol: string;
  added_at: string;
  user_id: string;
}
```

- Stored in `watchlist` table with RLS by `user_id`
- Managed by `marketStore.addTicker()` / `removeTicker()`

### Public Portal Domain (`src/pages/PublicPortal.tsx:46-82`)

```typescript
interface PublicTrade {
  id: string;
  ticker: string;
  contract: { strike?: number; type?: "C" | "P"; expiry?: string } | null;
  trade_type: string;
  state: string;
  entry_price: number | null;
  admin_name: string | null;
  // ...
}

interface PublicChallenge {
  id: string;
  name: string;
  starting_balance: number;
  current_balance: number;
  target_balance: number;
  progress_percent: number; // Pre-computed by API
  // ...
}
```

---

## 6. P&L Calculation

### Primary Calculator (`src/services/pnlCalculator.ts:1-392`)

| Function                    | Line    | Purpose                           |
| --------------------------- | ------- | --------------------------------- |
| `calculatePnL()`            | 122-222 | Full P&L with commission/slippage |
| `calculateNetPnLPercent()`  | 276-288 | Simple net P&L %                  |
| `calculateBreakevenPrice()` | 299-319 | Breakeven price calc              |
| `adjustWinRateForCosts()`   | 332-366 | Win rate after costs              |

### P&L in Trade Store (`src/stores/tradeStore.ts:496-503`)

```typescript
// Simple movePercent calculation:
movePercent = ((exitPrice - entryPrice) / entryPrice) * 100;
```

### Files Using P&L (65 files reference `movePercent` or `pnlPercent`)

Key files:

- [src/stores/tradeStore.ts](src/stores/tradeStore.ts) - State storage
- [src/hooks/useTradeStateMachine.ts](src/hooks/useTradeStateMachine.ts) - State transitions
- [src/lib/challengeHelpers.ts](src/lib/challengeHelpers.ts) - Challenge stats
- [src/components/hd/cards/HDActiveTradeRow.tsx](src/components/hd/cards/HDActiveTradeRow.tsx) - Display
- [src/services/pnlCalculator.ts](src/services/pnlCalculator.ts) - Full calculation

---

## 7. Focus File Lists

### (a) Trades / State Machine

| Priority | File                                                                   | Lines   | Reason                                 |
| -------- | ---------------------------------------------------------------------- | ------- | -------------------------------------- |
| **P0**   | [src/stores/tradeStore.ts](src/stores/tradeStore.ts)                   | 1-800   | Single source of truth for trade state |
| **P0**   | [src/hooks/useTradeStateMachine.ts](src/hooks/useTradeStateMachine.ts) | 1-900   | State transition logic                 |
| **P0**   | [src/types/index.ts](src/types/index.ts)                               | 133-230 | Trade/TradeUpdate types                |
| **P1**   | [server/routes/trades.ts](server/routes/trades.ts)                     | 1-950   | Trade REST API                         |
| **P1**   | [src/lib/api/tradeApi.ts](src/lib/api/tradeApi.ts)                     | 1-300   | Client-side trade API                  |
| **P1**   | [src/lib/supabase/database.ts](src/lib/supabase/database.ts)           | 1-500   | DB operations                          |

### (b) Calculations (P&L, Risk)

| Priority | File                                                                 | Lines | Reason               |
| -------- | -------------------------------------------------------------------- | ----- | -------------------- |
| **P0**   | [src/services/pnlCalculator.ts](src/services/pnlCalculator.ts)       | 1-392 | Full P&L calculator  |
| **P0**   | [src/lib/challengeHelpers.ts](src/lib/challengeHelpers.ts)           | 1-150 | Challenge stats      |
| **P1**   | [src/lib/riskEngine/calculator.ts](src/lib/riskEngine/calculator.ts) | 1-300 | Risk/position sizing |
| **P1**   | [src/lib/riskEngine/profiles.ts](src/lib/riskEngine/profiles.ts)     | 1-200 | Risk profiles        |

### (c) REST Routes

| Priority | File                                                           | Lines  | Reason                   |
| -------- | -------------------------------------------------------------- | ------ | ------------------------ |
| **P0**   | [server/routes/trades.ts](server/routes/trades.ts)             | 1-950  | Trade CRUD, linking      |
| **P0**   | [server/routes/api.ts](server/routes/api.ts)                   | 1-1400 | Market data, auth, proxy |
| **P1**   | [server/routes/public.ts](server/routes/public.ts)             | 1-650  | Public portal API        |
| **P1**   | [server/routes/tradeThreads.ts](server/routes/tradeThreads.ts) | 1-700  | Threads, member trades   |
| **P2**   | [server/routes/calendar.ts](server/routes/calendar.ts)         | 1-500  | Economic calendar        |
| **P2**   | [server/routes/ai.ts](server/routes/ai.ts)                     | 1-350  | AI coach                 |

### (d) WebSocket Routes

| Priority | File                                                                         | Lines | Reason               |
| -------- | ---------------------------------------------------------------------------- | ----- | -------------------- |
| **P0**   | [server/ws/index.ts](server/ws/index.ts)                                     | 1-92  | WS server setup      |
| **P0**   | [server/ws/hub.ts](server/ws/hub.ts)                                         | 1-200 | Massive.com proxy    |
| **P1**   | [src/lib/massive/websocket.ts](src/lib/massive/websocket.ts)                 | 1-300 | Client WS            |
| **P1**   | [src/lib/massive/streaming-manager.ts](src/lib/massive/streaming-manager.ts) | 1-400 | Subscription manager |

### (e) Public Portal

| Priority | File                                                     | Lines | Reason                |
| -------- | -------------------------------------------------------- | ----- | --------------------- |
| **P0**   | [src/pages/PublicPortal.tsx](src/pages/PublicPortal.tsx) | 1-500 | Main portal component |
| **P0**   | [server/routes/public.ts](server/routes/public.ts)       | 1-650 | Public API endpoints  |
| **P1**   | [src/components/public/](src/components/public/)         | (dir) | Portal subcomponents  |
| **P1**   | [src/pages/WinsPage.tsx](src/pages/WinsPage.tsx)         | 1-200 | Public wins display   |

---

## 8. Known Issues from Plan File

From the existing plan at `~/.claude/plans/replicated-launching-bubble.md`:

### Critical Bugs

1. **`rMultiple` not in Trade type** - Referenced but undefined
2. **Public Portal type mismatch** - Uses wrong field names (`target_amount` vs `target_balance`)
3. **Public Portal RLS bypass** - Direct Supabase query fails due to RLS
4. **Contract type comparison** - Uses `"CALL"` instead of `"C"`

### Medium Priority

1. **Empty `x-user-id` headers** - Inconsistent auth pattern
2. **Inconsistent P&L calculation** - Different methods in different files
3. **Missing `ensureArray` guards** - Runtime errors on null arrays

---

## 9. File Modification Plan (for upcoming fixes)

| File                                                 | Change                                              |
| ---------------------------------------------------- | --------------------------------------------------- |
| `src/types/index.ts`                                 | Add `rMultiple?: number` to Trade                   |
| `src/lib/challengeHelpers.ts`                        | Add `getFullChallengeStats()`                       |
| `src/components/hd/forms/HDChallengeDetailSheet.tsx` | Fix type comparisons, use centralized stats         |
| `src/pages/PublicPortal.tsx`                         | Fix Challenge type, use API instead of direct query |
| `src/stores/tradeStore.ts`                           | Verify auth headers pattern                         |
| `src/components/hd/layout/HDWatchlistRail.tsx`       | Add `ensureArray` guards                            |
| `src/pages/TradeDetailPage.tsx`                      | Add editable entry/exit prices                      |

---

## 10. Test Files to Create

| Test File                                                           | Tests For                        |
| ------------------------------------------------------------------- | -------------------------------- |
| `src/lib/__tests__/challengeHelpers.test.ts`                        | Challenge stats calculation      |
| `src/components/hd/forms/__tests__/HDChallengeDetailSheet.test.tsx` | Challenge detail rendering       |
| `src/services/__tests__/pnlCalculator.test.ts`                      | P&L calculations (if not exists) |

---

_End of Audit Report_
