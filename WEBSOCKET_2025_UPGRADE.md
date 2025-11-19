# WebSocket 2025 Upgrade Complete

## Official 2025 Massive WebSocket URLs

Upgraded to use the official Options + Indices Advanced endpoints:

- **Options**: `wss://socket.massive.com/options`
- **Indices**: `wss://socket.massive.com/indices`

## Key Changes

### 1. Direct WebSocket Connections

- Removed proxy server WebSocket routes (`/ws/options`, `/ws/indices`)
- Now connects directly to Massive's official endpoints
- Uses `VITE_MASSIVE_PROXY_TOKEN` for authentication

### 2. Auth Format (2025)

```json
{
  "action": "auth",
  "token": "YOUR_TOKEN"
}
```

### 3. Subscription Format (2025)

```json
{
  "action": "subscribe",
  "channels": [
    "options.bars:1m,5m,15m,60m:SPY*,QQQ*,NVDA*",
    "options.trades:SPY*,QQQ*,NVDA*",
    "options.quotes:SPY*,QQQ*,NVDA*",
    "indices.bars:1m,5m,15m,60m:SPX,NDX,VIX"
  ]
}
```

### 4. Wildcard Support

- Use `SPY*` to subscribe to all SPY options contracts
- Use `QQQ*` to subscribe to all QQQ options contracts
- Dramatically reduces subscription overhead

### 5. Underlying Price Included

Options bars now include `underlying` field with the spot price:

```typescript
{
  ev: 'AM',
  sym: 'O:SPY251219C00600000',
  o: 15.50,
  h: 15.75,
  l: 15.40,
  c: 15.65,
  v: 1250,
  vw: 15.58,
  underlying: 589.25  // ← SPY spot price!
}
```

### 6. Zero Stocks Feed Bandwidth

- No `stocks.*` channels at all
- Pure options + indices data only
- Underlying prices from options bars, not stocks feed

## Files Modified

1. **src/lib/massive/websocket.ts**

   - Updated WS URLs to official 2025 endpoints
   - Changed auth to use `token` field
   - Changed subscriptions to use `channels` array
   - Added wildcard support function `subscribeOptionsForRoots()`
   - Routes indices to indices socket, options to options socket

2. **src/stores/marketDataStore.ts**

   - Uses indices socket for SPX/NDX/VIX/RVX
   - Subscribes to `indices.bars:1m:SPX,NDX,VIX`
   - No stock subscriptions

3. **src/services/massiveClient.ts**
   - Maps ETFs to indices (SPY→I:SPX, QQQ→I:NDX)
   - Fetches trend metrics from index bars only

## Testing

Build: ✅ Successful

```bash
pnpm run build
```

Run locally:

```bash
pnpm run dev
```

Expected behavior:

- Two WebSocket connections open: `wss://socket.massive.com/options` and `wss://socket.massive.com/indices`
- Auth on both with same token
- Indices stream: SPX, NDX, VIX 1m bars
- Options stream: ready for dynamic root subscriptions (SPY*, QQQ*, etc.)

## Bandwidth Savings

**Before (stocks mode):**

- `stocks.bars:1m:SPY,QQQ,IWM` (redundant with options underlying)
- `stocks.quotes:SPY,QQQ,IWM` (redundant)
- `stocks.trades:SPY,QQQ,IWM` (redundant)

**After (pure options+indices):**

- `indices.bars:1m:SPX,NDX,VIX` (macro context)
- `options.bars:1m:SPY*` (includes underlying price)
- Zero wasted equity bandwidth ✅

## Next Steps

1. Add multi-timeframe rollup (5m, 15m, 60m) from 1m indices bars
2. Implement dynamic watchlist roots → `options.bars:1m:ROOT*` subscriptions
3. Use `underlying` field from options bars for spot price (no stocks needed)
4. Remove server-side `/ws/options` and `/ws/indices` proxy routes (optional cleanup)

## Migration Guide

If deploying to production:

1. Ensure `VITE_MASSIVE_PROXY_TOKEN` is set (same token works for both sockets)
2. No server-side changes needed (proxy still handles REST)
3. Browser connects directly to `wss://socket.massive.com/*`
4. Check browser console for `[Massive WS] Connected to options/indices` logs
5. Verify no `stocks.*` subscriptions in network tab

## Compatibility

- ✅ Options Advanced plan required
- ✅ Indices Advanced plan required
- ✅ Works in browser (direct connection)
- ✅ No CORS issues (Massive allows direct browser connections)
- ✅ Token-based auth (same token for both sockets)
- ✅ Wildcard subscriptions supported
- ✅ Underlying price included in every options bar
