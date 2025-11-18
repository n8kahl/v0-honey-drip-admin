# Quick Reference: Using marketDataStore

## Import the Store

```typescript
import { useMarketDataStore } from "@/stores/marketDataStore";
```

## Initialize (Once at App Start)

```typescript
// In App.tsx or main component
useEffect(() => {
  const watchlistSymbols = ["SPY", "AAPL", "TSLA"]; // From user's watchlist
  useMarketDataStore.getState().initialize(watchlistSymbols);

  return () => {
    useMarketDataStore.getState().cleanup();
  };
}, []);
```

## Access Data in Components

### Get Indicators

```typescript
function MyComponent({ symbol }: { symbol: string }) {
  const indicators = useMarketDataStore(
    (state) => state.symbols[symbol.toUpperCase()]?.indicators
  );

  return (
    <div>
      <p>EMA9: {indicators?.ema9?.toFixed(2)}</p>
      <p>RSI14: {indicators?.rsi14?.toFixed(2)}</p>
      <p>VWAP: {indicators?.vwap?.toFixed(2)}</p>
    </div>
  );
}
```

### Get Candles for Chart

```typescript
function Chart({
  symbol,
  timeframe,
}: {
  symbol: string;
  timeframe: Timeframe;
}) {
  const candles = useMarketDataStore(
    (state) => state.symbols[symbol.toUpperCase()]?.candles[timeframe] || []
  );

  // Pass to lightweight-charts or your chart library
  return <LightweightChart data={candles} />;
}
```

### Get Confluence Score

```typescript
function ConfluenceDisplay({ symbol }: { symbol: string }) {
  const confluence = useMarketDataStore(
    (state) => state.symbols[symbol.toUpperCase()]?.confluence
  );

  if (!confluence) return <div>Loading...</div>;

  return (
    <div>
      <h3>Confluence: {confluence.overall}/100</h3>
      <ul>
        <li>Trend: {confluence.trend}</li>
        <li>Momentum: {confluence.momentum}</li>
        <li>Technical: {confluence.technical}</li>
      </ul>

      <h4>Components</h4>
      <ul>
        <li>
          Trend Alignment: {confluence.components.trendAlignment ? "✅" : "❌"}
        </li>
        <li>Above VWAP: {confluence.components.aboveVWAP ? "✅" : "❌"}</li>
        <li>RSI Confirm: {confluence.components.rsiConfirm ? "✅" : "❌"}</li>
        <li>
          Volume Confirm: {confluence.components.volumeConfirm ? "✅" : "❌"}
        </li>
      </ul>
    </div>
  );
}
```

### Get MTF Trend

```typescript
function TrendIndicator({ symbol }: { symbol: string }) {
  const mtfTrend = useMarketDataStore(
    (state) => state.symbols[symbol.toUpperCase()]?.mtfTrend
  );

  if (!mtfTrend) return null;

  return (
    <div>
      <div>1m: {getTrendEmoji(mtfTrend["1m"])}</div>
      <div>5m: {getTrendEmoji(mtfTrend["5m"])}</div>
      <div>15m: {getTrendEmoji(mtfTrend["15m"])}</div>
      <div>60m: {getTrendEmoji(mtfTrend["60m"])}</div>
      <div>1D: {getTrendEmoji(mtfTrend["1D"])}</div>
    </div>
  );
}

function getTrendEmoji(trend: MTFTrend) {
  switch (trend) {
    case "bull":
      return "🟢";
    case "bear":
      return "🔴";
    case "neutral":
      return "⚪";
  }
}
```

### Get Strategy Signals

```typescript
function Signals({ symbol }: { symbol: string }) {
  const signals = useMarketDataStore(
    (state) => state.symbols[symbol.toUpperCase()]?.strategySignals || []
  );

  return (
    <div>
      <h3>Strategy Signals</h3>
      {signals.map((signal) => (
        <div key={signal.id}>
          <strong>{signal.strategy}</strong>: {signal.signal}
          <span> (Confidence: {signal.confidence}%)</span>
          <p>{signal.reason}</p>
        </div>
      ))}
    </div>
  );
}
```

### Check Connection Status

```typescript
function ConnectionStatus() {
  const isConnected = useMarketDataStore((state) => state.isConnected);

  return <div>{isConnected ? "🟢 Connected" : "🔴 Disconnected"}</div>;
}
```

### Check if Data is Stale

```typescript
function StaleIndicator({ symbol }: { symbol: string }) {
  const lastUpdated = useMarketDataStore(
    (state) => state.symbols[symbol.toUpperCase()]?.lastUpdated
  );

  const isStale = lastUpdated && Date.now() - lastUpdated > 10000; // 10 seconds

  return isStale ? <span>⚠️ Stale Data</span> : null;
}
```

## Add/Remove Symbols Dynamically

```typescript
function WatchlistManager() {
  const subscribe = useMarketDataStore((state) => state.subscribe);
  const unsubscribe = useMarketDataStore((state) => state.unsubscribe);

  const handleAddSymbol = (symbol: string) => {
    subscribe(symbol); // Automatically sends WS subscription
  };

  const handleRemoveSymbol = (symbol: string) => {
    unsubscribe(symbol); // Automatically sends WS unsubscription
  };

  return (
    <div>
      <button onClick={() => handleAddSymbol("AAPL")}>Add AAPL</button>
      <button onClick={() => handleRemoveSymbol("AAPL")}>Remove AAPL</button>
    </div>
  );
}
```

## Performance Tips

### 1. Use Specific Selectors (Avoid Re-renders)

❌ **Bad** (re-renders on ANY store change):

```typescript
const store = useMarketDataStore();
const indicators = store.symbols["SPY"]?.indicators;
```

✅ **Good** (only re-renders when SPY indicators change):

```typescript
const indicators = useMarketDataStore(
  (state) => state.symbols["SPY"]?.indicators
);
```

### 2. Select Only What You Need

❌ **Bad** (re-renders when any symbol changes):

```typescript
const allSymbols = useMarketDataStore((state) => state.symbols);
const spyIndicators = allSymbols["SPY"]?.indicators;
```

✅ **Good** (only re-renders when SPY indicators change):

```typescript
const spyIndicators = useMarketDataStore(
  (state) => state.symbols["SPY"]?.indicators
);
```

### 3. Use Equality Function for Deep Comparisons

```typescript
import { shallow } from "zustand/shallow";

const [ema9, rsi14] = useMarketDataStore(
  (state) => [
    state.symbols["SPY"]?.indicators.ema9,
    state.symbols["SPY"]?.indicators.rsi14,
  ],
  shallow
);
```

## Common Patterns

### Multi-Symbol Display

```typescript
function MultiSymbolDashboard({ symbols }: { symbols: string[] }) {
  // Get all symbols' data in one selector
  const symbolsData = useMarketDataStore((state) =>
    symbols.reduce((acc, symbol) => {
      acc[symbol] = state.symbols[symbol.toUpperCase()];
      return acc;
    }, {} as Record<string, SymbolData>)
  );

  return (
    <div>
      {symbols.map((symbol) => (
        <div key={symbol}>
          <h3>{symbol}</h3>
          <p>EMA9: {symbolsData[symbol]?.indicators.ema9}</p>
          <p>Confluence: {symbolsData[symbol]?.confluence.overall}</p>
        </div>
      ))}
    </div>
  );
}
```

### Compare MTF Trends

```typescript
function CompareTimeframes({ symbol }: { symbol: string }) {
  const mtfTrend = useMarketDataStore(
    (state) => state.symbols[symbol.toUpperCase()]?.mtfTrend
  );

  const isAligned = mtfTrend && new Set(Object.values(mtfTrend)).size === 1; // All same trend

  return (
    <div>
      {isAligned ? (
        <span>✅ All timeframes aligned: {mtfTrend["5m"]}</span>
      ) : (
        <span>⚠️ Mixed signals across timeframes</span>
      )}
    </div>
  );
}
```

### Real-time Price Updates

```typescript
function LivePrice({ symbol }: { symbol: string }) {
  const lastCandle = useMarketDataStore((state) => {
    const candles = state.symbols[symbol.toUpperCase()]?.candles["1m"];
    return candles?.[candles.length - 1];
  });

  if (!lastCandle) return <div>Loading...</div>;

  return (
    <div>
      <h2>{symbol}</h2>
      <p>Price: ${lastCandle.close.toFixed(2)}</p>
      <p>Volume: {lastCandle.volume.toLocaleString()}</p>
      <p>Updated: {new Date(lastCandle.time).toLocaleTimeString()}</p>
    </div>
  );
}
```

## Debugging

### Log All Store State

```typescript
// In browser console or component
console.log("[v0] Store state:", useMarketDataStore.getState());
```

### Watch Specific Symbol

```typescript
// In browser console
useMarketDataStore.subscribe(
  (state) => state.symbols["SPY"],
  (spyData) => console.log("[v0] SPY updated:", spyData)
);
```

### Check WebSocket Status

```typescript
const wsConnection = useMarketDataStore.getState().wsConnection;
console.log("[v0] WebSocket:", {
  isConnected: useMarketDataStore.getState().isConnected,
  readyState: wsConnection?.ws?.readyState,
  reconnectAttempts: wsConnection?.reconnectAttempts,
});
```

## Migration Checklist

When migrating a component to use marketDataStore:

- [ ] Remove local state (`useState`) for indicators/candles/confluence
- [ ] Remove `useEffect` hooks that fetch or calculate market data
- [ ] Replace with `useMarketDataStore` selectors
- [ ] Test that component updates in real-time
- [ ] Verify data matches existing calculations
- [ ] Remove any local indicator calculation imports
- [ ] Update tests to use store instead of mocking API calls

## TypeScript Types

All types are exported from `src/stores/marketDataStore.ts`:

```typescript
import type {
  Timeframe,
  MTFTrend,
  Candle,
  Indicators,
  ConfluenceScore,
  SymbolData,
  MarketDataStore,
} from "@/stores/marketDataStore";
```

---

**Questions?** Check `MARKET_DATA_STORE_COMPLETE.md` for full implementation details.
