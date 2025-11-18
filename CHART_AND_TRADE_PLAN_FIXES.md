# Chart & Trade Plan Fixes Required

## Issues to Fix

### 1. Chart Not Rendering TP/SL Lines ❌

**Problem**: When a contract is selected (LOADED state), the chart doesn't show TP/SL horizontal lines.

**Root Cause**: In `src/components/trading/TradingWorkspace.tsx` line 128-135, the `levels` prop is hardcoded to empty array `[]`.

**Fix**:

```typescript
// Add this after enteredChartLevels (around line 119):
const loadedChartLevels = useMemo(() => {
  if (!currentTrade || tradeState !== 'LOADED') return [] as any[];
  const keyLevels: KeyLevels = computedKeyLevels || {
    preMarketHigh: 0, preMarketLow: 0, orbHigh: 0, orbLow: 0,
    priorDayHigh: 0, priorDayLow: 0, vwap: 0, vwapUpperBand: 0, vwapLowerBand: 0,
    bollingerUpper: 0, bollingerLower: 0, weeklyHigh: 0, weeklyLow: 0,
    monthlyHigh: 0, monthlyLow: 0, quarterlyHigh: 0, quarterlyLow: 0,
    yearlyHigh: 0, yearlyLow: 0,
  };
  return buildChartLevelsForTrade(currentTrade, keyLevels);
}, [currentTrade, tradeState, computedKeyLevels]);

// Then change line 133:
- levels={[]}
+ levels={tradeState === 'LOADED' ? loadedChartLevels : []}
```

---

### 2. Trade Plan Not Visible Until Alert Sent ❌

**Problem**: User expects to see TP/SL trade plan immediately when contract is selected, but it only shows after opening the alert composer.

**Status**: Actually the trade plan IS shown in `HDLoadedTradeCard` (lines 69-88 in HDLoadedTradeCard.tsx). The card displays Mid/Target/Stop. However:

- The label says "Mid" instead of "Entry"
- No "Trade Plan" header to make it obvious
- No underlying stock price shown for context

**Fix**: In `src/components/hd/HDLoadedTradeCard.tsx` around line 63:

```typescript
{
  /* Underlying Stock Price */
}
{
  underlyingPrice && (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-3">
      <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">
        {trade.ticker} Price
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[var(--text-high)] tabular-nums font-medium text-lg">
          ${formatPrice(underlyingPrice)}
        </span>
        {underlyingChange !== undefined && (
          <span
            className={`text-xs tabular-nums ${
              underlyingChange >= 0
                ? "text-[var(--accent-positive)]"
                : "text-[var(--accent-negative)]"
            }`}
          >
            {underlyingChange >= 0 ? "+" : ""}
            {underlyingChange.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}

{
  /* Trade Plan - Price Details */
}
<div>
  <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-2 font-medium">
    📊 Trade Plan
  </div>
  <div className="grid grid-cols-3 gap-3">
    <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-3">
      <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">
        Entry
      </div>
      <div className="text-[var(--text-high)] tabular-nums font-medium">
        ${formatPrice(trade.contract.mid)}
      </div>
    </div>
    {/* ... Target and Stop remain same ... */}
  </div>
</div>;
```

---

### 3. Underlying Stock Price Not in Discord Alerts ❌

**Problem**: Discord alerts should show both contract price AND underlying stock price with context like "SL at SPY $590 (contract $2.50)"

**Files to Modify**:

1. `src/components/hd/HDAlertComposer.tsx` - Pass underlying price to formatter
2. `src/lib/discordFormatter.ts` - Include underlying prices in message

**Fix in HDAlertComposer.tsx** (around line 300-350 where formatDiscordAlert is called):

```typescript
// Add underlyingPrice prop to component (line 14)
interface HDAlertComposerProps {
  trade: Trade;
  alertType: AlertType;
  // ... existing props
  underlyingPrice?: number; // ADD THIS
  underlyingChange?: number; // ADD THIS
}

// Then when calling formatDiscordAlert (around line 350):
const formattedMessage = formatDiscordAlert({
  trade: {
    ...trade,
    underlyingPrice, // ADD THIS
    underlyingChange, // ADD THIS
    // ... rest of trade props
  },
  alertType,
  // ... rest
});
```

**Fix in discordFormatter.ts** (around line 50-150 where messages are built):

```typescript
// In formatDiscordAlert function, add underlying price to messages:

if (alertType === "load") {
  message += `\\n📍 Entry: $${formatPrice(trade.contract.mid)}`;
  if (trade.underlyingPrice) {
    message += ` (${trade.ticker} @ $${formatPrice(trade.underlyingPrice)})`;
  }
  if (trade.targetPrice)
    message += `\\n🎯 Target: $${formatPrice(trade.targetPrice)}`;
  if (trade.stopLoss) {
    message += `\\n🛑 Stop: $${formatPrice(trade.stopLoss)}`;
    // Calculate underlying SL price if we have delta
    if (trade.underlyingPrice && trade.contract.delta) {
      const underlyingMove =
        (trade.stopLoss - trade.contract.mid) / trade.contract.delta;
      const underlyingSL = trade.underlyingPrice + underlyingMove;
      message += ` (${trade.ticker} @ $${formatPrice(underlyingSL)})`;
    }
  }
}

// Similar for 'enter', 'update', 'exit' types
```

---

## Implementation Steps

1. **Fix Chart Rendering** (TradingWorkspace.tsx)

   - Add `loadedChartLevels` useMemo hook
   - Pass `loadedChartLevels` to HDLiveChart when `tradeState === 'LOADED'`

2. **Improve Trade Plan Display** (HDLoadedTradeCard.tsx)

   - Add underlying stock price display section
   - Add "📊 Trade Plan" header
   - Change "Mid" label to "Entry"

3. **Add Underlying Prices to Discord**
   - Update HDAlertComposer to receive underlyingPrice prop
   - Pass underlyingPrice through to formatDiscordAlert
   - Modify discordFormatter.ts to include underlying prices in all alert types
   - Calculate underlying TP/SL prices using delta (premium_move / delta = underlying_move)

---

## Testing Checklist

- [ ] Select a contract in WATCHING state → Chart should immediately show TP/SL lines
- [ ] Trade card should show "📊 Trade Plan" with Entry/Target/Stop
- [ ] Underlying stock price should show above trade plan
- [ ] Send LOAD alert → Discord should show "Entry $5.25 (SPY @ $590.50)"
- [ ] Send ENTER alert → Discord should show "SL $2.80 (SPY @ $588.25)"
- [ ] All alert types should include underlying context where helpful

---

## Delta-Based Underlying Price Calculation

Formula: `underlying_price_change = (option_price_change) / delta`

Example:

- Current SPY: $590
- Contract mid: $5.00, delta: 0.50
- Stop loss: $2.50 (option price)
- Option move: $2.50 - $5.00 = -$2.50
- Underlying move: -$2.50 / 0.50 = -$5.00
- Underlying SL: $590 + (-$5.00) = $585

This gives traders both perspectives: "SL at $2.50 contract price (SPY @ $585)"
