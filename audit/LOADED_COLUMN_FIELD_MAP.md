# LOADED Column Field Map - Setup & Contract Selection

**Generated**: December 17, 2025
**Purpose**: Phase 0 audit for LOADED Middle Column Redesign

---

## Architecture Overview

### Column Layout
**File**: `src/components/DesktopLiveCockpitSlim.tsx`

| Column | Component | Width |
|--------|-----------|-------|
| LEFT | `HDWatchlistRail` | ~200px |
| CENTER | `NowPanel` | flex-1 |
| RIGHT | `ActionRail` | 30rem |

---

## Router Structure
**File**: `src/components/trading/NowPanel.tsx`

| Focus State | Component | Description |
|-------------|-----------|-------------|
| `null` | `NowPanelEmpty` | Empty state |
| `kind: "symbol"` | `NowPanelSymbol` | **Setup mode: Symbol analysis + contract selection** |
| `kind: "trade", state: WATCHING/LOADED` | `NowPanelTrade` | Trade decision view |
| `kind: "trade", state: ENTERED` | `NowPanelManage` | Active trade management |
| `kind: "trade", state: EXITED` | `NowPanelTrade` | Trade recap |

---

## SYMBOL FOCUS (Setup Mode) Components
**Primary File**: `src/components/trading/NowPanelSymbol.tsx`

### Zone Structure

| Zone | Component | Purpose |
|------|-----------|---------|
| 1 | `SetupWorkspace` HeaderRow | Ticker/Price + Confluence summary |
| 2 | `SetupWorkspace` EventsStrip | Economic events within 48h |
| 3 | `SetupWorkspace` DecisionViz | Sparkline, Range+ATR, MTF grid |
| 4 | `SelectedContractStrip` + `CompactChain` | Contract selection |

---

## Field Map: All Metrics with Sources

### Zone 1: Symbol Header (SetupWorkspace)
**File**: `src/components/hd/viz/SetupWorkspace.tsx`

| UI Label | Current Source | Update Mechanism | Truly Live? | Issue |
|----------|----------------|------------------|-------------|-------|
| Symbol (SPY) | `symbol` prop | Props | ✅ Static | OK |
| Price ($678.87) | `currentPrice` prop → `watchlist.last` OR `activeTicker.last` | Polling/WS | ⚠️ Mixed sources | Should use canonical Tradier |
| Change % (+0.52%) | `changePercent` prop → `activeTicker.changePercent` OR calculated from candles | Polling | ⚠️ Fallback calculation | May drift |
| Data Health badge | `dataHealth` → `symbolData.lastUpdated` age | Computed | ✅ | OK |
| VWAP chip | `keyLevels.vwap` | `useKeyLevels` hook | ⚠️ Computed from bars | Shows as level, not quote |
| PDH/PDL chip | `keyLevels.priorDayHigh/Low` | `useKeyLevels` hook | ✅ Static for day | OK |
| ORB High/Low chip | `keyLevels.orbHigh/Low` | `useKeyLevels` hook | ✅ Static for day | OK |

### Zone 1: Confluence Summary (SetupWorkspace)
**File**: `src/components/hd/viz/SetupWorkspace.tsx` (lines 359-392)

| UI Label | Current Source | Update Mechanism | Truly Live? | Issue |
|----------|----------------|------------------|-------------|-------|
| Direction (Bullish/Bearish) | `confluence.trend` >= 70 = LONG | Computed | ⚠️ Delayed | Derived from snapshot |
| Confluence Score (53) | `calculateAdvancedConfluence()` | Computed | ❌ Snapshot | Static until recompute |
| RSI chip | `indicators.rsi14` | `useIndicators()` | ⚠️ Bar-based | Only updates on new bar |
| Above/Below VWAP | `currentPrice > indicators.vwap` | Computed | ⚠️ | Depends on price source |
| MTF Aligned chip | `confluence.components.trendAlignment` | Computed | ⚠️ Bar-based | Snapshot |
| Invalidation level | `keyLevels.vwap` OR `keyLevels.priorDayLow` OR `indicators.ema20` | Computed | ⚠️ | Static for session |

### Zone 2: Events Strip (SetupWorkspace)
**File**: `src/components/hd/viz/SetupWorkspace.tsx` (lines 321-357)

| UI Label | Current Source | Update Mechanism | Truly Live? | Issue |
|----------|----------------|------------------|-------------|-------|
| Event Name | `/api/calendar/events` | REST poll 5min | ✅ Cached | OK |
| Time Until | Computed from `event.datetime` | Computed | ✅ | OK |
| Impact badge | `event.impact` | Static | ✅ | OK |

### Zone 3: Decision Visualizations

#### A: Price Position Sparkline
**File**: `src/components/hd/viz/DecisionVizSparkline.tsx`

| UI Label | Current Source | Update Mechanism | Truly Live? | Issue |
|----------|----------------|------------------|-------------|-------|
| Sparkline bars | `candles` (1m) | `useCandles()` | ⚠️ Bar-based | Last bar may be stale |
| Current price marker | `currentPrice` prop | Props | ⚠️ Mixed | Same as header |
| Key level lines | `keyLevels` | `useKeyLevels()` | ✅ Static | OK |

#### B: Range + ATR
**File**: `src/components/hd/viz/DecisionVizRange.tsx`

| UI Label | Current Source | Update Mechanism | Truly Live? | Issue |
|----------|----------------|------------------|-------------|-------|
| Day Range | `max(candles.high) - min(candles.low)` | Computed from bars | ⚠️ Bar-based | May not include current |
| ATR(14) | `dailyCandles` via `atrWilder()` | Computed | ✅ Daily | OK |
| ATR Room | `ATR - Day Range` | Computed | ⚠️ | Depends on day range |
| Range bar visualization | Computed | SVG | ⚠️ | Same as above |

#### C: MTF Ladder
**File**: `src/components/hd/viz/SetupWorkspace.tsx` (MTFLadder component)

| UI Label | Current Source | Update Mechanism | Truly Live? | Issue |
|----------|----------------|------------------|-------------|-------|
| 1m/5m/15m/60m Trend | `mtfTrend[tf]` | `useMTFTrend()` | ⚠️ Bar-based | Only on bar close |
| Strength | Computed from alignment | Computed | ⚠️ | Derived |
| RSI per TF | `indicators.rsi14` (1m only) | `useIndicators()` | ⚠️ | Only 1m available |
| Alignment label | Computed from bull/bear count | Computed | ⚠️ | Derived |

### Zone 4: Contract Selection

#### Selected Contract Strip
**File**: `src/components/hd/strips/SelectedContractStrip.tsx`

| UI Label | Current Source | Update Mechanism | Truly Live? | Issue |
|----------|----------------|------------------|-------------|-------|
| Strike ($649) | `contract.strike` | Props (chain snapshot) | ❌ Static | OK (immutable) |
| Type (Call/Put) | `contract.type` | Props | ❌ Static | OK |
| Expiry | `contract.expiry` | Props | ❌ Static | OK |
| DTE | `contract.daysToExpiry` | Props | ❌ Static | OK |
| Mid ($2.06) | `contract.mid` | Props (chain snapshot) | ❌ **CRITICAL** | **Not live - snapshot from chain fetch** |
| Delta | `contract.delta` | Props (chain snapshot) | ❌ **CRITICAL** | **Snapshot - decays over time** |
| Spread % | `(ask-bid)/mid * 100` | Computed | ❌ | **Uses stale bid/ask** |
| IV | `contract.iv` | Props (chain snapshot) | ❌ | **Snapshot** |
| OI | `contract.openInterest` | Props (chain snapshot) | ❌ | **Snapshot** |
| Recommended badge | `isRecommended` prop | Computed | ✅ | OK |

#### Compact Chain
**File**: `src/components/hd/common/CompactChain.tsx`

| UI Label | Current Source | Update Mechanism | Truly Live? | Issue |
|----------|----------------|------------------|-------------|-------|
| All strikes | `contracts` array | Props (chain snapshot) | ❌ Static | **Chain fetched once** |
| Mid prices | `contract.mid` | Snapshot | ❌ **CRITICAL** | **All prices are stale** |
| Delta values | `contract.delta` | Snapshot | ❌ | **Stale Greeks** |
| Spread % | Computed | Computed | ❌ | **Uses stale data** |
| OTM/ATM/ITM sections | Computed from `currentPrice` | Computed | ⚠️ | Price source issues |
| Recommended highlight | `recommendation.bestContract.id` | Computed | ✅ | OK |

---

## Data Hooks Analysis

### Current Price Source Chain
**File**: `src/components/trading/NowPanelSymbol.tsx` (lines 64-67)

```typescript
const currentPrice = useMemo(() => {
  const fromWatchlist = watchlist.find((t) => t.symbol === symbol);
  return fromWatchlist?.last || activeTicker?.last || 0;
}, [symbol, watchlist, activeTicker]);
```

**Issue**: Multiple fallback sources with different update mechanisms:
1. `watchlist.last` - From `useMarketStore().watchlist`
2. `activeTicker.last` - From parent props
3. Falls back to `0` if neither available

**Fix**: Use dedicated `useQuotes()` hook for Tradier stock quotes.

### Contract Data Source
**File**: `src/hooks/useContractRecommendation.ts` / `src/services/options.ts`

```typescript
// Contracts come from fetchNormalizedChain() via useOptionsChain
// This is a single REST fetch with 10-second cache
const { contracts } = useOptionsChain(symbol, 10);
```

**Issue**: Contract data is a single snapshot at load time. No streaming updates.

**Fix**: Create `useLoadedTradeLiveModel` hook with:
1. Live option quote via Massive WS or REST poll
2. Live Greeks via `useLiveGreeks()` (already exists)
3. Proper staleness tracking

---

## Duplications Found

| Metric | Shown In | Recommended Owner |
|--------|----------|-------------------|
| Underlying Price | SetupWorkspace header, CompactChain ATM calc | **Setup header only** |
| Contract Mid | SelectedContractStrip, CompactChain rows | **SelectedContractStrip** (live) |
| Contract Delta | SelectedContractStrip, CompactChain rows | **SelectedContractStrip** (live) |
| Spread % | SelectedContractStrip, CompactChain rows | **SelectedContractStrip** (live) |
| VWAP | SetupWorkspace header, possibly right rail | **Setup header only** |
| Confluence Score | SetupWorkspace, possibly right rail | **Setup workspace only** |

---

## Key Issues Identified

### 1. No Live Option Quotes
**Current**: Contract data comes from single `fetchNormalizedChain()` REST call, cached 10s.
**Impact**: Mid, bid, ask, delta all stale after selection.
**Fix**: Add `useActiveTradePnL()` or similar for live option quote after selection.

### 2. Mixed Underlying Price Sources
**Current**: `watchlist.last || activeTicker.last || 0`
**Impact**: Different components may show different prices.
**Fix**: Single canonical `useQuotes([symbol])` from Tradier REST.

### 3. No Spread/Liquidity Grade
**Current**: Just shows spread% as raw number.
**Impact**: Trader doesn't know if spread is acceptable.
**Fix**: Add liquidity grade (A/B/C) based on spread thresholds.

### 4. No Expected Slippage
**Current**: Not shown anywhere.
**Impact**: Trader doesn't know execution quality impact.
**Fix**: Add slippage estimate based on spread and liquidity grade.

### 5. Static Greeks in Chain
**Current**: Delta shown in chain rows is from snapshot.
**Impact**: Misleading delta values especially for 0DTE.
**Fix**: Focus live Greeks on selected contract only (in strip).

### 6. No Staleness Indicators
**Current**: Only "Live/Delayed/Stale" badge on symbol header.
**Impact**: Contract data staleness not visible.
**Fix**: Add "Snapshot @ time" label on contract metrics.

---

## Recommended Ownership (LOADED Column)

### LOADED Middle Column (Setup/Contract Selection)
- Symbol header with live Tradier price
- Confluence summary (snapshot, labeled)
- Events strip
- Context tiles (collapsed drawer): Sparkline, Range/ATR, MTF
- **PRIMARY FOCUS**: Contract selection
  - Selected Contract Strip with **LIVE** mid/delta/spread
  - Liquidity grade + slippage estimate
  - Compact chain with **SNAPSHOT** data (labeled)
- Quick targets (TP/SL presets, editable)

### NOT in LOADED Column
- Execution buttons (Load/Enter) → Right Rail
- Discord preview → Right Rail
- Full position metrics → Right Rail (after enter)

---

## Files to Modify

### New Files
1. **`src/hooks/useLoadedTradeLiveModel.ts`** - Canonical live model for selected contract
2. **`src/lib/market/contractQuality.ts`** - Liquidity grade + slippage calculations

### Modified Files
1. `src/components/hd/strips/SelectedContractStrip.tsx` - Use live model, add liquidity grade
2. `src/components/hd/common/CompactChain.tsx` - Add "Snapshot" label, fix ATM calculation
3. `src/components/trading/NowPanelSymbol.tsx` - Wire up live model, canonical price source
4. `src/components/hd/viz/SetupWorkspace.tsx` - Use canonical Tradier price

---

## Test Checklist

- [ ] Underlying price comes from Tradier, not watchlist
- [ ] Contract mid updates live after selection (WS or 3s poll)
- [ ] Delta shows live (or labeled as snapshot)
- [ ] Spread% recalculates from live bid/ask
- [ ] Liquidity grade shown (A/B/C)
- [ ] Expected slippage shown
- [ ] Chain rows labeled as "Snapshot"
- [ ] Staleness warning if options data >15s old
- [ ] Context tiles collapsed by default
- [ ] Load/Enter buttons NOT in middle column
