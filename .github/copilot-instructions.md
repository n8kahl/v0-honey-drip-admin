# Copilot Instructions for Honey Drip Admin

## TL;DR for AI Agents

- Frontend: React 18 + TypeScript + Vite. Backend: Express proxy + WS bridges. DB: Supabase with strict RLS. Market data: Massive.com OPTIONS/INDICES.
- Real-time first: WebSocket streaming per symbol with automatic REST fallback + staleness tracking.
- Secrets never in browser: `MASSIVE_API_KEY` and `MASSIVE_PROXY_TOKEN` are server-only.

## Run / Build / Test

- Dev: `pnpm install` then `pnpm run dev` (concurrently runs `vite` and `tsx watch server/index.ts`).
- Build: `pnpm run build` (Vite build + `tsc -p tsconfig.server.json` to `server/dist`). Start: `pnpm run start`.
- Tests: `pnpm test` (Vitest), E2E: `pnpm run test:e2e` (Playwright). UI/headed/debug variants available.

## Security & Proxies

- REST proxy: `/api/massive/*` authenticates with server `MASSIVE_API_KEY`.
- WS proxies: `/ws/options` and `/ws/indices` require `token={MASSIVE_PROXY_TOKEN}`; server mirrors client subscriptions.
- Ephemeral token route available in `server/massive-proxy.ts`: `POST /api/massive/ws-token` (5-minute tokens), but primary WS auth uses `MASSIVE_PROXY_TOKEN`.

## Real-Time Data Pattern

- Use `createTransport(symbol, cb, { isOption?, isIndex? })` from `src/lib/massive/transport-policy.ts`.
- Behavior: WebSocket first; fallback to REST polling (adaptive, ~2–10s) when WS unhealthy; switch back on recovery.
- Staleness windows: WebSocket > 5s, REST > 6s. Batching flush: 100ms.
- Example (quotes): `useQuotes(['AAPL','SPY'])` sets per-symbol transports and updates `asOf` + `source`.

## Database & RLS

- Run `scripts/001_create_schema.sql` in Supabase; all core tables enforce `user_id` RLS (`profiles`, `discord_channels`, `challenges`, `watchlist`, `trades`, `trade_updates`).
- Always filter by `user_id`; use helpers in `src/lib/supabase/` where available.

## Key Patterns

- Risk engine (`src/lib/riskEngine/`): DTE → Trade type mapping (<1 Scalp, <5 Day, <30 Swing, ≥30 LEAP). Use `calculator.ts` via hooks.
- Options chain: `useMassiveData().fetchOptionsChain(symbol)` uses unified normalized chain; legacy Massive chain is fallback.
- Logging: prefix verbose traces with `[v0]`; errors with `console.error('[v0] ...')`.
- Cleanup: transports unsubscribe on unmount/tab switch; hooks use `AbortController` and interval guards.

## Debugging

- Verify proxy headers and routes in Network tab (`/api/massive/*`), and WS URLs `/ws/options` or `/ws/indices` with `token`.
- Server health: `server/index.ts` logs port + missing env warnings; WS hub in `server/ws/*` shows auth/subscribe activity.
- Staleness UI relies on `asOf` + `source` from quote updates; expect visual stale indicators beyond thresholds.

## Pointers (files)

- `src/lib/massive/transport-policy.ts`, `src/lib/massive/websocket.ts` — streaming logic (WS-first + REST fallback). Legacy `streaming-manager.ts` is now a thin adapter delegating to transport policy.
- `src/hooks/useMassiveData.ts` — quotes/options hooks and unified chain fetch.
- `src/lib/riskEngine/*` — TP/SL logic; `calculator.ts`, `profiles.ts`, `chartLevels.ts`.
- `server/index.ts`, `server/ws/index.ts` — Express app + WS proxy hubs; `server/massive-proxy.ts` for REST/ephemeral WS token demo.
