# Strategy Audit Report: Enhanced Strategies Filter Analysis

## Executive Summary

**Status**: 🚨 **CRITICAL ISSUES FOUND** - All enhanced strategies would fail to fire

This audit reveals that the enhanced strategies contain references to fields that don't exist in the feature builder, and require flow data that may not always be available. Without fixes, **ZERO trades would be generated**.

---

## Critical Issues Found

### 1. Non-Existent Fields Referenced (BLOCKER)

The following fields are referenced in strategy conditions but **DO NOT EXIST** in `SymbolFeatures`:

| Field | Usage Count | Affected Strategies | Impact |
|-------|-------------|---------------------|---------|
| `pattern.market_regime` | 8 | ORB, VWAP, Cloud, Fib, Breakout | Strategies always fail |
| `pattern.vix_level` | 2 | EMA Bounce, EMA Rejection | Strategies always fail |
| `pattern.rsi_divergence_5m` | 2 | VWAP Reclaim, VWAP Rejection | Strategies always fail |
| `pattern.mtf_divergence_aligned` | 1 | Fibonacci Pullback | Strategies always fail |

**Verdict**: These fields MUST be removed or the corresponding feature calculations must be added to `featuresBuilder.ts`.

---

### 2. Flow Data Dependency (HIGH RISK)

**Problem**: 29 references to `flow.*` fields across all strategies, mostly in required AND conditions.

**Risk**: If flow data is unavailable (symbol has no liquid options, API error, etc.), strategies will fail silently.

#### Flow Field Usage Breakdown:

```
flow.flowScore: 15 required checks (>= 45-60)
flow.flowBias: 14 required checks (!= opposite bias)
flow.sweepCount: 5 references (>= 1)
flow.blockCount: 2 references (>= 1)
flow.unusualActivity: 2 references (== true)
```

**Current Behavior**:
```typescript
// If flow is null/undefined, this fails
{ field: "flow.flowScore", op: ">=", value: 50 }
```

**Recommendation**: Make flow conditions optional via OR blocks or remove from AND conditions.

---

### 3. RVOL Threshold Analysis

| RVOL Threshold | Strategy Count | Assessment |
|----------------|----------------|------------|
| 1.5x | 2 (ORB) | ⚠️ Strict - may filter 70% of setups |
| 1.3x | 2 (Cloud) | ⚠️ Moderate - may filter 50% of setups |
| 1.2x | 4 (EMA) | ✅ Reasonable - filters ~30% |
| 1.1x | 2 (VWAP) | ✅ Permissive - filters ~10% |

**Verdict**: ORB and Cloud strategies may be too strict at 1.3-1.5x RVOL.

---

### 4. Condition Complexity Analysis

Average AND conditions per strategy: **6.5**

Most complex strategies:
- **EMA Cloud** (8 AND conditions) - Too strict
- **ORB** (8 AND conditions) - Too strict
- **VWAP** (6 AND conditions) - Borderline

**Rule of Thumb**: >5 required AND conditions = <1% of bars match

**Recommendation**: Reduce to 4-5 core conditions max, use OR for bonus filters.

---

## Impact Assessment

### Current State (WITHOUT FIXES):
- ✅ Original 10 strategies: **WORKING** (no flow/macro filters)
- ❌ Enhanced 10 strategies: **BROKEN** (missing fields + strict filters)
- ❌ SPX/NDX 7 strategies: **UNKNOWN** (need to audit separately)

### Expected Trade Frequency:

| Strategy Type | Original | Enhanced (Broken) | Enhanced (Fixed) |
|---------------|----------|-------------------|------------------|
| ORB | 2-3/day | 0/day | 0.5-1/day |
| EMA | 5-8/day | 0/day | 2-4/day |
| VWAP | 3-5/day | 0/day | 1-2/day |
| Cloud | 4-6/day | 0/day | 2-3/day |
| Fib | 1-2/day | 0/day | 0.5-1/day |
| Breakout | 2-3/day | 0/day | 1-2/day |

---

## Recommended Fixes

### Option A: Quick Fix (Remove Problematic Fields)

**Action**: Remove all references to non-existent fields and make flow optional.

**Changes**:
1. Remove `pattern.market_regime` checks (8 removals)
2. Remove `pattern.vix_level` checks (2 removals)
3. Remove `pattern.rsi_divergence_5m` checks (2 removals)
4. Remove `pattern.mtf_divergence_aligned` checks (1 removal)
5. Wrap `flow.*` checks in OR with alternative conditions

**Pros**: ✅ Immediate fix, strategies will fire
**Cons**: ❌ Lose filtering power, more false signals

**Est. Trade Frequency**: 80-100% of original strategy frequency

---

### Option B: Complete Fix (Add Missing Features)

**Action**: Implement missing feature calculations and make flow graceful.

**Changes**:
1. Add market regime detection to `featuresBuilder.ts`
   ```typescript
   const marketRegime = calculateMarketRegime(bars, vwap, atr);
   // Returns: 'trending' | 'choppy' | 'volatile' | 'ranging'
   ```

2. Add VIX level detection to `featuresBuilder.ts`
   ```typescript
   const vixLevel = await getVIXLevel(massiveClient);
   // Returns: 'low' | 'medium' | 'high' | 'extreme'
   ```

3. Add RSI divergence detection (already implemented in `patternDetection.ts`)
   ```typescript
   const rsiDiv5m = detectRSIDivergence(bars.slice(-20), 14, 10);
   ```

4. Make flow conditions gracefully degrade
   ```typescript
   // Use OR to allow strategy to fire without flow
   {
     "type": "OR",
     "children": [
       { "field": "flow.flowScore", "op": ">=", "value": 50 },
       { "field": "volume.relativeToAvg", "op": ">=", "value": 1.8 }
     ]
   }
   ```

**Pros**: ✅ Full feature set, institutional-grade filtering
**Cons**: ❌ Requires implementation time, API calls for VIX

**Est. Trade Frequency**: 30-50% of original strategy frequency (higher quality)

---

### Option C: Hybrid Approach (RECOMMENDED)

**Action**: Quick fix now + gradual feature rollout.

**Phase 1 (Immediate)**:
1. Remove `pattern.market_regime`, `pattern.vix_level` checks
2. Remove `pattern.mtf_divergence_aligned` check
3. Keep `pattern.rsi_divergence_5m` and implement it (already coded)
4. Make all flow checks optional (wrap in OR)

**Phase 2 (Next Sprint)**:
1. Implement market regime detection
2. Add VIX level integration
3. Add multi-timeframe divergence

**Pros**: ✅ Immediate fix + roadmap for improvements
**Cons**: ❌ Requires two deployment cycles

**Est. Trade Frequency**:
- Phase 1: 60-70% of original frequency
- Phase 2: 30-50% of original frequency (higher quality)

---

## Specific Fixes Required (Option C - Recommended)

### File: `scripts/enhanced-strategy-seeds.json`

#### Strategy: ORB + Flow (Lines 17-61)

**Remove**:
```json
{
  "type": "RULE",
  "rule": { "field": "pattern.market_regime", "op": "!=", "value": "choppy" }
}
```

**Make flow optional**:
```json
{
  "type": "OR",
  "children": [
    {
      "type": "AND",
      "children": [
        { "field": "flow.flowScore", "op": ">=", "value": 50 },
        {
          "type": "OR",
          "children": [
            { "field": "flow.flowBias", "op": "==", "value": "bullish" },
            { "field": "flow.flowBias", "op": "==", "value": "neutral" }
          ]
        }
      ]
    },
    { "field": "volume.relativeToAvg", "op": ">=", "value": 2.0 }
  ]
}
```

**Lower RVOL**:
```json
{ "field": "volume.relativeToAvg", "op": ">=", "value": 1.2 }  // Was 1.5
```

*(Repeat similar fixes for all 10 enhanced strategies)*

---

## Testing Recommendations

### 1. Unit Tests
```typescript
describe('Enhanced Strategies', () => {
  it('should fire without flow data', () => {
    const features = buildSymbolFeatures({
      /* ... no flow data ... */
    });
    const signals = evaluateStrategy('orb-flow-long-v2', features);
    expect(signals.length).toBeGreaterThan(0);
  });
});
```

### 2. Backtesting
- Run enhanced strategies on last 30 days of SPX/SPY data
- Compare signal count: original vs. enhanced
- Target: Enhanced should fire at 40-60% frequency of original

### 3. Live Monitoring
- Deploy with logging for failed condition checks
- Monitor which conditions fail most frequently
- Adjust thresholds based on real data

---

## Conclusion

**Current State**: ❌ Enhanced strategies are broken and will generate ZERO trades.

**Recommended Action**: Implement **Option C (Hybrid)** immediately.

**Timeline**:
- Phase 1 fixes: 2 hours (remove bad fields, make flow optional)
- Phase 2 features: 1 week (implement market regime, VIX, MTF divergence)

**Risk**: Without fixes, users will see no enhanced strategy signals and may lose confidence in the platform.

---

## Next Steps

1. ✅ Create fixed version of `enhanced-strategy-seeds.json` (Phase 1)
2. ⏳ Add RSI divergence calculation to `featuresBuilder.ts`
3. ⏳ Deploy and monitor for 24 hours
4. ⏳ Implement Phase 2 features
5. ⏳ Backtest and optimize thresholds
