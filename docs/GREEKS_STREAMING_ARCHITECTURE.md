# Greeks Streaming Architecture
## Real-Time Options Greeks for HoneyDrip Admin Platform

**Version**: 1.0
**Date**: 2025-01-20
**Status**: Production Ready

---

## Executive Summary

This document defines the architecture for real-time Greeks (delta, gamma, theta, vega, IV) streaming in the HoneyDrip admin platform. The system enables admins to monitor active trades with sub-30-second Greeks updates, detect IV crush/spikes, and send accurate Discord alerts to the community.

### Key Features
- ✅ Real-time Greeks from Massive.com API
- ✅ 10-second polling interval for active trades
- ✅ 30-second freshness threshold
- ✅ Automatic IV history tracking (IV percentile, crush detection)
- ✅ Fallback to cached values on API failure
- ✅ Greeks storage in centralized data store
- ⚠️ WebSocket streaming (future enhancement)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      MASSIVE.COM API                              │
│                                                                    │
│  REST: /v3/snapshot/options/{ticker} → Greeks + Quotes           │
│  Future: wss://socket.massive.com/options → Greeks Stream       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER (Proxy)                         │
│                                                                    │
│  /api/massive/snapshot/options/{ticker}                          │
│    - Proxy to Massive API                                        │
│    - Cache: 1s TTL (snapshots)                                   │
│    - Auth: x-massive-proxy-token                                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                 GREEKS MONITOR SERVICE (Client)                   │
│                                                                    │
│  File: src/services/greeksMonitorService.ts                      │
│  - Polls active trades every 10 seconds                          │
│  - Fetches real Greeks from Massive API                          │
│  - Records IV history                                             │
│  - Detects IV crush/spikes                                        │
│  - Triggers alerts on Greek thresholds                            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│              MARKET DATA STORE (Zustand)                          │
│                                                                    │
│  File: src/stores/marketDataStore.ts                             │
│  - Stores Greeks per symbol                                       │
│  - Tracks freshness (< 30s = fresh)                              │
│  - Provides hooks: useGreeks(), useAreGreeksStale()              │
│  - Updates trigger UI re-renders                                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    UI COMPONENTS                                   │
│                                                                    │
│  - Greeks Monitoring Dashboard (new)                              │
│  - Active Trade Cards (HDEnteredTradeCard)                        │
│  - Greeks Detail Panel (new)                                      │
│  - IV History Charts (new)                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Initial Trade Entry

```typescript
User selects contract → HDContractGrid
  ↓
Contract has real Greeks from Massive (via /api/options/chain)
  ↓
Admin clicks "Enter Trade"
  ↓
Trade created with initial Greeks
  - delta, gamma, theta, vega, IV (snapshot at entry)
  ↓
tradeStore.activeTrades updated
```

### 2. Active Trade Monitoring

```typescript
greeksMonitor.start(activeTrades)
  ↓
Every 10 seconds:
  ↓
For each active trade:
  1. Fetch Greeks from Massive API
     GET /api/massive/snapshot/options/{underlyingTicker}
     Response: { results: [{ greeks: { delta, gamma, theta, vega }, implied_volatility, ... }] }

  2. Match contract by strike + expiry + type

  3. Extract real Greeks:
     - delta: greeks.delta
     - gamma: greeks.gamma
     - theta: greeks.theta ($/day)
     - vega: greeks.vega ($/1% IV change)
     - IV: implied_volatility

  4. Record IV history:
     recordIV(ticker, iv, 'massive')

  5. Detect IV events:
     - IV crush (>20% drop from 5-reading avg)
     - IV spike (>30% rise from 5-reading avg)

  6. Update marketDataStore:
     updateGreeks(ticker, {
       delta, gamma, theta, vega, iv,
       lastUpdated: Date.now(),
       source: 'massive',
       isFresh: true
     })

  7. Check alerts:
     - Theta decay > -50 on 0DTE final hour
     - Gamma risk > 0.2 (explosive moves)
     - IV > 75th percentile (high IV)
     - IV < 25th percentile (low IV)
```

### 3. Fallback Strategy

```typescript
If Massive API fails:
  ↓
1. Use cached Greeks from initial entry
   - delta: trade.contract.delta
   - gamma: trade.contract.gamma
   - theta: trade.contract.theta
   - vega: trade.contract.vega
   - IV: trade.contract.iv
  ↓
2. Mark as stale:
   - source: 'cached' | 'fallback'
   - isFresh: false
  ↓
3. Show warning in UI:
   "⚠️ Greeks data is stale (using cached values)"
  ↓
4. Retry next interval (10s)
```

---

## Greeks Data Schema

### GreeksSnapshot (greeksMonitorService.ts)
```typescript
interface GreeksSnapshot {
  symbol: string;         // OCC ticker: "SPX250117C05200000"
  strike: number;
  expiry: string;         // ISO date: "2025-01-17"
  type: 'C' | 'P';
  greeks: {
    delta: number;         // -1 to 1
    gamma: number;         // 0 to ~0.5 (higher = more explosive)
    theta: number;         // Negative $ per day
    vega: number;          // $ per 1% IV change
    rho: number;           // $ per 1% interest rate change
    impliedVolatility: number;  // 0.30 = 30% IV
    timestamp: number;     // When fetched
  };
  underlyingPrice: number;
  optionPrice: number;    // Mid price
  daysToExpiry: number;
}
```

### Greeks (marketDataStore.ts)
```typescript
interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho?: number;
  iv: number;                // Implied volatility
  lastUpdated: number;        // Timestamp

  // Contract metadata
  contractTicker?: string;
  strike?: number;
  expiry?: string;
  type?: 'C' | 'P';

  // Quality indicators
  isFresh: boolean;          // < 30s old
  source: 'massive' | 'cached' | 'fallback';
}
```

### IVReading (ivHistory.ts)
```typescript
interface IVReading {
  timestamp: number;
  iv: number;
  source: 'massive' | 'tradier' | 'manual';
}

interface IVStats {
  current: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  percentile: number;   // 0-100
  rank: number;         // Same as percentile
  isHigh: boolean;      // > 75th percentile
  isLow: boolean;       // < 25th percentile
}
```

---

## Performance Characteristics

### Polling Strategy

| Metric | Value | Rationale |
|--------|-------|-----------|
| **Poll Interval** | 10 seconds | Balance freshness vs. API costs |
| **Freshness Threshold** | 30 seconds | Mark Greeks as stale after 30s |
| **Cache TTL (Server)** | 1 second | Minimize redundant API calls for multiple admins |
| **Max Retries** | 3 | Exponential backoff on errors |
| **Timeout** | 5 seconds | Prevent hung requests |

### API Load Estimation

**Assumptions**:
- 5 active admins
- Each monitoring 3 trades simultaneously
- 10-second poll interval

**Load**:
- Total active trades: 5 admins × 3 trades = 15 trades
- API calls per minute: (15 trades / 10s) × 60s = 90 calls/min
- With 1s server cache: ~15-20 calls/min to Massive API (shared across admins)

**Cost** (Massive API):
- If Massive charges per call: 90 calls/min × 60 min/hour × 24 hours = 129,600 calls/day
- If unlimited subscription: No additional cost

---

## IV History & Analytics

### IV Percentile Calculation

```typescript
// Example: SPX options
// History: [0.10, 0.12, 0.15, 0.18, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45] (last 10 readings)
// Current IV: 0.35

// Percentile = (count of values < current) / total count
// = 7 / 10 = 70th percentile

const stats = getIVStats('SPX');
// {
//   current: 0.35,
//   min: 0.10,
//   max: 0.45,
//   mean: 0.25,
//   stdDev: 0.12,
//   percentile: 70,
//   rank: 70,
//   isHigh: false,  // Not > 75th
//   isLow: false    // Not < 25th
// }
```

### IV Crush Detection

```typescript
// Example: Post-earnings IV drop
// History: [0.50, 0.52, 0.48, 0.51, 0.50, 0.30] (last 6 readings)

const crush = detectIVCrush('SPX', 5);
// Previous 5 avg: (0.50 + 0.52 + 0.48 + 0.51 + 0.50) / 5 = 0.502
// Current: 0.30
// Drop: ((0.502 - 0.30) / 0.502) * 100 = 40.2%

// {
//   isCrush: true,       // Drop > 20%
//   dropPercent: 40.2
// }
```

### IV Spike Detection

```typescript
// Example: Pre-FOMC IV spike
// History: [0.15, 0.14, 0.16, 0.15, 0.14, 0.25] (last 6 readings)

const spike = detectIVSpike('SPX', 5);
// Previous 5 avg: (0.15 + 0.14 + 0.16 + 0.15 + 0.14) / 5 = 0.148
// Current: 0.25
// Rise: ((0.25 - 0.148) / 0.148) * 100 = 68.9%

// {
//   isSpike: true,       // Rise > 30%
//   risePercent: 68.9
// }
```

---

## Alert Thresholds

### Greeks-Based Alerts

| Alert Type | Threshold | Action | Priority |
|------------|-----------|--------|----------|
| **High Theta Decay** | θ < -50 on 0DTE final hour | Warn: "Rapid decay - consider trimming" | High |
| **Gamma Spike** | γ > 0.2 near ATM | Warn: "High gamma risk - explosive moves possible" | High |
| **IV Crush** | IV drops >20% from recent avg | Alert: "IV crush detected - vega loss accelerating" | Critical |
| **IV Spike** | IV rises >30% from recent avg | Alert: "IV spike - volatility premium expanding" | Medium |
| **IV High Rank** | IV > 75th percentile | Info: "High IV - good for selling premium" | Low |
| **IV Low Rank** | IV < 25th percentile | Info: "Low IV - good for buying options" | Low |

---

## Future Enhancements

### Phase 2: WebSocket Streaming (6-12 months)

**Goal**: Replace polling with true real-time WebSocket streaming from Massive API.

**Prerequisites**:
1. Verify Massive.com supports Greeks via WebSocket (check API docs)
2. Test WebSocket stability (reconnection, auth refresh)
3. Implement server-side Greeks WebSocket hub (similar to existing options/indices hubs)

**Architecture**:
```
Massive WebSocket → Express Greeks Hub → Client marketDataStore
                       ↓
               Greeks updates every 5-10s
                       ↓
               Zero polling latency
```

**Benefits**:
- Sub-second Greeks updates
- Lower API costs (no redundant polling)
- Better scalability (push vs. pull)

**Risks**:
- WebSocket disconnections (need robust reconnection logic)
- Increased server complexity (maintain persistent connections)

---

### Phase 3: Portfolio Greeks Aggregation

**Goal**: Show net portfolio Greeks across all active trades.

**Use Case**:
- Admin monitoring 5 trades simultaneously
- Total delta: +2.5 (net bullish exposure)
- Total gamma: 0.8 (high explosive potential)
- Total theta: -$450/day (decay bleeding)
- Total vega: +$1200 per 1% IV change (long volatility)

**Benefits**:
- Portfolio risk management
- Hedging opportunities (if too much gamma, hedge with underlying)
- Daily P&L projections (theta × days)

**Implementation**:
```typescript
interface PortfolioGreeks {
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;
  totalVega: number;
  thetaPerDay: number;           // Total $ lost per day to decay
  gammaRisk: number;             // Aggregate gamma exposure
  vegaExposure: number;          // Total $ exposed to IV changes
  netDirectionality: 'bullish' | 'bearish' | 'neutral';
  lastUpdated: number;
}
```

---

### Phase 4: Greeks-Based Auto-Alerts to Discord

**Goal**: Automatically send Discord alerts when Greek thresholds are breached.

**Example Alerts**:
- "⚠️ SPX 5200C: Theta decay accelerating (-$75/day, 0DTE final hour)"
- "🔻 QQQ 420P: IV crushed 35% (52% → 34%) - Vega loss detected"
- "📈 SPY 500C: Gamma spiked to 0.25 - Price sensitive to small moves"

**Configuration**:
- Per-strategy alert thresholds
- Admin-level alert preferences (DMs vs. channels)
- Cooldown periods (don't spam every 10s)

---

## Testing Strategy

### Unit Tests

**File**: `src/lib/greeks/__tests__/ivHistory.test.ts`

```typescript
describe('IV History Tracking', () => {
  test('records IV readings correctly', () => {
    recordIV('SPX', 0.25, 'massive');
    recordIV('SPX', 0.30, 'massive');

    const history = getIVHistory('SPX');
    expect(history).toHaveLength(2);
    expect(history[1].iv).toBe(0.30);
  });

  test('detects IV crush', () => {
    // Simulate 5 normal readings + 1 crushed
    [0.50, 0.52, 0.48, 0.51, 0.50].forEach(iv => recordIV('SPX', iv, 'massive'));
    recordIV('SPX', 0.30, 'massive');

    const { isCrush, dropPercent } = detectIVCrush('SPX');
    expect(isCrush).toBe(true);
    expect(dropPercent).toBeGreaterThan(20);
  });

  test('calculates IV percentile correctly', () => {
    [0.10, 0.20, 0.30, 0.40, 0.50].forEach(iv => recordIV('SPX', iv, 'massive'));
    recordIV('SPX', 0.35, 'massive');

    const stats = getIVStats('SPX');
    expect(stats?.percentile).toBeCloseTo(66.7, 1); // 4/6 = 66.7%
  });
});
```

### Integration Tests

**File**: `src/services/__tests__/greeksMonitorService.test.ts`

```typescript
describe('Greeks Monitor Service', () => {
  test('fetches real Greeks from Massive API', async () => {
    const trade = createMockTrade({ ticker: 'SPX', strike: 5200, type: 'C' });

    const snapshot = await greeksMonitor.fetchGreeks(trade);

    expect(snapshot).toBeDefined();
    expect(snapshot.greeks.delta).toBeGreaterThan(0);
    expect(snapshot.greeks.delta).toBeLessThanOrEqual(1);
    expect(snapshot.greeks.gamma).toBeGreaterThanOrEqual(0);
  });

  test('falls back to cached Greeks on API failure', async () => {
    // Mock API failure
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const trade = createMockTrade({ ticker: 'SPX', contract: { delta: 0.45 } });

    const snapshot = await greeksMonitor.fetchGreeks(trade);

    expect(snapshot.greeks.delta).toBe(0.45); // Cached value
    expect(snapshot.greeks.source).toBe('fallback');
  });
});
```

### Manual Testing Checklist

- [ ] Load active trade → Verify real Greeks appear
- [ ] Wait 10 seconds → Verify Greeks refresh automatically
- [ ] Simulate Massive API failure → Verify fallback to cached values
- [ ] Simulate IV crush (manually trigger) → Verify alert fires
- [ ] Check Greeks freshness indicator → Should show "Fresh" if < 30s
- [ ] Check IV history chart → Should show last 100 readings
- [ ] Multiple admins monitoring same ticker → Verify shared cache works

---

## Deployment Checklist

### Pre-Deploy

- [x] Update `greeksMonitorService.ts` to use real Massive API
- [x] Add Greeks schema to `marketDataStore.ts`
- [x] Implement IV history tracking (`ivHistory.ts`)
- [x] Lower recompute threshold for 0DTE (0.2% vs. 0.5%)
- [ ] Build Greeks monitoring dashboard component
- [ ] Add unit tests for IV history
- [ ] Add integration tests for Greeks monitor
- [ ] Update environment variables documentation

### Post-Deploy

- [ ] Monitor Massive API call volume (ensure under rate limits)
- [ ] Verify Greeks accuracy (compare to broker/TradingView)
- [ ] Collect admin feedback on Greeks freshness
- [ ] Monitor memory usage (IV history grows over time)
- [ ] Set up alerts for stale Greeks (>1 minute)

---

## Troubleshooting

### Greeks Not Updating

**Symptom**: Greeks remain stale despite active trade monitoring.

**Causes**:
1. Massive API down or rate-limited
2. WebSocket connection lost
3. greeksMonitor not started
4. Proxy token expired/invalid

**Fix**:
```bash
# Check Massive API status
curl -H "x-massive-proxy-token: YOUR_TOKEN" \
  http://localhost:3000/api/massive/snapshot/options/SPX

# Check greeksMonitor status
console.log(greeksMonitor.getPortfolioGreeks());

# Restart monitor
greeksMonitor.stop();
greeksMonitor.start(tradeStore.getState().activeTrades);
```

### IV History Not Accumulating

**Symptom**: `getIVHistory('SPX')` returns empty or too few readings.

**Causes**:
1. IV not being recorded (check logs for `[IVHistory]`)
2. Symbol mismatch (case-sensitive)
3. Browser refresh cleared in-memory history

**Fix**:
```typescript
// Check tracked symbols
const tracked = getTrackedSymbols();
console.log('Tracked symbols:', tracked);

// Manually record IV
recordIV('SPX', 0.35, 'manual');

// Check history
const history = getIVHistory('SPX');
console.log('SPX IV history:', history);
```

### High Memory Usage

**Symptom**: Browser tab uses >500MB RAM.

**Causes**:
1. IV history not capped (should be max 100 readings per symbol)
2. Many symbols tracked simultaneously
3. Memory leak in marketDataStore

**Fix**:
```typescript
// Clear old IV history
clearIVHistory();  // Clears all symbols

// Check memory usage
const tracked = getTrackedSymbols();
console.log('Tracking', tracked.length, 'symbols');

// Limit tracked symbols (only active tickers)
const activeTickers = tradeStore.getState().activeTrades.map(t => t.ticker);
tracked.forEach(({ symbol }) => {
  if (!activeTickers.includes(symbol)) {
    clearIVHistory(symbol);
  }
});
```

---

## Conclusion

This Greeks streaming architecture provides HoneyDrip admins with production-grade, real-time Greeks monitoring for active trades. By combining Massive API integration, intelligent caching, IV history tracking, and robust fallback strategies, the system ensures admins can confidently send accurate Discord alerts to the community.

**Key Wins**:
- ✅ Real Greeks from Massive API (no more simulated data)
- ✅ 10-second refresh (fast enough for 0DTE without spam)
- ✅ IV crush/spike detection (catch post-earnings events)
- ✅ Fallback strategy (never show blank Greeks)
- ✅ Extensible (easy to add WebSocket in Phase 2)

**Next Steps**:
1. Build Greeks monitoring dashboard (Part 3)
2. Deploy to production
3. Gather admin feedback
4. Plan WebSocket migration (Phase 2)
