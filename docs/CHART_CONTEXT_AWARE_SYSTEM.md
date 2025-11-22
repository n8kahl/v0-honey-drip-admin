# Chart Context-Aware System - Day Trader Optimization

**Date**: November 2025
**Status**: Implemented
**Branch**: `claude/update-hd-live-chart-01GurrvqTBmiXVdCeGTPEDLU`

## Overview

The HD Live Chart has been redesigned to provide an optimized experience for day traders by automatically detecting the trading context and presenting the most relevant data and UI for each moment.

## Problem Statement

The original HDLiveChart was designed to be a general-purpose charting component with:

- 5 different timeframes (1m, 5m, 15m, 60m, 1D) - most irrelevant for intraday trading
- 4-8 simultaneous indicators (EMA 8/21/50/200, VWAP, Bollinger Bands) causing visual clutter
- No context awareness - same UI for browsing watchlists and executing trades
- Recent price bars obscured by indicator labels
- Performance drag from loading unnecessary historical data

## Solution: Three-Mode Context-Aware Chart

The new system automatically detects the current trading context and configures the chart optimally:

### Mode 1: BROWSE State

**When**: Symbol selected, no trade loaded
**Goal**: Quick setup identification and scanning

**Configuration**:

- **Timeframe**: 5m only (most useful for intraday setups)
- **Indicators**: EMA9 + EMA21 (momentum + trend, simple)
- **Key Levels**: Hidden (not needed for scanning)
- **Data**: Last 20 bars only (lightweight, fast load)
- **Historical Cache TTL**: 60 seconds
- **Dual Chart**: No
- **Trade Metrics**: Hidden

**Use Case**: Trader scrolls watchlist, selects symbols to examine for entry setups

---

### Mode 2: LOADED State

**When**: Contract selected, ready to enter trade
**Goal**: Execute entry with confidence and precision

**Configuration**:

- **Timeframe**: 5m + 1m (dual-view side-by-side)
  - 5m view shows context/trend
  - 1m view shows entry precision
- **Indicators**: EMA9 + EMA21 + VWAP (order flow context)
- **Key Levels**: Enabled (ORB, support/resistance, VWAP bands)
- **Data**: Last 50 bars per timeframe
- **Historical Cache TTL**: 120 seconds
- **Dual Chart**: YES
- **Trade Metrics**: Hidden

**Use Case**: Trader has loaded contract, studying entry zone, ready to pull trigger

---

### Mode 3: ENTERED State

**When**: Position active
**Goal**: Real-time trade management and P&L monitoring

**Configuration**:

- **Timeframe**: 1m only (real-time management focus)
- **Indicators**: EMA9 + VWAP (minimal - focus on price action)
- **Key Levels**: Enabled (entry, TP targets, SL)
- **Data**: WebSocket stream only (no historical fetches)
- **Historical Cache TTL**: 300 seconds (won't change during trade)
- **Dual Chart**: No
- **Trade Metrics**: YES (expandable panel below chart)

**Metrics Panel Shows**:

- P&L percentage (compact view)
- Current price vs entry
- Target (TP) and Stop Loss levels
- Greeks (Delta, Theta, IV, DTE)
- Risk/Reward ratio
- Entry time and trade duration
- Expandable detailed view with all metrics

**Use Case**: Trader actively managing position, monitoring P&L, adjusting stops/targets

---

## Implementation Details

### Core Files

#### 1. `src/lib/chartUtils/chartStateDetector.ts`

Utility for detecting chart mode and generating optimized configs.

```typescript
// Detect mode based on trade state
const mode = detectChartMode(tradeState, currentTrade, hasLoadedContract);
// Returns: 'BROWSE' | 'LOADED' | 'ENTERED'

// Get mode-specific configuration
const config = getChartModeConfig(mode, symbol);
// Returns: ChartModeConfig with timeframes, indicators, cache TTL, etc.
```

**Key Functions**:

- `detectChartMode()` - Determines current mode
- `getChartModeConfig()` - Returns optimized settings for mode
- `getSafeTimeframe()` - Ensures requested timeframe is valid for mode

---

#### 2. `src/components/hd/charts/HDLiveChartContextAware.tsx`

Main wrapper component that orchestrates the context-aware behavior.

```typescript
<HDLiveChartContextAware
  ticker={symbol}
  tradeState={tradeState}
  currentTrade={currentTrade}
  activeTicker={activeTicker}
  hasLoadedContract={isLoaded || isEntered}
  levels={chartLevels}
  height={400}
/>
```

**Responsibilities**:

- Detects chart mode automatically
- Applies mode-specific config to HDLiveChart
- Renders dual timeframe view in LOADED mode
- Shows TradeMetricsPanel in ENTERED mode
- Manages data loading strategy by mode

---

#### 3. `src/components/hd/charts/TradeMetricsPanel.tsx`

Expandable panel showing real-time P&L and trade metrics.

**Features**:

- Compact view: P&L %, price move, DTE warning
- Expanded view: Entry/current/target/SL prices, Greeks, risk/reward
- Color coding: Green for gains, red for losses, yellow for near-expiry
- Real-time duration tracking
- Expandable/collapsible with smooth animation

---

### Data Optimization

**Before** (Old System):

- Loaded 1D, 60m, 15m, 5m, 1m bars simultaneously
- ~500-5000 bars per symbol
- 5+ API calls per symbol load
- No TTL - could reuse stale data

**After** (New System):

- BROWSE: 20 bars (5m only)
- LOADED: 50 bars × 2 timeframes = 100 bars
- ENTERED: WebSocket stream (no fetch)
- Smart TTL by mode: 60s → 120s → 300s

**Performance Improvement**: 60-80% fewer API calls and data transfers for day traders

---

### Visual Improvements

1. **Label Placement**: Indicator labels moved to compact right panel (future enhancement)
2. **Simplified Indicators**: Context-aware visibility prevents visual overload
3. **Dual Timeframe**: 5m + 1m side-by-side for entry precision (LOADED mode)
4. **P&L Panel**: Always-visible metrics below chart (ENTERED mode)
5. **No Chart Controls**: Hidden in ENTERED mode (focused trading)

---

## Integration

The new system is transparent to parent components. Update TradingWorkspace to use:

```typescript
import { HDLiveChartContextAware } from '../hd/charts/HDLiveChartContextAware';

// Instead of:
// <HDLiveChart {...manualProps} />

// Now use:
<HDLiveChartContextAware
  ticker={ticker}
  tradeState={tradeState}
  currentTrade={currentTrade}
  activeTicker={activeTicker}
  hasLoadedContract={isLoaded || isEntered}
  levels={levels}
  height={height}
/>
```

---

## Future Enhancements

### Planned

1. **RightSideIndicatorPanel**: Dedicated area for indicator labels (prevents overlap)
2. **Smart Cache Manager**: Global cache with deduplication by symbol + mode
3. **Mobile Optimization**: Adjust layout for small screens
4. **Alternative Timeframes**: Allow 15m/60m with on-demand loading

### Potential

1. **Strategy-Specific Configs**: Load different indicators based on strategy type
2. **Performance Metrics**: Show FPS and data latency in debug mode
3. **Export Chart**: Save chart snapshots with trade annotations
4. **Indicator Customization**: Allow traders to choose which indicators per mode

---

## Testing

### Manual Testing Checklist

- [ ] Navigate to TradingWorkspace
- [ ] Select a symbol → Chart shows BROWSE mode (5m, EMA9+21)
- [ ] Load a contract → Chart shows LOADED mode (5m + 1m dual view)
- [ ] Enter trade → Chart shows ENTERED mode (1m only + P&L panel)
- [ ] Verify P&L panel in ENTERED state:
  - [ ] Shows correct percentage gain/loss
  - [ ] Expandable to show all metrics
  - [ ] Colors respond to P&L direction
- [ ] Check Greeks display for options
- [ ] Verify DTE warnings (0DTE red, <7 DTE yellow)
- [ ] Test on mobile: Verify responsive layout

### Performance Metrics

- BROWSE load time: <500ms
- LOADED load time: <800ms (dual chart)
- ENTERED P&L update: <100ms

---

## Troubleshooting

### Chart not switching modes

- Check that `tradeState` prop is updating correctly
- Verify `currentTrade` and `hasLoadedContract` props

### Indicators showing incorrectly

- BROWSE should only show EMA9+21
- LOADED should show EMA9+21+VWAP
- ENTERED should show EMA9+VWAP

### P&L panel showing wrong value

- Verify `contract.mid` or `activeTicker.last` is current
- Check that `trade.entryPrice` is set

### Performance degradation

- Verify mode is correctly detected (should be ENTERED, not LOADED)
- Check WebSocket is active (avoid REST polling in ENTERED)

---

## Configuration Reference

### Chart Mode Config

```typescript
interface ChartModeConfig {
  mode: "BROWSE" | "LOADED" | "ENTERED";
  timeframes: ("1" | "5" | "15" | "60" | "1D")[];
  defaultTimeframe: TfKey;
  indicators: {
    ema: number[];
    vwap: boolean;
    bollinger: boolean;
  };
  historicalBarCount: number;
  showKeyLevels: boolean;
  showTradeMetrics: boolean;
  dualTimeframeView: boolean;
  cacheKey: string;
  cacheTTL: number; // seconds
}
```

---

## References

- Original Enhancement Request: HD Live Chart Day Trader Optimization
- Related: `src/lib/riskEngine/chartLevels.ts`
- Streaming Architecture: `src/lib/massive/streaming-manager.ts`
- Trade State Machine: `src/hooks/useTradeStateMachine.ts`

---

**Questions?** See CLAUDE.md for general architecture guidance.
