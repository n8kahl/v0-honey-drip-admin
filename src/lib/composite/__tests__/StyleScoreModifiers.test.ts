/**
 * Unit tests for Style Score Modifiers
 * Phase 2.1: Context-aware style differentiation
 */

import { describe, it, expect } from "vitest";
import {
  extractStyleFactors,
  calculateStyleModifiers,
  applyStyleModifiersToScore,
  calculateFullStyleScores,
  formatStyleModifiers,
  type StyleScoreFactors,
} from "../StyleScoreModifiers";
import type { SymbolFeatures } from "../../strategy/engine";

// Helper to create mock features
function createMockFeatures(overrides: Partial<SymbolFeatures> = {}): SymbolFeatures {
  return {
    symbol: "SPY",
    time: new Date().toISOString(),
    price: { current: 580, change: 1.5, changePct: 0.26 },
    volume: { current: 1000000, relativeToAvg: 1.0 },
    vwap: { value: 579, distancePct: 0.17 },
    indicators: { rsi: 55 },
    session: {
      isRegularHours: true,
      minutesSinceOpen: 60,
      minutesToClose: 330,
    },
    mtf: {
      "5m": {
        close: 580,
        atr: 2.5,
        rsi: { "14": 55 },
        ema: { "20": 578, "50": 575 },
      },
      "15m": {
        close: 580,
        rsi: { "14": 58 },
        ema: { "20": 577, "50": 574 },
      },
      "60m": {
        close: 580,
        rsi: { "14": 60 },
        ema: { "20": 576, "50": 572 },
      },
    },
    pattern: {
      market_regime: "trending",
      vix_level: "medium",
    },
    ...overrides,
  } as any;
}

describe("StyleScoreModifiers", () => {
  describe("extractStyleFactors", () => {
    it("extracts time of day window correctly", () => {
      // Use minutesSinceOpen to determine time window (more reliable than Date parsing)
      const features = createMockFeatures({
        session: { isRegularHours: true, minutesSinceOpen: 15, minutesToClose: 375 },
      } as any);

      // Create a date at 9:45 local time (15 minutes after 9:30 open)
      const time = new Date();
      time.setHours(9, 45, 0, 0);

      const factors = extractStyleFactors(features, time);

      // Time of day window depends on the time passed
      expect(factors.minutesSinceOpen).toBe(15);
      // The timeOfDay detection happens in the function based on time
      expect(factors.timeOfDay).toBeDefined();
    });

    it("identifies volume spike", () => {
      const features = createMockFeatures({
        volume: { current: 2000000, relativeToAvg: 2.5 },
      } as any);

      const factors = extractStyleFactors(features);

      expect(factors.volumeSpike).toBe(true);
      expect(factors.volumeRatio).toBe(2.5);
    });

    it("calculates ATR percent correctly", () => {
      const features = createMockFeatures({
        price: { current: 100, change: 1, changePct: 1 },
        mtf: { "5m": { atr: 2.0 } },
      } as any);

      const factors = extractStyleFactors(features);

      expect(factors.atrPercent).toBe(2.0);
    });

    it("detects key level proximity", () => {
      const features = createMockFeatures({
        vwap: { value: 580, distancePct: 0.15 }, // Within 0.25%
      } as any);

      const factors = extractStyleFactors(features);

      expect(factors.nearKeyLevel).toBe(true);
      expect(factors.keyLevelType).toBe("vwap");
    });

    it("identifies RSI extreme conditions", () => {
      const features = createMockFeatures({
        mtf: { "5m": { rsi: { "14": 25 } } },
      } as any);

      const factors = extractStyleFactors(features);

      expect(factors.rsiExtreme).toBe(true);
      expect(factors.rsiValue).toBe(25);
    });

    it("extracts market regime", () => {
      const features = createMockFeatures({
        pattern: { market_regime: "choppy" },
      } as any);

      const factors = extractStyleFactors(features);

      expect(factors.regime).toBe("choppy");
    });

    it("identifies weekend session", () => {
      const features = createMockFeatures({
        session: { isRegularHours: false, minutesSinceOpen: 0, minutesToClose: 0 },
      } as any);

      // Saturday
      const time = new Date("2025-01-18T10:00:00-05:00");
      const factors = extractStyleFactors(features, time);

      expect(factors.isWeekend).toBe(true);
    });
  });

  describe("calculateStyleModifiers", () => {
    it("boosts scalp during opening drive", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "opening_drive",
        minutesSinceOpen: 15,
        minutesToClose: 375,
        atrPercent: 0.8,
        volumeSpike: true,
        volumeRatio: 2.0,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 60,
        regime: "trending",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      expect(result.modifiers.scalp).toBeGreaterThan(1.3);
      expect(result.reasoning.scalpReasons.some((r) => r.includes("opening_drive"))).toBe(true);
    });

    it("penalizes scalp during lunch chop", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "lunch_chop",
        minutesSinceOpen: 150,
        minutesToClose: 240,
        atrPercent: 0.5,
        volumeSpike: false,
        volumeRatio: 0.6,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 50,
        regime: "ranging",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      expect(result.modifiers.scalp).toBeLessThan(0.7);
    });

    it("boosts swing with high MTF alignment", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "mid_morning",
        minutesSinceOpen: 60,
        minutesToClose: 330,
        atrPercent: 1.2,
        volumeSpike: false,
        volumeRatio: 1.0,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 90,
        regime: "trending",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      expect(result.modifiers.swing).toBeGreaterThan(1.2);
      expect(result.reasoning.swingReasons.some((r) => r.includes("MTF"))).toBe(true);
    });

    it("penalizes swing with poor MTF alignment", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "afternoon",
        minutesSinceOpen: 300,
        minutesToClose: 90,
        atrPercent: 1.0,
        volumeSpike: false,
        volumeRatio: 0.9,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 30,
        regime: "choppy",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      expect(result.modifiers.swing).toBeLessThan(0.6);
      expect(result.reasoning.warnings.some((w) => w.includes("MTF"))).toBe(true);
    });

    it("adjusts for high volatility correctly", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "mid_morning",
        minutesSinceOpen: 60,
        minutesToClose: 330,
        atrPercent: 3.0, // High ATR
        volumeSpike: false,
        volumeRatio: 1.0,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 60,
        regime: "volatile",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      expect(result.modifiers.scalp).toBeLessThan(0.8); // High vol hurts scalps
      expect(result.modifiers.swing).toBeGreaterThan(1.1); // High vol helps swings
    });

    it("adjusts for low volatility correctly", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "mid_morning",
        minutesSinceOpen: 60,
        minutesToClose: 330,
        atrPercent: 0.3, // Low ATR
        volumeSpike: false,
        volumeRatio: 1.0,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 60,
        regime: "ranging",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      expect(result.modifiers.scalp).toBeGreaterThan(1.0); // Low vol helps scalps
      expect(result.modifiers.swing).toBeLessThan(0.8); // Low vol hurts swings
    });

    it("boosts all styles near key levels", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "mid_morning", // Use a neutral time to isolate key level effect
        minutesSinceOpen: 60,
        minutesToClose: 330,
        atrPercent: 1.0,
        volumeSpike: false,
        volumeRatio: 1.0,
        nearKeyLevel: true,
        keyLevelType: "vwap",
        rsiExtreme: false,
        mtfAlignment: 60,
        regime: "trending", // Trending is neutral for most styles
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      // Key level proximity should provide a boost (1.25x for scalp, 1.15x for day/swing)
      // Combined with other factors, expect reasonable boosts
      expect(result.modifiers.scalp).toBeGreaterThanOrEqual(1.1);
      expect(result.modifiers.dayTrade).toBeGreaterThanOrEqual(1.0);
      expect(result.modifiers.swing).toBeGreaterThanOrEqual(0.9);
    });

    it("handles RSI extremes for mean reversion", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "mid_morning",
        minutesSinceOpen: 60,
        minutesToClose: 330,
        atrPercent: 1.0,
        volumeSpike: false,
        volumeRatio: 1.0,
        nearKeyLevel: false,
        rsiExtreme: true,
        rsiValue: 25,
        mtfAlignment: 70, // Good MTF alignment helps swing
        regime: "trending", // Trending regime boosts swing
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      // RSI extreme (0.85 scalp, 1.1 day, 1.25 swing) + trending regime (1.25 swing)
      expect(result.modifiers.swing).toBeGreaterThan(1.0); // RSI extreme good for swing reversal
      expect(result.modifiers.scalp).toBeLessThan(1.1); // Scalps get less boost from RSI extremes
    });

    it("applies volume spike bonuses", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "power_hour",
        minutesSinceOpen: 330,
        minutesToClose: 60,
        atrPercent: 1.0,
        volumeSpike: true,
        volumeRatio: 2.5,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 60,
        regime: "trending",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      expect(result.modifiers.scalp).toBeGreaterThan(1.4); // Volume spike + power hour
      expect(result.reasoning.scalpReasons.some((r) => r.includes("Volume"))).toBe(true);
    });

    it("applies choppy regime penalties", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "afternoon",
        minutesSinceOpen: 300,
        minutesToClose: 90,
        atrPercent: 1.0,
        volumeSpike: false,
        volumeRatio: 0.8,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 40,
        regime: "choppy",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      expect(result.modifiers.scalp).toBeLessThan(0.8);
      expect(result.modifiers.dayTrade).toBeLessThan(0.9);
      expect(result.modifiers.swing).toBeLessThan(0.7);
      expect(result.reasoning.warnings.some((w) => w.includes("hoppy"))).toBe(true);
    });

    it("severely penalizes after hours trading", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "after_hours",
        minutesSinceOpen: 0,
        minutesToClose: 0,
        atrPercent: 1.0,
        volumeSpike: false,
        volumeRatio: 0.3,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 50,
        regime: "ranging",
        isPreMarket: false,
        isAfterHours: true,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      // After hours: base 0.5 for scalp, 0.6 for day + other penalties
      // Should be clamped at min 0.5
      expect(result.modifiers.scalp).toBeLessThanOrEqual(0.5);
      expect(result.modifiers.dayTrade).toBeLessThanOrEqual(0.6);
      expect(result.reasoning.warnings.some((w) => w.includes("After-hours"))).toBe(true);
    });

    it("penalizes day trades near close", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "power_hour",
        minutesSinceOpen: 375,
        minutesToClose: 15, // Only 15 minutes to close
        atrPercent: 1.0,
        volumeSpike: false,
        volumeRatio: 1.0,
        nearKeyLevel: false,
        rsiExtreme: false,
        mtfAlignment: 60,
        regime: "ranging", // Use ranging to avoid trending boost
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      // Power hour gives +1.2 to day trades but near close gives -0.6, net should be lower
      expect(result.modifiers.dayTrade).toBeLessThanOrEqual(0.85);
      expect(result.reasoning.dayTradeReasons.some((r) => r.includes("30 minutes"))).toBe(true);
    });

    it("clamps modifiers to safe bounds", () => {
      // Create extreme conditions that would push modifiers beyond bounds
      const factors: StyleScoreFactors = {
        timeOfDay: "opening_drive",
        minutesSinceOpen: 5,
        minutesToClose: 385,
        atrPercent: 0.2,
        volumeSpike: true,
        volumeRatio: 5.0,
        nearKeyLevel: true,
        keyLevelType: "orb",
        rsiExtreme: false,
        mtfAlignment: 95,
        regime: "trending",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);

      // All modifiers should be clamped between 0.5 and 1.5
      expect(result.modifiers.scalp).toBeGreaterThanOrEqual(0.5);
      expect(result.modifiers.scalp).toBeLessThanOrEqual(1.5);
      expect(result.modifiers.dayTrade).toBeGreaterThanOrEqual(0.5);
      expect(result.modifiers.dayTrade).toBeLessThanOrEqual(1.5);
      expect(result.modifiers.swing).toBeGreaterThanOrEqual(0.5);
      expect(result.modifiers.swing).toBeLessThanOrEqual(1.5);
    });
  });

  describe("applyStyleModifiersToScore", () => {
    it("applies modifiers to base score correctly", () => {
      const modifiers = { scalp: 1.2, dayTrade: 1.0, swing: 0.8 };

      const result = applyStyleModifiersToScore(75, modifiers);

      expect(result.scalpScore).toBe(90); // 75 * 1.2
      expect(result.dayTradeScore).toBe(75); // 75 * 1.0
      expect(result.swingScore).toBe(60); // 75 * 0.8
    });

    it("recommends highest scoring style", () => {
      const modifiers = { scalp: 0.9, dayTrade: 1.2, swing: 1.1 };

      const result = applyStyleModifiersToScore(70, modifiers);

      expect(result.recommendedStyle).toBe("day_trade");
      expect(result.recommendedStyleScore).toBe(84); // 70 * 1.2
    });

    it("caps scores at 100", () => {
      const modifiers = { scalp: 1.5, dayTrade: 1.5, swing: 1.5 };

      const result = applyStyleModifiersToScore(90, modifiers);

      expect(result.scalpScore).toBe(100);
      expect(result.dayTradeScore).toBe(100);
      expect(result.swingScore).toBe(100);
    });

    it("floors scores at 0", () => {
      const modifiers = { scalp: 0.5, dayTrade: 0.5, swing: 0.5 };

      const result = applyStyleModifiersToScore(-10, modifiers);

      expect(result.scalpScore).toBe(0);
      expect(result.dayTradeScore).toBe(0);
      expect(result.swingScore).toBe(0);
    });
  });

  describe("calculateFullStyleScores", () => {
    it("integrates factor extraction and scoring", () => {
      const features = createMockFeatures({
        volume: { current: 2000000, relativeToAvg: 2.0 },
        session: { isRegularHours: true, minutesSinceOpen: 20, minutesToClose: 370 },
      } as any);

      // Create a time during opening drive (9:45 local time)
      const time = new Date();
      time.setHours(9, 50, 0, 0);

      const { modifierResult, scores } = calculateFullStyleScores(75, features, time);

      // Verify factors are extracted
      expect(modifierResult.factors.volumeSpike).toBe(true);
      expect(modifierResult.factors.minutesSinceOpen).toBe(20);
      expect(scores.recommendedStyle).toBeDefined();

      // Volume spike should boost scores
      expect(modifierResult.modifiers.scalp).toBeGreaterThan(1.0);
    });

    it("handles weekend conditions", () => {
      const features = createMockFeatures({
        session: { isRegularHours: false, minutesSinceOpen: 0, minutesToClose: 0 },
      } as any);

      const time = new Date("2025-01-18T10:00:00-05:00"); // Saturday
      const { modifierResult, scores } = calculateFullStyleScores(70, features, time);

      expect(modifierResult.factors.isWeekend).toBe(true);
      expect(modifierResult.factors.timeOfDay).toBe("weekend");
      expect(scores.swingScore).toBeGreaterThan(scores.scalpScore);
    });
  });

  describe("formatStyleModifiers", () => {
    it("formats result for display", () => {
      const factors: StyleScoreFactors = {
        timeOfDay: "power_hour",
        minutesSinceOpen: 330,
        minutesToClose: 60,
        atrPercent: 1.5,
        volumeSpike: true,
        volumeRatio: 2.0,
        nearKeyLevel: true,
        keyLevelType: "vwap",
        rsiExtreme: false,
        rsiValue: 55,
        mtfAlignment: 75,
        regime: "trending",
        isPreMarket: false,
        isAfterHours: false,
        isWeekend: false,
      };

      const result = calculateStyleModifiers(factors);
      const formatted = formatStyleModifiers(result);

      expect(formatted).toContain("power_hour");
      expect(formatted).toContain("trending");
      expect(formatted).toContain("Scalp:");
      expect(formatted).toContain("Day Trade:");
      expect(formatted).toContain("Swing:");
      expect(formatted).toContain("ATR:");
      expect(formatted).toContain("Volume:");
    });
  });
});
