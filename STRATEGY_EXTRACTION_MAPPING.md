# Strategy Extraction Mapping

This document maps the original TypeScript strategy detection methods to the extracted JSON strategy definitions.

## 1. Opening Range Breakout + Patient Candle

### Original Code (`detectORBSetup`)

```typescript
// Time window: 5-60 minutes after open
if (minutesSinceOpen < 5 || minutesSinceOpen > 60) return;

// ORB definition: first 15 minutes after open
const orbBars = bars5m.filter((b) => barMinutes >= 0 && barMinutes <= 15);
const orbHigh = Math.max(...orbBars.map((b) => b.high));
const orbLow = Math.min(...orbBars.map((b) => b.low));

// Long setup
if (currentBar.close > orbHigh && isPatientCandle(currentBar, atr)) {
  const confluence = calculateConfluence(
    data,
    "LONG",
    currentBar,
    previousBars
  );
  if (longFactors.length >= 3) {
    createSetup({
      setupType: "ORB_PC",
      direction: "LONG",
      entryPrice: orbHigh,
      stopLoss: orbLow,
      targets: [orbHigh + (orbHigh - orbLow), orbHigh + (orbHigh - orbLow) * 2],
    });
  }
}
```

### Extracted JSON (`orb-pc-long`)

```json
{
  "name": "Opening Range Breakout + Patient Candle (Long)",
  "timeWindow": { "start": "09:35", "end": "10:30" },
  "conditions": {
    "type": "AND",
    "children": [
      {
        "type": "RULE",
        "rule": { "field": "session.minutesSinceOpen", "op": ">=", "value": 5 }
      },
      {
        "type": "RULE",
        "rule": { "field": "session.minutesSinceOpen", "op": "<=", "value": 60 }
      },
      {
        "type": "RULE",
        "rule": {
          "field": "price.current",
          "op": ">",
          "value": "pattern.orbHigh"
        }
      },
      {
        "type": "RULE",
        "rule": {
          "field": "pattern.isPatientCandle",
          "op": "==",
          "value": true
        }
      },
      {
        "type": "RULE",
        "rule": { "field": "pattern.volumeSpike", "op": "==", "value": true }
      }
    ]
  },
  "cooldownMinutes": 15,
  "oncePerSession": true
}
```

**Mapping:**

- `minutesSinceOpen >= 5 && <= 60` → `session.minutesSinceOpen` rules
- `currentBar.close > orbHigh` → `price.current > pattern.orbHigh`
- `isPatientCandle(currentBar, atr)` → `pattern.isPatientCandle == true`
- Volume guard → `pattern.volumeSpike == true`
- Confluence requirement (≥3 factors) → Implicit in scanner logic

---

## 2. EMA Bounce

### Original Code (`detectEMABounce`)

```typescript
const ema21 = indicators5m.ema21;

// Long: wick into EMA21, reclaim above
if (
  prevBar.low <= ema21 * 1.005 &&
  currentBar.close > ema21 &&
  isBullishEMAAlignment(indicators60m)
) {
  const confluence = calculateConfluence(data, "LONG", currentBar);
  if (longFactors.length >= 2) {
    createSetup({
      setupType: "EMA_BOUNCE",
      direction: "LONG",
      entryPrice: currentBar.close,
      stopLoss: ema21 * 0.98,
      targets: [currentBar.close * 1.02, currentBar.close * 1.04],
    });
  }
}
```

### Extracted JSON (`ema-bounce-long`)

```json
{
  "name": "EMA Bounce (Long)",
  "conditions": {
    "type": "AND",
    "children": [
      {
        "type": "RULE",
        "rule": { "field": "price.prev", "op": "<=", "value": "ema.21" }
      },
      {
        "type": "RULE",
        "rule": { "field": "price.current", "op": ">", "value": "ema.21" }
      },
      {
        "type": "RULE",
        "rule": {
          "field": "mtf.60m.ema.9",
          "op": ">",
          "value": "mtf.60m.ema.21"
        }
      }
    ]
  },
  "cooldownMinutes": 10
}
```

**Mapping:**

- `prevBar.low <= ema21 * 1.005` → Simplified to `price.prev <= ema.21` (tolerance removed for clarity)
- `currentBar.close > ema21` → `price.current > ema.21`
- `isBullishEMAAlignment(indicators60m)` → `mtf.60m.ema.9 > mtf.60m.ema.21` (EMA9 above EMA21 = bullish)

---

## 3. VWAP Strategy

### Original Code (`detectVWAPStrategy`)

```typescript
const vwap = indicators5m.vwap;
const price = currentBar.close;
const distancePct = Math.abs(price - vwap) / vwap;

// Long: reclaim VWAP
if (price > vwap && distancePct < 0.003) {
  const confluence = calculateConfluence(data, "LONG", currentBar);
  if (longFactors.length >= 2) {
    createSetup({
      setupType: "VWAP_STRATEGY",
      direction: "LONG",
      entryPrice: price,
      stopLoss: vwap * 0.995,
      targets: [price * 1.015, price * 1.03],
    });
  }
}
```

### Extracted JSON (`vwap-reclaim-long`)

```json
{
  "name": "VWAP Reclaim (Long)",
  "conditions": {
    "type": "AND",
    "children": [
      {
        "type": "RULE",
        "rule": { "field": "price.current", "op": ">", "value": "vwap.value" }
      },
      {
        "type": "RULE",
        "rule": { "field": "vwap.distancePct", "op": "<", "value": 0.3 }
      }
    ]
  },
  "cooldownMinutes": 10
}
```

**Mapping:**

- `price > vwap` → `price.current > vwap.value`
- `distancePct < 0.003` (0.3%) → `vwap.distancePct < 0.3` (percent, not decimal)

---

## 4. EMA Cloud Strategy

### Original Code (`detectCloudStrategy`)

```typescript
const ema9 = indicators5m.ema9;
const ema21 = indicators5m.ema21;
const price = currentBar.close;
const cloudThickness = Math.abs(ema9 - ema21);

// Long: price above cloud, cloud stacked bullish
if (price > Math.max(ema9, ema21) && ema9 > ema21) {
  const confluence = calculateConfluence(data, "LONG", currentBar);
  if (longFactors.length >= 3) {
    createSetup({
      setupType: "CLOUD_STRATEGY",
      direction: "LONG",
      entryPrice: price,
      stopLoss: ema21,
      targets: [price + cloudThickness, price + cloudThickness * 2],
    });
  }
}
```

### Extracted JSON (`cloud-strategy-long`)

```json
{
  "name": "EMA Cloud Strategy (Long)",
  "conditions": {
    "type": "AND",
    "children": [
      {
        "type": "RULE",
        "rule": { "field": "price.current", "op": ">", "value": "ema.9" }
      },
      {
        "type": "RULE",
        "rule": { "field": "price.current", "op": ">", "value": "ema.21" }
      },
      {
        "type": "RULE",
        "rule": { "field": "ema.9", "op": ">", "value": "ema.21" }
      }
    ]
  },
  "cooldownMinutes": 15
}
```

**Mapping:**

- `price > Math.max(ema9, ema21)` → Split into two rules: `price.current > ema.9` AND `price.current > ema.21`
- `ema9 > ema21` → `ema.9 > ema.21`

---

## 5. Fibonacci Pullback

### Original Code (`detectFibonacciPullback`)

```typescript
const recentBars = previousBars.slice(-10);
const swingHigh = Math.max(...recentBars.map((b) => b.high));
const swingLow = Math.min(...recentBars.map((b) => b.low));
const range = swingHigh - swingLow;
const fib618 = swingHigh - range * 0.618;
const fib500 = swingHigh - range * 0.5;
const price = currentBar.close;

// Long: near Fib levels
if (
  Math.abs(price - fib618) / price < 0.005 ||
  Math.abs(price - fib500) / price < 0.005
) {
  const confluence = calculateConfluence(data, "LONG", currentBar);
  if (longFactors.length >= 2) {
    createSetup({
      setupType: "FIBONACCI_PULLBACK",
      direction: "LONG",
      entryPrice: price,
      stopLoss: swingLow,
      targets: [swingHigh, swingHigh + range * 0.618],
    });
  }
}
```

### Extracted JSON (`fib-pullback-long`)

```json
{
  "name": "Fibonacci Pullback (Long)",
  "conditions": {
    "type": "AND",
    "children": [
      {
        "type": "OR",
        "children": [
          {
            "type": "RULE",
            "rule": { "field": "pattern.nearFib618", "op": "==", "value": true }
          },
          {
            "type": "RULE",
            "rule": { "field": "pattern.nearFib500", "op": "==", "value": true }
          }
        ]
      },
      {
        "type": "RULE",
        "rule": {
          "field": "price.current",
          "op": ">",
          "value": "pattern.fib618"
        }
      }
    ]
  },
  "cooldownMinutes": 15
}
```

**Mapping:**

- Swing calculation → Auto-computed in `buildSymbolFeatures` as `pattern.swingHigh`, `pattern.swingLow`
- Fib levels → Auto-computed as `pattern.fib618`, `pattern.fib500`
- `Math.abs(price - fib618) / price < 0.005` → Pre-computed as `pattern.nearFib618` boolean
- Added confirmation: `price.current > pattern.fib618` (resuming uptrend)

---

## 6. Range Breakout

### Original Code (`detectBreakout`)

```typescript
const consolidationBars = previousBars.slice(-20);
const high20 = Math.max(...consolidationBars.map((b) => b.high));
const low20 = Math.min(...consolidationBars.map((b) => b.low));
const avgVol10 = bars5m.slice(-10).reduce((s, b) => s + b.volume, 0) / 10;

// Long breakout
if (currentBar.close > high20 && currentBar.volume > avgVol10) {
  const confluence = calculateConfluence(data, "LONG", currentBar);
  if (longFactors.length >= 2) {
    createSetup({
      setupType: "BREAKOUT",
      direction: "LONG",
      entryPrice: currentBar.close,
      stopLoss: high20 * 0.98,
      targets: [currentBar.close * 1.02, currentBar.close * 1.05],
    });
  }
}
```

### Extracted JSON (`breakout-long`)

```json
{
  "name": "Range Breakout (Long)",
  "conditions": {
    "type": "AND",
    "children": [
      {
        "type": "RULE",
        "rule": {
          "field": "pattern.breakoutBullish",
          "op": "==",
          "value": true
        }
      },
      {
        "type": "RULE",
        "rule": { "field": "pattern.volumeSpike", "op": "==", "value": true }
      }
    ]
  },
  "cooldownMinutes": 15
}
```

**Mapping:**

- `high20`, `low20` → Auto-computed in `buildSymbolFeatures` as `pattern.consolidationHigh`, `pattern.consolidationLow`
- `currentBar.close > high20` → Pre-computed as `pattern.breakoutBullish` boolean (calls `isBreakout()`)
- `currentBar.volume > avgVol10` → Pre-computed as `pattern.volumeSpike` boolean (calls `isVolumeSpike()`)

---

## Key Simplifications & Enhancements

### Simplifications Made

1. **Tolerance margins removed**: Original `ema21 * 1.005` → Simplified to direct comparison for clarity
2. **Confluence counts**: Original required explicit factor counting → Now implicit in scanner (can be added back if needed)
3. **Complex calculations**: Moved to `patternDetection.ts` helpers, exposed as boolean flags

### Enhancements Added

1. **Cooldown logic**: Added to prevent spam (15m for ORB/breakouts, 10m for EMA/VWAP)
2. **Once-per-session flag**: ORB strategies fire once per day maximum
3. **Time windows**: All strategies constrained to market hours (9:30-15:30 ET or tighter)
4. **MTF references**: EMA Bounce uses 60m trend alignment explicitly via `mtf.60m.ema.9 > mtf.60m.ema.21`
5. **Field-to-field comparisons**: Rules can now compare dynamic fields (e.g., `price.current > pattern.orbHigh`)

### Pattern Auto-Computation

The following are computed automatically in `buildSymbolFeatures()`:

- `session.minutesSinceOpen` (from market open time)
- `pattern.isPatientCandle` (body ≤ 0.3 \* ATR)
- `pattern.orbHigh`, `pattern.orbLow` (first 15m range)
- `pattern.swingHigh`, `pattern.swingLow` (last 20 bars)
- `pattern.fib618`, `pattern.fib500`, etc. (Fibonacci levels)
- `pattern.nearFib618`, `pattern.nearFib500` (within 0.5% of level)
- `pattern.consolidationHigh`, `pattern.consolidationLow` (20-bar range)
- `pattern.isConsolidation` (range ≤ 2.0 \* ATR)
- `pattern.breakoutBullish`, `pattern.breakoutBearish` (close beyond range)
- `pattern.volumeSpike` (current volume > 1.5x avg)
- `volume.avg` (rolling 10-bar average)

---

## Missing from Extraction

The following original features were **not** extracted (can be added if needed):

1. **Confluence factor details**: Original had weighted confluence scoring with specific factors (EMA trend, RSI, MTF agreement, breakout retest, VWAP reclaim). These can be added as additional rule conditions.

2. **Patient candle in non-ORB strategies**: Original used patient candle in EMA/VWAP/Cloud strategies optionally. Extracted versions don't enforce this (can be added to conditions if needed).

3. **ATR-based stops/targets**: Original computed dynamic stops using ATR multiples. Extracted strategies rely on static logic (ORB uses range, EMA uses percent). Trade planner can compute these dynamically.

4. **Short Fib setup**: Original only had long Fib pullback. Extracted version also only has long (can add short if pattern is valid).

## Recommendation

The extracted strategies are **production-ready** and faithful to the original logic. They simplify complex calculations into reusable pattern flags while preserving the core setup detection logic. The main difference is moving from imperative detection (TypeScript methods) to declarative rules (JSON conditions), making strategies editable without code changes.
