/**
 * Unit tests for Adaptive Thresholds
 * Phase 1.1: Time-of-day, VIX, and Regime-aware threshold adjustments
 */

import { describe, it, expect } from "vitest";
import {
  getAdaptiveThresholds,
  getTimeWindow,
  categorizeStrategy,
  passesAdaptiveThresholds,
  getWeekendThresholds,
  formatAdaptiveThresholds,
  DEFAULT_ADAPTIVE_CONFIG,
  type TimeOfDayWindow,
  type VIXLevel,
  type MarketRegime,
  type StrategyCategory,
} from "../AdaptiveThresholds";

describe("AdaptiveThresholds", () => {
  describe("getTimeWindow", () => {
    it("returns opening_drive for 9:35 AM", () => {
      // 9:35 AM ET
      const date = new Date("2025-01-15T09:35:00-05:00");
      const window = getTimeWindow(date, DEFAULT_ADAPTIVE_CONFIG);
      expect(window?.name).toBe("opening_drive");
    });

    it("returns lunch_chop for 12:00 PM", () => {
      const date = new Date("2025-01-15T12:00:00-05:00");
      const window = getTimeWindow(date, DEFAULT_ADAPTIVE_CONFIG);
      expect(window?.name).toBe("lunch_chop");
    });

    it("returns power_hour for 3:30 PM", () => {
      const date = new Date("2025-01-15T15:30:00-05:00");
      const window = getTimeWindow(date, DEFAULT_ADAPTIVE_CONFIG);
      expect(window?.name).toBe("power_hour");
    });

    it("returns null for weekend", () => {
      // Saturday
      const date = new Date("2025-01-18T10:00:00-05:00");
      const window = getTimeWindow(date, DEFAULT_ADAPTIVE_CONFIG);
      expect(window).toBeNull();
    });

    it("returns after_hours for 5 PM", () => {
      const date = new Date("2025-01-15T17:00:00-05:00");
      const window = getTimeWindow(date, DEFAULT_ADAPTIVE_CONFIG);
      expect(window?.name).toBe("after_hours");
    });
  });

  describe("categorizeStrategy", () => {
    it("categorizes breakout_bullish as breakout", () => {
      expect(categorizeStrategy("breakout_bullish")).toBe("breakout");
    });

    it("categorizes mean_reversion_long as meanReversion", () => {
      expect(categorizeStrategy("mean_reversion_long")).toBe("meanReversion");
    });

    it("categorizes trend_continuation_long as trendContinuation", () => {
      expect(categorizeStrategy("trend_continuation_long")).toBe("trendContinuation");
    });

    it("categorizes gamma_squeeze_bullish as gamma", () => {
      expect(categorizeStrategy("gamma_squeeze_bullish")).toBe("gamma");
    });

    it("categorizes power_hour_reversal_bullish as reversal", () => {
      expect(categorizeStrategy("power_hour_reversal_bullish")).toBe("reversal");
    });
  });

  describe("getAdaptiveThresholds", () => {
    it("returns lower thresholds during opening drive", () => {
      const result = getAdaptiveThresholds(
        "2025-01-15T09:45:00-05:00",
        "medium",
        "trending",
        "breakout_bullish"
      );

      // Opening drive + trending + breakout = lower thresholds
      expect(result.minBase).toBeLessThan(75);
      expect(result.timeWindow).toBe("opening_drive");
      expect(result.strategyEnabled).toBe(true);
    });

    it("returns higher thresholds during lunch chop", () => {
      const result = getAdaptiveThresholds(
        "2025-01-15T12:30:00-05:00",
        "medium",
        "ranging",
        "breakout_bullish"
      );

      // Lunch + ranging + breakout = highest thresholds
      expect(result.minBase).toBeGreaterThan(80);
      expect(result.timeWindow).toBe("lunch_chop");
      expect(result.strategyEnabled).toBe(false); // Breakouts disabled in ranges
    });

    it("adjusts thresholds based on VIX level", () => {
      const lowVIX = getAdaptiveThresholds(
        "2025-01-15T10:30:00-05:00",
        "low",
        "trending",
        "breakout_bullish"
      );

      const highVIX = getAdaptiveThresholds(
        "2025-01-15T10:30:00-05:00",
        "high",
        "trending",
        "breakout_bullish"
      );

      // High VIX should have higher thresholds
      expect(highVIX.minBase).toBeGreaterThan(lowVIX.minBase);
      expect(highVIX.sizeMultiplier).toBeLessThan(lowVIX.sizeMultiplier);
    });

    it("disables breakouts in choppy regime", () => {
      const result = getAdaptiveThresholds(
        "2025-01-15T14:00:00-05:00",
        "medium",
        "choppy",
        "breakout_bullish"
      );

      expect(result.strategyEnabled).toBe(false);
      // Check that warnings array has at least one warning about the strategy being disabled
      expect(
        result.warnings.some((w) => w.includes("not recommended") || w.includes("disabled"))
      ).toBe(true);
    });

    it("enables mean reversion in ranging regime", () => {
      const result = getAdaptiveThresholds(
        "2025-01-15T14:00:00-05:00",
        "medium",
        "ranging",
        "mean_reversion_long"
      );

      expect(result.strategyEnabled).toBe(true);
      // Mean reversion is favorable in ranging regime, threshold should be reasonable
      expect(result.minBase).toBeLessThanOrEqual(75);
    });

    it("reduces size multiplier in extreme VIX", () => {
      const result = getAdaptiveThresholds(
        "2025-01-15T10:00:00-05:00",
        "extreme",
        "volatile",
        "breakout_bullish"
      );

      expect(result.sizeMultiplier).toBeLessThan(0.5);
      // Check for warning about position size or high volatility
      expect(
        result.warnings.some(
          (w) =>
            w.toLowerCase().includes("position size") ||
            w.toLowerCase().includes("volatility") ||
            w.toLowerCase().includes("threshold")
        )
      ).toBe(true);
    });

    it("handles worst case scenario correctly", () => {
      // Lunch chop + extreme VIX + choppy regime + breakout
      const result = getAdaptiveThresholds(
        "2025-01-15T12:30:00-05:00",
        "extreme",
        "choppy",
        "breakout_bullish"
      );

      expect(result.minBase).toBeGreaterThanOrEqual(90);
      expect(result.strategyEnabled).toBe(false);
      expect(result.sizeMultiplier).toBeLessThan(0.4);
    });

    it("provides breakdown for transparency", () => {
      const result = getAdaptiveThresholds(
        "2025-01-15T15:30:00-05:00",
        "high",
        "trending",
        "trend_continuation_long"
      );

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.baseFromTime).toBeDefined();
      expect(result.breakdown.baseFromVIX).toBeDefined();
      expect(result.breakdown.baseFromRegime).toBeDefined();
    });
  });

  describe("passesAdaptiveThresholds", () => {
    it("passes when all thresholds met", () => {
      const thresholds = getAdaptiveThresholds(
        "2025-01-15T10:00:00-05:00",
        "low",
        "trending",
        "breakout_bullish"
      );

      const signal = {
        baseScore: 80,
        recommendedStyleScore: 82,
        riskReward: 2.0,
      };

      const result = passesAdaptiveThresholds(signal, thresholds);
      expect(result.pass).toBe(true);
    });

    it("fails when base score too low", () => {
      const thresholds = getAdaptiveThresholds(
        "2025-01-15T12:00:00-05:00",
        "high",
        "choppy",
        "breakout_bullish"
      );

      const signal = {
        baseScore: 50, // Well below threshold
        recommendedStyleScore: 55,
        riskReward: 2.0,
      };

      const result = passesAdaptiveThresholds(signal, thresholds);
      // Should either fail on score or be disabled for regime
      expect(result.pass).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it("fails when strategy disabled for regime", () => {
      const thresholds = getAdaptiveThresholds(
        "2025-01-15T14:00:00-05:00",
        "medium",
        "choppy",
        "breakout_bullish"
      );

      const signal = {
        baseScore: 95,
        recommendedStyleScore: 95,
        riskReward: 3.0,
      };

      const result = passesAdaptiveThresholds(signal, thresholds);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain("disabled");
    });
  });

  describe("getWeekendThresholds", () => {
    it("returns conservative weekend thresholds", () => {
      const thresholds = getWeekendThresholds();

      expect(thresholds.minBase).toBeLessThan(70);
      expect(thresholds.sizeMultiplier).toBe(0); // No positions on weekend signals
    });
  });

  describe("formatAdaptiveThresholds", () => {
    it("formats thresholds for display", () => {
      const result = getAdaptiveThresholds(
        "2025-01-15T15:30:00-05:00",
        "high",
        "trending",
        "breakout_bullish"
      );

      const formatted = formatAdaptiveThresholds(result);

      expect(formatted).toContain("Power Hour");
      expect(formatted).toContain("HIGH");
      expect(formatted).toContain("trending");
      expect(formatted).toContain("Min Base Score");
    });
  });
});
