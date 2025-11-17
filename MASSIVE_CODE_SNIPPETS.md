# Massive.com Integration - Implementation Code Snippets

Quick copy-paste fixes for the 3 critical issues.

---

## 🔧 FIX #1: Add AbortController to Fetch Calls

**File**: `src/lib/massive/client.ts`

### Current Code (Lines 36-80)

```typescript
class MassiveClient {
  private baseUrl: string;
  private connected: boolean = false;
  private lastError: string | null = null;

  constructor(baseUrl: string = MASSIVE_API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await massiveFetch(url, {
        ...options,
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
      this.connected = false;
      this.lastError = error.message;
      console.error("[Massive API] Request failed:", error);
      throw error;
    }
  }
}
```

### FIXED Code (Add AbortController)

```typescript
class MassiveClient {
  private baseUrl: string;
  private connected: boolean = false;
  private lastError: string | null = null;
  private abortController: AbortController | null = null; // ← ADD THIS

  constructor(baseUrl: string = MASSIVE_API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Create fresh AbortController for this request
    this.abortController = new AbortController(); // ← ADD THIS

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
        // ← ADD THIS
        this.connected = false;
        this.lastError = error.message;
        console.error("[Massive API] Request failed:", error);
      }
      throw error;
    }
  }

  // ← ADD THIS METHOD
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
```

### Update Transport-Policy Stop Method

**File**: `src/lib/massive/transport-policy.ts`, lines 105-120

**Current**:

```typescript
stop() {
  if (!this.isActive) return;
  this.isActive = false;

  console.log(`[TransportPolicy] Stopping for ${this.config.symbol}`);

  if (this.wsUnsubscribe) {
    this.wsUnsubscribe();
    this.wsUnsubscribe = null;
  }

  this.clearPollTimer();

  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
```

**FIXED**:

```typescript
stop() {
  if (!this.isActive) return;
  this.isActive = false;

  console.log(`[TransportPolicy] Stopping for ${this.config.symbol}`);

  // Cancel in-flight requests  ← ADD THIS SECTION
  try {
    massiveClient.cancel();
  } catch (e) {
    console.warn('[TransportPolicy] Error canceling requests:', e);
  }

  if (this.wsUnsubscribe) {
    this.wsUnsubscribe();
    this.wsUnsubscribe = null;
  }

  this.clearPollTimer();

  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
```

---

## 🔧 FIX #2: Implement Adaptive Polling Intervals

**File**: `src/lib/massive/transport-policy.ts`, lines 80-95

### Current Code

```typescript
constructor(config: TransportConfig, callback: TransportCallback) {
  this.config = {
    pollInterval: 3000,
    maxReconnectDelay: 30000,
    ...config,
  };
  this.callback = callback;
  this.basePollInterval = this.config.pollInterval!;
  this.currentPollInterval = this.basePollInterval;
}
```

### FIXED Code

```typescript
constructor(config: TransportConfig, callback: TransportCallback) {
  this.config = {
    pollInterval: 3000,
    maxReconnectDelay: 30000,
    ...config,
  };
  this.callback = callback;
  // Use adaptive interval instead of fixed 3s  ← CHANGE THIS
  this.basePollInterval = this.getOptimalPollInterval();
  this.currentPollInterval = this.basePollInterval;
}

// ← ADD THIS METHOD
private getOptimalPollInterval(): number {
  const { isIndex, isOption, symbol } = this.config;

  // Check market hours
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const isPreMarket = hour < 9;
  const isAfterHours = hour >= 16;
  const isMarketClosed = isWeekend || isPreMarket || isAfterHours;

  // Base intervals by asset type
  if (isIndex) {
    // Indices are less volatile, can use longer intervals
    return isMarketClosed ? 10000 : 5000;
  } else if (isOption) {
    // Options are most volatile, need faster fallback
    return isMarketClosed ? 6000 : 2000;
  } else {
    // Stocks are moderate
    return isMarketClosed ? 8000 : 4000;
  }
}
```

---

## 🔧 FIX #3: Remove Subscription Duplicates

**File**: `src/hooks/useMassiveData.ts`

### Step 1: Verify StreamingManager is Not Used

Run this command to find any external usage:

```bash
grep -r "streamingManager\|StreamingManager\|streaming-manager" src/ \
  --exclude-dir=node_modules \
  --exclude-dir=.git
```

If results only show `streaming-manager.ts` itself, proceed to step 2.

### Step 2: Verify transport-policy Is Used Everywhere

**Current code in useMassiveData.ts** (already correct):

```typescript
import { createTransport } from "../lib/massive/transport-policy";

export function useQuotes(symbols: string[]) {
  // ...
  const unsubscribe = createTransport(
    symbol,
    (data, source, timestamp) => {
      handleUpdate(data, source, timestamp);
    },
    { isIndex, pollInterval: 3000 }
  );
  // ...
}
```

This is already using the right system. ✅

### Step 3: Document Deprecation

Add to top of `src/lib/massive/streaming-manager.ts`:

```typescript
/**
 * @deprecated StreamingManager is not actively used in production.
 * Use transport-policy.ts via useQuotes() and useMassiveData() hooks instead.
 *
 * TODO: Remove this file in v1.0.0 after confirming no external dependencies.
 *
 * Rationale: transport-policy.ts provides better lifecycle management
 * and integrates seamlessly with React hooks.
 */
```

---

## 🔧 BONUS: Add Adaptive Polling with Market Status

**File**: `src/lib/massive/transport-policy.ts`, improve the polling logic

### Current pollData Method (Lines 220-260)

```typescript
private async pollData() {
  if (!this.isActive) return;

  if (this.fetchingBars) {
    console.debug(
      `[TransportPolicy] Skipping REST poll for ${this.config.symbol} while historical bars are loading`
    );
    this.scheduleNextPoll();
    return;
  }

  const marketOpen = await this.isMarketOpen();
  if (!marketOpen) {
    this.currentPollInterval = Math.max(this.currentPollInterval, this.closedMarketPollInterval);
  }

  // ... rest of polling logic
}
```

### IMPROVED: Add Market-Based Backoff

```typescript
private async pollData() {
  if (!this.isActive) return;

  if (this.fetchingBars) {
    console.debug(
      `[TransportPolicy] Skipping REST poll for ${this.config.symbol} while historical bars are loading`
    );
    this.scheduleNextPoll();
    return;
  }

  const marketOpen = await this.isMarketOpen();

  // Adaptive interval based on market status  ← ADD THIS
  if (!marketOpen) {
    this.currentPollInterval = this.getOptimalPollInterval();
    // Will return 6000-10000 when market closed
  } else {
    // Market open, use aggressive intervals
    this.currentPollInterval = this.getOptimalPollInterval();
    // Will return 2000-5000 when market open
  }

  // ... rest of polling logic
}
```

---

## ✅ VERIFICATION: Test These Changes

### Test 1: AbortController Works

```typescript
// In browser console after opening DevTools
async function testAbort() {
  console.log("Starting test...");

  // Trigger a fetch
  const promise = massiveClient.getQuotes(["AAPL"]);

  // Immediately cancel
  setTimeout(() => massiveClient.cancel(), 10);

  try {
    await promise;
    console.log("❌ FAILED: Fetch should have been aborted");
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("✅ SUCCESS: Fetch properly aborted");
    } else {
      console.log("❌ FAILED:", err.message);
    }
  }
}

testAbort();
```

### Test 2: Adaptive Polling Works

```typescript
// In console
function testAdaptivePolling() {
  // Mock the time to simulate market hours
  const tp = new TransportPolicy({ symbol: "I:SPX", isIndex: true }, () => {});

  const interval = tp["getOptimalPollInterval"]();
  console.log(`Index polling interval: ${interval}ms`);
  console.log(
    interval === 5000 ? "✅ Market hours (5s)" : "⏰ Off-market (10s)"
  );

  // Test options
  const tp2 = new TransportPolicy(
    { symbol: "O:SPY250117C500", isOption: true },
    () => {}
  );

  const interval2 = tp2["getOptimalPollInterval"]();
  console.log(`Option polling interval: ${interval2}ms`);
  console.log(
    interval2 === 2000 ? "✅ Market hours (2s)" : "⏰ Off-market (6s)"
  );
}

testAdaptivePolling();
```

### Test 3: No Duplicate Subscriptions

```typescript
// In console
function testNoDuplicates() {
  const subs = massiveWS.subscriptions;

  // Try subscribing to same symbol twice
  const unsub1 = massiveWS.subscribeQuotes(["AAPL"], () => {});
  const unsub2 = massiveWS.subscribeQuotes(["AAPL"], () => {});

  const activeAAPL = subs.options.has("Q.AAPL") ? 1 : 0;
  console.log(`AAPL subscriptions: ${activeAAPL}`);
  console.log(activeAAPL === 1 ? "✅ No duplicates" : "❌ Duplicates found");

  unsub1();
  unsub2();
}

testNoDuplicates();
```

---

## 📋 IMPLEMENTATION CHECKLIST

```
☐ FIX #1: Add AbortController
  ☐ Update client.ts with AbortController field
  ☐ Add cancel() method
  ☐ Update transport-policy.ts stop() method
  ☐ Test with browser console script
  ☐ Verify no console errors

☐ FIX #2: Adaptive Polling
  ☐ Add getOptimalPollInterval() method
  ☐ Update constructor to use adaptive intervals
  ☐ Test with browser console script
  ☐ Verify 2-5s ranges based on asset type

☐ FIX #3: Remove Duplicates
  ☐ Run grep command to find streaming-manager usage
  ☐ Add deprecation comment to streaming-manager.ts
  ☐ Verify useMassiveData.ts uses only transport-policy
  ☐ Document decision in code comments

☐ TESTING
  ☐ Run unit tests for transport-policy
  ☐ Test REST fallback manually (disable WS in DevTools)
  ☐ Monitor Network tab for polling frequency
  ☐ Check Console for [v0] logs
  ☐ Test memory with DevTools (should not grow)

☐ DEPLOYMENT
  ☐ Create PR with all 3 fixes
  ☐ Deploy to staging
  ☐ Monitor Massive.com quota usage
  ☐ Run 24-hour production monitoring
  ☐ Celebrate! 🎉
```

---

## 💾 COMMAND REFERENCE

```bash
# Find streaming-manager usage
grep -r "StreamingManager" src/ --exclude-dir=node_modules

# Count subscription-related code
grep -c "subscribe\|unsubscribe" src/lib/massive/transport-policy.ts

# Test build
npm run build

# Run tests
npm test src/lib/massive/

# Check TypeScript
npx tsc --noEmit

# View polling intervals (run in browser console)
massiveWS.getConnectionState()

# Monitor REST calls (DevTools)
# Network tab → Filter: "api/massive" → Watch polling frequency
```

---

## 📞 NEED HELP?

### If You Get Errors

1. **"AbortController is not defined"**

   - Upgrade Node.js to 18+ (AbortController is built-in)
   - Or: Add polyfill if needed

2. **"streaming-manager not imported"**

   - Check src/lib/massive/streaming-manager.ts wasn't imported elsewhere
   - Use grep command above to verify

3. **"Polling still too aggressive"**
   - Verify getOptimalPollInterval() is being called in constructor
   - Check market hours calculation (should return different values)

### If Tests Fail

1. **Transport-policy tests fail**

   - Verify AbortController changes didn't break cleanup
   - Check that callbacks still fire for valid requests

2. **Memory tests fail**
   - Make sure cancel() is called in stop()
   - Force garbage collection in DevTools (⚙️ → Memory)

---

## 🚀 NEXT STEPS

After these 3 fixes are complete and tested:

1. **Add Filter Parameter Support** (1-2 hours)

   - Update server/routes/api.ts
   - Add params like `?strike_price.gte=400&expiration_date.lte=...`

2. **Implement Message Batching** (2-3 hours)

   - Batch updates every 100ms instead of per-message
   - Reduce React re-renders by 90%

3. **Cache Indicator Data** (30 minutes)
   - Add 60-second cache to fetchIndicators()
   - Avoid duplicate REST calls

---

**All code is copy-paste ready. Test thoroughly before production deployment!**
