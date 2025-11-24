# Weekend Radar Features - Phases 2 & 3

**Continuation of WEEKEND_RADAR_IMPLEMENTATION_PLAN.md**

---

# PHASE 2: SPX Deep Dive & Options Flow (10-14 hours)

**Goal**: Index options analysis + historical flow replay

**Features**: 4 (SPX Weekend Lab) + 2 (Options Flow Replay)

---

## Feature 4: SPX/NDX Weekend Strategy Lab 🧪

**Estimated Time**: 6-8 hours
**Complexity**: 🟡 MEDIUM

### Database Schema

```sql
-- Migration: 015_add_gamma_exposure_snapshots.sql
CREATE TABLE gamma_exposure_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL CHECK (symbol IN ('SPX', 'NDX')),
  snapshot_time TIMESTAMPTZ NOT NULL,

  -- Gamma exposure per strike (JSONB map)
  gamma_by_strike JSONB NOT NULL,  -- { "4500": 125000000, "4550": -85000000, ... }

  -- Key levels identified
  max_gamma_strike NUMERIC,  -- Strike with highest positive gamma (support)
  min_gamma_strike NUMERIC,  -- Strike with highest negative gamma (resistance)
  zero_gamma_strike NUMERIC, -- Gamma flip point (neutral)

  -- Aggregate metrics
  total_call_gamma BIGINT,
  total_put_gamma BIGINT,
  net_gamma BIGINT,

  -- Metadata
  total_call_oi INTEGER,
  total_put_oi INTEGER,
  put_call_ratio NUMERIC(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(symbol, snapshot_time)
);

CREATE INDEX idx_gamma_snapshots_symbol ON gamma_exposure_snapshots(symbol);
CREATE INDEX idx_gamma_snapshots_time ON gamma_exposure_snapshots(snapshot_time DESC);

-- RLS
ALTER TABLE gamma_exposure_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view gamma snapshots"
  ON gamma_exposure_snapshots FOR SELECT
  USING (true);  -- Public market data
```

### Backend: Gamma Exposure Calculator

**New File: `server/lib/gammaCalculator.ts`**

```typescript
/**
 * Gamma Exposure Calculator
 *
 * Calculates dealer gamma exposure per strike for SPX/NDX
 * Formula: Gamma Exposure = Gamma * Open Interest * 100 * Spot Price^2
 */

import type { OptionContract } from '../../src/types/options.js';

export interface GammaExposureResult {
  gammaByStrike: Record<string, number>;  // Strike → Gamma Exposure
  maxGammaStrike: number;
  minGammaStrike: number;
  zeroGammaStrike: number;
  totalCallGamma: number;
  totalPutGamma: number;
  netGamma: number;
  totalCallOI: number;
  totalPutOI: number;
  putCallRatio: number;
}

export class GammaCalculator {
  /**
   * Calculate gamma exposure for all strikes
   */
  calculateGammaExposure(
    symbol: string,
    spotPrice: number,
    optionsChain: OptionContract[]
  ): GammaExposureResult {

    const gammaByStrike: Record<string, number> = {};
    let totalCallGamma = 0;
    let totalPutGamma = 0;
    let totalCallOI = 0;
    let totalPutOI = 0;

    // Group by strike
    const strikeMap = new Map<number, { calls: OptionContract[]; puts: OptionContract[] }>();

    for (const contract of optionsChain) {
      const strike = contract.strikePrice;
      if (!strikeMap.has(strike)) {
        strikeMap.set(strike, { calls: [], puts: [] });
      }

      const group = strikeMap.get(strike)!;
      if (contract.optionType === 'call') {
        group.calls.push(contract);
      } else {
        group.puts.push(contract);
      }
    }

    // Calculate gamma exposure per strike
    for (const [strike, { calls, puts }] of strikeMap.entries()) {
      let strikeGamma = 0;

      // Call gamma (dealers are short calls, so negative gamma for dealers)
      for (const call of calls) {
        if (call.greeks?.gamma && call.openInterest) {
          const callGamma = call.greeks.gamma * call.openInterest * 100 * spotPrice * spotPrice;
          strikeGamma -= callGamma;  // Negative (dealers are short)
          totalCallGamma -= callGamma;
          totalCallOI += call.openInterest;
        }
      }

      // Put gamma (dealers are short puts, so positive gamma for dealers)
      for (const put of puts) {
        if (put.greeks?.gamma && put.openInterest) {
          const putGamma = put.greeks.gamma * put.openInterest * 100 * spotPrice * spotPrice;
          strikeGamma += putGamma;  // Positive (dealers are short)
          totalPutGamma += putGamma;
          totalPutOI += put.openInterest;
        }
      }

      gammaByStrike[strike.toString()] = strikeGamma;
    }

    // Find key levels
    const strikes = Object.keys(gammaByStrike).map(Number).sort((a, b) => a - b);
    let maxGammaStrike = strikes[0];
    let minGammaStrike = strikes[0];
    let zeroGammaStrike = strikes[0];

    for (const strike of strikes) {
      const gamma = gammaByStrike[strike.toString()];

      if (gamma > gammaByStrike[maxGammaStrike.toString()]) {
        maxGammaStrike = strike;
      }
      if (gamma < gammaByStrike[minGammaStrike.toString()]) {
        minGammaStrike = strike;
      }

      // Find zero gamma strike (closest to 0)
      if (Math.abs(gamma) < Math.abs(gammaByStrike[zeroGammaStrike.toString()])) {
        zeroGammaStrike = strike;
      }
    }

    const netGamma = totalCallGamma + totalPutGamma;
    const putCallRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

    return {
      gammaByStrike,
      maxGammaStrike,
      minGammaStrike,
      zeroGammaStrike,
      totalCallGamma,
      totalPutGamma,
      netGamma,
      totalCallOI,
      totalPutOI,
      putCallRatio,
    };
  }

  /**
   * Interpret gamma exposure (for UI display)
   */
  interpretGamma(result: GammaExposureResult, spotPrice: number): {
    supportLevel: number;
    resistanceLevel: number;
    flipPoint: number;
    dealerPositioning: 'LONG_GAMMA' | 'SHORT_GAMMA';
    expectedVolatility: 'LOW' | 'MEDIUM' | 'HIGH';
    magnet: 'ABOVE' | 'BELOW' | 'AT';
  } {
    const supportLevel = result.maxGammaStrike;  // Max positive gamma = support
    const resistanceLevel = result.minGammaStrike;  // Max negative gamma = resistance
    const flipPoint = result.zeroGammaStrike;

    // Dealer positioning
    const dealerPositioning = result.netGamma > 0 ? 'LONG_GAMMA' : 'SHORT_GAMMA';

    // Expected volatility
    let expectedVolatility: 'LOW' | 'MEDIUM' | 'HIGH';
    if (dealerPositioning === 'LONG_GAMMA') {
      // Dealers long gamma → stabilizing effect → low vol
      expectedVolatility = 'LOW';
    } else {
      // Dealers short gamma → destabilizing effect → high vol
      expectedVolatility = 'HIGH';
    }

    // Price magnet (gravitates towards zero gamma)
    let magnet: 'ABOVE' | 'BELOW' | 'AT';
    if (spotPrice > flipPoint * 1.01) {
      magnet = 'ABOVE';
    } else if (spotPrice < flipPoint * 0.99) {
      magnet = 'BELOW';
    } else {
      magnet = 'AT';
    }

    return {
      supportLevel,
      resistanceLevel,
      flipPoint,
      dealerPositioning,
      expectedVolatility,
      magnet,
    };
  }
}
```

### API Route

**New Route: `server/routes/gammaExposure.ts`**

```typescript
import express from 'express';
import { GammaCalculator } from '../lib/gammaCalculator.js';
import { getOptionChain } from '../massive/client.js';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

/**
 * POST /api/gamma-exposure
 * Calculate gamma exposure for SPX or NDX
 */
router.post('/api/gamma-exposure', async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol || !['SPX', 'NDX'].includes(symbol)) {
      return res.status(400).json({ error: 'Symbol must be SPX or NDX' });
    }

    // Get current spot price
    const quoteResponse = await fetch(`/api/quotes?tickers=${symbol}`);
    const quotes = await quoteResponse.json();
    const spotPrice = quotes.quotes?.[0]?.last || 0;

    // Get full options chain
    const optionsChain = await getOptionChain(symbol);

    if (!optionsChain || optionsChain.length === 0) {
      return res.status(404).json({ error: 'Options chain not available' });
    }

    // Calculate gamma exposure
    const calculator = new GammaCalculator();
    const result = calculator.calculateGammaExposure(symbol, spotPrice, optionsChain);
    const interpretation = calculator.interpretGamma(result, spotPrice);

    // Save snapshot
    const { error: insertError } = await supabase
      .from('gamma_exposure_snapshots')
      .insert({
        symbol,
        snapshot_time: new Date().toISOString(),
        gamma_by_strike: result.gammaByStrike,
        max_gamma_strike: result.maxGammaStrike,
        min_gamma_strike: result.minGammaStrike,
        zero_gamma_strike: result.zeroGammaStrike,
        total_call_gamma: result.totalCallGamma,
        total_put_gamma: result.totalPutGamma,
        net_gamma: result.netGamma,
        total_call_oi: result.totalCallOI,
        total_put_oi: result.totalPutOI,
        put_call_ratio: result.putCallRatio,
      });

    if (insertError) {
      console.warn('Failed to save gamma snapshot:', insertError);
    }

    res.json({
      result,
      interpretation,
      spotPrice,
    });

  } catch (error) {
    console.error('Gamma exposure error:', error);
    res.status(500).json({ error: 'Failed to calculate gamma exposure' });
  }
});

export default router;
```

### Frontend: SPX Gamma Wall Heatmap

**Component: `src/components/radar/SPXGammaWall.tsx`**

```tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export function SPXGammaWall() {
  const [symbol, setSymbol] = useState<'SPX' | 'NDX'>('SPX');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const calculateGamma = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gamma-exposure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });

      if (!response.ok) throw new Error('Failed to calculate gamma');

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Gamma calculation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">SPX/NDX Gamma Wall</h2>

        <div className="flex gap-2">
          <Button
            variant={symbol === 'SPX' ? 'default' : 'outline'}
            onClick={() => setSymbol('SPX')}
          >
            SPX
          </Button>
          <Button
            variant={symbol === 'NDX' ? 'default' : 'outline'}
            onClick={() => setSymbol('NDX')}
          >
            NDX
          </Button>
          <Button onClick={calculateGamma} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Calculate
          </Button>
        </div>
      </div>

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Key Levels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Support (Max Gamma):</span>
                <Badge variant="default">{data.interpretation.supportLevel}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Resistance (Min Gamma):</span>
                <Badge variant="destructive">{data.interpretation.resistanceLevel}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Flip Point (Zero Gamma):</span>
                <Badge variant="outline">{data.interpretation.flipPoint}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Current Price:</span>
                <Badge variant="secondary">{data.spotPrice.toFixed(2)}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dealer Positioning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Position:</span>
                <Badge variant={data.interpretation.dealerPositioning === 'LONG_GAMMA' ? 'default' : 'destructive'}>
                  {data.interpretation.dealerPositioning.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Expected Volatility:</span>
                <Badge variant="outline">{data.interpretation.expectedVolatility}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Price Magnet:</span>
                <span className="font-semibold">{data.interpretation.magnet} flip point</span>
              </div>
            </CardContent>
          </Card>

          {/* TODO: Add heatmap visualization using Recharts */}
        </>
      )}
    </div>
  );
}
```

---

## Feature 2: Options Flow Replay & Analysis 🌊

**Estimated Time**: 4-6 hours
**Complexity**: 🟡 MEDIUM

### Database Schema

```sql
-- Migration: 016_add_options_flow_snapshots.sql
CREATE TABLE options_flow_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,

  -- Aggregate flow metrics
  total_premium BIGINT,           -- Total premium traded
  call_premium BIGINT,
  put_premium BIGINT,
  call_put_premium_ratio NUMERIC(5,2),

  -- Flow bias
  buy_pressure NUMERIC(5,2),      -- 0-100
  sell_pressure NUMERIC(5,2),     -- 0-100
  net_flow_bias TEXT CHECK (net_flow_bias IN ('BULLISH', 'NEUTRAL', 'BEARISH')),

  -- Large trades
  large_call_trades INTEGER,      -- Trades > $100k
  large_put_trades INTEGER,
  sweep_count INTEGER,            -- Option sweeps detected

  -- Top strikes (JSONB)
  top_call_strikes JSONB,         -- [{ strike, volume, premium }, ...]
  top_put_strikes JSONB,

  -- Raw snapshot data
  flow_data JSONB,                -- Full flow snapshot for replay

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(symbol, snapshot_time)
);

CREATE INDEX idx_flow_snapshots_symbol ON options_flow_snapshots(symbol);
CREATE INDEX idx_flow_snapshots_time ON options_flow_snapshots(snapshot_time DESC);

-- RLS
ALTER TABLE options_flow_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view flow snapshots"
  ON options_flow_snapshots FOR SELECT
  USING (true);  -- Public market data
```

### Backend: Flow Aggregator

**New File: `server/workers/flowAggregator.ts`**

```typescript
/**
 * Options Flow Aggregator
 *
 * Runs Friday 3:30pm-4:00pm to capture EOD flow
 * Generates weekend digest for Monday planning
 */

import { supabase } from '../lib/supabase.js';

export class FlowAggregator {
  /**
   * Aggregate Friday's options flow (last 2 hours)
   */
  async aggregateFridayFlow(symbol: string): Promise<void> {
    // TODO: Integrate with Massive.com WebSocket for trade-level data
    // For now, use aggregate flow from existing service

    console.log(`[Flow Aggregator] Aggregating Friday flow for ${symbol}...`);

    // Placeholder implementation
    const flowData = {
      totalPremium: 1_500_000_000,
      callPremium: 900_000_000,
      putPremium: 600_000_000,
      callPutPremiumRatio: 1.5,
      buyPressure: 65,
      sellPressure: 35,
      netFlowBias: 'BULLISH',
      largeCallTrades: 15,
      largePutTrades: 8,
      sweepCount: 3,
      topCallStrikes: [
        { strike: 4500, volume: 10000, premium: 50_000_000 },
        { strike: 4550, volume: 8000, premium: 40_000_000 },
      ],
      topPutStrikes: [
        { strike: 4450, volume: 7000, premium: 35_000_000 },
      ],
    };

    // Save snapshot
    const { error } = await supabase
      .from('options_flow_snapshots')
      .insert({
        symbol,
        snapshot_time: new Date().toISOString(),
        ...flowData,
      });

    if (error) {
      console.error('[Flow Aggregator] Failed to save snapshot:', error);
    } else {
      console.log(`[Flow Aggregator] ✅ Saved ${symbol} flow snapshot`);
    }
  }
}

// Run on Fridays at 4:05pm ET
if (process.env.NODE_ENV === 'production') {
  const aggregator = new FlowAggregator();

  setInterval(async () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 5 = Friday
    const hour = now.getUTCHours();

    // Friday 4:05pm ET (21:05 UTC)
    if (dayOfWeek === 5 && hour === 21 && now.getUTCMinutes() === 5) {
      console.log('[Flow Aggregator] Running Friday EOD aggregation...');

      for (const symbol of ['SPX', 'NDX', 'SPY', 'QQQ']) {
        await aggregator.aggregateFridayFlow(symbol);
      }
    }
  }, 60_000); // Check every minute
}
```

---

# PHASE 3: Extended Hours & Backtesting (10-13 hours)

**Goal**: Premarket/aftermarket analysis + validation tools

**Features**: 3 (Premarket/Aftermarket) + 6 (Backtesting)

---

## Feature 3: Premarket/Aftermarket Setup Builder 🌅

**Estimated Time**: 5-7 hours
**Complexity**: 🟡 MEDIUM

### Key Implementation Points

1. **Use Tradier for Extended Hours Data**
   - Tradier explicitly supports premarket/aftermarket data
   - Massive.com support uncertain, use Tradier as primary

2. **Conditional Alerts System**
   ```typescript
   interface ConditionalAlert {
     condition: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'VOLUME_SPIKE';
     threshold: number;
     action: 'ENTER_LONG' | 'ENTER_SHORT' | 'CLOSE_POSITION';
     timeWindow: 'PREMARKET' | 'FIRST_5MIN' | 'FIRST_30MIN';
   }
   ```

3. **Premarket Breakout Scanner**
   - Scan 7:00am-9:30am ET
   - Compare PM prices to RTH H/L/C
   - Volume analysis (PM volume vs avg PM volume)
   - News catalyst detection (optional)

4. **Aftermarket Continuation Detector**
   - Scan 4:00pm-8:00pm ET
   - Identify RTH trend continuation vs reversal
   - Gap probability for next session

### Database Schema

```sql
-- Migration: 017_add_extended_hours_setups.sql
CREATE TABLE extended_hours_setups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  symbol TEXT NOT NULL,

  session_type TEXT CHECK (session_type IN ('PREMARKET', 'AFTERMARKET')),

  -- Conditional plan
  condition_type TEXT NOT NULL,
  condition_threshold NUMERIC,
  recommended_action TEXT,

  -- Context
  rth_close NUMERIC,
  pm_ah_price NUMERIC,
  gap_percent NUMERIC(5,2),

  -- Status
  status TEXT CHECK (status IN ('PENDING', 'TRIGGERED', 'EXPIRED')) DEFAULT 'PENDING',
  triggered_at TIMESTAMPTZ,

  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, symbol, session_type, created_at)
);

CREATE INDEX idx_extended_hours_user ON extended_hours_setups(user_id);
CREATE INDEX idx_extended_hours_symbol ON extended_hours_setups(symbol);
CREATE INDEX idx_extended_hours_status ON extended_hours_setups(status);

-- RLS
ALTER TABLE extended_hours_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own extended hours setups"
  ON extended_hours_setups
  USING (auth.uid() = user_id);
```

---

## Feature 6: Backtesting & What-If Analysis 🔮

**Estimated Time**: 5-6 hours
**Complexity**: 🟡 MEDIUM

### Database Schema

```sql
-- Migration: 018_add_backtest_results.sql
CREATE TABLE backtest_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),

  name TEXT NOT NULL,
  description TEXT,

  -- Backtest parameters
  detector_types TEXT[],          -- Which detectors to test
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  symbols TEXT[],                 -- Symbols tested
  min_score_threshold NUMERIC(5,2),

  -- Results
  total_signals INTEGER,
  wins INTEGER,
  losses INTEGER,
  scratches INTEGER,
  win_rate NUMERIC(5,2),
  avg_risk_reward NUMERIC(5,2),
  total_pnl_percent NUMERIC(7,2),
  max_drawdown NUMERIC(5,2),

  -- Equity curve (JSONB array)
  equity_curve JSONB,             -- [{ date, equity, pnl }, ...]

  -- Detailed trades
  trades JSONB,                   -- [{ date, symbol, setup, entry, exit, pnl }, ...]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_user ON backtest_results(user_id);
CREATE INDEX idx_backtest_created ON backtest_results(created_at DESC);

-- RLS
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own backtests"
  ON backtest_results
  USING (auth.uid() = user_id);
```

### Backend: Backtest Runner

**New File: `server/lib/backtestRunner.ts`**

```typescript
/**
 * Backtest Runner
 *
 * Replays historical data through composite scanner
 * Tracks hypothetical trades and P&L
 */

import { CompositeScanner } from '../../src/lib/composite/CompositeScanner.js';
import { buildSymbolFeatures } from '../../src/lib/strategy/featuresBuilder.js';

export interface BacktestConfig {
  detectorTypes: string[];
  dateRangeStart: Date;
  dateRangeEnd: Date;
  symbols: string[];
  minScoreThreshold: number;
}

export interface BacktestResult {
  totalSignals: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  avgRiskReward: number;
  totalPnlPercent: number;
  maxDrawdown: number;
  equityCurve: Array<{ date: string; equity: number; pnl: number }>;
  trades: Array<any>;
}

export class BacktestRunner {
  async runBacktest(config: BacktestConfig, userId: string): Promise<BacktestResult> {
    console.log('[Backtest] Starting backtest...', config);

    const trades: any[] = [];
    let equity = 10000; // Starting capital
    let maxEquity = 10000;
    let maxDrawdown = 0;
    const equityCurve: Array<{ date: string; equity: number; pnl: number }> = [];

    // Loop through each date in range
    const currentDate = new Date(config.dateRangeStart);

    while (currentDate <= config.dateRangeEnd) {
      // Fetch historical bars for this date
      // Run composite scanner
      // Simulate trades
      // Track P&L

      // TODO: Full implementation

      // Increment date
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const wins = trades.filter(t => t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl < 0).length;
    const scratches = trades.filter(t => t.pnl === 0).length;
    const winRate = (wins / trades.length) * 100;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

    return {
      totalSignals: trades.length,
      wins,
      losses,
      scratches,
      winRate,
      avgRiskReward: 2.0, // TODO: Calculate
      totalPnlPercent: (totalPnl / 10000) * 100,
      maxDrawdown,
      equityCurve,
      trades,
    };
  }
}
```

---

# OPTIONAL: Feature 8 - Economic Calendar (4-6 hours)

**Complexity**: 🟡 MEDIUM

**External API Options:**
1. Alpha Vantage (free tier: 25 req/day)
2. TradingEconomics (paid)
3. Yahoo Finance scraper

**Implementation**: Straightforward API integration + database storage + UI overlay

---

# INTEGRATION & ALIGNMENT

## Composite Scanner Integration

**All features integrate with existing infrastructure:**

1. **Watchlist Health Score** ← Uses `buildSymbolFeatures()` + `CompositeScanner`
2. **Market Regime Detector** ← Adds new indicator (ADX) to features
3. **SPX Gamma Wall** ← Uses existing options chain API
4. **Options Flow** ← Extends existing `flowAnalysisService.ts`
5. **Premarket/Aftermarket** ← Adds extended hours session detection
6. **Backtesting** ← Replays `CompositeScanner` on historical data

## Risk Engine Alignment

- **ADX Indicator**: New addition to `riskEngine/indicators.ts`
- **Regime-Based Adjustments**: Update detector scoring based on regime
- **Extended Hours Risk**: Wider stops for PM/AH due to lower liquidity

## Data Schema Alignment

**New Tables (7 total):**
1. `watchlist_health_scores`
2. `gamma_exposure_snapshots`
3. `options_flow_snapshots`
4. `extended_hours_setups`
5. `backtest_results`
6. `economic_events` (optional)
7. `earnings_calendar` (optional)

All tables follow existing RLS patterns.

---

# TESTING STRATEGY

## Unit Tests (Per Feature)

1. **Health Scorer**: Test scoring logic, edge cases
2. **Regime Detector**: Test ADX calculation, regime classification
3. **Gamma Calculator**: Test formula accuracy
4. **Flow Aggregator**: Test aggregation logic
5. **Backtest Runner**: Test P&L calculation

## Integration Tests

1. **End-to-End Health Score Flow**: Watchlist → Features → Score → Save → Display
2. **Gamma Exposure Flow**: API call → Calculate → Save → Render heatmap
3. **Backtest Flow**: Config → Run → Results → Save

## E2E Tests (Playwright)

1. Navigate to Health Score page → Click refresh → Verify table populates
2. Navigate to SPX Lab → Calculate gamma → Verify levels display
3. Navigate to Backtest → Configure → Run → Verify results

---

# DEPLOYMENT CHECKLIST

## Phase 1 Deployment

- [ ] Run migrations 014 (health scores)
- [ ] Deploy health scorer backend code
- [ ] Deploy health score API routes
- [ ] Deploy Health Score UI component
- [ ] Deploy ADX indicator + regime detector
- [ ] Deploy Regime Dashboard UI
- [ ] Verify all tests pass
- [ ] Update documentation

## Phase 2 Deployment

- [ ] Run migrations 015-016 (gamma + flow)
- [ ] Deploy gamma calculator
- [ ] Deploy flow aggregator worker
- [ ] Deploy API routes
- [ ] Deploy SPX Lab UI
- [ ] Deploy flow replay UI
- [ ] Schedule Friday EOD flow aggregation

## Phase 3 Deployment

- [ ] Run migrations 017-018 (extended hours + backtest)
- [ ] Deploy extended hours scanner
- [ ] Deploy backtest runner
- [ ] Deploy UI components
- [ ] Configure Tradier for extended hours

---

# ESTIMATED TIMELINE

| Phase | Features | Hours | Week |
|-------|----------|-------|------|
| Phase 1 | 5, 7 | 8-12 | Week 1 (Weekend 1) |
| Phase 2 | 4, 2 | 10-14 | Week 2 (Weekend 2) |
| Phase 3 | 3, 6 | 10-13 | Week 3 |
| **Total** | **2-8** | **28-39 hrs** | **3 weeks** |

**Recommended Approach**: Implement 1 phase per weekend, deliver incremental value.

---

# SUCCESS METRICS

## User Adoption
- % of users accessing weekend radar features
- Avg time spent in Health Score / SPX Lab
- # of backtests run per week

## Trading Performance
- Win rate improvement (users using weekend planning vs not)
- % of Monday trades from weekend playbook
- Accuracy of gamma level predictions

## Technical Performance
- Health score calculation time (<5s)
- Gamma calculation time (<10s)
- Backtest run time (<30s for 90-day lookback)

---

# CONCLUSION

This 3-phase plan delivers:
- ✅ Full alignment with existing systems (composite scanner, risk engine, data providers)
- ✅ Incremental value delivery (each phase standalone useful)
- ✅ Comprehensive testing at each stage
- ✅ Clear deployment path

**Next Step**: Approve Phase 1 implementation and begin with Feature 5 (Watchlist Health Score).
