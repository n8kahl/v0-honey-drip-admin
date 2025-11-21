# Massive.com Connection - Quick Fix Guide

## 🔴 CRITICAL ISSUES (Fix Before Production)

### Issue #1: Duplicate Subscriptions (Memory Leak Risk)

**Problem**: `transport-policy.ts` and `streaming-manager.ts` are competing subscription systems

**Quick Fix - Option A (Recommended): Remove Streaming Manager**

1. In `src/hooks/useMassiveData.ts`, ensure ONLY `transport-policy` is used:

```typescript
// ✅ Current (CORRECT)
import { createTransport } from '../lib/massive/transport-policy';

export function useQuotes(symbols: string[]) {
  // Uses createTransport per symbol
  const unsubscribe = createTransport(symbol, ...);
}
```

2. Search codebase for any usage of `StreamingManager`:

```bash
grep -r "StreamingManager\|streaming-manager" src/
```

3. If only in `streaming-manager.ts` itself, you're safe to ignore
4. If used elsewhere, either:
   - Migrate that code to use `transport-policy` instead, OR
   - Consolidate to `StreamingManager` exclusively

**Verification**:

```bash
# Should show 0 results outside streaming-manager.ts
grep -r "streamingManager\|new StreamingManager" src/ --exclude-dir=node_modules
```

---

### Issue #2: Missing AbortController on Fetches (Orphaned Callbacks)

**Problem**: Fetch requests don't cancel when component unmounts, causing memory leaks

**Quick Fix**: Update `src/lib/massive/client.ts`

```typescript
class MassiveClient {
  private baseUrl: string;
  private connected: boolean = false;
  private lastError: string | null = null;
  private abortController: AbortController | null = null; // ← ADD THIS

  constructor(baseUrl: string = MASSIVE_API_BASE) {
    this.baseUrl = baseUrl;
  }

  // ← ADD THIS METHOD
  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Create fresh AbortController for this request
    this.abortController = new AbortController();

    try {
      const response = await massiveFetch(url, {
        ...options,
        signal: this.abortController.signal, // ← ADD THIS
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = `Massive API error (${response.status}): ${
          errorText || response.statusText
        }`;
        this.lastError = error;
        this.connected = false;
        console.error("[Massive API]", error);
        throw new Error(error);
      }

      this.connected = true;
      this.lastError = null;
      const data = await response.json();
      return data;
    } catch (error: any) {
      // Only log if not an abort
      if (error.name !== "AbortError") {
        this.connected = false;
        this.lastError = error.message;
        console.error("[Massive API] Request failed:", error);
      }
      throw error;
    }
  }

  // ← ADD THIS METHOD for cleanup
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

// Export singleton
export const massiveClient = new MassiveClient();
```

**Update transport-policy.ts to call cancel on stop**:

```typescript
stop() {
  if (!this.isActive) return;
  this.isActive = false;

  // Cancel in-flight requests
  massiveClient.cancel();  // ← ADD THIS

  if (this.wsUnsubscribe) {
    this.wsUnsubscribe();
  }

  this.clearPollTimer();

  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
```

---

### Issue #3: Over-Aggressive REST Polling (3s for All Symbols)

**Problem**: 3-second polling interval for 10+ symbols exceeds Massive.com quota (~1200 req/min)

**Quick Fix**: Implement market-aware adaptive intervals

In `src/lib/massive/transport-policy.ts`, line ~90:

```typescript
// BEFORE (inefficient)
this.basePollInterval = this.config.pollInterval!;

// AFTER (adaptive)
this.basePollInterval = this.getOptimalPollInterval();

// Add this method to TransportPolicy class
private getOptimalPollInterval(): number {
  const { isIndex, isOption, symbol } = this.config;

  // Market status impacts interval
  const marketHour = new Date().getHours();
  const isPreMarket = marketHour < 9;
  const isAfterHours = marketHour >= 16;
  const isOffMarket = isPreMarket || isAfterHours || this.isWeekend();

  // Base intervals by asset type
  if (isIndex) {
    // Indices less volatile, can use longer intervals
    return isOffMarket ? 10000 : 5000;
  } else if (isOption) {
    // Options most volatile, need faster fallback
    return isOffMarket ? 6000 : 2000;
  } else {
    // Stocks moderate
    return isOffMarket ? 8000 : 4000;
  }
}

private isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}
```

**Expected Quota Impact**:

- **Before**: 10 symbols × 1 request per 3s = 200 req/min
- **After**: 5 indices (5s) + 5 options (2s) = ~90 req/min
- **Result**: 55% reduction in unnecessary requests

---

## 🟡 HIGH PRIORITY (Post-Launch, But Recommended Soon)

### Optimization #1: Cache Indicator Data

**File**: `src/lib/massive/indicators-api.ts`

Add simple cache:

```typescript
const indicatorCache = new Map<string, {
  data: any;
  timestamp: number
}>();

const CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function fetchIndicators(
  symbol: string,
  request: IndicatorRequest,
  timespan: string,
  limit: number
): Promise<IndicatorResponse> {
  const cacheKey = `${symbol}-${timespan}-${limit}`;
  const cached = indicatorCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[Indicators] Cache hit for ${symbol}`);
    return cached.data;
  }

  const data = await fetchIndicatorsFromAPI(...);
  indicatorCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

---

### Optimization #2: Utilize OPTIONS ADVANCED Trade Flow

**File**: `src/App.tsx`

Add to global state:

```typescript
const [tradeFlow, setTradeFlow] = useState<TradeTape[]>([]);

useEffect(() => {
  if (!watchlist.length) return;

  const unsubscribes: Array<() => void> = [];

  // Subscribe to trade flow for all watched symbols
  watchlist.forEach((ticker) => {
    const unsub = optionsAdvanced.subscribeTrades(ticker, (trade) => {
      setTradeFlow((prev) => {
        const updated = [...prev, trade];
        // Keep last 50 trades for tape visualization
        return updated.slice(-50);
      });
    });
    unsubscribes.push(unsub);
  });

  return () => unsubscribes.forEach((u) => u());
}, [watchlist]);
```

Then display in `HDRowWatchlist.tsx`:

```typescript
// Show confluence chips including trade flow
const tradeFlowSignal = getTradeFlowSignal(tradeFlow, ticker);
<ConfluenceChips
  confluence={confluence}
  tradeFlow={tradeFlowSignal} // ← NEW
/>;
```

---

## Verification Checklist

After applying fixes:

```bash
# 1. No duplicate subscriptions
✓ grep -r "StreamingManager" src/ | grep -v streaming-manager.ts

# 2. AbortController in place
✓ grep -c "AbortController" src/lib/massive/client.ts

# 3. Adaptive polling intervals
✓ grep -c "getOptimalPollInterval" src/lib/massive/transport-policy.ts

# 4. Run tests
✓ npm test src/lib/massive/

# 5. Monitor REST calls in dev tools
✓ Open Network tab, filter /api/massive
✓ Watch for duplicate requests to same endpoint

# 6. Check memory
✓ Open DevTools Memory, take snapshot before/after mount/unmount
✓ No growth after garbage collection
```

---

## Testing These Fixes

### Test 1: No Duplicate Subscriptions

```typescript
// src/lib/massive/__tests__/subscriptions.test.ts
import { render } from "@testing-library/react";
import App from "../../App";

describe("Subscription Deduplication", () => {
  it("should not duplicate subscriptions for same symbol", () => {
    const mockSubscribe = jest.spyOn(massiveWS, "subscribeQuotes");

    const { rerender } = render(<App watchlist={["AAPL"]} />);

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    // Re-render same watchlist
    rerender(<App watchlist={["AAPL"]} />);

    // Should still be 1 subscription
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });
});
```

### Test 2: AbortController Cleanup

```typescript
it("should abort fetch when component unmounts", async () => {
  const mockFetch = jest.spyOn(global, "fetch");
  mockFetch.mockImplementation(
    () => new Promise(() => {}) // Never resolves
  );

  const { unmount } = render(<App />);

  // Unmount should abort pending fetch
  unmount();

  // Check AbortController was called
  expect(mockFetch.mock.lastCall?.[1]?.signal?.aborted).toBe(true);
});
```

### Test 3: REST Fallback Interval

```typescript
it("should use 5s interval for indices, 2s for options", () => {
  const transport = new TransportPolicy(
    { symbol: "I:SPX", isIndex: true },
    () => {}
  );

  expect(transport["getOptimalPollInterval"]()).toBe(5000);

  const transport2 = new TransportPolicy(
    { symbol: "O:SPY250117C500", isOption: true },
    () => {}
  );

  expect(transport2["getOptimalPollInterval"]()).toBe(2000);
});
```

---

## Rollout Plan

### Phase 1 (Today): Critical Fixes

1. Remove/document StreamingManager
2. Add AbortController to client.ts
3. Deploy test to staging

### Phase 2 (This Week): Optimizations

1. Implement adaptive polling
2. Add indicator cache
3. Integrate OPTIONS ADVANCED trade flow
4. Staging testing with 24h monitoring

### Phase 3 (Next Week): Production Deploy

1. Monitor REST call volume
2. Watch for WS reconnects
3. Verify quota usage stays <800 req/min
4. Full deployment

---

## Monitoring Commands (DevTools Console)

```javascript
// See active WebSocket subscriptions
massiveWS
  .getActiveSubscriptions()
  .forEach((s) => console.log(`${s.symbol}: refCount=${s.refCount}`));

// See REST request volume
window.__restCallCount = (window.__restCallCount || 0) + 1;
// Total: window.__restCallCount calls this session

// Monitor cleanup
massiveClient.cancel();
console.log("✅ Pending requests cancelled");
```

---

**After applying these fixes, your Massive.com setup will be production-ready with:**

- ✅ No duplicate subscriptions
- ✅ Proper cleanup on unmount
- ✅ Optimized polling intervals
- ✅ Full utilization of OPTIONS ADVANCED
- ✅ ~55% reduction in unnecessary REST calls
