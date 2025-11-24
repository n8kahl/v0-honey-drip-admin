# 🚀 Massive.com Advanced Integration Guide

**Purpose**: Comprehensive plan for leveraging Massive.com Advanced subscription to maximize strategy engine capabilities and build institutional-grade backtesting infrastructure.

**Last Updated**: November 24, 2025
**Current Phase**: Phase 2 - Context Engines (In Progress)
**Next Phase**: Phase 3 - Historical Backtesting & Pattern Recognition

---

## 📊 What We're Currently Using

### ✅ Phase 1 & 2 Implementation

#### Real-Time Data Streams
- **Options Chains** (`/v3/snapshot/options/{underlying}`)
  - Greeks (delta, gamma, theta, vega, rho)
  - Implied volatility by strike
  - Open interest and volume
  - Bid/ask spreads
  - Last trade price and time

- **Indices Snapshots** (`/v3/snapshot/indices`)
  - VIX, SPY, NDX, RUT, TICK
  - Real-time quotes with change/volume
  - Used for market regime detection

- **Historical Bars** (`/v2/aggs/ticker/{ticker}/range/{mult}/{timespan}/{from}/{to}`)
  - 1m, 5m, 15m, 1h, 4h, daily, weekly bars
  - OHLCV + VWAP data
  - **NOW STORED** in `historical_bars` table (Phase 1)
  - 10-50x faster repeated queries

#### Persistent Data Warehouse (Phase 1)
- **5 Database Tables** storing historical snapshots:
  1. `historical_greeks` - 15-min snapshots of Greeks/IV
  2. `gamma_exposure_snapshots` - Dealer positioning every 15 min
  3. `iv_percentile_cache` - Daily 52-week IV context
  4. `options_flow_history` - Smart money tracking (placeholder)
  5. `market_regime_history` - Daily market classification

#### Context Engines (Phase 2 - Just Built!)
- **IVPercentileEngine** - Queries IV cache, applies entry timing boosts
- **GammaExposureEngine** - Predicts pinning vs breakout behavior
- **MTFAlignmentEngine** - Filters signals against daily/weekly trends
- **FlowAnalysisEngine** - Tracks institutional flow bias
- **RegimeDetectionEngine** - Adjusts strategy per market regime

---

## 🔥 What We're NOT Yet Using (But Should!)

### 1. **Historical Options Pricing** (Game Changer!)

**Endpoint**: `/v2/aggs/ticker/O:SPY251219C00650000/range/1/minute/{from}/{to}`

**What It Provides**:
- Historical minute-by-minute option price data
- Historical Greeks evolution (IV crush patterns)
- Actual bid/ask spreads over time

**Use Cases**:
```typescript
// Example: Backtest IV Crush Detector
async function backtestIVCrushDetector(symbol: string, startDate: string, endDate: string) {
  // 1. Fetch historical options chain data for SPX over 90 days
  const chains = await getHistoricalOptionChains(symbol, startDate, endDate);

  // 2. Run IV Crush detector on historical data
  let detections = [];
  for (const chain of chains) {
    const result = ivCrushDetector.detect(chain);
    if (result.detected) {
      detections.push(result);
    }
  }

  // 3. Calculate actual outcomes (did IV crush happen?)
  const outcomes = detections.map(d => {
    const actual = getActualIVChange(d.symbol, d.timestamp, '24h');
    return {
      predicted: d.prediction,
      actual: actual,
      correct: Math.sign(d.prediction) === Math.sign(actual)
    };
  });

  // 4. Calculate detector accuracy
  const winRate = outcomes.filter(o => o.correct).length / outcomes.length;
  return {
    winRate,
    totalSignals: outcomes.length,
    avgPredicted: avg(outcomes.map(o => o.predicted)),
    avgActual: avg(outcomes.map(o => o.actual)),
  };
}
```

**Impact**:
- **Know exact win rates** before going live
- **Optimize confluence weights** based on historical performance
- **Detect flawed detectors** that look good in theory but fail in practice
- **Backtest entry/exit timing** for maximum P&L

---

### 2. **Options Trade Feed** (Smart Money Tracking)

**Endpoint**: `/v3/trades/options` (if available in Advanced)

**What It Provides**:
- Real-time individual option trades
- Trade size, price, timestamp
- Exchange information
- Potentially trade classification (sweep, block, etc.)

**Use Cases**:
```typescript
// Example: Real-Time Unusual Options Activity (UOA)
interface OptionsFlowUpdate {
  symbol: string;
  strike: number;
  expiration: string;
  optionType: 'call' | 'put';
  side: 'buy' | 'sell';
  size: number;
  premium: number;
  timestamp: number;
  classification: 'SWEEP' | 'BLOCK' | 'SPLIT' | 'REGULAR';
}

// Subscribe to options trades
ws.on('trade', (trade: OptionsFlowUpdate) => {
  // Classify as unusual
  if (trade.premium > 100000 && trade.classification === 'SWEEP') {
    // Store in options_flow_history
    await storeFlowUpdate(trade);

    // Trigger alert if aligned with detector signal
    if (hasActiveSignal(trade.symbol)) {
      await sendDiscordAlert(`🔥 UOA Confirmation: ${formatFlow(trade)}`);
    }
  }
});
```

**Current Gap**:
- `options_flow_history` table exists but is **populated with placeholders**
- Need to integrate real trade data from Massive WebSocket

**Impact**:
- **Follow institutional money** in real-time
- **Confirm detector signals** with actual smart money activity
- **Detect dark pool positioning** before moves happen

---

### 3. **Historical IV Surface** (Pre-Catalyst Detection)

**What It Provides**:
- Strike-by-strike IV history
- IV skew evolution over time
- Detect abnormal IV expansion before events

**Use Cases**:
```typescript
// Example: Detect Pre-Earnings IV Ramp
async function detectPreEventIVRamp(symbol: string) {
  // 1. Fetch 30-day IV surface history
  const ivSurface = await getHistoricalIVSurface(symbol, '30d');

  // 2. Calculate IV expansion by strike
  const atm = findATMStrike(ivSurface.latest);
  const current_iv = atm.impliedVolatility;
  const avg_iv = average(ivSurface.history.map(s => s.atm_iv));

  const expansion_pct = (current_iv - avg_iv) / avg_iv * 100;

  // 3. Classify
  if (expansion_pct > 30) {
    return {
      detected: true,
      type: 'PRE_EVENT_IV_RAMP',
      message: `${symbol} IV expanded ${expansion_pct.toFixed(0)}% → Potential catalyst ahead`,
      recommendation: 'WAIT_FOR_IV_DROP',  // Don't buy premium now
    };
  }

  return { detected: false };
}
```

**Impact**:
- **Avoid buying expensive premium** before earnings
- **Detect dark horse catalysts** (unusual IV spikes with no announced event)
- **Time entries** for post-event IV crush plays

---

### 4. **Multi-Expiration Term Structure Analysis**

**What It Provides**:
- IV across expirations (0DTE vs 30DTE vs 60DTE)
- Term structure slope (contango vs backwardation)
- Front-month vs back-month spread

**Use Cases**:
```typescript
// Example: VIX Term Structure Signal
async function analyzeVIXTermStructure() {
  // Fetch VIX futures term structure
  const vxFrontMonth = await getVIXFuture('VX1'); // Front month
  const vxBackMonth = await getVIXFuture('VX3');  // 3rd month

  const termSpread = ((vxBackMonth - vxFrontMonth) / vxFrontMonth) * 100;

  if (termSpread < -10) {
    // Steep backwardation → Fear/panic
    return {
      regime: 'FEAR',
      recommendation: 'CONTRARIAN_LONG_SETUP',
      message: 'VIX term structure inverted -10% → Market pricing imminent risk',
    };
  } else if (termSpread > 20) {
    // Steep contango → Complacency
    return {
      regime: 'COMPLACENCY',
      recommendation: 'PREPARE_FOR_VOL_SPIKE',
      message: 'VIX term structure steep +20% → Complacency extreme',
    };
  }

  return { regime: 'NORMAL' };
}
```

**Impact**:
- **Detect fear vs complacency** regimes
- **Time VIX plays** (buy VIX calls when backwardated)
- **Risk-on/risk-off signals** for portfolio management

---

## 🎯 Phase 3 Roadmap: Backtesting & Pattern Recognition

### Goal
Build a **backtesting framework** that runs all 17 detectors on historical data to:
1. Know exact win rates per detector
2. Optimize confluence weights
3. Identify regime-specific performance
4. Auto-tune thresholds for target win rate

### Implementation Plan

#### Step 1: Historical Data Pipeline (2-3 hours)

```typescript
// server/workers/historicalDataBackfill.ts
/**
 * One-time backfill of historical data for backtesting
 * Fetches 90 days of options & indices data from Massive.com
 */
async function backfillHistoricalData(symbols: string[], days: number) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  for (const symbol of symbols) {
    // 1. Fetch historical options chains (daily snapshots)
    const chains = await fetchHistoricalChains(symbol, startDate, endDate);

    // 2. Store in historical_greeks table
    await bulkInsertGreeks(chains);

    // 3. Calculate gamma snapshots
    for (const chain of chains) {
      await snapshotGammaExposure(supabase, symbol, chain);
    }

    // 4. Calculate IV percentiles
    await calculateIVPercentileHistorical(supabase, symbol, startDate, endDate);
  }
}
```

#### Step 2: Backtesting Engine (3-4 hours)

```typescript
// src/lib/backtest/BacktestEngine.ts
export class BacktestEngine {
  /**
   * Run a detector on historical data
   */
  async backtestDetector(
    detector: OpportunityDetector,
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<BacktestResult> {
    const results: DetectionResult[] = [];

    // 1. Fetch historical bars + context
    const bars = await getHistoricalBars(symbol, '15m', startDate, endDate);

    for (const bar of bars) {
      // 2. Reconstruct SymbolFeatures for this timestamp
      const features = await reconstructFeatures(symbol, bar.timestamp);

      // 3. Run detector
      const detection = await detector.detect(features, null);

      if (detection.detected) {
        // 4. Calculate actual outcome (did price hit target?)
        const outcome = await calculateOutcome(
          symbol,
          bar.timestamp,
          detection.targets,
          detection.stopPrice
        );

        results.push({
          timestamp: bar.timestamp,
          detected: true,
          predicted: detection.direction,
          actual: outcome,
          correct: outcome.hit_target,
          pnl: outcome.pnl_percent,
        });
      }
    }

    // 5. Calculate stats
    return {
      detector: detector.type,
      symbol,
      totalSignals: results.length,
      winRate: results.filter(r => r.correct).length / results.length,
      avgWin: avg(results.filter(r => r.correct).map(r => r.pnl)),
      avgLoss: avg(results.filter(r => !r.correct).map(r => r.pnl)),
      profitFactor: calculateProfitFactor(results),
      byRegime: groupByRegime(results),
    };
  }
}
```

#### Step 3: Auto-Optimization (2-3 hours)

```typescript
// src/lib/backtest/ConfluenceOptimizer.ts
/**
 * Optimize confluence weights to hit target win rate
 */
export class ConfluenceOptimizer {
  async optimizeWeights(
    targetWinRate: number = 0.65,  // 65% target
    symbols: string[] = ['SPY', 'SPX', 'NDX'],
    days: number = 90
  ): Promise<OptimizedConfig> {
    // 1. Run all detectors on historical data
    const backtests = await Promise.all(
      ALL_DETECTORS.map(d => backtestDetector(d, symbols, days))
    );

    // 2. Calculate per-detector win rates
    const detectorWinRates = backtests.map(b => ({
      detector: b.detector,
      winRate: b.winRate,
      profitFactor: b.profitFactor,
    }));

    // 3. Genetic algorithm to find optimal weights
    const optimizer = new GeneticOptimizer();
    const optimized = optimizer.optimize({
      objective: 'maximize_win_rate',
      target: targetWinRate,
      constraints: {
        minSignalsPerDay: 5,
        maxSignalsPerDay: 20,
        minRiskReward: 1.5,
      },
      population: detectorWinRates,
    });

    // 4. Return optimized scanner config
    return {
      filters: optimized.filters,
      thresholds: optimized.thresholds,
      confluenceWeights: optimized.weights,
      expectedWinRate: optimized.expectedWinRate,
      expectedSignalsPerDay: optimized.expectedSignalsPerDay,
    };
  }
}
```

#### Step 4: Performance Dashboard (2-3 hours)

```tsx
// src/pages/Backtesting.tsx
export function BacktestingDashboard() {
  const [results, setResults] = useState<BacktestResult[]>([]);

  async function runBacktest() {
    const engine = new BacktestEngine();
    const results = await Promise.all(
      ALL_DETECTORS.map(d => engine.backtestDetector(d, 'SPY', '2024-08-01', '2024-11-01'))
    );
    setResults(results);
  }

  return (
    <div>
      <h1>Strategy Backtesting</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Detector</TableHead>
            <TableHead>Signals</TableHead>
            <TableHead>Win Rate</TableHead>
            <TableHead>Avg Win</TableHead>
            <TableHead>Avg Loss</TableHead>
            <TableHead>Profit Factor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map(r => (
            <TableRow key={r.detector}>
              <TableCell>{r.detector}</TableCell>
              <TableCell>{r.totalSignals}</TableCell>
              <TableCell className={r.winRate >= 0.65 ? 'text-green-500' : 'text-red-500'}>
                {(r.winRate * 100).toFixed(1)}%
              </TableCell>
              <TableCell className="text-green-500">+{r.avgWin.toFixed(2)}%</TableCell>
              <TableCell className="text-red-500">{r.avgLoss.toFixed(2)}%</TableCell>
              <TableCell>{r.profitFactor.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Regime-specific performance chart */}
      <RegimePerformanceChart results={results} />

      {/* Equity curve simulation */}
      <EquityCurveChart results={results} />
    </div>
  );
}
```

---

## 💡 Additional Enhancements

### 5. **WebSocket Streaming Upgrade**

**Current**: Polling indices every 3 seconds
**Upgrade**: Subscribe to real-time options + indices WebSocket

```typescript
// WebSocket subscription for live Greeks updates
ws.subscribe('options.greeks', ['SPX', 'NDX'], (update) => {
  // Update marketDataStore with live Greeks
  marketDataStore.updateGreeks(update.symbol, update.greeks);

  // Recompute composite signals if significant change
  if (hasSignificantChange(update)) {
    compositeScanner.scanSymbol(update.symbol, features);
  }
});
```

**Impact**:
- **Real-time Greeks updates** → Instant delta/gamma changes
- **Lower latency** → Faster signal generation
- **Reduced API costs** → No polling overhead

---

### 6. **Pattern Recognition Library**

**Build a library of proven option patterns**:
- IV Crush Pre-Earnings
- Gamma Squeeze Setup
- Put Wall Support
- Call Wall Resistance
- Dark Pool Accumulation
- Institutional Sweep Confirmation

**Store patterns in database**:
```sql
CREATE TABLE pattern_library (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB,  -- Pattern matching rules
  historical_win_rate NUMERIC,
  avg_duration_hours INTEGER,
  avg_profit_target_pct NUMERIC,
  favorable_regimes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 Current vs Enhanced Architecture

### Before Phase 2
```
User Request → CompositeScanner → Run 17 Detectors → Score → Output Signal
                                                         ↓
                                            (No historical context)
```

### After Phase 2 (Current)
```
User Request → CompositeScanner → Context Engines Query Data Warehouse
                                          ↓
                                   IV Percentile
                                   Gamma Walls
                                   MTF Alignment
                                   Flow Bias
                                   Market Regime
                                          ↓
                                   Apply Boosts/Penalties
                                          ↓
                                   Adjusted Score → Output Signal
```

### After Phase 3 (Target)
```
User Request → CompositeScanner → Context Engines + Pattern Matching
                                          ↓
                                   Query Historical Backtests
                                   Load Optimized Weights
                                   Real-Time Flow Confirmation
                                   IV Surface Analysis
                                   VIX Term Structure
                                          ↓
                                   Machine Learning Ensemble
                                          ↓
                                   High-Confidence Signal (65%+ win rate)
                                          ↓
                                   Auto-Execute or Alert
```

---

## 🚀 Immediate Next Steps

1. **Complete Phase 2** (1-2 hours remaining)
   - ✅ All 5 Context Engines built
   - ⏳ Integrate into CompositeScanner.scanSymbol()
   - ⏳ Add UI components for context display

2. **Test with Live Data** (1 hour)
   - Verify engines query database correctly
   - Check score adjustments are reasonable
   - Monitor for errors during market hours

3. **Begin Phase 3 Planning** (Next session)
   - Prioritize which enhancements deliver most value
   - Estimate effort for historical backfill
   - Design backtesting UI mockups

---

## 📚 Massive.com Advanced Features Summary

| Feature | Endpoint | Status | Impact |
|---------|----------|--------|--------|
| Real-time Options Chains | `/v3/snapshot/options` | ✅ Using | High |
| Real-time Indices | `/v3/snapshot/indices` | ✅ Using | High |
| Historical Bars | `/v2/aggs/ticker/...` | ✅ Using + Cached | High |
| Historical Options Pricing | `/v2/aggs/ticker/O:...` | ❌ Not Yet | **CRITICAL** |
| Options Trade Feed | `/v3/trades/options` | ❌ Not Yet | High |
| WebSocket Streaming | `wss://socket.massive.com` | ⚠️ Partial | Medium |
| Market Holidays | `/v1/market/holidays` | ✅ Using | Low |
| Options Contracts Lookup | `/v3/reference/options/contracts` | ✅ Using | Medium |

---

## 💬 Questions?

**Q: Can we backtest detectors right now?**
A: Partially. We have historical bars cached, but need historical options chain data for full backtesting.

**Q: When will options flow tracking be real?**
A: Phase 2.5 - need to integrate Massive.com trade feed (WebSocket or REST).

**Q: What's the #1 enhancement to prioritize?**
A: **Historical Options Pricing** → Enables true backtesting with actual win rates.

**Q: How much historical data should we store?**
A: **90 days for fast backtesting**, 1 year for regime analysis, 2+ years for pattern recognition.

---

**Ready to dominate with institutional-grade strategy infrastructure!** 🚀
