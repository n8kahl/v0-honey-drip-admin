# Unified Backend Architecture

## Overview

The backend has been refactored from a hodge-podge of direct Massive API calls into a **unified, normalized data layer** with:

- **Consistent REST APIs** for quotes, options chains, and bars
- **Server-side caching** with automatic TTL and exponential backoff
- **Symbol normalization** to handle indices (I: prefix) and aliases
- **Market-aware DTE** using trading days and US holiday calendar
- **Dynamic strike banding** to ensure minimum contract coverage
- **Greeks & pricing policy** with NBBO mid preference and fallbacks

---

## Normalized Endpoints

### GET /api/quotes?tickers=SPY,SPX,NDX

**Returns**: Normalized quotes for stocks and indices.

**Response**:

```json
{
  "results": [
    {
      "symbol": "SPY",
      "last": 456.78,
      "change": 1.23,
      "changePercent": 0.27,
      "asOf": 1700000000000,
      "source": "stocks"
    }
  ]
}
```

**Caching**: 500ms TTL for indices, 1s for stocks.

---

### GET /api/options/chain?symbol=SPX&window=10

**Returns**: ATM-centered options chain with exactly N strikes per side (calls/puts) per expiration.

**Features**:

- Resolves underlying price (indices via snapshot, stocks via fallback)
- Filters by strike band (±20–50%, widens dynamically if needed)
- Merges reference contracts with snapshot greeks/prices
- Returns 10 ITM + 10 OTM per side around ATM

**Response**:

```json
{
  "symbol": "SPX",
  "price": 6734.21,
  "asOf": "2025-11-16T22:00:00.000Z",
  "expirations": [
    {
      "date": "2025-11-18",
      "dte": 2,
      "atmStrike": 6735,
      "calls": [...],
      "puts": [...]
    }
  ]
}
```

**Caching**: 1s snapshot, 30s contracts.

---

### GET /api/bars?symbol=SPY&timespan=minute&multiplier=1&from=2025-11-16&to=2025-11-17&limit=500

**Returns**: Normalized bars for stocks, indices, and options.

**Response**:

```json
{
  "symbol": "SPY",
  "timespan": "minute",
  "multiplier": 1,
  "from": "2025-11-16",
  "to": "2025-11-17",
  "adjusted": true,
  "count": 390,
  "bars": [
    {
      "timestamp": 1700000000000,
      "open": 456.0,
      "high": 456.5,
      "low": 455.8,
      "close": 456.2,
      "volume": 1234567,
      "vwap": 456.15,
      "trades": 890
    }
  ]
}
```

**Caching**: 5s TTL.

---

### GET /api/market/status

**Returns**: Current market session and next open time.

**Response**:

```json
{
  "isOpen": false,
  "session": "closed",
  "nextOpen": "2025-11-18T14:30:00.000Z",
  "timestamp": "2025-11-16T22:00:00.000Z"
}
```

---

## Client Services

### src/services/quotes.ts

```typescript
import { fetchQuotes, useUnifiedQuotes } from "../services/quotes";

// Polling hook (3s interval)
const quotes = useUnifiedQuotes(["SPY", "SPX"], 3000);

// One-shot fetch
const quotes = await fetchQuotes(["SPY", "SPX"]);
```

### src/services/options.ts

```typescript
import { fetchNormalizedChain } from "../services/options";

// Fetch ATM-centered chain (10 per side)
const contracts = await fetchNormalizedChain("SPX", 10);
```

### src/services/bars.ts

```typescript
import { fetchBars } from "../services/bars";

// Fetch 5-minute bars for SPX
const bars = await fetchBars(
  "SPX",
  "minute",
  5,
  "2025-11-12",
  "2025-11-17",
  500
);
```

---

## Symbol Normalization

### Server: server/lib/symbolUtils.ts

- `normalizeSymbolForMassive(symbol)` → adds `I:` prefix for indices (SPX → I:SPX)
- `isIndex(symbol)` → checks if symbol is SPX/NDX/VIX/RUT/DJI
- `SYMBOL_ALIASES` → maps SPXW → SPX, NDXP → NDX

### Client: src/lib/symbolUtils.ts

- `normalizeSymbolForUI(symbol)` → removes `I:` prefix for display
- `normalizeSymbolForAPI(symbol)` → adds `I:` for indices
- `isIndex(symbol)`, `isEquity(symbol)` → helpers

---

## Caching Strategy

### server/lib/cache.ts

- **LRU Cache** with separate TTLs:

  - Snapshots: 1s
  - Contracts: 30s
  - Indices: 500ms
  - Bars: 5s

- **Exponential Backoff**: 100ms → 200ms → 400ms on 5xx errors
- **No retry on 4xx** (client errors)
- **cachedFetch()** wrapper for automatic cache + retry

---

## Market Calendar

### server/lib/marketCalendar.ts

- **US market holidays** (2024–2026): New Year's, MLK, Presidents, Good Friday, Memorial, Juneteenth, July 4th, Labor, Thanksgiving, Christmas
- **isMarketOpen(date)**: checks weekends + holidays
- **calculateDTE(expiry, ref)**: trading days to expiration (not calendar days)
- **getMarketStatus()**: returns session (premarket, open, afterhours, closed) and next open time

**Used in**: /api/options/chain for accurate DTE computation.

---

## Greeks & Pricing Policy

**Policy** (documented in code):

1. **Greeks**: from options snapshot (`greeks.delta/gamma/theta/vega`)
2. **IV**: `implied_volatility` from snapshot
3. **Price**:
   - **Prefer**: NBBO mid `(bid + ask) / 2` when both available
   - **Fallback**: `last_trade.p`
   - **Last resort**: single-side quote (`ap` or `bp`)

**Rounding**: monetary values to 2 decimals; strikes to instrument tick size.

---

## Dynamic Strike Banding

**Problem**: Legacy SPX contracts include strikes from $200–$2200; we need current-price-relevant strikes.

**Solution**:

1. Start with ±20% band around underlying price
2. Fetch contracts with `strike_price.gte` and `strike_price.lte` filters
3. If total contracts < `perSide * 4`, widen band by 10% (max ±50%)
4. Retry up to 3 times until minimum contracts met

**Logged**: `[v0] Widening strike band to ±30% for SPX (attempt 2)`

---

## DTE Calculation

**Old**: Calendar days via `Math.ceil((expiry - today) / 86400000)`

**New**: Trading days via market calendar:

- Excludes weekends
- Excludes US market holidays
- Correct for 0DTE and next-day expiries

**Example**: Friday expiry on a Wednesday = 2 trading days (Wed, Thu), not 2 calendar days.

---

## Migration Status

### ✅ Completed

- Normalized /api/quotes, /api/options/chain, /api/bars, /api/market/status
- Client services: quotes.ts, options.ts, bars.ts
- Symbol normalization (server + client)
- LRU caching with exponential backoff
- Market calendar and trading-day DTE
- Dynamic strike banding
- Greeks & mid-price policy
- Fixed DesktopLiveCockpit type errors (AlertType, TradeUpdate)
- useMassiveData migrated to unified chain endpoint

### 🚧 Remaining

- **Unified streaming**: Server WS bridge for quotes/options with normalized payloads; deprecate client transport-policy.ts
- **Stale indicators**: UI badges when asOf > thresholds (5s WS, 6s REST)
- **Unit tests**: Vitest tests for /api/quotes, /api/options/chain with mocked Massive responses
- **Deprecations**: Mark /api/massive/\* as deprecated for app use (keep for debugging)

---

## Environment Variables

### Server-side (never exposed to client)

- `MASSIVE_API_KEY` — Massive.com API key
- `MASSIVE_PROXY_TOKEN` — Shared secret for REST/WS proxy auth
- `MASSIVE_BASE_URL` — (optional) defaults to https://api.massive.com

### Client-side

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_MASSIVE_PROXY_TOKEN` — Matches server's `MASSIVE_PROXY_TOKEN`
- `VITE_USE_UNIFIED_CHAIN` — (optional) defaults to `true`
- `VITE_USE_UNIFIED_QUOTES` — (optional) defaults to `true`

---

## Feature Flags

- **VITE_USE_UNIFIED_CHAIN**: When `true` (default), uses `/api/options/chain`; when `false`, uses legacy Massive client
- **VITE_USE_UNIFIED_QUOTES**: When `true` (default), uses `/api/quotes`; when `false`, uses legacy streaming

---

## Deprecation Plan

### Deprecated (keep for debugging only)

- `/api/massive/*` — Direct Massive proxies; replaced by normalized endpoints
- `src/lib/massive/client.ts` — Direct client calls; replaced by services
- `src/lib/massive/transport-policy.ts` — Client-side WS; to be replaced by server WS bridge

### Keep

- `src/lib/massive/websocket.ts` — For now, used by live PnL tracking; will migrate to server WS
- `server/massive/client.ts` — Server-side Massive helpers; still used by normalized endpoints

---

## Testing Normalized Endpoints

### Health Check

```bash
curl http://localhost:8080/api/health | jq .
```

### Quotes

```bash
curl -H "x-massive-proxy-token: $VITE_MASSIVE_PROXY_TOKEN" \
  "http://localhost:8080/api/quotes?tickers=SPY,SPX,NDX" | jq .
```

### Options Chain

```bash
curl -H "x-massive-proxy-token: $VITE_MASSIVE_PROXY_TOKEN" \
  "http://localhost:8080/api/options/chain?symbol=SPX&window=10" | jq .
```

### Bars

```bash
curl -H "x-massive-proxy-token: $VITE_MASSIVE_PROXY_TOKEN" \
  "http://localhost:8080/api/bars?symbol=SPY&timespan=minute&multiplier=5&from=2025-11-12&to=2025-11-17&limit=100" | jq .
```

### Market Status

```bash
curl "http://localhost:8080/api/market/status" | jq .
```

---

## Build & Deploy

```bash
# Install deps
pnpm install

# Dev (Vite + tsx watch)
pnpm run dev

# Build (Vite dist + tsc server)
pnpm run build

# Production
pnpm run start
```

---

## Architecture Diagram

```
┌─────────────┐
│  Browser    │
│  (React)    │
└──────┬──────┘
       │ /api/quotes, /api/options/chain, /api/bars
       ▼
┌─────────────────────────────────────┐
│  Express Server (server/index.ts)   │
│  ├── /api/quotes                    │
│  ├── /api/options/chain             │
│  ├── /api/bars                      │
│  ├── /api/market/status             │
│  └── /api/massive/* (deprecated)    │
└──────┬──────────────────────────────┘
       │ LRU cache (1s–30s TTL)
       │ Exponential backoff (100ms–2s)
       ▼
┌──────────────────────┐
│  Massive.com API     │
│  - /v3/snapshot/*    │
│  - /v3/reference/*   │
│  - /v2/aggs/*        │
└──────────────────────┘
```

---

## Next Steps

1. **Implement server WS bridge**: Single WebSocket for quotes/options with normalized messages; client subscribes/unsubscribes
2. **Add stale indicators**: UI shows badge when quote.asOf > 5s (WS) or 6s (REST)
3. **Unit tests**: Mock Massive responses, test normalization logic
4. **Document deprecations**: Update README with migration guide for legacy code

---

## Contact

Questions? See `.github/copilot-instructions.md` or the main README.
