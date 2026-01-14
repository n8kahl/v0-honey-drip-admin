/**
 * Edge Stats Cache Tests
 *
 * Tests for edge multiplier calculation and score adjustment
 */

import { describe, it, expect } from "vitest";
import {
  calculateEdgeMultiplier,
  shouldHardFilter,
  applyEdgeToScore,
  getStatsKey,
  type EdgeStats,
} from "../edgeStatsCache.js";

describe("getStatsKey", () => {
  it("combines opportunity type and style", () => {
    expect(getStatsKey("breakout_bullish", "scalp")).toBe("breakout_bullish:scalp");
    expect(getStatsKey("mean_reversion_long", "day_trade")).toBe("mean_reversion_long:day_trade");
  });
});

describe("calculateEdgeMultiplier", () => {
  describe("no historical data", () => {
    it("returns multiplier 1.0 for null stats", () => {
      const result = calculateEdgeMultiplier(null);

      expect(result.multiplier).toBe(1.0);
      expect(result.confidence).toBe("low");
      expect(result.reason).toContain("Insufficient");
    });

    it("returns multiplier 1.0 for sample size < 5", () => {
      const stats: EdgeStats = {
        winRate: 70,
        profitFactor: 2.0,
        avgRiskReward: 2.5,
        sampleSize: 4,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBe(1.0);
      expect(result.confidence).toBe("low");
    });
  });

  describe("low sample size (5-19)", () => {
    it("gives small boost for early strong positive edge", () => {
      const stats: EdgeStats = {
        winRate: 65,
        profitFactor: 1.5,
        avgRiskReward: 2.0,
        sampleSize: 15,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBe(1.05);
      expect(result.confidence).toBe("low");
      expect(result.reason).toContain("Early positive");
    });

    it("gives small penalty for early negative edge", () => {
      const stats: EdgeStats = {
        winRate: 30,
        profitFactor: 0.5,
        avgRiskReward: 1.5,
        sampleSize: 15,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBe(0.95);
      expect(result.confidence).toBe("low");
      expect(result.reason).toContain("Early negative");
    });

    it("returns neutral for moderate edge with low samples", () => {
      const stats: EdgeStats = {
        winRate: 50,
        profitFactor: 1.0,
        avgRiskReward: 2.0,
        sampleSize: 15,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBe(1.0);
      expect(result.confidence).toBe("low");
      expect(result.reason).toContain("Building sample");
    });
  });

  describe("medium sample size (20-39)", () => {
    it("boosts for positive edge", () => {
      const stats: EdgeStats = {
        winRate: 60,
        profitFactor: 1.4,
        avgRiskReward: 2.0,
        sampleSize: 30,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBeGreaterThan(1.0);
      expect(result.multiplier).toBeLessThanOrEqual(1.15);
      expect(result.confidence).toBe("medium");
      expect(result.reason).toContain("Positive edge");
    });

    it("penalizes for negative edge", () => {
      const stats: EdgeStats = {
        winRate: 40,
        profitFactor: 0.8,
        avgRiskReward: 1.5,
        sampleSize: 30,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBeLessThan(1.0);
      expect(result.multiplier).toBeGreaterThanOrEqual(0.85);
      expect(result.confidence).toBe("medium");
      expect(result.reason).toContain("Negative edge");
    });
  });

  describe("high sample size (40+)", () => {
    it("gives strong boost for high win rate and profit factor", () => {
      const stats: EdgeStats = {
        winRate: 65,
        profitFactor: 1.8,
        avgRiskReward: 2.5,
        sampleSize: 50,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBeGreaterThan(1.1);
      expect(result.multiplier).toBeLessThanOrEqual(1.3);
      expect(result.confidence).toBe("high");
      expect(result.reason).toContain("Strong positive");
    });

    it("gives strong penalty for low win rate", () => {
      const stats: EdgeStats = {
        winRate: 35,
        profitFactor: 0.7,
        avgRiskReward: 1.5,
        sampleSize: 50,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBeLessThan(0.9);
      expect(result.multiplier).toBeGreaterThanOrEqual(0.7);
      expect(result.confidence).toBe("high");
      expect(result.reason).toContain("Negative edge");
    });

    it("gives strong penalty for low profit factor", () => {
      const stats: EdgeStats = {
        winRate: 50,
        profitFactor: 0.6,
        avgRiskReward: 1.5,
        sampleSize: 50,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBeLessThan(1.0);
      expect(result.confidence).toBe("high");
    });

    it("returns neutral-ish for borderline stats", () => {
      const stats: EdgeStats = {
        winRate: 50,
        profitFactor: 1.0,
        avgRiskReward: 2.0,
        sampleSize: 50,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBeCloseTo(1.0, 1);
      expect(result.confidence).toBe("high");
    });

    it("caps multiplier at 1.3", () => {
      const stats: EdgeStats = {
        winRate: 80,
        profitFactor: 3.0,
        avgRiskReward: 3.0,
        sampleSize: 100,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBeLessThanOrEqual(1.3);
    });

    it("floors multiplier at 0.7", () => {
      const stats: EdgeStats = {
        winRate: 20,
        profitFactor: 0.3,
        avgRiskReward: 1.0,
        sampleSize: 100,
      };

      const result = calculateEdgeMultiplier(stats);

      expect(result.multiplier).toBeGreaterThanOrEqual(0.7);
    });
  });
});

describe("shouldHardFilter", () => {
  it("does not filter when stats are null", () => {
    const result = shouldHardFilter(null);

    expect(result.filter).toBe(false);
  });

  it("does not filter when sample size < 40", () => {
    const stats: EdgeStats = {
      winRate: 30,
      profitFactor: 0.5,
      avgRiskReward: 1.0,
      sampleSize: 35,
    };

    const result = shouldHardFilter(stats);

    expect(result.filter).toBe(false);
  });

  it("filters when profit factor < 0.9 with high samples", () => {
    const stats: EdgeStats = {
      winRate: 50,
      profitFactor: 0.85,
      avgRiskReward: 1.5,
      sampleSize: 50,
    };

    const result = shouldHardFilter(stats);

    expect(result.filter).toBe(true);
    expect(result.reason).toContain("LOW_EDGE");
    expect(result.reason).toContain("Profit factor");
  });

  it("filters when win rate < 45% with high samples", () => {
    const stats: EdgeStats = {
      winRate: 40,
      profitFactor: 1.0,
      avgRiskReward: 2.0,
      sampleSize: 50,
    };

    const result = shouldHardFilter(stats);

    expect(result.filter).toBe(true);
    expect(result.reason).toContain("LOW_EDGE");
    expect(result.reason).toContain("Win rate");
  });

  it("does not filter acceptable edge with high samples", () => {
    const stats: EdgeStats = {
      winRate: 55,
      profitFactor: 1.2,
      avgRiskReward: 2.0,
      sampleSize: 50,
    };

    const result = shouldHardFilter(stats);

    expect(result.filter).toBe(false);
  });
});

describe("applyEdgeToScore", () => {
  it("returns neutral edge for null stats", () => {
    const result = applyEdgeToScore(80, null);

    expect(result.edgeMultiplier).toBe(1.0);
    expect(result.adjustedScore).toBe(80);
    expect(result.isLowEdge).toBe(false);
    expect(result.confidence).toBe("low");
    expect(result.sampleSize).toBe(0);
  });

  it("applies boost to adjusted score", () => {
    const stats: EdgeStats = {
      winRate: 65,
      profitFactor: 1.8,
      avgRiskReward: 2.5,
      sampleSize: 50,
    };

    const result = applyEdgeToScore(80, stats);

    expect(result.adjustedScore).toBeGreaterThan(80);
    expect(result.edgeMultiplier).toBeGreaterThan(1.0);
    expect(result.winRate).toBe(65);
    expect(result.profitFactor).toBe(1.8);
    expect(result.sampleSize).toBe(50);
    expect(result.isLowEdge).toBe(false);
  });

  it("applies penalty to adjusted score", () => {
    const stats: EdgeStats = {
      winRate: 35,
      profitFactor: 0.7,
      avgRiskReward: 1.5,
      sampleSize: 50,
    };

    const result = applyEdgeToScore(80, stats);

    expect(result.adjustedScore).toBeLessThan(80);
    expect(result.edgeMultiplier).toBeLessThan(1.0);
    expect(result.isLowEdge).toBe(true);
    expect(result.filterReason).toContain("LOW_EDGE");
  });

  it("caps adjusted score at 100", () => {
    const stats: EdgeStats = {
      winRate: 80,
      profitFactor: 3.0,
      avgRiskReward: 3.0,
      sampleSize: 100,
    };

    const result = applyEdgeToScore(95, stats);

    expect(result.adjustedScore).toBeLessThanOrEqual(100);
  });

  it("floors adjusted score at 0", () => {
    const stats: EdgeStats = {
      winRate: 20,
      profitFactor: 0.3,
      avgRiskReward: 1.0,
      sampleSize: 100,
    };

    const result = applyEdgeToScore(10, stats);

    expect(result.adjustedScore).toBeGreaterThanOrEqual(0);
  });

  it("rounds values to 2 decimal places", () => {
    const stats: EdgeStats = {
      winRate: 55.555,
      profitFactor: 1.234567,
      avgRiskReward: 2.0,
      sampleSize: 30,
    };

    const result = applyEdgeToScore(75, stats);

    // Check edgeMultiplier is rounded
    expect(result.edgeMultiplier.toString().split(".")[1]?.length || 0).toBeLessThanOrEqual(2);
    // Check adjustedScore is rounded
    expect(result.adjustedScore.toString().split(".")[1]?.length || 0).toBeLessThanOrEqual(2);
  });

  it("sets isLowEdge and filterReason for filtered signals", () => {
    const stats: EdgeStats = {
      winRate: 40,
      profitFactor: 0.8,
      avgRiskReward: 1.5,
      sampleSize: 50,
    };

    const result = applyEdgeToScore(80, stats);

    expect(result.isLowEdge).toBe(true);
    expect(result.filterReason).toBeDefined();
    expect(result.filterReason).toContain("LOW_EDGE");
  });

  it("does not set filterReason for acceptable signals", () => {
    const stats: EdgeStats = {
      winRate: 55,
      profitFactor: 1.3,
      avgRiskReward: 2.0,
      sampleSize: 50,
    };

    const result = applyEdgeToScore(80, stats);

    expect(result.isLowEdge).toBe(false);
    expect(result.filterReason).toBeUndefined();
  });
});
