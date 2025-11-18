# TP/SL Calculation Flow Documentation

## Overview

This document explains how Take Profit (TP) and Stop Loss (SL) levels are calculated and displayed throughout the trade lifecycle.

## Trade State Machine

```
WATCHING → LOADED → ENTERED → EXITED
   ↓         ↓         ↓
  None    Calculate  Recalculate
           TP/SL      TP/SL
```

## Detailed Flow

### 1. WATCHING State (Ticker Selection)

**Location**: User clicks a ticker from watchlist

**Action**: None - no TP/SL calculated yet

**Files Involved**:

- `src/hooks/useTradeStateMachine.ts` - `handleTickerClick()`
- `src/components/DesktopLiveCockpit.tsx` - displays watchlist

---

### 2. LOADED State (Contract Selection)

**Location**: User selects an options contract from the chain

**Action**: **FIRST TP/SL CALCULATION**

**Calculation Process**:

1. **Infer Trade Type** from DTE (Days To Expiration):

   - DTE < 1: SCALP
   - 1 ≤ DTE < 5: DAY
   - 5 ≤ DTE < 30: SWING
   - DTE ≥ 30: LEAP

2. **Get Risk Profile** for trade type:

   - Each profile has specific ATR multipliers for TP/SL
   - SCALP: tighter TP/SL (0.5-0.75 ATR)
   - DAY: moderate (1.0-1.5 ATR)
   - SWING: wider (1.5-2.0 ATR)
   - LEAP: widest (2.0-3.0 ATR)

3. **Adjust by Confluence** (if available):

   - Trend strength → adjust TP distance
   - Volatility → adjust SL distance
   - Liquidity → confidence level

4. **Calculate TP/SL** via `calculateRisk()`:

   - Uses key levels (VWAP, ORB, Prior Day High/Low)
   - ATR-based fallback if no levels available
   - Returns: targetPrice, stopLoss, reasoning, confidence

5. **Store in Trade Object**:
   ```typescript
   const trade: Trade = {
     ...
     targetPrice: riskResult.targetPrice,
     stopLoss: riskResult.stopLoss,
     ...
   }
   ```

**Files Involved**:

- `src/hooks/useTradeStateMachine.ts` - `handleContractSelect()`
- `src/components/DesktopLiveCockpit.tsx` - lines 140-230
- `src/lib/riskEngine/calculator.ts` - `calculateRisk()`
- `src/lib/riskEngine/profiles.ts` - `inferTradeTypeByDTE()`, `RISK_PROFILES`

**Console Log**:

```
[v0] LOADED state: Calculated TP = X.XX, SL = Y.YY for {tradeType} trade
```

---

### 3. ENTERED State (Trade Entry)

**Location**: User clicks "Enter Trade"

**Action**: **RECALCULATE TP/SL** based on actual entry price

**Why Recalculate?**

- Entry price may differ from contract mid price used in LOADED
- Live market conditions may have changed
- More accurate TP/SL based on actual fill price

**Calculation Process**:

1. **Get Entry Price**:

   - Use current contract mid if not specified
   - Or use user-provided entry price

2. **Recalculate TP/SL** with same profile:

   ```typescript
   const riskResult = calculateRisk({
     entryPrice,  // <- New actual entry price
     currentUnderlyingPrice: activeTicker.last,
     currentOptionMid: entryPrice,
     keyLevels,
     atr,
     expirationISO: contract.expiry,
     tradeType,
     ...
   });
   ```

3. **Update Trade Object**:
   ```typescript
   const finalTrade = {
     ...currentTrade,
     state: 'ENTERED',
     entryPrice,
     targetPrice: riskResult.targetPrice,  // <- Updated
     stopLoss: riskResult.stopLoss,        // <- Updated
     ...
   }
   ```

**Files Involved**:

- `src/hooks/useTradeStateMachine.ts` - `handleEnterTrade()`
- `src/components/DesktopLiveCockpit.tsx` - entry handling (though code shows issues here)
- `src/lib/riskEngine/calculator.ts` - `calculateRisk()` called again

**Console Log**:

```
[v0] Entry: Recalculated SL = Y.YY from {tradeType} profile
```

**Current Issue**: DesktopLiveCockpit shows duplicate calculation logic that may not be working correctly. The useTradeStateMachine hook has the correct logic.

---

### 4. Chart Level Display

**Location**: HDLiveChart component when trade is ENTERED

**Action**: Generate chart levels from TP/SL

**Process**:

1. **Build Chart Levels**:

   ```typescript
   const levels = buildChartLevelsForTrade(trade, keyLevels);
   ```

2. **Generated Levels**:

   - ENTRY: `trade.entryPrice`
   - TP1: `trade.targetPrice`
   - SL: `trade.stopLoss`
   - Key levels: VWAP, ORB High/Low, Prior Day High/Low, etc.

3. **Render on Chart**:
   - Horizontal lines at each price level
   - Color-coded: green for TP, red for SL, neutral for entry
   - Labels with hover info

**Files Involved**:

- `src/lib/riskEngine/chartLevels.ts` - `buildChartLevelsForTrade()`
- `src/components/hd/HDLiveChart.tsx` - renders levels prop
- `src/components/trading/TradingWorkspace.tsx` - calls buildChartLevelsForTrade

**Current Issue**: Chart may not be displaying TP/SL levels because:

1. Levels prop may not be passed correctly
2. Trade may not have valid TP/SL values
3. Chart rendering may be skipped for ENTERED state

---

## Key Functions

### `calculateRisk(input: RiskCalculationInput): RiskCalculationResult`

**Location**: `src/lib/riskEngine/calculator.ts`

**Purpose**: Core TP/SL calculation function

**Inputs**:

- `entryPrice`: Option entry price
- `currentUnderlyingPrice`: Current underlying stock price
- `currentOptionMid`: Current option mid price
- `keyLevels`: Key price levels (VWAP, ORB, etc.)
- `atr`: Average True Range for volatility
- `expirationISO`: Option expiration date
- `tradeType`: SCALP/DAY/SWING/LEAP (or inferred from DTE)
- `delta`, `gamma`: Greeks for option premium calculation
- `defaults`: Mode (percent vs calculated), fallback percentages

**Outputs**:

```typescript
{
  targetPrice: number,      // Primary TP
  stopLoss: number,          // SL level
  targetPrice2?: number,     // Secondary TP (optional)
  riskRewardRatio: number,   // Reward/Risk ratio
  confidence: 'high' | 'medium' | 'low',
  reasoning: string,         // Explanation of calculation
  calculatedAt: number,      // Timestamp
  usedLevels: string[],      // Which levels were used
  tradeType?: TradeType,     // Inferred or passed type
  dte?: number,              // Days to expiration
}
```

**Modes**:

1. **Percent Mode** (fallback):

   - TP = entryPrice \* (1 + tpPercent/100)
   - SL = entryPrice \* (1 - slPercent/100)
   - Simple, predictable

2. **Calculated Mode** (primary):
   - Projects TP candidates from key levels + ATR
   - Filters by distance and profile weights
   - Selects best TP/SL based on confluence

---

### `buildChartLevelsForTrade(trade, keyLevels, riskResult?): ChartLevel[]`

**Location**: `src/lib/riskEngine/chartLevels.ts`

**Purpose**: Convert trade TP/SL into chart displayable levels

**Returns**:

```typescript
[
  { type: "ENTRY", label: "Entry", price: trade.entryPrice },
  { type: "TP", label: "TP1", price: trade.targetPrice, meta: { tpIndex: 1 } },
  { type: "SL", label: "SL", price: trade.stopLoss },
  { type: "VWAP", label: "VWAP", price: keyLevels.vwap },
  // ... other key levels
];
```

---

## Current Issues & Fixes Needed

### Issue 1: TP/SL Not Displayed on Chart

**Symptoms**:

- Chart loads but no TP/SL lines visible
- Entry line may or may not show

**Root Causes**:

1. **trade.targetPrice or trade.stopLoss is undefined**

   - Calculation failed in LOADED or ENTERED state
   - Fallback values not set properly

2. **levels prop not passed to HDLiveChart**

   - TradingWorkspace may not be calling buildChartLevelsForTrade
   - DesktopLiveCockpit may not be using TradingWorkspace

3. **Chart not re-rendering for ENTERED state**
   - Chart may only render in WATCHING/LOADED states
   - Need conditional rendering based on trade state

**Fixes**:

1. ✅ Ensure calculateRisk is called in both LOADED and ENTERED states
2. ✅ Add fallback TP/SL if calculation fails
3. ✅ Verify levels prop is passed to HDLiveChart
4. ❌ Debug chart rendering in ENTERED state

---

### Issue 2: Duplicate Calculation Logic

**Location**: `src/components/DesktopLiveCockpit.tsx` lines 140-270

**Problem**:

- DesktopLiveCockpit has its own `handleContractSelect` logic
- This duplicates and may conflict with `useTradeStateMachine`
- Calculations may not be consistent

**Fix**:

- Remove duplicate logic from DesktopLiveCockpit
- Use `actions.handleContractSelect` from useTradeStateMachine
- Or move all logic into DesktopLiveCockpit if not using the hook

---

### Issue 3: Entry State Recalculation

**Location**: `src/hooks/useTradeStateMachine.ts` line 325+

**Current Code**:

```typescript
const handleEnterTrade = useCallback(
  (
    channelIds?: string[],
    challengeIds?: string[],
    comment?: string,
    entryPrice?: number
  ) => {
    const finalEntryPrice = entryPrice || currentTrade.contract.mid;
    const targetPrice = currentTrade.targetPrice || finalEntryPrice * 2; // ← Fallback only
    const stopLoss = currentTrade.stopLoss || finalEntryPrice * 0.5; // ← Fallback only

    // NO RECALCULATION WITH NEW ENTRY PRICE!
  }
);
```

**Problem**: TP/SL not recalculated with actual entry price

**Fix**: Call `calculateRisk()` again with `finalEntryPrice`:

```typescript
const handleEnterTrade = useCallback((
  channelIds?: string[],
  challengeIds?: string[],
  comment?: string,
  entryPrice?: number
) => {
  const finalEntryPrice = entryPrice || currentTrade.contract.mid;

  // Recalculate TP/SL with actual entry price
  const riskResult = calculateRisk({
    entryPrice: finalEntryPrice,
    currentUnderlyingPrice: activeTicker.last,
    currentOptionMid: finalEntryPrice,
    keyLevels,
    atr,
    expirationISO: currentTrade.contract.expiry,
    tradeType: currentTrade.tradeType,
    ...
  });

  const targetPrice = riskResult.targetPrice || finalEntryPrice * 2;
  const stopLoss = riskResult.stopLoss || finalEntryPrice * 0.5;

  // ... rest of logic
});
```

---

## Testing

### Test File: `src/lib/riskEngine/__tests__/tp-sl-flow.test.ts`

**Test Categories**:

1. **LOADED State Tests**:

   - Scalp trade TP/SL (DTE < 1)
   - Day trade TP/SL (1 ≤ DTE < 5)
   - Swing trade TP/SL (5 ≤ DTE < 30)
   - LEAP TP/SL (DTE ≥ 30)

2. **ENTERED State Tests**:

   - Recalculation with different entry price
   - Preservation when entry = contract mid

3. **Chart Levels Tests**:

   - TP and SL levels generated
   - Entry level included
   - Key levels (VWAP, ORB) included

4. **Edge Cases**:
   - Missing key levels (ATR fallback)
   - Missing ATR (key level fallback)
   - Percent mode fallback

**Run Tests**:

```bash
pnpm test src/lib/riskEngine/__tests__/tp-sl-flow.test.ts
```

---

## Debugging Checklist

When TP/SL not showing:

1. **Check Console Logs**:

   ```
   [v0] LOADED state: Calculated TP = X.XX, SL = Y.YY
   [v0] Entry: Recalculated SL = Y.YY
   ```

2. **Verify Trade Object**:

   - Open React DevTools
   - Find currentTrade in state
   - Check `targetPrice` and `stopLoss` are numbers, not undefined

3. **Check Chart Levels**:

   - Add console.log in TradingWorkspace before passing levels
   - Verify levels array is not empty
   - Check each level has valid `price` value

4. **Verify Chart Rendering**:

   - Check HDLiveChart is rendering for ENTERED state
   - Verify levels prop is received
   - Check chart initialization (may need to remount)

5. **Database Persistence**:
   - If trade is saved/restored, check DB has TP/SL values
   - May need migration to add columns

---

## Next Steps

1. ✅ Create comprehensive tests
2. ❌ Fix duplicate calculation logic in DesktopLiveCockpit
3. ❌ Add recalculation to handleEnterTrade in useTradeStateMachine
4. ❌ Verify chart levels display in all states
5. ❌ Add visual regression tests for chart display
6. ❌ Document configuration options (ATR multipliers, DTE thresholds)

---

## Configuration

### DTE Thresholds

```typescript
export const DEFAULT_DTE_THRESHOLDS = {
  scalp: 1, // < 1 day
  day: 5, // < 5 days
  swing: 30, // < 30 days
  // >= 30 is LEAP
};
```

### Risk Profiles (ATR Multipliers)

```typescript
export const RISK_PROFILES = {
  SCALP: {
    tpATRFrac: [0.5, 0.75],  // TP at 0.5x and 0.75x ATR
    slATRFrac: 0.3,           // SL at 0.3x ATR
    levelWeights: { ... },
  },
  DAY: {
    tpATRFrac: [1.0, 1.5],
    slATRFrac: 0.5,
    levelWeights: { ... },
  },
  SWING: {
    tpATRFrac: [1.5, 2.0],
    slATRFrac: 0.75,
    levelWeights: { ... },
  },
  LEAP: {
    tpATRFrac: [2.0, 3.0],
    slATRFrac: 1.0,
    levelWeights: { ... },
  },
};
```

### Confluence Adjustments

```typescript
function adjustProfileByConfluence(profile, confluence) {
  // Trend strength → adjust TP
  if (confluence.trend?.strength === "strong") {
    // Increase TP multiplier
  }

  // Volatility → adjust SL
  if (confluence.volatility?.level === "elevated") {
    // Widen SL
  }

  // Liquidity → confidence
  if (confluence.liquidity?.quality === "poor") {
    // Lower confidence
  }
}
```
