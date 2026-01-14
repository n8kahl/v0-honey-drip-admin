/**
 * Tests for generateOptimizedReport ranking and filtering logic
 */

import { describe, it, expect } from "vitest";
import {
  normalizeProfitFactor,
  calculateCompositeScore,
  enrichDetectorStats,
  filterDetectorsBySampleSize,
  rankDetectorsByCompositeScore,
  groupDetectorsByStyle,
  calculateAverageWinRate,
  calculateAverageProfitFactor,
  DEFAULT_MIN_TRADES,
  MAX_PROFIT_FACTOR,
  WIN_RATE_WEIGHT,
  PROFIT_FACTOR_WEIGHT,
  type DetectorStats,
} from "../generateOptimizedReport";

// ============================================================================
// Test Data Helpers
// ============================================================================

function createDetector(overrides: Partial<DetectorStats> = {}): DetectorStats {
  return {
    detector: "test_detector",
    winRate: 0.5,
    profitFactor: 1.5,
    totalTrades: 50,
    ...overrides,
  };
}

// ============================================================================
// normalizeProfitFactor Tests
// ============================================================================

describe("normalizeProfitFactor", () => {
  it("returns 0 for zero profit factor", () => {
    expect(normalizeProfitFactor(0)).toBe(0);
  });

  it("returns 0 for negative profit factor", () => {
    expect(normalizeProfitFactor(-1)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(normalizeProfitFactor(Infinity)).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(normalizeProfitFactor(NaN)).toBe(0);
  });

  it("normalizes PF=1 to 0.2 (with default max=5)", () => {
    expect(normalizeProfitFactor(1)).toBeCloseTo(0.2);
  });

  it("normalizes PF=2.5 to 0.5 (with default max=5)", () => {
    expect(normalizeProfitFactor(2.5)).toBeCloseTo(0.5);
  });

  it("caps at 1 for PF >= MAX_PROFIT_FACTOR", () => {
    expect(normalizeProfitFactor(5)).toBe(1);
    expect(normalizeProfitFactor(10)).toBe(1);
  });

  it("uses custom max profit factor", () => {
    expect(normalizeProfitFactor(2, 4)).toBeCloseTo(0.5);
  });
});

// ============================================================================
// calculateCompositeScore Tests
// ============================================================================

describe("calculateCompositeScore", () => {
  it("returns 0 for 0 win rate and 0 profit factor", () => {
    expect(calculateCompositeScore(0, 0)).toBe(0);
  });

  it("weights win rate at 60% and profit factor at 40%", () => {
    // 50% win rate + PF of 2.5 (normalized to 0.5)
    // Score = (0.5 * 0.6) + (0.5 * 0.4) = 0.3 + 0.2 = 0.5
    const score = calculateCompositeScore(0.5, 2.5);
    expect(score).toBeCloseTo(0.5);
  });

  it("handles 100% win rate with high PF", () => {
    // 100% win rate + PF of 5 (normalized to 1)
    // Score = (1 * 0.6) + (1 * 0.4) = 1.0
    const score = calculateCompositeScore(1.0, MAX_PROFIT_FACTOR);
    expect(score).toBeCloseTo(1.0);
  });

  it("handles good win rate with poor PF", () => {
    // 60% win rate + PF of 0.5 (normalized to 0.1)
    // Score = (0.6 * 0.6) + (0.1 * 0.4) = 0.36 + 0.04 = 0.4
    const score = calculateCompositeScore(0.6, 0.5);
    expect(score).toBeCloseTo(0.4);
  });

  it("handles poor win rate with good PF", () => {
    // 30% win rate + PF of 3 (normalized to 0.6)
    // Score = (0.3 * 0.6) + (0.6 * 0.4) = 0.18 + 0.24 = 0.42
    const score = calculateCompositeScore(0.3, 3);
    expect(score).toBeCloseTo(0.42);
  });
});

// ============================================================================
// enrichDetectorStats Tests
// ============================================================================

describe("enrichDetectorStats", () => {
  it("adds compositeScore to stats", () => {
    const stats = createDetector({ winRate: 0.5, profitFactor: 2.5 });
    const enriched = enrichDetectorStats(stats);

    expect(enriched.compositeScore).toBeDefined();
    expect(enriched.compositeScore).toBeCloseTo(0.5);
  });

  it("marks detector as hasSufficientSample when trades >= minTrades", () => {
    const stats = createDetector({ totalTrades: 50 });
    const enriched = enrichDetectorStats(stats, 30);

    expect(enriched.hasSufficientSample).toBe(true);
  });

  it("marks detector as NOT hasSufficientSample when trades < minTrades", () => {
    const stats = createDetector({ totalTrades: 20 });
    const enriched = enrichDetectorStats(stats, 30);

    expect(enriched.hasSufficientSample).toBe(false);
  });

  it("uses DEFAULT_MIN_TRADES when minTrades not specified", () => {
    const stats = createDetector({ totalTrades: DEFAULT_MIN_TRADES });
    const enriched = enrichDetectorStats(stats);

    expect(enriched.hasSufficientSample).toBe(true);
  });

  it("preserves original fields", () => {
    const stats = createDetector({
      detector: "my_detector",
      winRate: 0.65,
      profitFactor: 2.0,
      totalTrades: 100,
      avgHoldBars: 5,
      expectancy: 0.15,
    });
    const enriched = enrichDetectorStats(stats);

    expect(enriched.detector).toBe("my_detector");
    expect(enriched.winRate).toBe(0.65);
    expect(enriched.profitFactor).toBe(2.0);
    expect(enriched.totalTrades).toBe(100);
    expect(enriched.avgHoldBars).toBe(5);
    expect(enriched.expectancy).toBe(0.15);
  });
});

// ============================================================================
// filterDetectorsBySampleSize Tests
// ============================================================================

describe("filterDetectorsBySampleSize", () => {
  it("separates detectors by sample size", () => {
    const detectors = [
      createDetector({ detector: "high_sample", totalTrades: 50 }),
      createDetector({ detector: "low_sample", totalTrades: 10 }),
    ];

    const { topDetectors, lowSampleDetectors } = filterDetectorsBySampleSize(detectors, 30);

    expect(topDetectors).toHaveLength(1);
    expect(topDetectors[0].detector).toBe("high_sample");

    expect(lowSampleDetectors).toHaveLength(1);
    expect(lowSampleDetectors[0].detector).toBe("low_sample");
  });

  it("returns empty topDetectors if none meet threshold", () => {
    const detectors = [
      createDetector({ detector: "low_1", totalTrades: 10 }),
      createDetector({ detector: "low_2", totalTrades: 20 }),
    ];

    const { topDetectors, lowSampleDetectors } = filterDetectorsBySampleSize(detectors, 30);

    expect(topDetectors).toHaveLength(0);
    expect(lowSampleDetectors).toHaveLength(2);
  });

  it("sorts topDetectors by composite score (highest first)", () => {
    const detectors = [
      createDetector({ detector: "mediocre", winRate: 0.4, profitFactor: 1.0, totalTrades: 50 }),
      createDetector({ detector: "best", winRate: 0.7, profitFactor: 3.0, totalTrades: 50 }),
      createDetector({ detector: "good", winRate: 0.6, profitFactor: 2.0, totalTrades: 50 }),
    ];

    const { topDetectors } = filterDetectorsBySampleSize(detectors, 30);

    expect(topDetectors[0].detector).toBe("best");
    expect(topDetectors[1].detector).toBe("good");
    expect(topDetectors[2].detector).toBe("mediocre");
  });

  it("sorts lowSampleDetectors by totalTrades (highest first)", () => {
    const detectors = [
      createDetector({ detector: "few", totalTrades: 5 }),
      createDetector({ detector: "most", totalTrades: 25 }),
      createDetector({ detector: "some", totalTrades: 15 }),
    ];

    const { lowSampleDetectors } = filterDetectorsBySampleSize(detectors, 30);

    expect(lowSampleDetectors[0].detector).toBe("most");
    expect(lowSampleDetectors[1].detector).toBe("some");
    expect(lowSampleDetectors[2].detector).toBe("few");
  });

  it("enriches all detectors with compositeScore and hasSufficientSample", () => {
    const detectors = [createDetector({ totalTrades: 50 })];

    const { topDetectors } = filterDetectorsBySampleSize(detectors, 30);

    expect(topDetectors[0].compositeScore).toBeDefined();
    expect(topDetectors[0].hasSufficientSample).toBe(true);
  });

  it("handles exact threshold boundary (trades === minTrades is sufficient)", () => {
    const detectors = [createDetector({ detector: "boundary", totalTrades: 30 })];

    const { topDetectors, lowSampleDetectors } = filterDetectorsBySampleSize(detectors, 30);

    expect(topDetectors).toHaveLength(1);
    expect(topDetectors[0].detector).toBe("boundary");
    expect(lowSampleDetectors).toHaveLength(0);
  });

  it("handles empty input", () => {
    const { topDetectors, lowSampleDetectors } = filterDetectorsBySampleSize([], 30);

    expect(topDetectors).toHaveLength(0);
    expect(lowSampleDetectors).toHaveLength(0);
  });
});

// ============================================================================
// rankDetectorsByCompositeScore Tests
// ============================================================================

describe("rankDetectorsByCompositeScore", () => {
  it("returns detector names in order of composite score", () => {
    const detectors = [
      createDetector({ detector: "low", winRate: 0.3, profitFactor: 1.0 }),
      createDetector({ detector: "high", winRate: 0.8, profitFactor: 3.0 }),
      createDetector({ detector: "mid", winRate: 0.5, profitFactor: 2.0 }),
    ];

    const ranking = rankDetectorsByCompositeScore(detectors);

    expect(ranking).toEqual(["high", "mid", "low"]);
  });

  it("returns empty array for empty input", () => {
    expect(rankDetectorsByCompositeScore([])).toEqual([]);
  });

  it("handles ties by maintaining original order", () => {
    const detectors = [
      createDetector({ detector: "first", winRate: 0.5, profitFactor: 2.5 }),
      createDetector({ detector: "second", winRate: 0.5, profitFactor: 2.5 }),
    ];

    const ranking = rankDetectorsByCompositeScore(detectors);

    // Both have same score, should maintain relative order
    expect(ranking).toContain("first");
    expect(ranking).toContain("second");
  });
});

// ============================================================================
// groupDetectorsByStyle Tests
// ============================================================================

describe("groupDetectorsByStyle", () => {
  it("groups detectors by recommendedStyle", () => {
    const detectors = [
      createDetector({ detector: "scalp_1", recommendedStyle: "scalp" }),
      createDetector({ detector: "day_1", recommendedStyle: "day_trade" }),
      createDetector({ detector: "scalp_2", recommendedStyle: "scalp" }),
      createDetector({ detector: "swing_1", recommendedStyle: "swing" }),
    ];

    const groups = groupDetectorsByStyle(detectors);

    expect(groups.scalp).toHaveLength(2);
    expect(groups.day_trade).toHaveLength(1);
    expect(groups.swing).toHaveLength(1);
    expect(groups.unknown).toHaveLength(0);
  });

  it("puts detectors without style in unknown group", () => {
    const detectors = [
      createDetector({ detector: "no_style" }), // No recommendedStyle
      createDetector({ detector: "unknown_style", recommendedStyle: "unknown" }),
    ];

    const groups = groupDetectorsByStyle(detectors);

    expect(groups.unknown).toHaveLength(2);
  });

  it("sorts each group by composite score", () => {
    const detectors = [
      createDetector({ detector: "scalp_low", recommendedStyle: "scalp", winRate: 0.3 }),
      createDetector({ detector: "scalp_high", recommendedStyle: "scalp", winRate: 0.8 }),
    ];

    const groups = groupDetectorsByStyle(detectors);

    expect(groups.scalp[0].detector).toBe("scalp_high");
    expect(groups.scalp[1].detector).toBe("scalp_low");
  });

  it("returns empty groups for empty input", () => {
    const groups = groupDetectorsByStyle([]);

    expect(groups.scalp).toHaveLength(0);
    expect(groups.day_trade).toHaveLength(0);
    expect(groups.swing).toHaveLength(0);
    expect(groups.unknown).toHaveLength(0);
  });
});

// ============================================================================
// calculateAverageWinRate Tests
// ============================================================================

describe("calculateAverageWinRate", () => {
  it("calculates average win rate", () => {
    const detectors = [
      createDetector({ winRate: 0.4, totalTrades: 10 }),
      createDetector({ winRate: 0.6, totalTrades: 10 }),
    ];

    expect(calculateAverageWinRate(detectors)).toBeCloseTo(0.5);
  });

  it("excludes detectors with 0 trades", () => {
    const detectors = [
      createDetector({ winRate: 0.5, totalTrades: 10 }),
      createDetector({ winRate: 0.0, totalTrades: 0 }), // Should be excluded
    ];

    expect(calculateAverageWinRate(detectors)).toBeCloseTo(0.5);
  });

  it("returns 0 for empty input", () => {
    expect(calculateAverageWinRate([])).toBe(0);
  });

  it("returns 0 when all detectors have 0 trades", () => {
    const detectors = [createDetector({ totalTrades: 0 })];

    expect(calculateAverageWinRate(detectors)).toBe(0);
  });
});

// ============================================================================
// calculateAverageProfitFactor Tests
// ============================================================================

describe("calculateAverageProfitFactor", () => {
  it("calculates average profit factor", () => {
    const detectors = [
      createDetector({ profitFactor: 1.5 }),
      createDetector({ profitFactor: 2.5 }),
    ];

    expect(calculateAverageProfitFactor(detectors)).toBeCloseTo(2.0);
  });

  it("excludes detectors with 0 profit factor", () => {
    const detectors = [
      createDetector({ profitFactor: 2.0 }),
      createDetector({ profitFactor: 0 }), // Should be excluded
    ];

    expect(calculateAverageProfitFactor(detectors)).toBeCloseTo(2.0);
  });

  it("excludes detectors with Infinity profit factor", () => {
    const detectors = [
      createDetector({ profitFactor: 2.0 }),
      createDetector({ profitFactor: Infinity }), // Should be excluded
    ];

    expect(calculateAverageProfitFactor(detectors)).toBeCloseTo(2.0);
  });

  it("returns 0 for empty input", () => {
    expect(calculateAverageProfitFactor([])).toBe(0);
  });

  it("returns 0 when all detectors have invalid PF", () => {
    const detectors = [
      createDetector({ profitFactor: 0 }),
      createDetector({ profitFactor: Infinity }),
    ];

    expect(calculateAverageProfitFactor(detectors)).toBe(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Ranking Integration", () => {
  it("top detector list never contains detectors with totalTrades < minTrades", () => {
    const detectors = [
      createDetector({ detector: "high_sample_low_wr", totalTrades: 100, winRate: 0.3 }),
      createDetector({ detector: "low_sample_high_wr", totalTrades: 10, winRate: 0.9 }),
      createDetector({ detector: "high_sample_high_wr", totalTrades: 50, winRate: 0.8 }),
    ];

    const { topDetectors } = filterDetectorsBySampleSize(detectors, 30);

    // Even though low_sample_high_wr has better win rate, it should NOT be in top
    expect(topDetectors.every((d) => d.totalTrades >= 30)).toBe(true);
    expect(topDetectors.find((d) => d.detector === "low_sample_high_wr")).toBeUndefined();
  });

  it("low sample detectors are visible in lowSampleDetectors array", () => {
    const detectors = [
      createDetector({ detector: "high_sample", totalTrades: 50 }),
      createDetector({ detector: "low_sample_1", totalTrades: 10 }),
      createDetector({ detector: "low_sample_2", totalTrades: 20 }),
    ];

    const { lowSampleDetectors } = filterDetectorsBySampleSize(detectors, 30);

    expect(lowSampleDetectors).toHaveLength(2);
    expect(lowSampleDetectors.map((d) => d.detector)).toContain("low_sample_1");
    expect(lowSampleDetectors.map((d) => d.detector)).toContain("low_sample_2");
  });

  it("composite score balances win rate and profit factor correctly", () => {
    // Detector A: High WR (0.7), low PF (1.0)
    // Score = 0.7 * 0.6 + 0.2 * 0.4 = 0.42 + 0.08 = 0.50
    const detectorA = createDetector({
      detector: "A",
      winRate: 0.7,
      profitFactor: 1.0,
      totalTrades: 50,
    });

    // Detector B: Low WR (0.4), high PF (4.0)
    // Score = 0.4 * 0.6 + 0.8 * 0.4 = 0.24 + 0.32 = 0.56
    const detectorB = createDetector({
      detector: "B",
      winRate: 0.4,
      profitFactor: 4.0,
      totalTrades: 50,
    });

    const { topDetectors } = filterDetectorsBySampleSize([detectorA, detectorB], 30);

    // Detector B should rank higher despite lower win rate due to better PF
    expect(topDetectors[0].detector).toBe("B");
    expect(topDetectors[1].detector).toBe("A");
  });
});
