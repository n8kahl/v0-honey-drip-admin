# Architecture Review: Real-Time Data Streaming

## Current Architecture

### Data Flow Layers

```
User Interface (Chart/Watchlist/Options)
           ↓
    React Hooks Layer
  (useQuotes, useOptionsChain, HDLiveChart)
           ↓
   Transport Policy Layer
  (WebSocket-first with REST fallback)
           ↓
    Protocol Layer
  (massiveWS + massiveClient)
           ↓
    Proxy Server Layer
  (Express /api/massive/*)
           ↓
    Massive.com API
```

## Issues Identified

### 🔴 CRITICAL: Chart Data Fetching

**Problem**: Chart uses WebSocket for **live aggregates** but fetches **historical bars via REST on load**

- Historical: REST API call (good ✅)
- Live updates: WebSocket subscription (creates fake aggregates from quote data ❌)

**Current Code** (HDLiveChart.tsx line 475-555):

```typescript
// WebSocket subscribes to QUOTES, converts to fake aggregates
massiveWS.subscribeAggregates([ticker], (message) => {
  const agg = message.data;
  const newBar: Bar = {
    time: Math.floor(agg.timestamp / 1000),
    open: agg.open, // ← Same as close!
    high: agg.high, // ← Same as close!
    low: agg.low, // ← Same as close!
    close: agg.close, // ← Only real value
    volume: agg.volume,
  };
  // ...update chart
});
```

**WebSocket Handler** (websocket.ts line 408-414):

```typescript
subscribeAggregates(symbols: string[], callback) {
  return this.subscribeQuotes(symbols, (message) => {
    const data = message.data as QuoteUpdate;
    // Creates fake aggregate with open=high=low=close=last price
    callback(this.toAggregateMessage(data.symbol, data.last, data.timestamp, data.volume));
  });
}
```

**Why This is Bad**:

1. **Fake candlesticks**: OHLC are all the same value (last price)
2. **Misleading visuals**: Chart shows "bars" that aren't real time-period aggregates
3. **Resource waste**: Constant WebSocket messages create tiny micro-bars
4. **Poor UX**: User sees chart "ticking" but bars aren't meaningful

### 🟡 MODERATE: Options Chain Polling

**Problem**: Polling options chain every 3 seconds is excessive

**Current Code** (useMassiveData.ts line 147-157):

```typescript
// Refresh every 3 seconds while panel is open
const refreshInterval = setInterval(() => {
  if (rateLimitedRef.current) return;
  fetchOptionsChain(); // Full chain fetch
}, 3000);
```

**Why This is Problematic**:

1. **Rate limit risk**: Each call fetches 100-1000+ contracts
2. **Bandwidth waste**: Options chains are large (50KB-500KB)
3. **Unnecessary**: Options prices don't need 3s updates
4. **Battery drain**: Mobile devices suffer

### 🟢 GOOD: Quote Streaming

**What Works Well**:

```typescript
// transport-policy.ts adaptive polling
- WebSocket first, 3s REST fallback
- Batched updates (50ms buffer)
- Adaptive intervals based on market hours
- Health monitoring with reconnect
```

This is **excellent architecture** for watchlist prices ✅

## Recommended Changes

### 1. Fix Chart Data: Disable Live WebSocket Aggregates

**Recommendation**: Use REST-only for chart bars, disable fake WebSocket aggregates

**Rationale**:

- Massive.com doesn't provide true aggregate streams on free tier
- Creating fake OHLC from quotes is misleading
- Historical bars are sufficient for 5-minute charts
- User can refresh to get latest bars

**Implementation**:

```typescript
// HDLiveChart.tsx - REMOVE WebSocket subscription for aggregates
useEffect(() => {
  // DELETE this entire WebSocket subscription block (lines 474-555)
  // Only keep historical REST fetch
}, [ticker]);

// Instead, add a manual refresh mechanism:
const refreshChart = useCallback(() => {
  loadHistoricalBars();
}, [loadHistoricalBars]);

// Add refresh button to UI
<Button onClick={refreshChart}>Refresh Chart</Button>;
```

### 2. Reduce Options Chain Polling

**Recommendation**: Increase interval from 3s to 10-15s

**Rationale**:

- Options prices change less frequently than stocks
- 10s refresh is plenty for trading decisions
- Reduces API usage by 70%
- Still feels "live" to users

**Implementation**:

```typescript
// useMassiveData.ts
const REFRESH_INTERVAL = 12000; // 12 seconds (was 3s)

// Add pause/resume based on visibility
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearInterval(refreshInterval);
    } else {
      fetchOptionsChain(); // Refresh on return
      refreshInterval = setInterval(fetchOptionsChain, REFRESH_INTERVAL);
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () =>
    document.removeEventListener("visibilitychange", handleVisibilityChange);
}, [fetchOptionsChain]);
```

### 3. Add Chart Auto-Refresh on Interval

**Recommendation**: Auto-refresh chart bars every 30-60 seconds (not real-time)

**Implementation**:

```typescript
// HDLiveChart.tsx
useEffect(() => {
  // Refresh bars every 60 seconds
  const refreshInterval = setInterval(() => {
    if (document.hidden) return; // Don't fetch when tab inactive
    loadHistoricalBars();
  }, 60000);

  return () => clearInterval(refreshInterval);
}, [loadHistoricalBars]);
```

### 4. Optimize TransportPolicy for Market Hours

**Current State**: Already good! ✅

- Adaptive polling intervals
- Market hours detection
- Exponential backoff

**Minor Enhancement**: Add even longer intervals for after-hours

```typescript
// transport-policy.ts
private getOptimalPollInterval(): number {
  // ...existing code...

  // After 8 PM ET, slow down even more
  const isLateNight = hour >= 20 || hour < 4;
  if (isLateNight) {
    return 30000; // 30s for late night/early morning
  }

  // ...rest of existing logic...
}
```

## Performance Impact Analysis

### Current (Before Changes)

- **Chart**: 10-30 WS messages/sec = ~1800 msgs/min per chart
- **Options Chain**: 20 fetches/min × 200KB = 4 MB/min
- **Quotes**: 20 fetches/min × 5 symbols × 1KB = 100 KB/min
- **Total**: ~4.1 MB/min bandwidth

### Proposed (After Changes)

- **Chart**: 1 fetch/min × 50KB = 50 KB/min (98% reduction ✅)
- **Options Chain**: 5 fetches/min × 200KB = 1 MB/min (75% reduction ✅)
- **Quotes**: 20 fetches/min × 5 symbols × 1KB = 100 KB/min (unchanged)
- **Total**: ~1.15 MB/min bandwidth (72% reduction 🎉)

## User Experience Impact

### What Users Lose

- ❌ Fake "live" chart ticking (was misleading anyway)
- ❌ 3-second options chain updates (overkill for trading)

### What Users Gain

- ✅ Honest, accurate chart data (real bars, not fake)
- ✅ Better performance (less battery, less bandwidth)
- ✅ Lower rate limit risk (fewer API calls)
- ✅ Chart panning works smoothly (already fixed)
- ✅ Manual refresh control (when they want latest data)

## Implementation Priority

1. **High Priority - Remove Chart WebSocket** (30 min)

   - Delete WebSocket aggregate subscription
   - Add manual refresh button
   - Add 60s auto-refresh

2. **High Priority - Reduce Options Polling** (15 min)

   - Change 3s → 12s interval
   - Add visibility-based pause/resume

3. **Medium Priority - Chart Auto-Refresh** (10 min)

   - Add 60s interval timer
   - Respect document.hidden state

4. **Low Priority - Enhanced Transport Policy** (20 min)
   - Add late-night interval detection
   - Add connection quality metrics

**Total Time**: ~1.5 hours
**Impact**: Massive improvement in sustainability and honest UX

## Alternative: Paid Tier Considerations

If upgrading to Massive.com paid tier with true aggregate streams:

1. **Keep** WebSocket for chart (real aggregates available)
2. **Add** differential updates for options (only changed contracts)
3. **Implement** smart batching (combine multiple updates)
4. **Add** compression for WebSocket messages

But for **free tier**, the recommended changes above are optimal.

## Conclusion

**Current architecture is 80% excellent**:

- ✅ Transport policy is sophisticated
- ✅ WebSocket-first with fallback is smart
- ✅ Batching and health monitoring are solid

**But 20% needs fixing**:

- ❌ Chart WebSocket creates fake data
- ❌ Options polling is too aggressive
- ❌ No respect for battery/bandwidth

**Recommended fixes make it 100% excellent** while being honest about free tier limitations.
