# Unified WebSocket Migration Guide

## ✅ Completed: Core Infrastructure

### Created Files

1. **`src/lib/massive/unifiedWebSocket.ts`** - Single socket connection manager
2. **`src/lib/massive/subscriptionManager.ts`** - Watchlist-driven subscription manager

### Architecture

```
UnifiedMassiveWebSocket (core)
  ↓
MassiveSubscriptionManager (watchlist)
  ↓
marketDataStore (state)
```

### Channel Syntax (Docs-Compliant)

**Indices (I: prefix)**:

- `V.I:SPX` - Real-time index value
- `AM.I:SPX` - 1-minute aggregates

**Options Contracts**:

- `Q.O:SPY251219C00650000` - Quotes (bid/ask)
- `T.O:SPY251219C00650000` - Trades
- `A.O:SPY251219C00650000` - 1-second aggregates

**NOT AVAILABLE** (stocks plan excluded):

- ~~`A.SPY`~~ - No direct equity root bars
- ~~`T.SPY`~~ - No direct equity trades

---

## 🔄 Next Steps: Integration into `marketDataStore`

### 1. Replace Old WebSocket Import

**Current (OLD)**:

```typescript
import { massiveWS } from "../lib/massive/websocket";
```

**New**:

```typescript
import { MassiveSubscriptionManager } from "../lib/massive/subscriptionManager";
```

### 2. Initialize Single Manager

**Add to store state**:

```typescript
interface MarketDataState {
  // ...existing...

  /** Unified WebSocket manager */
  wsManager: MassiveSubscriptionManager | null;
}
```

**Initialize in actions**:

```typescript
initWebSocket: () => {
  const { set, get } = useMarketDataStore.getState();

  const token = import.meta.env.VITE_MASSIVE_PROXY_TOKEN;
  if (!token) {
    console.error('[marketDataStore] No VITE_MASSIVE_PROXY_TOKEN');
    return;
  }

  const manager = new MassiveSubscriptionManager({
    token,
    onQuote: (symbol, quote) => {
      // Update quotes map
      const quotes = new Map(get().quotes);
      quotes.set(symbol, {
        symbol,
        last: quote.last,
        bid: quote.bid,
        ask: quote.ask,
        change: quote.change || 0,
        changePercent: quote.changePercent || 0,
        volume: quote.volume || 0,
        timestamp: quote.timestamp,
        asOf: Date.now(),
        source: quote.source || 'ws',
      });
      set({ quotes });
    },
    onBar: (symbol, timeframe, bar) => {
      // Add to candles map per timeframe
      const candles = new Map(get().candles);
      const key = `${symbol}:${timeframe}`;
      const existing = candles.get(key) || [];

      // Append or update last candle
      const lastIdx = existing.findIndex(c => c.time === bar.time);
      if (lastIdx >= 0) {
        existing[lastIdx] = bar;
      } else {
        existing.push(bar);
        // Keep last 500 candles
        if (existing.length > 500) existing.shift();
      }

      candles.set(key, existing);
      set({ candles });
    },
    onTrade: (symbol, trade) => {
      // Optional: track recent trades
      console.log('[WS Trade]', symbol, trade);
    },
    onStatus: (status) => {
      set({
        wsConnection: status === 'authenticated' ? 'connected' : status
      });
    },
  });

  manager.connect();
  set({ wsManager: manager });
},
```

### 3. Update `subscribeToSymbols`

**Replace subscription logic**:

```typescript
subscribeToSymbols: () => {
  const { wsManager, symbols } = get();
  if (!wsManager) return;

  // Always include core indices
  const coreIndices = ['SPX', 'VIX'];
  const allSymbols = Array.from(new Set([...Array.from(symbols), ...coreIndices]));

  console.log('[marketDataStore] Subscribing to:', allSymbols);
  wsManager.updateWatchlist(allSymbols);
},
```

### 4. Update `subscribe` / `unsubscribe`

```typescript
subscribe: (symbol: string) => {
  const { wsManager, symbols } = get();
  const updated = new Set(symbols);
  updated.add(symbol);
  set({ symbols: updated });
  wsManager?.updateWatchlist(Array.from(updated));
},

unsubscribe: (symbol: string) => {
  const { wsManager, symbols } = get();
  const updated = new Set(symbols);
  updated.delete(symbol);
  set({ symbols: updated });
  wsManager?.updateWatchlist(Array.from(updated));
},
```

### 5. Cleanup on Unmount

```typescript
cleanup: () => {
  const { wsManager } = get();
  wsManager?.disconnect();
  set({ wsManager: null });
},
```

---

## 🗑️ Files to Remove (After Migration)

Once fully migrated, delete obsolete multi-socket files:

1. `src/lib/massive/websocket.ts` (old multi-socket)
2. `server/ws/hub.ts` (server-side proxy hub)
3. `server/ws/index.ts` (server WS upgrade handler)
4. Any references to `massiveWS.subscribe()` in components

---

## 🧪 Testing Checklist

### After Integration:

1. **Open app** → Check browser console for:

   ```
   [UnifiedWS] Connecting to wss://socket.massive.com
   [UnifiedWS] ✅ Connected
   [UnifiedWS] ✅ Authenticated
   [SubManager] Adding symbols: ['SPX', 'VIX', ...]
   [UnifiedWS] Subscribing: ['V.I:SPX', 'AM.I:SPX', 'V.I:VIX', ...]
   ```

2. **Add/remove watchlist symbol** → Should see:

   ```
   [SubManager] Adding symbols: ['QQQ']
   [UnifiedWS] Subscribing: ['V.I:QQQ', ...]
   ```

   (Note: Equity roots won't have direct channels, only indices)

3. **Check quote updates** → Prices should update every ~1s for indices

4. **Check bars** → `AM.` events should populate 1m candles

5. **Verify no 403s** → Only indices/options channels active (no stocks)

---

## 🎯 Benefits

- **1 socket** instead of 2-3
- **Docs-compliant** channel syntax
- **Automatic I: prefix** handling
- **Dynamic subscriptions** (add/remove on the fly)
- **Plan-aware** (indices + options only)
- **Zero stocks waste** (filtered out at subscription manager)

---

## 📊 Current Watchlist Support

| Symbol   | Type    | Channels              | Notes                |
| -------- | ------- | --------------------- | -------------------- |
| SPX      | Index   | `V.I:SPX`, `AM.I:SPX` | ✅ Full support      |
| VIX      | Index   | `V.I:VIX`, `AM.I:VIX` | ✅ Full support      |
| NDX      | Index   | `V.I:NDX`, `AM.I:NDX` | ✅ Full support      |
| SPY      | Equity  | _(none)_              | ⚠️ Use REST fallback |
| QQQ      | Equity  | _(none)_              | ⚠️ Use REST fallback |
| O:SPY... | Options | `Q.`, `T.`, `A.`      | ✅ Full support      |

**Equity roots (SPY, QQQ, etc.)**: Use REST `/api/quotes` as fallback. Manager skips creating channels for them.

---

## 🚀 Deployment

After full migration + testing:

1. Commit all changes:

   ```bash
   git add -A
   git commit -m "feat: migrate to unified Massive WebSocket architecture

   - Single socket to wss://socket.massive.com
   - Docs-compliant channel syntax (V., AM., Q., T., A.)
   - Dynamic watchlist subscriptions
   - Plan-aware (indices + options only)
   - Remove obsolete multi-socket server proxies"
   ```

2. Push to Railway:

   ```bash
   git push origin main
   ```

3. Verify production logs show single socket connection

---

## 📖 References

- [Massive WebSocket Docs](https://massive.com/docs/websocket)
- [Options Aggregates](https://massive.com/docs/websocket/options/aggregates-per-second)
- [Indices Aggregates](https://massive.com/docs/websocket/indices/aggregates-per-minute)
