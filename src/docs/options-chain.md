# Options Chain (Webull-like)

- Default expirations: window=8 (more than 4), similar to Webull.
- Hook: `useOptionsChain(symbol, window?)` returns `{ optionsChain, contracts, loading, error, asOf }`.
- Stream wrapper: `useStreamingOptionsChain(symbol)` returns `{ contracts, loading, error, isStale, asOf }`.
- Consumers (e.g., `DesktopLiveCockpitSlim`) render loading/error states and only display the grid when data is present.
- Normalization: uses unified `/api/options/chain` via `fetchNormalizedChain`; falls back to Massive legacy when disabled.
- Staleness: data considered stale if `Date.now() - asOf > 5000` ms.

## Tuning

- Increase/decrease expirations via `useOptionsChain(symbol, window)` parameter.
- Environment: unified chain is on by default; override with `VITE_USE_UNIFIED_CHAIN=false`.

## Tests

- Vitest covers `useOptionsChain` window behavior under `src/hooks/__tests__/useOptionsChain.test.ts`.
