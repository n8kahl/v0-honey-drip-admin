# Copilot Instructions for Honey Drip Admin

## Architecture Overview

This is a **real-time options trading dashboard** with a secure proxy architecture separating client and server concerns.

### Core Stack

- **Frontend**: React 18 + TypeScript + Vite (SPA served from Next.js middleware)
- **Backend**: Express.js server proxying Massive.com API + WebSocket bridges
- **Database**: Supabase (PostgreSQL with Row Level Security on all tables)
- **Real-time**: Streaming-first WebSocket with automatic REST fallback
- **Market Data**: Massive.com OPTIONS ADVANCED + INDICES ADVANCED subscriptions

### Architecture Pattern: Streaming-First with REST Fallback

The application prioritizes **real-time data delivery** over consistency:

1. **WebSocket First**: Each symbol (`useMassiveData.ts` + `transport-policy.ts`) maintains a persistent WebSocket connection
2. **Smart Fallback**: If WebSocket disconnects, automatically polls REST `/api/massive/*` every 3 seconds
3. **Source Tracking**: Quotes include `source` ('websocket' or 'rest') and `asOf` timestamp for stale detection (>5s WebSocket, >6s REST)
4. **Cleanup**: Subscriptions unsubscribe on component unmount and tab switch to avoid duplicate streams

**Key Files**: `src/lib/massive/transport-policy.ts`, `src/hooks/useMassiveData.ts`, `src/lib/massive/websocket.ts`

## Security Model

**Critical**: API keys never reach the browser. All Massive.com authentication happens server-side.

### Server Proxy (`server/index.ts` + `server/massive-proxy.ts`)

- `/api/massive/[...path]` — REST proxy authenticated with `MASSIVE_API_KEY` header
- `/api/massive/ws-token` — Generates 5-minute ephemeral tokens (WebSocket auth)
- `/ws/options` and `/ws/indices` — WebSocket proxies that authenticate server-side, mirror subscriptions client-side

### Environment Variables

- **Server-side only** (never in browser):
  - `MASSIVE_API_KEY` — Massive.com API key
  - `MASSIVE_PROXY_TOKEN` — Shared secret for REST + WebSocket proxies
- **Client-side** (exposed to browser):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `VITE_MASSIVE_PROXY_TOKEN` — Matches server's `MASSIVE_PROXY_TOKEN`

## Development Workflow

### Build & Run

```bash
pnpm install
pnpm run dev              # Vite SPA + tsx-watched Express server (http://localhost:5173 + :3000)
pnpm run build            # Vite dist + tsc server (outputs to server/dist)
pnpm run start            # Production (Node server/dist/index.js)
```

### Database Setup

1. Execute `scripts/001_create_schema.sql` in Supabase SQL editor (creates tables + RLS policies)
2. Row Level Security enforces `user_id` filtering on: `profiles`, `discord_channels`, `challenges`, `watchlist`, `trades`, `trade_updates`

### Logging Convention

Use `console.log('[v0] ...')` prefix for verbose trace logs (production ignores these). Errors use `console.error('[v0] ...')`.

## Data Flow Patterns

### Quote Streaming (Watchlist Symbol Updates)

```
App.tsx
  → useQuotes(['AAPL', 'SPY'])  // useMassiveData.ts
    → createTransport() per symbol  // transport-policy.ts
      → massiveWS.subscribe()  // WebSocket streaming
      → massiveClient.quotes()  // 3s REST fallback on disconnect
      → callback(quote, source, timestamp)
    → setWatchlist() with updated quote data
```

### Options Chain Loading (per ticker)

```
DesktopLiveCockpit.tsx (user clicks ticker)
  → useMassiveData().fetchOptionsChain(symbol)
    → massiveClient.getOptionsChain()  // REST call via proxy
      → map to Contract[] type
    → Display in options grid
```

### Trade Lifecycle (Supabase)

1. **WATCHING** → Create trade in `trades` table, open options chain modal
2. **LOADED** → Select contract, calculate TP/SL via `riskEngine/calculator.ts`
3. **ENTERED** → Insert `trade_updates` record, emit Discord alert
4. **EXITED** → Update `trade_updates` with exit price/time, archive

**Key Files**: `src/lib/supabase/database.ts`, `src/lib/riskEngine/calculator.ts`

## Critical Component Patterns

### Risk Engine (DTE-Aware TP/SL)

Located in `src/lib/riskEngine/`:

- **calculator.ts**: Calculates TP/SL using percent mode or confluence levels (ATR, VWAP, support/resistance)
- **profiles.ts**: Defines `RISK_PROFILES` keyed by trade type (Scalp, Day, Swing, LEAP) + inferTradeTypeByDTE()
- **chartLevels.ts**: Computes key technical levels (ORB, VWAP, weekly/monthly pivots)

Trade type is inferred from **DTE** (Days To Expiration): <1 DTE = Scalp, <5 = Day, <30 = Swing, ≥30 = LEAP.

### Discord Integration

- User adds webhook URLs in Settings, saved to `discord_channels` table
- On trade action (enter, exit, update), format message via `lib/discordFormatter.ts`
- Call Supabase function or server endpoint to send webhook
- Channels can have flags: `is_default_load`, `is_default_enter`, `is_default_exit`, `is_default_update`

### Mobile-First Responsive

- `src/components/MobileBottomNav.tsx` — Bottom tabs (Live/Active/History/Settings)
- `src/components/DesktopLiveCockpit.tsx` — Desktop sidebar + charts
- Components use `use-mobile` hook to detect viewport, conditional render
- Tailwind breakpoints: `sm`, `md`, `lg` (Radix UI components adapt)

## Key File Reference

| File                                  | Purpose                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `src/App.tsx`                         | App shell, tab routing, global state (watchlist, trades, discord channels) |
| `src/contexts/AuthContext.tsx`        | Supabase session + user management                                         |
| `src/hooks/useMassiveData.ts`         | Streaming quotes + options chain fetching                                  |
| `src/hooks/useRiskEngine.ts`          | Wraps risk calculator, fetches market context (ATR, levels)                |
| `src/lib/supabase/database.ts`        | All CRUD operations (RLS-protected queries)                                |
| `src/lib/massive/transport-policy.ts` | Streaming-first data acquisition logic                                     |
| `src/lib/riskEngine/calculator.ts`    | TP/SL calculation engine (percent + confluence modes)                      |
| `server/index.ts`                     | Express app, security headers, CORS, rate limiting                         |
| `server/ws/index.ts`                  | WebSocket proxy server (mirrors subscriptions, server-side auth)           |

## Common Patterns to Follow

1. **Component State**: Lift shared state to App.tsx or custom hook (e.g., `useQuotes`, `useRiskEngine`)
2. **Error Handling**: Catch, log with `[v0]` prefix, throw or use `toast()` for user feedback
3. **Supabase Queries**: Always use `eq('user_id', userId)` for RLS enforcement
4. **Async/Await**: Prefer async/await; use AbortController for cancellation in useEffect cleanup
5. **Types**: Define in `src/types/index.ts`; trade data uses discriminated unions (`TradeState`)

## When Debugging

- Check browser DevTools Network tab for proxy requests to `/api/massive/*` (should include `x-massive-proxy-token` header)
- Verify WebSocket connects to `/ws/options?token=...` or `/ws/indices?token=...`
- Supabase RLS errors appear as "row-level security violation" in logs
- Stale quotes show visual indicator if data is older than threshold
