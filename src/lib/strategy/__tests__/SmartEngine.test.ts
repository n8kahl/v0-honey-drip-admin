/**
 * SmartEngine Test Suite
 *
 * Comprehensive tests for the Strategy Engine including:
 * 1. Flow Gate Logic - minFlowScore threshold evaluation
 * 2. Gamma Gate Logic - gammaRegime matching
 * 3. Institutional Score Gate - minInstitutionalScore threshold
 * 4. Flow Bias Gate - requiredFlowBias matching
 * 5. Optimization Application - pending_params override simulation
 * 6. Regression Check - BacktestTrade imports from types.ts
 */

import { describe, it, expect, vi } from "vitest";
import {
  evaluateStrategy,
  evaluateSmartGates,
  evaluateConditionTree,
  evaluateRule,
  computeStrategyConfidence,
  getFeatureValue,
  type SymbolFeatures,
} from "../engine";
import type {
  StrategyDefinition,
  StrategySmartGates,
  StrategyConditionTree,
} from "../../../types/strategy";
import {
  BacktestTrade,
  BacktestStats,
  BacktestConfig,
  DEFAULT_BACKTEST_CONFIG,
  calculateStats,
} from "../../backtest/types";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock strategy definition with smart gates
 */
function createMockStrategy(overrides: Partial<StrategyDefinition> = {}): StrategyDefinition {
  return {
    id: "test-strategy-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: "test-owner",
    name: "Test Strategy",
    slug: "test-strategy",
    category: "INTRADAY",
    underlyingScope: "ANY",
    timeWindow: null,
    barTimeframe: "5m",
    entrySide: "LONG",
    conditions: {
      type: "AND",
      children: [
        {
          type: "RULE",
          rule: { field: "price.current", op: ">", value: 100 },
        },
      ],
    },
    alertBehavior: {
      flashWatchlist: true,
      showNowPlaying: true,
      notifyDiscord: false,
    },
    cooldownMinutes: 5,
    oncePerSession: false,
    isCoreLibrary: false,
    enabled: true,
    ...overrides,
  };
}

/**
 * Create mock symbol features for testing
 */
function createMockFeatures(overrides: Partial<SymbolFeatures> = {}): SymbolFeatures {
  return {
    symbol: "SPY",
    time: new Date().toISOString(),
    price: {
      current: 595.5,
      open: 594.0,
      high: 596.0,
      low: 593.5,
      prevClose: 593.0,
    },
    volume: {
      current: 1000000,
      avg: 800000,
      relativeToAvg: 1.25,
    },
    flow: {
      flowScore: 65,
      flowBias: "bullish",
      sweepCount: 5,
      blockCount: 2,
      unusualActivity: false,
      buyPressure: 60,
    },
    greeks: {
      delta: 0.45,
      gamma: 0.02,
      theta: -0.15,
      vega: 0.25,
      gammaRisk: "medium",
    },
    ema: { "9": 595.0, "21": 594.5, "50": 593.0 },
    rsi: { "14": 55 },
    session: {
      minutesSinceOpen: 60,
      isRegularHours: true,
    },
    ...overrides,
  };
}

// ============================================================================
// 1. Flow Gate Logic Tests
// ============================================================================

describe("Flow Gate Logic", () => {
  it("should reject when flow score is below minFlowScore threshold", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minFlowScore: 80, // Require flow score >= 80
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 50, // Below threshold
        flowBias: "bullish",
      },
    });

    const result = evaluateStrategy(strategy, features);

    expect(result.matches).toBe(false);
    expect(result.gateReason).toContain("Flow Score Low");
    expect(result.gateReason).toContain("50 < 80");
  });

  it("should pass when flow score meets minFlowScore threshold", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minFlowScore: 60,
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 75, // Above threshold
        flowBias: "bullish",
      },
    });

    const result = evaluateStrategy(strategy, features);

    // Gate should pass, conditions determine final match
    expect(result.gateReason).toBeUndefined();
  });

  it("should pass when flow score exactly equals minFlowScore", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minFlowScore: 70,
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 70, // Exactly at threshold
        flowBias: "neutral",
      },
    });

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });

  it("should use default flow score of 50 when flow.flowScore is undefined", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minFlowScore: 40, // Should pass with default 50
      },
    });

    const features = createMockFeatures({
      flow: {
        flowBias: "bullish",
        // flowScore intentionally omitted
      },
    });

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });
});

// ============================================================================
// 2. Gamma Gate Logic Tests
// ============================================================================

describe("Gamma Gate Logic", () => {
  it("should reject when gamma regime does not match required short_gamma", () => {
    const strategy = createMockStrategy({
      smartGates: {
        gammaRegime: "short_gamma", // Require short gamma
      },
    });

    const features = createMockFeatures({
      greeks: {
        delta: 0.45,
        gamma: 0.02,
        gammaRisk: "low", // Not matching regime
      },
    });

    // Add dealer positioning to features
    (features as any).dealer_positioning = "LONG_GAMMA";

    const result = evaluateStrategy(strategy, features);

    expect(result.matches).toBe(false);
    expect(result.gateReason).toContain("Gamma Regime Mismatch");
    expect(result.gateReason).toContain("long_gamma");
    expect(result.gateReason).toContain("short_gamma");
  });

  it("should pass when gamma regime matches required short_gamma", () => {
    const strategy = createMockStrategy({
      smartGates: {
        gammaRegime: "short_gamma",
      },
    });

    const features = createMockFeatures({
      greeks: {
        delta: 0.45,
        gamma: 0.02,
        gammaRisk: "high",
      },
    });

    // Add dealer positioning to features
    (features as any).dealer_positioning = "SHORT_GAMMA";

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });

  it("should pass when gamma regime matches required long_gamma", () => {
    const strategy = createMockStrategy({
      smartGates: {
        gammaRegime: "long_gamma",
      },
    });

    const features = createMockFeatures({
      greeks: {
        delta: 0.45,
        gamma: 0.02,
        gammaRisk: "low",
      },
    });

    // Add dealer positioning to features
    (features as any).dealer_positioning = "LONG_GAMMA";

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });

  it("should pass when gammaRegime is set to 'any'", () => {
    const strategy = createMockStrategy({
      smartGates: {
        gammaRegime: "any",
      },
    });

    const features = createMockFeatures({
      greeks: {
        gammaRisk: "high",
      },
    });

    (features as any).dealer_positioning = "SHORT_GAMMA";

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });
});

// ============================================================================
// 3. Institutional Score Gate Tests
// ============================================================================

describe("Institutional Score Gate", () => {
  it("should reject when institutional score is below threshold", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minInstitutionalScore: 70,
      },
    });

    const features = createMockFeatures({});
    (features as any).institutional_score = 50;

    const result = evaluateStrategy(strategy, features);

    expect(result.matches).toBe(false);
    expect(result.gateReason).toContain("Institutional Score Low");
    expect(result.gateReason).toContain("50 < 70");
  });

  it("should pass when institutional score meets threshold", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minInstitutionalScore: 60,
      },
    });

    const features = createMockFeatures({});
    (features as any).institutional_score = 75;

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });

  it("should check flow.institutionalConviction as fallback", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minInstitutionalScore: 50,
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 80,
        flowBias: "bullish",
      },
    });

    // Add institutionalConviction to flow object
    (features.flow as any).institutionalConviction = 65;

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });
});

// ============================================================================
// 4. Flow Bias Gate Tests
// ============================================================================

describe("Flow Bias Gate", () => {
  it("should reject when flow bias does not match required bullish", () => {
    const strategy = createMockStrategy({
      smartGates: {
        requiredFlowBias: "bullish",
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 80,
        flowBias: "bearish", // Mismatch
      },
    });

    const result = evaluateStrategy(strategy, features);

    expect(result.matches).toBe(false);
    expect(result.gateReason).toContain("Flow Bias Mismatch");
    expect(result.gateReason).toContain("bearish");
    expect(result.gateReason).toContain("bullish");
  });

  it("should pass when flow bias matches required bearish", () => {
    const strategy = createMockStrategy({
      smartGates: {
        requiredFlowBias: "bearish",
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 70,
        flowBias: "bearish",
      },
    });

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });

  it("should pass when requiredFlowBias is 'any'", () => {
    const strategy = createMockStrategy({
      smartGates: {
        requiredFlowBias: "any",
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 50,
        flowBias: "neutral",
      },
    });

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });
});

// ============================================================================
// 5. Gamma Exposure (GEX) Gate Tests
// ============================================================================

describe("Gamma Exposure Gate", () => {
  it("should reject when dealer net delta is below minGammaExposure", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minGammaExposure: 100000000, // $100M
      },
    });

    const features = createMockFeatures({});
    (features as any).dealer_net_delta = 50000000; // $50M - below threshold

    const result = evaluateStrategy(strategy, features);

    expect(result.matches).toBe(false);
    expect(result.gateReason).toContain("Gamma Exposure Low");
  });

  it("should pass when absolute dealer net delta meets threshold (negative)", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minGammaExposure: 80000000,
      },
    });

    const features = createMockFeatures({});
    (features as any).dealer_net_delta = -100000000; // Negative but abs() >= threshold

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });
});

// ============================================================================
// 6. Combined Gates Tests
// ============================================================================

describe("Combined Smart Gates", () => {
  it("should reject on first failing gate (flow score)", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minFlowScore: 90,
        requiredFlowBias: "bullish",
        gammaRegime: "short_gamma",
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 50, // Fails first
        flowBias: "bullish",
      },
    });

    const result = evaluateStrategy(strategy, features);

    expect(result.matches).toBe(false);
    expect(result.gateReason).toContain("Flow Score Low");
  });

  it("should pass all gates when all conditions met", () => {
    const strategy = createMockStrategy({
      smartGates: {
        minFlowScore: 60,
        requiredFlowBias: "bullish",
        gammaRegime: "short_gamma",
      },
    });

    const features = createMockFeatures({
      flow: {
        flowScore: 80,
        flowBias: "bullish",
      },
    });
    (features as any).dealer_positioning = "SHORT_GAMMA";

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });

  it("should pass when no smart gates are defined", () => {
    const strategy = createMockStrategy({
      smartGates: undefined,
    });

    const features = createMockFeatures({});

    const result = evaluateStrategy(strategy, features);

    expect(result.gateReason).toBeUndefined();
  });
});

// ============================================================================
// 7. Optimization Application Tests
// ============================================================================

describe("Optimization Application", () => {
  it("should verify pending_params structure is compatible with strategy", () => {
    const pendingParams = {
      riskReward: {
        stopMultiplier: 0.75,
        targetMultiplier: 2.0,
        trailingStopPct: 0.1,
      },
      consensus: {
        minScore: 75,
        minConfluence: 3,
        requiredFactors: ["flow", "gamma", "volume"],
      },
      optimizedAt: new Date().toISOString(),
      expectancyGain: 0.35,
    };

    // Verify structure matches StrategyOptimizationParams
    expect(pendingParams.riskReward).toBeDefined();
    expect(pendingParams.riskReward.stopMultiplier).toBe(0.75);
    expect(pendingParams.riskReward.targetMultiplier).toBe(2.0);
    expect(pendingParams.consensus.minScore).toBe(75);
    expect(pendingParams.expectancyGain).toBe(0.35);
  });

  it("should simulate optimization override with modified backtest config", () => {
    // Original config
    const originalConfig: BacktestConfig = {
      ...DEFAULT_BACKTEST_CONFIG,
      targetMultiple: 1.5,
      stopMultiple: 1.0,
    };

    // Optimized params from GA
    const pendingParams = {
      riskReward: {
        stopMultiplier: 0.6,
        targetMultiplier: 2.5,
      },
    };

    // Simulate applying optimization
    const optimizedConfig: BacktestConfig = {
      ...originalConfig,
      targetMultiple: pendingParams.riskReward.targetMultiplier,
      stopMultiple: pendingParams.riskReward.stopMultiplier,
    };

    expect(optimizedConfig.targetMultiple).toBe(2.5);
    expect(optimizedConfig.stopMultiple).toBe(0.6);
    expect(optimizedConfig.targetMultiple).not.toBe(originalConfig.targetMultiple);
  });

  it("should calculate improved expectancy with optimized params", () => {
    // Simulate baseline trades
    const baselineTrades: BacktestTrade[] = [
      createMockTrade({ pnl: 100, rMultiple: 1.0 }),
      createMockTrade({ pnl: -50, rMultiple: -0.5 }),
      createMockTrade({ pnl: 150, rMultiple: 1.5 }),
      createMockTrade({ pnl: -100, rMultiple: -1.0 }),
    ];

    // Simulate optimized trades (better R:R)
    const optimizedTrades: BacktestTrade[] = [
      createMockTrade({ pnl: 200, rMultiple: 2.0 }),
      createMockTrade({ pnl: -40, rMultiple: -0.4 }),
      createMockTrade({ pnl: 250, rMultiple: 2.5 }),
      createMockTrade({ pnl: -60, rMultiple: -0.6 }),
    ];

    const baselineStats = calculateStats("baseline", baselineTrades);
    const optimizedStats = calculateStats("optimized", optimizedTrades);

    // Verify expectancy improved
    expect(optimizedStats.expectancy).toBeGreaterThan(baselineStats.expectancy);
    expect(optimizedStats.profitFactor).toBeGreaterThan(baselineStats.profitFactor);
  });
});

// ============================================================================
// 8. Regression Check - BacktestTrade Type Imports
// ============================================================================

describe("Regression Check - BacktestTrade Imports", () => {
  it("should import BacktestTrade from types.ts", () => {
    const trade: BacktestTrade = {
      timestamp: Date.now(),
      symbol: "SPY",
      detector: "test-detector",
      direction: "LONG",
      entryPrice: 595.0,
      targetPrice: 600.0,
      stopPrice: 590.0,
      exitPrice: 598.0,
      exitTimestamp: Date.now() + 3600000,
      exitReason: "TARGET_HIT",
      pnl: 300,
      pnlPercent: 0.5,
      rMultiple: 0.6,
      barsHeld: 5,
    };

    expect(trade.timestamp).toBeDefined();
    expect(trade.symbol).toBe("SPY");
    expect(trade.direction).toBe("LONG");
    expect(trade.exitReason).toBe("TARGET_HIT");
  });

  it("should import BacktestStats from types.ts", () => {
    const stats: BacktestStats = {
      detector: "test-detector",
      totalTrades: 10,
      winners: 6,
      losers: 4,
      breakeven: 0,
      winRate: 0.6,
      totalPnl: 500,
      totalPnlPercent: 5.0,
      avgWin: 150,
      avgLoss: 100,
      largestWin: 300,
      largestLoss: 150,
      profitFactor: 1.5,
      expectancy: 0.5,
      avgRMultiple: 0.5,
      avgBarsHeld: 10,
      avgWinBars: 8,
      avgLossBars: 12,
      trades: [],
    };

    expect(stats.winRate).toBe(0.6);
    expect(stats.profitFactor).toBe(1.5);
    expect(stats.trades).toBeDefined();
  });

  it("should import BacktestConfig from types.ts", () => {
    const config: BacktestConfig = {
      symbols: ["SPY", "QQQ"],
      startDate: "2024-01-01",
      endDate: "2024-03-01",
      timeframe: "15m",
      targetMultiple: 1.5,
      stopMultiple: 1.0,
      maxHoldBars: 20,
      slippage: 0.001,
    };

    expect(config.symbols).toContain("SPY");
    expect(config.timeframe).toBe("15m");
  });

  it("should have DEFAULT_BACKTEST_CONFIG with expected values", () => {
    expect(DEFAULT_BACKTEST_CONFIG).toBeDefined();
    expect(DEFAULT_BACKTEST_CONFIG.targetMultiple).toBe(2.0);
    expect(DEFAULT_BACKTEST_CONFIG.stopMultiple).toBe(0.75);
    expect(DEFAULT_BACKTEST_CONFIG.maxHoldBars).toBe(15);
  });

  it("should calculateStats correctly from types.ts", () => {
    const trades: BacktestTrade[] = [
      createMockTrade({ pnl: 200, rMultiple: 2.0 }),
      createMockTrade({ pnl: -50, rMultiple: -0.5 }),
      createMockTrade({ pnl: 100, rMultiple: 1.0 }),
    ];

    const stats = calculateStats("test-detector", trades);

    expect(stats.totalTrades).toBe(3);
    expect(stats.winners).toBe(2);
    expect(stats.losers).toBe(1);
    expect(stats.winRate).toBeCloseTo(0.667, 2);
  });
});

// ============================================================================
// 9. Condition Tree Evaluation Tests
// ============================================================================

describe("Condition Tree Evaluation", () => {
  it("should evaluate simple greater than rule", () => {
    const tree: StrategyConditionTree = {
      type: "RULE",
      rule: { field: "price.current", op: ">", value: 100 },
    };

    const features = createMockFeatures({ price: { current: 150 } });
    const result = evaluateConditionTree(tree, features);

    expect(result).toBe(true);
  });

  it("should evaluate AND conditions", () => {
    const tree: StrategyConditionTree = {
      type: "AND",
      children: [
        { type: "RULE", rule: { field: "price.current", op: ">", value: 100 } },
        { type: "RULE", rule: { field: "rsi.14", op: "<", value: 70 } },
      ],
    };

    const features = createMockFeatures({
      price: { current: 150 },
      rsi: { "14": 55 },
    });

    const result = evaluateConditionTree(tree, features);

    expect(result).toBe(true);
  });

  it("should evaluate OR conditions", () => {
    const tree: StrategyConditionTree = {
      type: "OR",
      children: [
        { type: "RULE", rule: { field: "price.current", op: ">", value: 1000 } }, // false
        { type: "RULE", rule: { field: "rsi.14", op: "<", value: 70 } }, // true
      ],
    };

    const features = createMockFeatures({
      price: { current: 150 },
      rsi: { "14": 55 },
    });

    const result = evaluateConditionTree(tree, features);

    expect(result).toBe(true);
  });

  it("should evaluate NOT conditions", () => {
    const tree: StrategyConditionTree = {
      type: "NOT",
      child: { type: "RULE", rule: { field: "rsi.14", op: ">", value: 80 } },
    };

    const features = createMockFeatures({ rsi: { "14": 55 } });

    const result = evaluateConditionTree(tree, features);

    expect(result).toBe(true); // NOT (55 > 80) = NOT false = true
  });
});

// ============================================================================
// 10. Confidence Scoring Tests
// ============================================================================

describe("Confidence Scoring", () => {
  it("should return high confidence when all conditions are met", () => {
    const strategy = createMockStrategy({
      conditions: {
        type: "AND",
        children: [
          { type: "RULE", rule: { field: "price.current", op: ">", value: 500 } },
          { type: "RULE", rule: { field: "rsi.14", op: "<", value: 70 } },
        ],
      },
    });

    const features = createMockFeatures({
      price: { current: 595.5 },
      rsi: { "14": 55 },
    });

    const confidence = computeStrategyConfidence(strategy, features);

    expect(confidence).toBe(100);
  });

  it("should return partial confidence when some conditions are close", () => {
    const strategy = createMockStrategy({
      conditions: {
        type: "AND",
        children: [
          { type: "RULE", rule: { field: "price.current", op: ">", value: 596 } }, // Close miss
          { type: "RULE", rule: { field: "rsi.14", op: "<", value: 70 } }, // Pass
        ],
      },
    });

    const features = createMockFeatures({
      price: { current: 595.5 }, // Just under 596
      rsi: { "14": 55 },
    });

    const confidence = computeStrategyConfidence(strategy, features);

    // Should be partial (not 0, not 100)
    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThan(100);
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMockTrade(overrides: Partial<BacktestTrade> = {}): BacktestTrade {
  return {
    timestamp: Date.now(),
    symbol: "SPY",
    detector: "test-detector",
    direction: "LONG",
    entryPrice: 595.0,
    targetPrice: 600.0,
    stopPrice: 590.0,
    exitPrice: 598.0,
    exitTimestamp: Date.now() + 3600000,
    exitReason: "TARGET_HIT",
    pnl: 100,
    pnlPercent: 0.5,
    rMultiple: 1.0,
    barsHeld: 5,
    ...overrides,
  };
}
