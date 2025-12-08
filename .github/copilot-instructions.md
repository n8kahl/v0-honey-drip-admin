# Copilot Instructions for Honey Drip Admin

## TL;DR for AI Agents

- **Stack**: React 18 + TypeScript + Vite frontend; Express backend with WebSocket proxies; Supabase (PostgreSQL + RLS); Massive.com OPTIONS/INDICES ADVANCED
- **State**: Zustand stores (7 domains) — no Redux, no Context API. Use selectors to prevent re-renders
- **Real-time**: WebSocket-first per symbol with automatic REST fallback + staleness tracking via `transport-policy.ts`
- **Security**: API keys server-only; `/api/massive/*` proxy + `/ws/{options,indices}` with token auth
- **Workers**: 5 background workers for signal scanning, data ingestion, gamma exposure, optimizer, and pre-warming

## Run / Build / Test

```bash
# Development (starts Vite + Express concurrently)
pnpm install
pnpm run dev              # Frontend :5173 + API :8080
pnpm run dev:all          # + compositeScanner worker
pnpm run dev:full         # + compositeScanner + historicalDataIngestion
pnpm run dev:workers      # All 4 workers (composite, ingestion, gamma, watchlist)

# Build & Production
pnpm run build            # Vite build + tsc server → server/dist
pnpm run start            # NODE_ENV=production node server/dist/index.js
pnpm run start:workers    # All production workers

# Testing
pnpm test                 # Vitest unit tests
pnpm test:e2e             # Playwright E2E (headless)
pnpm test:e2e:ui          # Playwright UI mode
pnpm run session-check    # Pre-commit health check (tests + build + git status)

# Workers (Background Processes)
pnpm start:composite      # Signal scanner (60s intervals)
pnpm start:ingestion      # Historical data ingestion (15m intervals)
pnpm start:gamma          # Gamma exposure snapshots
pnpm start:prewarm        # Weekend pre-warm (manual trigger)
```

## Architecture: State Management (Zustand)

**7 domain-specific stores** (all in `src/stores/`) — use selectors to prevent unnecessary re-renders:

1. **`tradeStore`** — Trade lifecycle + persistence
   - States: `WATCHING → LOADED → ENTERED → EXITED`
   - Actions: `createTrade()`, `updateTrade()`, `loadTrades(userId)`, `markTradeAsUpdated()`
   - Critical: `contract` field stores full JSONB for price persistence across sessions
   - Use: `getLoadedTrades()`, `getEnteredTrades()`, `getTradeById(id)`

2. **`marketStore`** — Watchlist + real-time quotes
   - Map-based quotes for O(1) lookup
   - Actions: `addTicker()`, `updateQuotes(quotes)`, `getWatchlistSymbols()`

3. **`uiStore`** — Navigation + dialogs
   - Tab state: `activeTab` (live/active/history/settings)
   - Modals: `showDiscordDialog`, `showAddTickerDialog`, voice HUD state
   - Helpers: `navigateToActive()`, `focusTradeInLive(trade)`

4. **`settingsStore`** — Discord channels + challenges + TP settings
   - Discord: `createDiscordChannel()`, `getDefaultChannels(type)`
   - Challenges: `getActiveChallenges()`, `linkTradeToChallenges()`
   - TP Settings: `tpMode`, `tpPercent`, `slPercent` for risk engine defaults

5. **`marketDataStore`** — Historical bars + aggregates cache
   - Database-backed historical data with 7-day TTL
   - Actions: `fetchBars()`, `invalidateCache()`

6. **`alertEscalationStore`** — Discord alert rate limiting
   - Per-channel rate limits (avoid webhook 429s)
   - Actions: `canSendAlert()`, `recordAlert()`

7. **`activeTradesDockStore`** — Floating active trades panel state
   - UI: `isExpanded`, `position`

**Usage Pattern** (CRITICAL):

```tsx
// ✅ CORRECT: Select specific slice to avoid re-renders
const activeTrades = useTradeStore((s) => s.activeTrades);
const setActiveTab = useUIStore((s) => s.setActiveTab);

// ❌ WRONG: Will re-render on ANY store change
const { activeTrades, historyTrades, isLoading } = useTradeStore();
```

## Architecture: Real-Time Data Flow

```
Component → useQuotes(['SPY']) → createTransport() per symbol
  ├─ WebSocket: massiveWS.subscribe() (primary)
  ├─ REST Fallback: 2-3s adaptive polling when WS unhealthy
  └─ Callback: (quote, source, timestamp) → marketStore.updateQuotes()
```

**Key Files**:

- `src/lib/massive/transport-policy.ts` — WebSocket-first + REST fallback logic
- `src/lib/massive/websocket.ts` — WS connection with jittered backoff
- `src/hooks/useMassiveData.ts` — React hooks: `useQuotes()`, `useOptionsChain()`

**Staleness Detection**:

- WebSocket: stale if `Date.now() - asOf > 5000ms`
- REST: stale if `Date.now() - asOf > 6000ms`
- UI shows visual indicators when data exceeds thresholds

## Architecture: Server Proxies

**Express backend** (`server/index.ts`) keeps API keys secure:

1. **REST Proxy**: `/api/massive/*` → forwards to `api.massive.com` with `MASSIVE_API_KEY`
   - Auth: requires `x-massive-proxy-token` header matching `MASSIVE_PROXY_TOKEN`
   - Resilient v2 aggs fallback: 5xx errors return empty results with `_fallback: 'empty'` to prevent UI errors

2. **WebSocket Proxies**: `/ws/options` and `/ws/indices`
   - Auth: `?token={MASSIVE_PROXY_TOKEN}` query param required
   - Server authenticates to Massive, mirrors client subscribe/unsubscribe

3. **Normalized Chain**: `/api/options/chain?symbol=SPY&window=10`
   - Server-side strike banding (20-50%), trading-day DTE calculation
   - Fallback to legacy Massive chain if disabled (`VITE_USE_UNIFIED_CHAIN=false`)

## Database (Supabase + RLS)

**Setup**: Run migrations in order from `scripts/` directory (001-022 + data warehouse scripts)

**Core Tables** (all enforce `user_id` RLS except warehouse tables):

**User Data**:

- `profiles` — extends `auth.users`, includes TP settings, public portal fields
- `discord_channels` — webhook configs, voice alerts, throttle settings
- `challenges` — trading challenges for grouping trades
- `watchlist` — user tickers for composite scanner

**Trade Lifecycle** (critical for state machine):

- `trades` — full lifecycle with `status` enum (watching/loaded/entered/exited)
  - `contract` JSONB — stores full contract details (bid/ask/Greeks/volume)
  - `confluence` JSONB — chart levels, IV percentile, detector signals
  - Indexes: `idx_trades_user_state`, `idx_trades_state` for fast queries
- `trade_updates` — audit trail of all actions (enter/trim/exit/sl)
- `trades_discord_channels`, `trades_challenges` — many-to-many junction tables

**Data Warehouse** (authenticated read-only, no RLS):

- `historical_bars` — OHLCV data from Massive.com, 7-day cache
- `historical_greeks` — options Greeks time-series (15m intervals)
- `options_flow_history` — large trades, unusual activity
- `iv_percentile_cache` — IV rank/percentile for entry timing
- `gamma_exposure_snapshots` — dealer positioning snapshots
- `market_regime_history` — VIX-based regime classification

**Always filter by `user_id`** for user tables — use helpers in `src/lib/supabase/database.ts`

**Migration Pattern**: Use `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` for safety. See `scripts/012_add_historical_data_warehouse.sql` for warehouse example.

## Risk Engine Pattern

**DTE-driven trade type inference** (`src/lib/riskEngine/`):

- `<1 DTE` → Scalp
- `<5 DTE` → Day
- `<30 DTE` → Swing
- `≥30 DTE` → LEAP

**TP/SL Calculation** (`calculator.ts`):

```ts
import { calculateRisk } from '@/lib/riskEngine/calculator';

const result = calculateRisk({
  entryPrice: 15.50,
  mode: 'levels',  // 'levels' | 'percent' | 'atr'
  keyLevels: { vwap: 589, orbHigh: 592, ... },
  atr: 12.5,
  expirationISO: '2025-11-25T00:00:00Z',
  // ...defaults
});
// Returns: { targetPrice, stopLoss, riskRewardRatio, confidence, tradeType }
```

Use via hooks in components; avoid direct imports in UI components.

## Options Chain Pattern

```tsx
// Unified normalized chain (default)
const { fetchOptionsChain } = useMassiveData();
const chain = await fetchOptionsChain("SPY", 10); // window=10 expirations

// Streaming wrapper
const { contracts, loading, isStale } = useStreamingOptionsChain("SPY");
```

Chain filtered by liquidity (bid/ask spread, open interest) — see `src/lib/massive/options-advanced.ts`

## Take Profit Calculation Pattern (CRITICAL)

**Unified calculator ensures consistency** across all UI components:

```tsx
import { useTakeProfit } from "@/hooks/useTakeProfit";
import { calculateConfidenceGrade } from "@/lib/riskEngine/confidenceGrading";

// In component
const tpResult = useTakeProfit({
  entryPrice: 15.5,
  contract: trade.contract,
  userOverride: trade.manualTP, // Priority 1: User adjustment
  keyLevels: trade.confluence?.keyLevels, // For risk engine
  currentUnderlyingPrice: ticker.last,
  atr: symbolData.atr,
});

// tpResult includes:
// - targetPrice: number (the actual TP value)
// - source: "user_override" | "risk_engine" | "dte_default" | "contract_mid_fallback"
// - label: "Adjusted TP" | "Initial TP" | "Default TP" | "Estimated TP"
// - confidence: 0-100 score
// - riskDetails?: full RiskCalculationResult if available
```

**Priority Hierarchy** (NEVER bypass this):

1. **User Override** — if `trade.manualTP` is set (confidence: 100)
2. **Risk Engine** — calculated from key levels + ATR (confidence: 40-85)
3. **DTE Defaults** — based on trade type: Scalp (30-50%), Day (50-100%), Swing (100-150%), LEAP (150-200%)
4. **Fallback** — `contract.mid * 1.5` (confidence: 30)

**Display Pattern**:

```tsx
<div>
  TP: ${tpResult.targetPrice.toFixed(2)}
  <span className="text-xs text-zinc-400">
    {tpResult.indicator} {tpResult.label}
  </span>
</div>
```

**Confidence Grading** (data quality indicator):

```tsx
import { calculateConfidenceGrade } from "@/lib/riskEngine/confidenceGrading";

const grade = calculateConfidenceGrade(riskResult, {
  levelsUsed: ["VWAP", "ORB", "PrevDayHigh"],
  hasATR: true,
  hasIV: true,
  hasFlow: true,
  confluenceScore: 78,
  liquidityQuality: "excellent",
  lastDataUpdate: Date.now(),
});

// grade.score: 0-100
// grade.grade: "high" | "medium" | "low"
// grade.indicator: "✓" | "~" | "?"
// grade.reasoning: ["✓ Excellent key level data", "✓ ATR volatility data available", ...]
```

## Logging Convention

**Prefix all verbose logs with `[v0]`** for easy grepping:

```ts
console.log("[v0] Fetching options chain for", symbol);
console.error("[v0] Failed to load trades:", error);
```

This distinguishes app logs from library logs (Massive, Supabase, etc.)

## Environment Variables

**Client-side** (exposed via Vite):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_MASSIVE_PROXY_TOKEN` — shared secret for proxy auth
- `VITE_USE_UNIFIED_CHAIN` — enable normalized chain (default: true)

**Server-side** (never bundled):

- `MASSIVE_API_KEY` — Massive.com OPTIONS ADVANCED key
- `MASSIVE_PROXY_TOKEN` — must match client `VITE_MASSIVE_PROXY_TOKEN`
- `PORT` — server port (default: 8080 in production)
- `NODE_ENV` — `production` enables optimizations

## Background Workers (server/workers/)

**5 independent processes** for 24/7 data operations:

1. **`compositeScanner.ts`** — Signal detection (60s intervals)
   - Scans all user watchlists for 16 detector patterns
   - Inserts to `composite_signals` table
   - Auto-sends Discord alerts
   - Uses optimized params from `config/optimized-params.json`

2. **`historicalDataIngestion.ts`** — Data warehouse population
   - Greeks ingestion (15m): `historical_greeks` table
   - Options flow tracking (1m): `options_flow_history`
   - IV percentile (daily): `iv_percentile_cache`
   - Gamma exposure (15m): `gamma_exposure_snapshots`
   - Market regime (daily): `market_regime_history`

3. **`gammaExposureWorker.ts`** — Dealer positioning snapshots
   - Calculates aggregate dealer gamma exposure by strike
   - Identifies key support/resistance from option walls

4. **`weekendPreWarm.ts`** — Weekend/pre-market analysis
   - Pre-fetches historical data for faster Monday opens
   - 25x faster than live API calls (cached in `historical_bars`)

5. **`confluenceOptimizer.ts`** — Backtest-driven parameter tuning
   - Tests 100s of detector threshold combinations
   - Outputs `config/optimized-params.json` for scanner

**Worker Pattern**:

- All use `SUPABASE_SERVICE_ROLE_KEY` for direct database access
- Singleton Supabase client with `persistSession: false`
- Graceful error handling — continue on failure, log to console
- Use `tsx watch` for dev, `node server/dist/server/workers/*.js` for prod

## Debugging

**Port conflicts**: Kill processes on 8080 and 5173:

```bash
lsof -ti:8080,5173 | xargs kill -9
```

**Check services**:

```bash
curl http://localhost:8080/api/health  # API health
curl http://localhost:5173/            # Vite
```

**Network Tab**:

- REST: `/api/massive/*` should have `x-massive-proxy-token` header
- WebSocket: `/ws/options?token=...` or `/ws/indices?token=...`
- Staleness: Look for `asOf` and `source` in quote updates

**Server Logs**: `server/index.ts` logs port and missing env vars on startup; `server/ws/index.ts` logs WS auth/subscribe activity

**Worker Logs**: All workers log to console with `[WorkerName]` prefix. Check for heartbeat messages every interval.

## Key File Pointers

**State**:

- `src/stores/{tradeStore,marketStore,uiStore,settingsStore}.ts`
- `src/App.tsx` — orchestrates data loading, no useState

**Real-time**:

- `src/lib/massive/transport-policy.ts` — WebSocket-first transport
- `src/lib/massive/websocket.ts` — WS connection management
- `src/hooks/useMassiveData.ts` — quotes/options hooks

**Risk/Calculations**:

- `src/lib/riskEngine/calculator.ts` — TP/SL engine
- `src/lib/riskEngine/profiles.ts` — DTE thresholds
- `src/lib/riskEngine/chartLevels.ts` — confluence logic

**Server**:

- `server/index.ts` — Express app entry
- `server/massive-proxy.ts` — REST proxy routes
- `server/ws/index.ts` — WebSocket hubs

**Database**:

- `scripts/001_create_schema.sql` — Supabase schema
- `src/lib/supabase/database.ts` — CRUD helpers

## Trade Lifecycle (Critical Pattern)

**State Machine Flow** (`src/hooks/useTradeStateMachine.ts`):

```
Symbol Click (SPY)
  ↓
WATCHING (local only, NOT persisted)
  ↓
Contract Click (649P · 1 DTE)
  ↓
  Trade Details + Analysis panels shown
  Alert Composer opens with "Load" button
  ↓
"Load and Alert" → LOADED
  ↓
  createTradeApi() → database INSERT
  Real DB ID assigned
  Trade appears in left nav "Loaded Trades"
  ↓
"Enter Trade" → ENTERED
  ↓
  updateTradeApi() → status='entered'
  P&L tracking begins
  ↓
"Exit Trade" → EXITED
  ↓
  updateTradeApi() → status='exited'
  Trade moves to history
```

**Key Implementation Details**:

- `WATCHING`: Temporary preview state, NO database persistence
- `LOADED`: First database insert via `createTradeApi()`
- `contract` JSONB field stores full market data to prevent "ghost trades"
- State transitions use `updateTradeApi()` with status mapping
- Junction tables (`trades_discord_channels`, `trades_challenges`) linked after creation

**Why This Pattern**:

- Prevents accidental DB pollution from users browsing contracts
- Ensures only intentional "Load" actions create persistent trades
- Full contract details preserved for accurate price display across sessions

## Common Pitfalls

1. **Don't use `useState` for global state** — use Zustand stores
2. **Don't expose API keys** — `MASSIVE_API_KEY` server-only; client uses proxy
3. **Don't poll unnecessarily** — `transport-policy` handles fallback automatically
4. **Always cleanup** — hooks use `AbortController`, transports auto-unsubscribe on unmount
5. **Filter by `user_id`** — RLS enforced, but explicit filtering prevents errors
6. **Use selectors** — `useTradeStore(s => s.activeTrades)` prevents re-renders
7. **Trade state transitions** — Never skip states (WATCHING can go to LOADED or ENTERED, but not directly to EXITED)
8. **Contract JSONB** — Always persist full contract object in `createTradeApi()` to prevent price loss
9. **Unified TP Calculator** — Always use `useTakeProfit()` hook or `calculateTakeProfit()` for consistent TP values across UI
10. **Force Confluence Calculation** — Call `marketDataStore.recomputeSymbol(symbol, { force: true })` after initial data load
11. **Confidence Grading** — Use `calculateConfidenceGrade()` to provide users with data quality indicators
