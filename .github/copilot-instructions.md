# Copilot Instructions for Honey Drip Admin

## TL;DR for AI Agents

- **Stack**: React 18 + TypeScript + Vite frontend; Express backend with WebSocket proxies; Supabase (PostgreSQL + RLS); Massive.com OPTIONS/INDICES ADVANCED
- **State**: Zustand stores (4 domains: trade, market, ui, settings) — no Redux, no Context API
- **Real-time**: WebSocket-first per symbol with automatic REST fallback + staleness tracking via `transport-policy.ts`
- **Security**: API keys server-only; `/api/massive/*` proxy + `/ws/{options,indices}` with token auth

## Run / Build / Test

```bash
# Development (starts Vite + Express concurrently)
pnpm install
pnpm run dev  # Vite on :5173, API on :8080

# Build & Production
pnpm run build  # Vite build + tsc server → server/dist
pnpm run start  # NODE_ENV=production node server/dist/index.js

# Testing
pnpm test                 # Vitest unit tests
pnpm run test:e2e         # Playwright E2E (headless)
pnpm run test:e2e:ui      # Playwright UI mode
pnpm run test:e2e:headed  # Headed browser
```

## Architecture: State Management (Zustand)

**4 domain-specific stores** — use selectors to prevent unnecessary re-renders:

1. **`tradeStore`** (`src/stores/tradeStore.ts`)

   - Trade lifecycle: `WATCHING → LOADED → ENTERED → EXITED`
   - Actions: `transitionToLoaded(contract)`, `transitionToEntered(price, qty)`, `transitionToExited(price)`
   - Supabase sync: `createTrade()`, `updateTrade()`, `loadTrades(userId)`

2. **`marketStore`** (`src/stores/marketStore.ts`)

   - Watchlist + real-time quotes (Map for O(1) lookup)
   - Actions: `addTicker()`, `updateQuotes(quotes)`, `getWatchlistSymbols()`

3. **`uiStore`** (`src/stores/uiStore.ts`)

   - Navigation: `activeTab` (live/active/history/settings)
   - Dialogs: `showDiscordDialog`, `showAddTickerDialog`, voice state
   - Helpers: `navigateToActive()`, `focusTradeInLive(trade)`

4. **`settingsStore`** (`src/stores/settingsStore.ts`)
   - Discord channels + challenges
   - Actions: `createDiscordChannel()`, `getDefaultChannels(type)`, `getActiveChallenges()`

**Usage Pattern**:

```tsx
// Select specific slice to avoid re-renders
const activeTrades = useTradeStore((s) => s.activeTrades);
const setActiveTab = useUiStore((s) => s.setActiveTab);
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

**Setup**: Run `scripts/001_create_schema.sql` in Supabase SQL editor

**Core Tables** (all enforce `user_id` RLS):

- `profiles` — extends `auth.users`
- `discord_channels` — webhook configs per user
- `challenges` — trading challenges for grouping trades
- `watchlist` — user tickers
- `trades` — full lifecycle (status: watching/loaded/entered/exited)
- `trade_updates` — history of entries/exits/trims

**Always filter by `user_id`** — use helpers in `src/lib/supabase/database.ts` or store actions

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

## Common Pitfalls

1. **Don't use `useState` for global state** — use Zustand stores
2. **Don't expose API keys** — `MASSIVE_API_KEY` server-only; client uses proxy
3. **Don't poll unnecessarily** — `transport-policy` handles fallback automatically
4. **Always cleanup** — hooks use `AbortController`, transports auto-unsubscribe on unmount
5. **Filter by `user_id`** — RLS enforced, but explicit filtering prevents errors
6. **Use selectors** — `useTradeStore(s => s.activeTrades)` prevents re-renders
