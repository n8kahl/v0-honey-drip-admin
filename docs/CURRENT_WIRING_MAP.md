# Current Wiring Map - Middle & Right Columns

**Generated**: December 17, 2025
**Purpose**: Phase 0 audit for NOW/Execution Column Redesign

---

## Architecture Overview

### Main Layout Component
**File**: `src/components/DesktopLiveCockpitSlim.tsx`

**3-Column Layout**:
1. **LEFT**: `HDWatchlistRail` - Watchlist + Loaded/Active trades sidebar
2. **CENTER**: `NowPanel` - Contextual content based on focus
3. **RIGHT**: `ActionRail` (width: 30rem) - State-dependent actions + Discord

---

## Middle Column (NowPanel)

### Router Structure
**File**: `src/components/trading/NowPanel.tsx`

| Focus State | Component | Description |
|-------------|-----------|-------------|
| `null` | `NowPanelEmpty` | Empty state |
| `kind: "symbol"` | `NowPanelSymbol` | Symbol analysis (WATCHING) |
| `kind: "trade", state: WATCHING/LOADED/EXITED` | `NowPanelTrade` | Trade setup view |
| `kind: "trade", state: ENTERED` | `NowPanelManage` | **Management cockpit** |

### NowPanelManage Metrics (ENTERED trades)
**File**: `src/components/trading/NowPanelManage.tsx`

| Metric | Current Source | Live? | Issue |
|--------|----------------|-------|-------|
| P&L % | `(contract.bid - entryPrice) / entryPrice` | ❌ | Uses static contract |
| P&L $ | `currentContractPrice - entryPrice` | ❌ | Uses static contract |
| Underlying Price | `watchlist.last` OR `activeTicker.last` OR `candles[1m][-1]` | ⚠️ | Multiple sources |
| Delta | `trade.contract.delta` | ❌ | Static snapshot |
| Gamma | `trade.contract.gamma` | ❌ | Static snapshot |
| Theta | `trade.contract.theta` | ❌ | Static snapshot |
| IV | `trade.contract.iv` | ❌ | Static snapshot |
| Progress to TP | Calculated from currentContractPrice | ❌ | Depends on static |
| Key Levels | `useKeyLevels(trade.ticker)` | ✅ | OK |
| ATR | `symbolData?.indicators?.atr` | ⚠️ | From marketDataStore |
| MTF Trend | `symbolData?.mtfTrend` | ⚠️ | From marketDataStore |
| Hold Time | `Date.now() - trade.entryTime` | ✅ | OK |

---

## Right Column (ActionRail)

### Mode Detection
**File**: `src/components/trading/ActionRail.tsx`

| Mode | Condition | Content |
|------|-----------|---------|
| Setup | `WATCHING + setupMode.focusedSymbol` | Contract tile + Discord + Load/Enter buttons |
| Loaded | `LOADED + currentTrade` | Risk box + Discord + Enter/Unload |
| Manage | `ENTERED + currentTrade` | Quick actions OR Discord composer |
| Exited | `EXITED + currentTrade` | Final P&L + Share |

### SetupModeContent Metrics
| Metric | Current Source | Live? | Issue |
|--------|----------------|-------|-------|
| Contract Mid | `activeContract.mid` | ❌ | Static |
| Delta | `activeContract.delta` | ❌ | Static |
| Spread % | `(ask - bid) / mid * 100` | ❌ | Static |
| Theta | `activeContract.theta` | ❌ | Static |
| IV | `activeContract.iv` | ❌ | Static |
| Volume | `activeContract.volume` | ❌ | Static |
| TP/SL Targets | **Hardcoded** `TP1: +20%, TP2: +40%, SL: -25%` | ❌ | Should use trade values |

---

## Data Hooks

### Primary Hooks

**`src/hooks/useMassiveData.ts`**:
```typescript
// Live quotes for stocks (WS primary, REST fallback)
useQuotes(symbols: string[])
  → { quotes: Map<symbol, QuoteData>, loading, error }

// Live option P&L tracking
useActiveTradePnL(contractTicker, entryPrice, quantity)
  → { currentPrice, pnlPercent, pnlDollars, asOf, source, isStale }
  → Uses createTransport() internally (WS or 3s REST poll)
  → Stale threshold: 10 seconds
```

**`src/hooks/useOptionsAdvanced.ts`**:
```typescript
// Live Greeks polling (30s default)
useLiveGreeks(contractId, initialGreeks, pollInterval)
  → { delta, gamma, theta, vega, iv, source: "live"|"static" }
```

### Transport Layer
**`src/lib/massive/streaming-manager.ts`**:
- Centralized WebSocket subscription manager
- Auto-reconnect with exponential backoff
- Channels: `quotes`, `trades`, `agg1m`

---

## Duplications Found

| Metric | Shown In | Should Own |
|--------|----------|------------|
| P&L Display | NowPanelManage, ActionRailRiskBox | **NOW only** |
| Greeks | HDGreeksMonitor, NowPanelManage inline | **NOW only** |
| Contract Details | ActionRail SetupMode, NowPanelTrade | **NOW only** |
| Entry/Current Price | NowPanelManage, ActionRailRiskBox | **NOW only** |
| Underlying Price | 3+ components with different sources | **NOW only** |

---

## Key Issues

### 1. No Canonical "effectiveMid"
- NowPanelManage: `contract.bid || contract.mid`
- ActionRail: `activeContract.mid`
- P&L hooks: `data.last || (bid+ask)/2`

**Fix**: Create `useActiveTradeLiveModel` hook with single `effectiveMid`

### 2. Static Contract Data
Most components use `trade.contract.{field}` which is snapshot at creation time.

**Fix**: Replace with live streaming via `useActiveTradePnL` and `useLiveGreeks`

### 3. Underlying from Wrong Source
NowPanelManage uses watchlist/activeTicker/candles - inconsistent.

**Fix**: Use Tradier REST for underlying via `useQuotes`

### 4. No Freshness Indicators
No component shows data age or source (WS vs REST).

**Fix**: Add source badges and stale warnings

### 5. Time-to-Close Bug
Uses `new Date()` for market close calculation - ignores ET timezone.

**Fix**: Use ET-aware market calendar

### 6. R-Multiple Not Calculated
No component shows R = (effectiveMid - entry) / (entry - stop).

**Fix**: Add to live model hook

### 7. Hardcoded TP/SL in ActionRail
Shows `TP1: +20%, TP2: +40%, SL: -25%` instead of trade values.

**Fix**: Use `trade.targetPrice` and `trade.stopLoss`

---

## Recommended Ownership

### NOW Column (Middle) - "TRUTH" Provider
- Live option price (effectiveMid)
- Live P&L % and $
- Live Greeks (Δ, Γ, Θ, ν, IV)
- Live underlying price (from Tradier)
- R-multiple calculation
- Time to market close (ET)
- Data freshness indicators
- Key levels / ATR / MTF

### Execution Column (Right) - "DECISION + ACTION"
- Trade state badge
- Discord channel/challenge selection
- Action buttons (Load, Enter, Trim, Exit, etc.)
- Alert preview (byte-for-byte match with Discord)
- Execution gates (disabled when data stale)

---

## Files to Modify

1. **NEW**: `src/hooks/useActiveTradeLiveModel.ts` - Canonical live model
2. **NEW**: `src/lib/market/dataFreshness.ts` - Centralized staleness thresholds
3. `src/components/trading/NowPanelManage.tsx` - Use new live model
4. `src/components/trading/ActionRail.tsx` - Remove duplicate metrics
5. `src/components/trading/ActionRailRiskBox.tsx` - Simplify or remove
6. `src/components/hd/dashboard/HDGreeksMonitor.tsx` - May be redundant
