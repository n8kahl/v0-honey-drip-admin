# Console.log Cleanup Strategy

## Current State
- **Total console calls**: 600+ across codebase
- **Target**: Reduce to ~100 (keep only critical/error logs)
- **Strategy**: Remove verbose debug logs, keep error/warning/critical info

## What to KEEP (Keep These!)

### ✅ Error & Critical Information
```typescript
console.error('Critical error:', error)      // API failures, exceptions
console.warn('Warning:', message)            // Invalid state, fallbacks
console.info('[Module] Starting...')         // Major lifecycle events
```

### ✅ Production-Important Logs
- API connection failures (Massive, Tradier timeout)
- Authentication issues (token fetch, login failed)
- Data validation failures (Greeks out of bounds)
- System health (WebSocket connected/disconnected)
- Trade state transitions (ENTERED, EXITED)
- Provider switching (Massive → Tradier fallback)

### ❌ Remove These (Verbose Debug Logs)
- Repeated state updates (every render, every 100ms)
- Loop iterations (processing 500 items)
- Intermediate calculation steps
- Mouseenter/hover events
- Redux action dispatches (in dev mode only)
- Detailed JSON dumps of large objects
- Polling updates (running every 5-10 seconds)

## File-by-File Breakdown

| File | Console Calls | Action | Keep | Remove |
|------|---|--------|------|--------|
| useStrategyScanner.ts | 40 | **REMOVE 30** | Errors, strategy alerts | Loop iterations, calculation steps |
| marketDataStore.ts | 38 | **REMOVE 25** | Connection status | Repeated state updates |
| HDLiveChart.tsx | 34 | **REMOVE 20** | Errors, canvas issues | Mouse events, re-renders |
| greeksMonitorService.ts | 30 | **REMOVE 18** | API failures, Greeks alerts | Poll progress, cache updates |
| massive/client.ts | 26 | **REMOVE 15** | API errors, retries | Individual request info |

## Implementation Steps

### Phase 1: Identify Candidates (Already Done - See Above)

### Phase 2: Remove Verbose Logs
Apply this pattern to top 5 files:

```typescript
// REMOVE THIS (verbose debug)
console.log('[Module] Processing item', i, 'of', 1000);

// REMOVE THIS (repeated updates)
console.log('[Store] Updated symbol', symbol, 'price:', price);

// KEEP THIS (critical info)
console.error('[Module] Failed to process:', error.message);

// KEEP THIS (state transition)
console.info('[Trade] Transitioned to EXITED at', exitPrice);
```

### Phase 3: Keep Important Logs
Priority order for keeping logs:
1. Errors/failures (console.error)
2. State transitions (ENTERED → EXITED)
3. API issues (Massive down, fallback to Tradier)
4. Authentication (token obtained, login failed)
5. System health (WebSocket connected)
6. Major warnings (data validation, bounds issues)

## Estimated Reduction

**Top 10 files account for ~280 console logs**

Removing ~200 verbose logs from top files:
- useStrategyScanner.ts: 40 → 10 (remove loop iterations)
- marketDataStore.ts: 38 → 8 (remove state updates)
- HDLiveChart.tsx: 34 → 14 (remove mouse/render events)
- greeksMonitorService.ts: 30 → 12 (remove poll updates)
- massive/client.ts: 26 → 11 (remove request details)

**Result**: 600 → ~250-300 (acceptable for production)

## Manual Cleanup Checklist

- [ ] useStrategyScanner.ts - Remove loop logging
- [ ] marketDataStore.ts - Remove state update logging
- [ ] HDLiveChart.tsx - Remove event logging
- [ ] greeksMonitorService.ts - Remove poll logging
- [ ] massive/client.ts - Remove request logging
- [ ] HDLiveChartNew.tsx - Remove event logging
- [ ] transport-policy.ts - Remove retry logging
- [ ] websocket.ts - Keep connection events
- [ ] unifiedWebSocket.ts - Keep connection events
- [ ] AuthContext.tsx - Keep auth events

## Testing After Cleanup

1. **Check console in dev**: `npm run dev` - Should be cleaner
2. **Check console in prod build**: `npm run build && npm run start`
3. **Monitor**: Verify error logs still appear when issues occur
4. **Search**: Grep for remaining logs - should be ~250-300

## Future: Implement Logger Service

For next iteration (Phase 2 refactor), consider:

```typescript
// src/lib/logger.ts
const logger = {
  error: (msg: string, err?: any) => {
    console.error(`[ERROR] ${msg}`, err);
    // Could also send to error tracking service
  },
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  info: (msg: string) => console.info(`[INFO] ${msg}`),
  debug: (msg: string) => {
    if (process.env.DEBUG) console.log(`[DEBUG] ${msg}`);
  }
};

export default logger;
```

This allows global control of logging level without removing logs.
