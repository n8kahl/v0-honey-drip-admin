# Honey Drip Admin: Master Enhancement Plan

> **Version**: 1.0.0
> **Created**: November 26, 2025
> **Author**: Claude (AI Assistant)
> **Status**: Active Development

## Executive Summary

This document outlines a comprehensive 4-phase enhancement plan to transform Honey Drip Admin from a functional trading dashboard into a professional-grade, AI-enhanced trading system with institutional-level confluence detection and profitability optimization.

**Target Outcomes:**

- 3-4x improvement in signal-to-noise ratio
- 25%+ increase in win rate through adaptive thresholds
- Full regime-aware strategy selection
- AI/ML layer for predictive signal quality
- Professional-grade weekend/after-hours planning

---

## Table of Contents

1. [Phase Overview](#phase-overview)
2. [Phase 1: Quick Wins (Week 1-2)](#phase-1-quick-wins)
3. [Phase 2: Core Improvements (Week 3-6)](#phase-2-core-improvements)
4. [Phase 3: Advanced Features (Week 7-12)](#phase-3-advanced-features)
5. [Phase 4: AI/ML Layer (Week 13-20)](#phase-4-aiml-layer)
6. [Testing Strategy](#testing-strategy)
7. [Documentation Requirements](#documentation-requirements)
8. [Database Migrations](#database-migrations)
9. [Risk Mitigation](#risk-mitigation)
10. [Success Metrics](#success-metrics)

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENHANCEMENT ROADMAP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: Quick Wins                    PHASE 2: Core Improvements          │
│  ─────────────────────                  ────────────────────────             │
│  [Week 1-2]                             [Week 3-6]                           │
│  ├─ 1.1 Adaptive Thresholds             ├─ 2.1 Style Score Differentiation  │
│  ├─ 1.2 IV Percentile Gating            ├─ 2.2 Level-Aware Stop Loss        │
│  ├─ 1.3 Historical Win Rate Tracking    ├─ 2.3 Greeks Dashboard (Radar)     │
│  └─ 1.4 Confidence Scoring              └─ 2.4 Economic Calendar Integration│
│                                                                              │
│  PHASE 3: Advanced Features             PHASE 4: AI/ML Layer                │
│  ───────────────────────                ────────────────────                 │
│  [Week 7-12]                            [Week 13-20]                         │
│  ├─ 3.1 Gamma Context Engine            ├─ 4.1 Signal Quality Predictor     │
│  ├─ 3.2 Non-Trend Day Strategies        ├─ 4.2 Pattern Recognition NN       │
│  ├─ 3.3 Trade Plan Builder              ├─ 4.3 Adaptive Optimizer           │
│  ├─ 3.4 Sunday Evening Futures          └─ 4.4 Regime Transition Predictor  │
│  └─ 3.5 Enhanced Flow Analysis                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Quick Wins

**Timeline**: Week 1-2
**Goal**: Immediate improvements with minimal risk, high impact

### 1.1 Adaptive Thresholds by Time of Day, VIX, and Regime

**Priority**: P0 (Critical)
**Estimated Impact**: +15-20% signal quality
**Files to Modify**:

- `src/lib/composite/AdaptiveThresholds.ts` (NEW)
- `src/lib/composite/CompositeScanner.ts`
- `server/workers/compositeScanner.ts`
- `src/lib/composite/types.ts`

#### Implementation Details

```typescript
// NEW FILE: src/lib/composite/AdaptiveThresholds.ts

export interface TimeOfDayWindow {
  name: string;
  start: string; // "09:30"
  end: string; // "10:00"
  thresholds: {
    minBase: number;
    minStyle: number;
    minRR: number;
  };
  rationale: string;
}

export interface AdaptiveThresholdConfig {
  timeOfDay: TimeOfDayWindow[];
  byVIX: Record<
    "low" | "medium" | "high" | "extreme",
    {
      minBase: number;
      minStyle: number;
      minRR: number;
      sizeMultiplier: number;
    }
  >;
  byRegime: Record<
    "trending" | "ranging" | "choppy" | "volatile",
    {
      breakout: { minBase: number; minRR: number };
      meanReversion: { minBase: number; minRR: number };
      trendContinuation: { minBase: number; minRR: number };
    }
  >;
}

export const DEFAULT_ADAPTIVE_THRESHOLDS: AdaptiveThresholdConfig = {
  timeOfDay: [
    {
      name: "opening_drive",
      start: "09:30",
      end: "10:00",
      thresholds: { minBase: 65, minStyle: 70, minRR: 1.2 },
      rationale: "High momentum period, lower bar for breakouts",
    },
    {
      name: "mid_morning",
      start: "10:00",
      end: "11:30",
      thresholds: { minBase: 75, minStyle: 80, minRR: 1.8 },
      rationale: "Post-ORB stabilization, higher quality required",
    },
    {
      name: "lunch_chop",
      start: "11:30",
      end: "13:30",
      thresholds: { minBase: 85, minStyle: 88, minRR: 2.2 },
      rationale: "Low volume/choppy period, only best setups",
    },
    {
      name: "afternoon",
      start: "13:30",
      end: "15:00",
      thresholds: { minBase: 72, minStyle: 75, minRR: 1.5 },
      rationale: "Volume returns, moderate thresholds",
    },
    {
      name: "power_hour",
      start: "15:00",
      end: "16:00",
      thresholds: { minBase: 68, minStyle: 72, minRR: 1.3 },
      rationale: "High momentum reversal window, lower bar",
    },
  ],
  byVIX: {
    low: { minBase: 70, minStyle: 75, minRR: 1.5, sizeMultiplier: 1.2 },
    medium: { minBase: 75, minStyle: 78, minRR: 1.6, sizeMultiplier: 1.0 },
    high: { minBase: 80, minStyle: 82, minRR: 1.8, sizeMultiplier: 0.7 },
    extreme: { minBase: 88, minStyle: 90, minRR: 2.2, sizeMultiplier: 0.4 },
  },
  byRegime: {
    trending: {
      breakout: { minBase: 65, minRR: 1.3 },
      meanReversion: { minBase: 85, minRR: 2.0 },
      trendContinuation: { minBase: 60, minRR: 1.2 },
    },
    ranging: {
      breakout: { minBase: 85, minRR: 2.0 },
      meanReversion: { minBase: 65, minRR: 1.3 },
      trendContinuation: { minBase: 80, minRR: 1.8 },
    },
    choppy: {
      breakout: { minBase: 92, minRR: 2.5 },
      meanReversion: { minBase: 75, minRR: 1.5 },
      trendContinuation: { minBase: 88, minRR: 2.2 },
    },
    volatile: {
      breakout: { minBase: 88, minRR: 2.0 },
      meanReversion: { minBase: 80, minRR: 1.8 },
      trendContinuation: { minBase: 85, minRR: 2.0 },
    },
  },
};

export function getAdaptiveThresholds(
  timeISO: string,
  vixLevel: "low" | "medium" | "high" | "extreme",
  regime: "trending" | "ranging" | "choppy" | "volatile",
  strategyType: "breakout" | "meanReversion" | "trendContinuation",
  config: AdaptiveThresholdConfig = DEFAULT_ADAPTIVE_THRESHOLDS
): { minBase: number; minStyle: number; minRR: number; sizeMultiplier: number } {
  // Implementation
}
```

#### Testing Requirements

```typescript
// __tests__/AdaptiveThresholds.test.ts

describe("AdaptiveThresholds", () => {
  describe("getAdaptiveThresholds", () => {
    it("returns lower thresholds during opening drive", () => {
      const result = getAdaptiveThresholds("2025-01-15T09:45:00", "medium", "trending", "breakout");
      expect(result.minBase).toBeLessThan(70);
    });

    it("returns higher thresholds during lunch chop", () => {
      const result = getAdaptiveThresholds("2025-01-15T12:30:00", "medium", "ranging", "breakout");
      expect(result.minBase).toBeGreaterThan(80);
    });

    it("reduces size multiplier in high VIX", () => {
      const result = getAdaptiveThresholds("2025-01-15T10:00:00", "high", "trending", "breakout");
      expect(result.sizeMultiplier).toBeLessThan(1.0);
    });

    it("combines time, VIX, and regime adjustments correctly", () => {
      // Worst case: lunch chop + extreme VIX + choppy regime + breakout
      const result = getAdaptiveThresholds("2025-01-15T12:30:00", "extreme", "choppy", "breakout");
      expect(result.minBase).toBeGreaterThan(90);
      expect(result.sizeMultiplier).toBeLessThan(0.5);
    });
  });
});
```

#### Documentation

- Update `CLAUDE.md` Section 12 (Critical Patterns) with adaptive threshold documentation
- Add inline JSDoc to all exported functions
- Create `docs/ADAPTIVE_THRESHOLDS.md` with full explanation

---

### 1.2 IV Percentile Gating

**Priority**: P0 (Critical)
**Estimated Impact**: +15% cost savings, avoid buying expensive options
**Files to Modify**:

- `src/lib/greeks/ivHistory.ts`
- `src/lib/composite/detectors/*.ts` (add IV gating)
- `src/lib/composite/types.ts`

#### Implementation Details

```typescript
// Enhancement to src/lib/greeks/ivHistory.ts

export interface IVGatingConfig {
  maxIVPercentileForBuying: number; // Don't buy if IV > this percentile (default: 75)
  minIVPercentileForSelling: number; // Don't sell if IV < this percentile (default: 25)
  ivCrushWarningThreshold: number; // Warn if post-event IV drop > this (default: 20%)
  earningsProximityDays: number; // Days before earnings to flag (default: 3)
}

export interface IVAnalysis {
  currentIV: number;
  ivRank: number; // 0-100: Where IV is vs 52-week range
  ivPercentile: number; // 0-100: % of days IV was lower than current
  isElevated: boolean; // IV > 75th percentile
  isCheap: boolean; // IV < 25th percentile
  gatingDecision: "BUY_OK" | "SELL_PREMIUM" | "AVOID" | "WARN_EARNINGS";
  reasoning: string;
}

export function analyzeIVForGating(
  symbol: string,
  currentIV: number,
  ivHistory: number[], // Last 252 trading days
  daysToEarnings?: number,
  config: IVGatingConfig = DEFAULT_IV_GATING_CONFIG
): IVAnalysis {
  // Implementation
}
```

#### Signal Integration

```typescript
// In each detector, add IV gating check
export async function detect(
  features: SymbolFeatures,
  config: DetectorConfig
): Promise<DetectionResult> {
  // ... existing detection logic ...

  // NEW: IV Gating Check
  if (features.ivAnalysis?.gatingDecision === "AVOID") {
    return {
      detected: false,
      reason: `IV too elevated (${features.ivAnalysis.ivPercentile}th percentile) - avoid buying premium`,
      ivGated: true,
    };
  }

  if (features.ivAnalysis?.gatingDecision === "WARN_EARNINGS") {
    result.warnings.push(`Earnings in ${features.ivAnalysis.daysToEarnings} days - IV crush risk`);
    result.confidence *= 0.8; // Reduce confidence near earnings
  }

  // ... continue with detection ...
}
```

#### Testing Requirements

```typescript
describe("IVGating", () => {
  it("blocks buying when IV > 75th percentile", () => {
    const analysis = analyzeIVForGating("SPY", 28, generateIVHistory(15, 25), undefined);
    expect(analysis.gatingDecision).toBe("AVOID");
    expect(analysis.isElevated).toBe(true);
  });

  it("suggests selling premium when IV elevated", () => {
    const analysis = analyzeIVForGating("SPY", 30, generateIVHistory(15, 25), undefined);
    expect(analysis.gatingDecision).toBe("SELL_PREMIUM");
  });

  it("warns about earnings proximity", () => {
    const analysis = analyzeIVForGating("NVDA", 45, generateIVHistory(30, 50), 2);
    expect(analysis.gatingDecision).toBe("WARN_EARNINGS");
  });

  it("allows buying when IV cheap", () => {
    const analysis = analyzeIVForGating("SPY", 12, generateIVHistory(15, 25), undefined);
    expect(analysis.gatingDecision).toBe("BUY_OK");
    expect(analysis.isCheap).toBe(true);
  });
});
```

---

### 1.3 Historical Win Rate Tracking Infrastructure

**Priority**: P0 (Critical)
**Estimated Impact**: Foundation for all ML improvements, +20% expectancy long-term
**Files to Create**:

- `src/lib/analytics/SignalPerformance.ts` (NEW)
- `server/routes/analytics.ts` (NEW)
- `scripts/012_add_signal_performance_table.sql` (NEW)

#### Database Schema

```sql
-- scripts/012_add_signal_performance_table.sql

-- Track every signal's outcome for ML training
CREATE TABLE signal_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Signal identification
  signal_id UUID REFERENCES composite_signals(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,
  direction TEXT NOT NULL,  -- 'LONG' | 'SHORT'

  -- Context at signal time
  signal_time TIMESTAMPTZ NOT NULL,
  time_of_day_window TEXT,  -- 'opening_drive', 'lunch_chop', etc.
  vix_level TEXT,           -- 'low', 'medium', 'high', 'extreme'
  market_regime TEXT,       -- 'trending', 'ranging', 'choppy', 'volatile'
  iv_percentile NUMERIC,

  -- Signal scores at detection
  base_score NUMERIC,
  scalp_score NUMERIC,
  day_trade_score NUMERIC,
  swing_score NUMERIC,
  confluence_count INTEGER,

  -- Entry details
  entry_price NUMERIC,
  entry_time TIMESTAMPTZ,
  projected_stop NUMERIC,
  projected_t1 NUMERIC,
  projected_t2 NUMERIC,
  projected_rr NUMERIC,

  -- Outcome tracking
  outcome TEXT CHECK (outcome IN ('WIN_T1', 'WIN_T2', 'WIN_T3', 'STOP_HIT', 'TIME_STOP', 'MANUAL_EXIT', 'PENDING')),
  exit_price NUMERIC,
  exit_time TIMESTAMPTZ,
  actual_rr NUMERIC,
  hold_time_minutes INTEGER,
  max_favorable_excursion NUMERIC,   -- Highest profit point
  max_adverse_excursion NUMERIC,     -- Worst drawdown point

  -- Computed metrics
  pnl_percent NUMERIC,
  was_winner BOOLEAN,

  -- Metadata
  trade_type TEXT,  -- 'SCALP', 'DAY', 'SWING'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast analytics queries
CREATE INDEX idx_signal_perf_symbol ON signal_performance(symbol);
CREATE INDEX idx_signal_perf_opportunity ON signal_performance(opportunity_type);
CREATE INDEX idx_signal_perf_outcome ON signal_performance(outcome);
CREATE INDEX idx_signal_perf_regime ON signal_performance(market_regime);
CREATE INDEX idx_signal_perf_vix ON signal_performance(vix_level);
CREATE INDEX idx_signal_perf_time ON signal_performance(signal_time DESC);
CREATE INDEX idx_signal_perf_tod ON signal_performance(time_of_day_window);

-- Composite index for common analytics queries
CREATE INDEX idx_signal_perf_analytics ON signal_performance(
  opportunity_type, market_regime, vix_level, outcome
);

-- Materialized view for quick win rate lookups
CREATE MATERIALIZED VIEW signal_win_rates AS
SELECT
  opportunity_type,
  market_regime,
  vix_level,
  time_of_day_window,
  COUNT(*) as total_signals,
  SUM(CASE WHEN was_winner THEN 1 ELSE 0 END) as wins,
  ROUND(100.0 * SUM(CASE WHEN was_winner THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as win_rate,
  ROUND(AVG(actual_rr), 2) as avg_rr,
  ROUND(AVG(CASE WHEN was_winner THEN pnl_percent ELSE 0 END), 2) as avg_win_pct,
  ROUND(AVG(CASE WHEN NOT was_winner THEN pnl_percent ELSE 0 END), 2) as avg_loss_pct,
  ROUND(AVG(hold_time_minutes), 0) as avg_hold_time
FROM signal_performance
WHERE outcome != 'PENDING'
GROUP BY opportunity_type, market_regime, vix_level, time_of_day_window;

-- Refresh function (call hourly)
CREATE OR REPLACE FUNCTION refresh_signal_win_rates()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY signal_win_rates;
END;
$$ LANGUAGE plpgsql;
```

#### TypeScript Implementation

```typescript
// src/lib/analytics/SignalPerformance.ts

export interface SignalPerformanceRecord {
  id: string;
  signalId?: string;
  symbol: string;
  opportunityType: string;
  direction: "LONG" | "SHORT";

  // Context
  signalTime: Date;
  timeOfDayWindow: string;
  vixLevel: string;
  marketRegime: string;
  ivPercentile?: number;

  // Scores
  baseScore: number;
  scalpScore: number;
  dayTradeScore: number;
  swingScore: number;
  confluenceCount: number;

  // Entry
  entryPrice: number;
  entryTime?: Date;
  projectedStop: number;
  projectedT1: number;
  projectedT2: number;
  projectedRR: number;

  // Outcome
  outcome: "WIN_T1" | "WIN_T2" | "WIN_T3" | "STOP_HIT" | "TIME_STOP" | "MANUAL_EXIT" | "PENDING";
  exitPrice?: number;
  exitTime?: Date;
  actualRR?: number;
  holdTimeMinutes?: number;
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;

  // Computed
  pnlPercent?: number;
  wasWinner?: boolean;
  tradeType: "SCALP" | "DAY" | "SWING";
}

export interface WinRateQuery {
  opportunityType?: string;
  marketRegime?: string;
  vixLevel?: string;
  timeOfDayWindow?: string;
  minSampleSize?: number;
}

export interface WinRateResult {
  opportunityType: string;
  marketRegime: string;
  vixLevel: string;
  timeOfDayWindow: string;
  totalSignals: number;
  wins: number;
  winRate: number;
  avgRR: number;
  avgWinPct: number;
  avgLossPct: number;
  avgHoldTime: number;
  expectancy: number; // winRate * avgWin - (1 - winRate) * avgLoss
}

export class SignalPerformanceTracker {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Record a new signal for tracking
   */
  async recordSignal(signal: Partial<SignalPerformanceRecord>): Promise<string> {
    // Implementation
  }

  /**
   * Update signal with outcome
   */
  async recordOutcome(
    signalId: string,
    outcome: SignalPerformanceRecord["outcome"],
    exitPrice: number,
    exitTime: Date
  ): Promise<void> {
    // Implementation
  }

  /**
   * Get historical win rates for signal type
   */
  async getWinRates(query: WinRateQuery): Promise<WinRateResult[]> {
    // Implementation - queries materialized view
  }

  /**
   * Get win rate for specific context (used in real-time scoring)
   */
  async getContextualWinRate(
    opportunityType: string,
    regime: string,
    vixLevel: string,
    timeWindow: string
  ): Promise<{ winRate: number; sampleSize: number; confidence: number }> {
    // Implementation
  }
}
```

#### API Routes

```typescript
// server/routes/analytics.ts

router.get("/api/analytics/win-rates", async (req, res) => {
  const { opportunityType, regime, vixLevel, timeWindow } = req.query;
  const tracker = new SignalPerformanceTracker(supabase);
  const results = await tracker.getWinRates({
    opportunityType: opportunityType as string,
    marketRegime: regime as string,
    vixLevel: vixLevel as string,
    timeOfDayWindow: timeWindow as string,
    minSampleSize: 10,
  });
  res.json(results);
});

router.post("/api/analytics/record-outcome", async (req, res) => {
  const { signalId, outcome, exitPrice, exitTime } = req.body;
  const tracker = new SignalPerformanceTracker(supabase);
  await tracker.recordOutcome(signalId, outcome, exitPrice, new Date(exitTime));
  res.json({ success: true });
});
```

---

### 1.4 Confidence Scoring for Missing Data

**Priority**: P1 (High)
**Estimated Impact**: +10% signal quality, avoid false signals on weekends
**Files to Modify**:

- `src/lib/composite/ConfidenceScoring.ts` (NEW)
- `src/lib/composite/CompositeScanner.ts`
- `src/lib/strategy/featuresBuilder.ts`

#### Implementation Details

```typescript
// NEW FILE: src/lib/composite/ConfidenceScoring.ts

export interface DataAvailability {
  price: boolean;
  volume: boolean;
  vwap: boolean;
  rsi: boolean;
  ema: boolean;
  atr: boolean;
  flow: boolean;
  mtf_5m: boolean;
  mtf_15m: boolean;
  mtf_60m: boolean;
  orb: boolean;
  priorDayLevels: boolean;
  vixLevel: boolean;
}

export interface ConfidenceAdjustment {
  baseConfidence: number; // 0-100
  dataCompletenessScore: number; // 0-100
  adjustedConfidence: number; // 0-100
  missingCriticalData: string[];
  missingOptionalData: string[];
  penalties: Record<string, number>;
}

// Weight of each data point for confidence
const DATA_WEIGHTS: Record<keyof DataAvailability, { weight: number; critical: boolean }> = {
  price: { weight: 20, critical: true },
  volume: { weight: 15, critical: true },
  vwap: { weight: 12, critical: false },
  rsi: { weight: 10, critical: false },
  ema: { weight: 8, critical: false },
  atr: { weight: 10, critical: true },
  flow: { weight: 8, critical: false },
  mtf_5m: { weight: 5, critical: false },
  mtf_15m: { weight: 4, critical: false },
  mtf_60m: { weight: 3, critical: false },
  orb: { weight: 3, critical: false },
  priorDayLevels: { weight: 5, critical: false },
  vixLevel: { weight: 7, critical: false },
};

export function calculateDataConfidence(availability: DataAvailability): ConfidenceAdjustment {
  let totalWeight = 0;
  let availableWeight = 0;
  const missingCritical: string[] = [];
  const missingOptional: string[] = [];
  const penalties: Record<string, number> = {};

  for (const [key, config] of Object.entries(DATA_WEIGHTS)) {
    totalWeight += config.weight;
    if (availability[key as keyof DataAvailability]) {
      availableWeight += config.weight;
    } else {
      penalties[key] = config.weight;
      if (config.critical) {
        missingCritical.push(key);
      } else {
        missingOptional.push(key);
      }
    }
  }

  const dataCompletenessScore = Math.round((availableWeight / totalWeight) * 100);

  // Critical data missing = hard cap on confidence
  let baseConfidence = 100;
  if (missingCritical.length > 0) {
    baseConfidence = Math.max(50, baseConfidence - missingCritical.length * 20);
  }

  const adjustedConfidence = Math.round((baseConfidence * dataCompletenessScore) / 100);

  return {
    baseConfidence,
    dataCompletenessScore,
    adjustedConfidence,
    missingCriticalData: missingCritical,
    missingOptionalData: missingOptional,
    penalties,
  };
}

/**
 * Apply confidence adjustment to signal score
 */
export function applyConfidenceToScore(
  rawScore: number,
  confidenceAdjustment: ConfidenceAdjustment
): { adjustedScore: number; reasoning: string } {
  const multiplier = confidenceAdjustment.adjustedConfidence / 100;
  const adjustedScore = Math.round(rawScore * multiplier);

  let reasoning = `Score adjusted from ${rawScore} to ${adjustedScore} `;
  reasoning += `(${confidenceAdjustment.dataCompletenessScore}% data available)`;

  if (confidenceAdjustment.missingCriticalData.length > 0) {
    reasoning += `. Missing critical: ${confidenceAdjustment.missingCriticalData.join(", ")}`;
  }

  return { adjustedScore, reasoning };
}
```

---

## Phase 2: Core Improvements

**Timeline**: Week 3-6
**Goal**: Fundamental signal quality and UX improvements

### 2.1 Style Score Differentiation

**Priority**: P0 (Critical)
**Estimated Impact**: +25% signal quality
**Files to Modify**:

- `src/lib/composite/StyleScoreModifiers.ts` (NEW)
- All detector files in `src/lib/composite/detectors/`

#### Implementation Details

```typescript
// NEW FILE: src/lib/composite/StyleScoreModifiers.ts

export interface StyleModifiers {
  scalp: number; // Multiplier for scalp suitability
  dayTrade: number; // Multiplier for day trade suitability
  swing: number; // Multiplier for swing suitability
}

export interface StyleScoreFactors {
  timeOfDay: string; // 'opening_drive', 'power_hour', etc.
  minutesSinceOpen: number;
  atrPercent: number; // ATR as % of price
  volumeSpike: boolean;
  nearKeyLevel: boolean;
  rsiExtreme: boolean;
  mtfAlignment: number; // 0-100
  regime: string;
}

/**
 * Calculate style-specific score modifiers based on market context
 */
export function calculateStyleModifiers(factors: StyleScoreFactors): StyleModifiers {
  let scalp = 1.0;
  let dayTrade = 1.0;
  let swing = 1.0;

  // TIME OF DAY ADJUSTMENTS
  if (factors.timeOfDay === "opening_drive") {
    scalp *= 1.3; // Scalps love opening volatility
    dayTrade *= 1.1;
    swing *= 0.8; // Don't swing trade off the open
  } else if (factors.timeOfDay === "lunch_chop") {
    scalp *= 0.6; // Scalps suffer in chop
    dayTrade *= 0.8;
    swing *= 1.0; // Swing doesn't care
  } else if (factors.timeOfDay === "power_hour") {
    scalp *= 1.2;
    dayTrade *= 1.15;
    swing *= 0.9;
  }

  // VOLATILITY (ATR) ADJUSTMENTS
  if (factors.atrPercent > 2.0) {
    scalp *= 0.8; // Too volatile for tight scalp stops
    dayTrade *= 1.1; // Day trades can handle it
    swing *= 1.2; // Swing loves volatility for bigger moves
  } else if (factors.atrPercent < 0.5) {
    scalp *= 1.1; // Low vol = tighter spreads, good for scalps
    dayTrade *= 0.9;
    swing *= 0.7; // Low vol = slow moves, bad for swings
  }

  // VOLUME SPIKE
  if (factors.volumeSpike) {
    scalp *= 1.25; // Volume = liquidity = better fills
    dayTrade *= 1.15;
    swing *= 1.0;
  }

  // KEY LEVEL PROXIMITY
  if (factors.nearKeyLevel) {
    scalp *= 1.2; // Clear entry/exit
    dayTrade *= 1.15;
    swing *= 1.1;
  }

  // RSI EXTREME (mean reversion signals)
  if (factors.rsiExtreme) {
    scalp *= 0.9; // Mean reversion takes time
    dayTrade *= 1.1;
    swing *= 1.2; // Best for swings
  }

  // MTF ALIGNMENT
  if (factors.mtfAlignment > 80) {
    scalp *= 1.1;
    dayTrade *= 1.2;
    swing *= 1.3; // MTF alignment most important for swings
  } else if (factors.mtfAlignment < 40) {
    scalp *= 1.0; // Scalps don't need MTF
    dayTrade *= 0.85;
    swing *= 0.7; // Don't swing against MTF
  }

  // REGIME ADJUSTMENTS
  if (factors.regime === "trending") {
    swing *= 1.2; // Trending = ride the wave
  } else if (factors.regime === "choppy") {
    scalp *= 0.7;
    dayTrade *= 0.8;
    swing *= 0.6; // Choppy = avoid swings
  }

  // Normalize to prevent extreme values
  return {
    scalp: Math.max(0.5, Math.min(1.5, scalp)),
    dayTrade: Math.max(0.5, Math.min(1.5, dayTrade)),
    swing: Math.max(0.5, Math.min(1.5, swing)),
  };
}
```

---

### 2.2 Level-Aware Stop Loss

**Priority**: P0 (Critical)
**Estimated Impact**: +20% win rate
**Files to Modify**:

- `src/lib/riskEngine/LevelAwareStops.ts` (NEW)
- `src/lib/riskEngine/calculator.ts`

#### Implementation Details

```typescript
// NEW FILE: src/lib/riskEngine/LevelAwareStops.ts

export interface KeyLevel {
  price: number;
  type: "ORB" | "VWAP" | "PriorDayHL" | "WeekHL" | "Pivot" | "Fib" | "Bollinger";
  strength: "strong" | "moderate" | "weak";
  touchCount: number; // How many times price has respected this level
}

export interface LevelAwareStopResult {
  recommendedStop: number;
  levelType: string;
  levelStrength: string;
  distanceFromLevel: number;
  distancePercent: number;
  reasoning: string;
  alternativeStops: Array<{
    price: number;
    type: string;
    distancePercent: number;
  }>;
}

/**
 * Calculate stop loss based on actual support/resistance levels
 */
export function calculateLevelAwareStop(
  entryPrice: number,
  direction: "long" | "short",
  keyLevels: KeyLevel[],
  atr: number,
  maxStopPercent: number = 5
): LevelAwareStopResult {
  // Sort levels by proximity to entry
  const relevantLevels = keyLevels
    .filter((level) => {
      if (direction === "long") {
        return level.price < entryPrice; // Support levels below entry
      } else {
        return level.price > entryPrice; // Resistance levels above entry
      }
    })
    .map((level) => ({
      ...level,
      distance: Math.abs(entryPrice - level.price),
      distancePercent: Math.abs((entryPrice - level.price) / entryPrice) * 100,
    }))
    .filter((level) => level.distancePercent <= maxStopPercent)
    .sort((a, b) => {
      // Prioritize strong levels, then proximity
      const strengthOrder = { strong: 0, moderate: 1, weak: 2 };
      const strengthDiff = strengthOrder[a.strength] - strengthOrder[b.strength];
      if (strengthDiff !== 0) return strengthDiff;
      return a.distance - b.distance;
    });

  if (relevantLevels.length === 0) {
    // Fallback to ATR-based stop
    const atrStop = direction === "long" ? entryPrice - atr * 1.0 : entryPrice + atr * 1.0;

    return {
      recommendedStop: atrStop,
      levelType: "ATR",
      levelStrength: "moderate",
      distanceFromLevel: atr,
      distancePercent: (atr / entryPrice) * 100,
      reasoning: "No key levels found, using 1.0 ATR stop",
      alternativeStops: [],
    };
  }

  const primaryLevel = relevantLevels[0];

  // Place stop slightly beyond the level (buffer)
  const buffer = atr * 0.1; // 10% of ATR as buffer
  const recommendedStop =
    direction === "long" ? primaryLevel.price - buffer : primaryLevel.price + buffer;

  return {
    recommendedStop,
    levelType: primaryLevel.type,
    levelStrength: primaryLevel.strength,
    distanceFromLevel: primaryLevel.distance + buffer,
    distancePercent: (Math.abs(entryPrice - recommendedStop) / entryPrice) * 100,
    reasoning: `Stop placed below ${primaryLevel.type} (${primaryLevel.strength}) at ${primaryLevel.price.toFixed(2)}`,
    alternativeStops: relevantLevels.slice(1, 3).map((l) => ({
      price: direction === "long" ? l.price - buffer : l.price + buffer,
      type: l.type,
      distancePercent: l.distancePercent,
    })),
  };
}
```

---

### 2.3 Greeks Dashboard for Radar

**Priority**: P1 (High)
**Estimated Impact**: Major UX improvement for weekend planning
**Files to Create**:

- `src/components/hd/dashboard/HDGreeksDashboard.tsx` (NEW)
- `src/components/hd/dashboard/HDIVSurface.tsx` (NEW)
- `src/components/hd/dashboard/HDThetaTimeline.tsx` (NEW)
- `src/hooks/useGreeksAnalysis.ts` (NEW)

#### Component Structure

```typescript
// src/components/hd/dashboard/HDGreeksDashboard.tsx

interface HDGreeksDashboardProps {
  symbol: string;
  isOffHours: boolean;
}

export function HDGreeksDashboard({ symbol, isOffHours }: HDGreeksDashboardProps) {
  return (
    <div className="space-y-4">
      {/* IV Analysis Panel */}
      <Card>
        <CardHeader>
          <CardTitle>IV Analysis: {symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <IVRankGauge ivRank={ivRank} ivPercentile={ivPercentile} />
          <IVHistoryChart data={ivHistory30Days} />
          <IVRecommendation analysis={ivAnalysis} />
        </CardContent>
      </Card>

      {/* Theta Decay Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Theta Decay by DTE</CardTitle>
        </CardHeader>
        <CardContent>
          <ThetaDecayBars
            dte0={thetaDecay[0]}
            dte1={thetaDecay[1]}
            dte2={thetaDecay[2]}
            dte7={thetaDecay[7]}
          />
        </CardContent>
      </Card>

      {/* Gamma Exposure Map */}
      <Card>
        <CardHeader>
          <CardTitle>Gamma Exposure by Strike</CardTitle>
        </CardHeader>
        <CardContent>
          <GammaExposureChart
            strikes={gammaByStrike}
            currentPrice={currentPrice}
            gammaFlipLevel={gammaFlipLevel}
          />
        </CardContent>
      </Card>

      {/* DTE Recommendation */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended DTE</CardTitle>
        </CardHeader>
        <CardContent>
          <DTERecommendation
            vixLevel={vixLevel}
            ivRank={ivRank}
            tradingStyle={preferredStyle}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 2.4 Economic Calendar Integration

**Priority**: P1 (High)
**Estimated Impact**: Avoid trading into volatility events, +10% win rate
**Files to Create**:

- `src/lib/calendar/EconomicCalendar.ts` (NEW)
- `src/components/hd/dashboard/HDEconomicCalendar.tsx` (NEW)
- `server/routes/calendar.ts` (NEW)

#### Implementation

```typescript
// src/lib/calendar/EconomicCalendar.ts

export interface EconomicEvent {
  id: string;
  name: string;
  datetime: Date;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "FED" | "EMPLOYMENT" | "INFLATION" | "GDP" | "EARNINGS" | "OTHER";
  previous?: string;
  forecast?: string;
  actual?: string;
  affectsSymbols: string[]; // Which symbols this impacts
}

export interface EarningsEvent {
  symbol: string;
  name: string;
  datetime: Date;
  timing: "BMO" | "AMC"; // Before market open / After market close
  expectedMove: number; // Implied move from options pricing
  ivRank: number;
  historicalBeatRate: number;
}

export interface CalendarAnalysis {
  eventsNext24h: EconomicEvent[];
  eventsNext7d: EconomicEvent[];
  earningsThisWeek: EarningsEvent[];
  tradingRecommendations: string[];
  highRiskPeriods: Array<{ start: Date; end: Date; reason: string }>;
}

/**
 * Fetch economic calendar from data provider
 */
export async function fetchEconomicCalendar(
  startDate: Date,
  endDate: Date
): Promise<EconomicEvent[]> {
  // Implementation - fetch from investing.com API or similar
}

/**
 * Analyze calendar for trading implications
 */
export function analyzeCalendarForTrading(
  events: EconomicEvent[],
  earnings: EarningsEvent[],
  watchlistSymbols: string[]
): CalendarAnalysis {
  // Implementation
}
```

---

## Phase 3: Advanced Features

**Timeline**: Week 7-12
**Goal**: Professional-grade trading capabilities

### 3.1 Gamma Context Engine

**Priority**: P0 (Critical for index options)
**Files to Create**:

- `src/lib/gamma/GammaContextEngine.ts` (NEW)
- `src/lib/gamma/DealerPositioning.ts` (NEW)

### 3.2 Non-Trend Day Strategies

**Priority**: P0 (Critical)
**Files to Create**:

- `src/lib/composite/detectors/MeanReversionScalpDetector.ts` (NEW)
- `src/lib/composite/detectors/RangeFadeDetector.ts` (NEW)
- `src/lib/composite/detectors/VWAPReversionDetector.ts` (NEW)
- `src/lib/composite/detectors/GammaPinningDetector.ts` (NEW)
- `src/lib/composite/detectors/VolatilitySqueezeDetector.ts` (NEW)

### 3.3 Trade Plan Builder

**Priority**: P1 (High)
**Files to Create**:

- `src/components/hd/planning/TradePlanBuilder.tsx` (NEW)
- `src/components/hd/planning/VisualPriceLadder.tsx` (NEW)
- `src/lib/planning/TradePlanGenerator.ts` (NEW)

### 3.4 Sunday Evening Futures

**Priority**: P1 (High)
**Files to Create**:

- `src/hooks/useFuturesData.ts` (NEW)
- `src/components/hd/dashboard/HDFuturesOvernight.tsx` (NEW)

### 3.5 Enhanced Flow Analysis

**Priority**: P2 (Medium)
**Files to Modify**:

- `src/lib/massive/aggregate-flow.ts`
- Add dark pool detection, order flow imbalance

---

## Phase 4: AI/ML Layer

**Timeline**: Week 13-20
**Goal**: Predictive capabilities and adaptive optimization

### 4.1 Signal Quality Predictor

**Priority**: P0 (Critical)
**Files to Create**:

- `src/lib/ml/SignalQualityPredictor.ts` (NEW)
- `server/workers/mlTraining.ts` (NEW)
- `scripts/ml/train_signal_model.py` (NEW)

### 4.2 Pattern Recognition Neural Network

**Priority**: P2 (Medium)
**Files to Create**:

- `src/lib/ml/PatternRecognitionNN.ts` (NEW)
- `scripts/ml/train_pattern_model.py` (NEW)

### 4.3 Adaptive Optimizer

**Priority**: P1 (High)
**Files to Modify**:

- `server/workers/optimizer.ts`
- Add continuous micro-adjustments

### 4.4 Regime Transition Predictor

**Priority**: P2 (Medium)
**Files to Create**:

- `src/lib/ml/RegimeTransitionPredictor.ts` (NEW)

---

## Testing Strategy

### Unit Testing Requirements

| Phase | Feature             | Min Coverage | Critical Paths                             |
| ----- | ------------------- | ------------ | ------------------------------------------ |
| 1.1   | Adaptive Thresholds | 90%          | Time parsing, threshold calculation        |
| 1.2   | IV Gating           | 85%          | Percentile calculation, gating decisions   |
| 1.3   | Win Rate Tracking   | 80%          | Database operations, metric calculations   |
| 1.4   | Confidence Scoring  | 90%          | Data availability checks, score adjustment |
| 2.1   | Style Modifiers     | 85%          | All modifier calculations                  |
| 2.2   | Level-Aware Stops   | 90%          | Level selection, stop placement            |

### Integration Testing

- Scanner integration tests: Verify adaptive thresholds apply correctly
- API endpoint tests: All new routes with mock data
- Database migration tests: Verify schema changes don't break existing data

### E2E Testing

- Weekend planning flow: Load radar → view Greeks → create plan
- Signal tracking flow: Signal detected → trade entered → outcome recorded

---

## Documentation Requirements

### For Each Feature

1. **CLAUDE.md Update**: Add to relevant section
2. **Inline JSDoc**: All exported functions
3. **Feature Doc**: `docs/features/FEATURE_NAME.md`
4. **API Doc**: If new endpoints added

### Documentation Template

````markdown
# Feature: [Name]

## Overview

Brief description of what this feature does.

## Configuration

```typescript
// Config interface and defaults
```
````

## Usage

```typescript
// Example usage
```

## Testing

How to test this feature manually.

## Troubleshooting

Common issues and solutions.

```

---

## Database Migrations

| Migration | Phase | Description |
|-----------|-------|-------------|
| 012 | 1.3 | signal_performance table + materialized view |
| 013 | 2.3 | greeks_history table for IV tracking |
| 014 | 2.4 | economic_calendar cache table |
| 015 | 3.1 | gamma_exposure table |
| 016 | 3.3 | trade_plans table |
| 017 | 4.1 | ml_predictions table |

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing signals | Feature flags for all new features |
| Performance degradation | Benchmark before/after each phase |
| Database migration issues | Test migrations on staging first |
| ML model accuracy | A/B test predictions vs rules-only |

### Rollback Plan

Each phase can be rolled back independently:
1. Database: Keep migration rollback scripts
2. Code: Feature flags allow instant disable
3. ML: Fall back to rules-only system

---

## Success Metrics

### Phase 1 Targets
- [ ] Signal count: Same or higher (adaptive thresholds don't over-filter)
- [ ] Build time: No regression
- [ ] Test coverage: Maintain 70%+

### Phase 2 Targets
- [ ] Win rate tracking active for 100% of signals
- [ ] Greeks dashboard load time < 2s
- [ ] Calendar data refresh < 500ms

### Phase 3 Targets
- [ ] Non-trend day signals: 3+ new detector types
- [ ] Trade plan export: PDF + Discord working
- [ ] Futures data: Real-time during off-hours

### Phase 4 Targets
- [ ] ML prediction accuracy: >60% on win/loss
- [ ] Adaptive optimizer: Parameters adjust within 1 hour of regime change
- [ ] Pattern recognition: 5+ patterns detected with >70% accuracy

---

## Appendix: File Index

### New Files to Create

```

src/lib/composite/
├── AdaptiveThresholds.ts
├── ConfidenceScoring.ts
├── StyleScoreModifiers.ts
└── detectors/
├── MeanReversionScalpDetector.ts
├── RangeFadeDetector.ts
├── VWAPReversionDetector.ts
├── GammaPinningDetector.ts
└── VolatilitySqueezeDetector.ts

src/lib/riskEngine/
└── LevelAwareStops.ts

src/lib/analytics/
└── SignalPerformance.ts

src/lib/greeks/
└── IVGating.ts

src/lib/gamma/
├── GammaContextEngine.ts
└── DealerPositioning.ts

src/lib/calendar/
└── EconomicCalendar.ts

src/lib/planning/
└── TradePlanGenerator.ts

src/lib/ml/
├── SignalQualityPredictor.ts
├── PatternRecognitionNN.ts
└── RegimeTransitionPredictor.ts

src/components/hd/dashboard/
├── HDGreeksDashboard.tsx
├── HDIVSurface.tsx
├── HDThetaTimeline.tsx
├── HDEconomicCalendar.tsx
└── HDFuturesOvernight.tsx

src/components/hd/planning/
├── TradePlanBuilder.tsx
└── VisualPriceLadder.tsx

src/hooks/
├── useGreeksAnalysis.ts
└── useFuturesData.ts

server/routes/
├── analytics.ts
└── calendar.ts

scripts/
├── 012_add_signal_performance_table.sql
├── 013_add_greeks_history_table.sql
├── 014_add_economic_calendar_table.sql
├── 015_add_gamma_exposure_table.sql
├── 016_add_trade_plans_table.sql
└── 017_add_ml_predictions_table.sql

scripts/ml/
├── train_signal_model.py
└── train_pattern_model.py

docs/features/
├── ADAPTIVE_THRESHOLDS.md
├── IV_GATING.md
├── SIGNAL_PERFORMANCE.md
├── CONFIDENCE_SCORING.md
├── STYLE_MODIFIERS.md
├── LEVEL_AWARE_STOPS.md
├── GREEKS_DASHBOARD.md
├── ECONOMIC_CALENDAR.md
├── NON_TREND_STRATEGIES.md
├── TRADE_PLAN_BUILDER.md
└── ML_PREDICTIONS.md

```

---

**Document Version**: 1.0.0
**Last Updated**: November 26, 2025
**Next Review**: After Phase 1 completion
```
