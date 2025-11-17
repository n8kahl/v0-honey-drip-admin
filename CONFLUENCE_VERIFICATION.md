# Confluence Calculations Verification Report

## Executive Summary

✅ **Confluence calculations ARE working, BUT there are 3 potential issues with accuracy on trade entry.**

---

## 1. Data Flow: WATCHING → LOADED → ENTERED

### State 1: WATCHING (User selects ticker)
**Location:** `src/components/DesktopLiveCockpit.tsx:200-220`

```tsx
// updatedTrade contains ONLY contract data + defaults
const updatedTrade = {
  ...contract,
  targetPrice: contract.mid * 1.5,  // ← DEFAULT 50% move
  stopLoss: contract.mid * 0.5,     // ← DEFAULT 50% retrace
  state: 'LOADED',
  updates: [...],
}
```

**Issue #1:** ✅ **NOT AN ISSUE** — Defaults are acceptable for LOADED state

---

### State 2: LOADED (User loads contract, sees TP/SL)
**Location:** `src/components/hd/HDLoadedTradeCard.tsx:60-90`

**Confluence fetching:**
```tsx
// Hook fetches trend, volatility, liquidity
const confluence = useConfluenceData(currentTrade, tradeState);
```

**Hook Location:** `src/hooks/useConfluenceData.ts:45-75`
```ts
useEffect(() => {
  if (!trade || !tradeState || (tradeState !== 'LOADED' && tradeState !== 'ENTERED')) {
    // ✅ CORRECT: Fetches for BOTH LOADED and ENTERED
    return;
  }

  // Debounce: 300ms before fetching
  fetchTimeoutRef.current = setTimeout(() => {
    fetchConfluenceData(trade, tradeKey);
  }, 300);
}, [trade?.id, trade?.contract.expiry, trade?.contract.strike, trade?.contract.type, tradeState]);
```

**What gets fetched:**
- `fetchTrendMetrics(trade.ticker)` — Trend/sentiment
- `fetchVolatilityMetrics(trade.contract.id)` — IV percentile
- `fetchLiquidityMetrics(trade.contract.id)` — Bid-ask spread, volume

**Issue #2:** ⚠️ **TP/SL NOT RECALCULATED based on confluence** — Default 50/50 used for LOADED display

---

### State 3: ENTERED (User clicks "Enter")
**Location:** `src/components/DesktopLiveCockpit.tsx:301-325`

**Current behavior:**
```tsx
if (alertType === 'enter') {
  const finalTrade = {
    ...currentTrade,                    // ← Keeps old TP/SL!
    state: 'ENTERED' as TradeState,
    entryPrice: currentTrade.contract.mid,  // ← Entry price SET
    entryTime: new Date(),
    // ❌ NO RE-CALCULATION HERE
  };

  setCurrentTrade(finalTrade);
  setTradeState('ENTERED');
  // ❌ NO UPDATE TO TARGET_PRICE/STOP_LOSS
}
```

**Issue #3:** 🔴 **CRITICAL** — Entry sets `entryPrice`, but TP/SL are NOT recalculated based on:
- Actual entry price (vs. contract mid used in LOADED state)
- Confluence data (trend, volatility, liquidity) that was already fetched
- Risk profile for inferred trade type (by DTE)

---

## 2. Confluence Panel Display (HDConfluenceDetailPanel)

**Location:** `src/components/hd/HDConfluenceDetailPanel.tsx`

**Data shown:**
- ✅ Trend score (bullish/bearish/mixed)
- ✅ Volatility level (elevated/normal/calm) based on IV percentile
- ✅ Liquidity level (tight/fair/thin) based on bid-ask spread

**Does it update on entry?**
- ✅ YES — `useConfluenceData` reruns when `tradeState` changes to 'ENTERED'
- ✅ `HDEnteredTradeCard.tsx` renders confluence metrics
- ✅ Confluence data is fetched for both LOADED and ENTERED states

---

## 3. Risk Calculation Integration

**Location:** `src/lib/riskEngine/calculator.ts`

**Functions available but NOT CALLED ON ENTRY:**
```ts
export function calculateRisk(input: RiskCalculationInput): RiskCalculationResult {
  // ✅ This SHOULD be called when user clicks "Enter"
  // ✅ Input includes: entryPrice, currentOptionMid, keyLevels, atr, profile
  // ✅ Output: targetPrice, stopLoss, targetPrice2, reasoning, confidence
}

export function buildChartLevelsForTrade(
  trade: Trade,
  keyLevels: KeyLevels,
  riskResult?: RiskCalculationResult
): ChartLevel[] {
  // ✅ This builds chart display from trade + risk result
}
```

**Problem:** `calculateRisk()` is never called during trade entry!

---

## 4. Chart Levels Display

**For ENTERED trades:** `src/components/hd/HDEnteredTradeCard.tsx:110-125`

```tsx
const chartLevels = useMemo(() => {
  // Mock key levels - in production, get these from risk engine context
  const keyLevels: KeyLevels = {
    preMarketHigh: 0,  // ← ALL ZEROS!
    preMarketLow: 0,
    orbHigh: 0,
    orbLow: 0,
    // ...
  };
  
  return buildChartLevelsForTrade(trade, keyLevels);
  // ❌ Empty keyLevels means chart only shows ENTRY, TP, SL (no confluence levels)
}, [trade]);
```

**Issue #4:** ⚠️ **Chart levels are built but key technical levels (ORB, VWAP, Bollinger) are EMPTY (all zeros)**

---

## 5. Summary of Issues

| # | Issue | Severity | Location | Status |
|---|-------|----------|----------|--------|
| 1 | Defaults used in LOADED state | Low | DesktopLiveCockpit.tsx:217 | ✅ Expected |
| 2 | TP/SL not optimized in LOADED state | Medium | No risk calc on LOAD | ⚠️ Minor gap |
| 3 | **TP/SL NOT RECALC ON ENTRY** | 🔴 HIGH | DesktopLiveCockpit.tsx:301 | **NEEDS FIX** |
| 4 | Key chart levels all zeros | Medium | HDEnteredTradeCard.tsx:113 | ⚠️ Missing impl |
| 5 | Confluence fetched but not used for TP/SL | Medium | useConfluenceData.ts | ⚠️ Gap |

---

## 6. What Should Happen

### On LOAD (User clicks contract):
1. ✅ Fetch trend, volatility, liquidity metrics
2. ❌ **SHOULD:** Call `calculateRisk()` with confluence context
3. ❌ **SHOULD:** Update `targetPrice` and `stopLoss` based on profile + levels
4. Display optimized TP/SL in HDLoadedTradeCard

### On ENTER (User clicks "Enter"):
1. ✅ Set `entryPrice` to current price
2. ❌ **SHOULD:** Call `calculateRisk()` with actual entry price
3. ❌ **SHOULD:** Recalculate TP/SL from entry (not from mid price)
4. ❌ **SHOULD:** Rebuild chart levels with entry + new TP/SL
5. ✅ Display in HDEnteredTradeCard

---

## 7. Recommendations

### Priority 1 (HIGH) - Fix Entry Recalculation
**File:** `src/components/DesktopLiveCockpit.tsx`

When `alertType === 'enter'`:
```tsx
// Step 1: Calculate new TP/SL with entry price + confluence
const riskInput = {
  entryPrice: currentTrade.contract.mid,  // Entry price
  currentUnderlyingPrice: currentTrade.contract.mid,
  currentOptionMid: currentTrade.contract.mid,
  keyLevels: /* fetch from somewhere */,
  atr: /* fetch from somewhere */,
  expirationISO: currentTrade.contract.expiry,
  // ... other fields
};

const riskResult = calculateRisk(riskInput);

// Step 2: Update trade with new TP/SL
const finalTrade = {
  ...currentTrade,
  state: 'ENTERED',
  entryPrice: currentTrade.contract.mid,
  targetPrice: riskResult.targetPrice,      // ← NEW
  stopLoss: riskResult.stopLoss,             // ← NEW
  // ... other fields
};
```

### Priority 2 (MEDIUM) - Populate Key Levels for Chart
**File:** `src/components/hd/HDEnteredTradeCard.tsx`

Fetch actual market levels (ORB, VWAP, Bollinger) and pass to `buildChartLevelsForTrade()`.

### Priority 3 (LOW) - Optimize LOAD State TP/SL
**File:** `src/components/DesktopLiveCockpit.tsx`

When loading contract, use `calculateRisk()` instead of defaults.

---

## 8. Verification Checklist

- [x] Confluence metrics ARE fetched for LOADED & ENTERED states
- [x] Chart display shows entry + TP/SL
- [x] Confluence chips display trend/vol/liq status
- [ ] **TP/SL recalculated on entry with actual entry price**
- [ ] Risk profiles (by DTE) applied correctly
- [ ] Key technical levels (ORB, VWAP, etc.) populated on entry
- [ ] Confluence data used to weight TP/SL selection
- [ ] Discord alerts include updated confluence & levels

---

## Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/riskEngine/calculator.ts` | TP/SL calculation engine | ✅ Complete, not called on entry |
| `src/lib/riskEngine/chartLevels.ts` | Chart level builder | ✅ Complete, empty keyLevels |
| `src/hooks/useConfluenceData.ts` | Fetch trend/vol/liq | ✅ Complete |
| `src/components/DesktopLiveCockpit.tsx` | Trade state management | ⚠️ Missing entry recalc |
| `src/components/hd/HDEnteredTradeCard.tsx` | Entered trade display | ⚠️ Missing key levels |
| `src/lib/supabase/database.ts` | Persist to DB | ⚠️ Not called for entry |

