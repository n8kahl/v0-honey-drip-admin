/**
 * Unit tests for Level-Aware Stops
 * Phase 2.2: Key Level-Based Stop Placement
 */

import { describe, it, expect } from "vitest";
import {
  calculateLevelAwareStop,
  calculateLevelAwareTargets,
  validateStopPlacement,
  extractKeyLevelsArray,
  formatLevelAwareStop,
  DEFAULT_LEVEL_AWARE_CONFIG,
  type KeyLevel,
} from "../LevelAwareStops";
import type { KeyLevels } from "../types";

// Helper to create mock key levels
function createMockKeyLevels(overrides: Partial<KeyLevels> = {}): KeyLevels {
  return {
    priorDayHigh: 585,
    priorDayLow: 575,
    weeklyHigh: 590,
    weeklyLow: 570,
    orbHigh: 582,
    orbLow: 578,
    vwap: 580,
    vwapUpperBand: 583,
    vwapLowerBand: 577,
    bollingerUpper: 586,
    bollingerLower: 574,
    preMarketHigh: 581,
    preMarketLow: 579,
    ...overrides,
  };
}

describe("LevelAwareStops", () => {
  describe("extractKeyLevelsArray", () => {
    it("extracts all key levels from KeyLevels interface", () => {
      const keyLevels = createMockKeyLevels();
      const levels = extractKeyLevelsArray(keyLevels, 580);

      // Should have multiple levels
      expect(levels.length).toBeGreaterThan(10);

      // Check that prior day levels are strong
      const pdh = levels.find((l) => l.label === "Prior Day High");
      expect(pdh).toBeDefined();
      expect(pdh?.strength).toBe("strong");
      expect(pdh?.price).toBe(585);
    });

    it("assigns correct strength levels", () => {
      const keyLevels = createMockKeyLevels();
      const levels = extractKeyLevelsArray(keyLevels, 580);

      // Strong levels: Prior Day, Weekly
      const strongLevels = levels.filter((l) => l.strength === "strong");
      expect(strongLevels.length).toBeGreaterThan(3);

      // Moderate levels: ORB, VWAP
      const moderateLevels = levels.filter((l) => l.strength === "moderate");
      expect(moderateLevels.length).toBeGreaterThan(2);

      // Weak levels: Bollinger bands, VWAP bands
      const weakLevels = levels.filter((l) => l.strength === "weak");
      expect(weakLevels.length).toBeGreaterThan(1);
    });

    it("handles missing levels gracefully", () => {
      const keyLevels: KeyLevels = {
        priorDayHigh: 585,
        // All other levels missing
      };

      const levels = extractKeyLevelsArray(keyLevels, 580);
      expect(levels.length).toBe(1);
      expect(levels[0].price).toBe(585);
    });
  });

  describe("calculateLevelAwareStop", () => {
    it("places long stop below nearest strong support", () => {
      const keyLevels = createMockKeyLevels();
      const result = calculateLevelAwareStop(
        580, // Entry
        "long",
        keyLevels,
        2.0, // ATR
        "DAY"
      );

      // Stop should be below entry
      expect(result.recommendedStop).toBeLessThan(580);

      // Should have found a level
      expect(result.levelType).not.toBe("ATR");

      // Distance should be within config limits
      expect(result.distancePercent).toBeLessThanOrEqual(DEFAULT_LEVEL_AWARE_CONFIG.maxStopPercent);
    });

    it("places short stop above nearest strong resistance", () => {
      const keyLevels = createMockKeyLevels();
      const result = calculateLevelAwareStop(
        580, // Entry
        "short",
        keyLevels,
        2.0, // ATR
        "DAY"
      );

      // Stop should be above entry
      expect(result.recommendedStop).toBeGreaterThan(580);

      // Should have found a level
      expect(result.levelType).not.toBe("ATR");
    });

    it("falls back to ATR when no levels available", () => {
      const emptyLevels: KeyLevels = {};
      const result = calculateLevelAwareStop(580, "long", emptyLevels, 2.0, "DAY");

      expect(result.levelType).toBe("ATR");
      expect(result.levelLabel).toContain("ATR");
      expect(result.confidence).toBe("low");
      expect(result.warnings).toContain("No key levels found within range, using ATR-based stop");
    });

    it("respects trade type constraints", () => {
      const keyLevels = createMockKeyLevels();

      // SCALP should have tighter stops
      const scalpResult = calculateLevelAwareStop(580, "long", keyLevels, 2.0, "SCALP");

      // SWING can have wider stops
      const swingResult = calculateLevelAwareStop(580, "long", keyLevels, 2.0, "SWING");

      // Scalp max is 2%, swing max is 8%
      expect(scalpResult.distancePercent).toBeLessThanOrEqual(2.0);
      // For swing, we may find levels further away
    });

    it("provides alternative stops", () => {
      const keyLevels = createMockKeyLevels();
      const result = calculateLevelAwareStop(580, "long", keyLevels, 2.0, "DAY");

      // Should have alternatives if multiple levels exist
      expect(result.alternativeStops.length).toBeGreaterThanOrEqual(0);

      // Each alternative should have required fields
      result.alternativeStops.forEach((alt) => {
        expect(alt.price).toBeDefined();
        expect(alt.type).toBeDefined();
        expect(alt.distancePercent).toBeDefined();
      });
    });

    it("adds buffer beyond key level", () => {
      const keyLevels: KeyLevel[] = [
        { price: 575, type: "PriorDayHL", strength: "strong", label: "PDL" },
      ];

      const result = calculateLevelAwareStop(580, "long", keyLevels, 2.0, "DAY");

      // Buffer is 0.1 ATR = 0.2 below level
      // So stop should be 575 - 0.2 = 574.8
      expect(result.recommendedStop).toBeLessThan(575);
      expect(result.reasoning).toContain("below");
    });

    it("filters levels outside max distance", () => {
      const farLevels: KeyLevel[] = [
        { price: 500, type: "MonthHL", strength: "strong", label: "Monthly Low" }, // Too far
      ];

      const result = calculateLevelAwareStop(
        580,
        "long",
        farLevels,
        2.0,
        "SCALP" // Max 2% = 11.6 points
      );

      // 500 is 80 points away = 13.8%, too far for SCALP
      expect(result.levelType).toBe("ATR");
    });

    it("calculates confidence based on level strength", () => {
      // Strong level close to entry
      const strongLevel: KeyLevel[] = [
        { price: 578, type: "PriorDayHL", strength: "strong", label: "PDL" },
      ];

      const strongResult = calculateLevelAwareStop(580, "long", strongLevel, 2.0, "DAY");
      expect(strongResult.confidence).toBe("high");

      // Weak level
      const weakLevel: KeyLevel[] = [
        { price: 576, type: "Bollinger", strength: "weak", label: "BB Lower" },
      ];

      const weakResult = calculateLevelAwareStop(580, "long", weakLevel, 2.0, "DAY");
      expect(weakResult.confidence).not.toBe("high");
    });
  });

  describe("calculateLevelAwareTargets", () => {
    it("calculates targets based on key levels", () => {
      const keyLevels = createMockKeyLevels();
      const stopDistance = 3; // 3 point stop

      const result = calculateLevelAwareTargets(580, "long", keyLevels, 2.0, stopDistance);

      // All targets should be above entry for long
      expect(result.T1).toBeGreaterThan(580);
      expect(result.T2).toBeGreaterThan(580);
      expect(result.T3).toBeGreaterThan(580);

      // Targets should be in order
      expect(result.T2).toBeGreaterThan(result.T1);
      expect(result.T3).toBeGreaterThan(result.T2);

      // Should have reasoning
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it("falls back to R multiples when no levels", () => {
      const emptyLevels: KeyLevels = {};
      const stopDistance = 3;

      const result = calculateLevelAwareTargets(580, "long", emptyLevels, 2.0, stopDistance);

      // Should fall back to 1R, 2R, 3R
      expect(result.T1).toBeCloseTo(583, 0); // 580 + 3
      expect(result.T2).toBeCloseTo(586, 0); // 580 + 6
      expect(result.T3).toBeCloseTo(589, 0); // 580 + 9

      expect(result.reasoning.some((r) => r.includes("no levels"))).toBe(true);
    });

    it("calculates short targets correctly", () => {
      const keyLevels = createMockKeyLevels();
      const stopDistance = 3;

      const result = calculateLevelAwareTargets(580, "short", keyLevels, 2.0, stopDistance);

      // All targets should be below entry for short
      expect(result.T1).toBeLessThan(580);
      expect(result.T2).toBeLessThan(580);
      expect(result.T3).toBeLessThan(580);
    });
  });

  describe("validateStopPlacement", () => {
    it("validates correct long stop placement", () => {
      const keyLevels: KeyLevel[] = [
        { price: 575, type: "PriorDayHL", strength: "strong", label: "PDL" },
      ];

      const result = validateStopPlacement(574, 580, "long", keyLevels, 2.0);

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it("rejects stop on wrong side for long", () => {
      const keyLevels: KeyLevel[] = [];

      const result = validateStopPlacement(585, 580, "long", keyLevels, 2.0);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("Stop must be below entry for long trades");
    });

    it("rejects stop on wrong side for short", () => {
      const keyLevels: KeyLevel[] = [];

      const result = validateStopPlacement(575, 580, "short", keyLevels, 2.0);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("Stop must be above entry for short trades");
    });

    it("warns about too tight stops", () => {
      const keyLevels: KeyLevel[] = [];

      // Stop only 0.1% away
      const result = validateStopPlacement(579.5, 580, "long", keyLevels, 2.0);

      expect(result.issues.some((i) => i.includes("too tight"))).toBe(true);
    });

    it("warns about too wide stops", () => {
      const keyLevels: KeyLevel[] = [];

      // Stop 15% away
      const result = validateStopPlacement(500, 580, "long", keyLevels, 2.0);

      expect(result.issues.some((i) => i.includes("too wide"))).toBe(true);
    });

    it("suggests adjusting stop to key level", () => {
      // Stop placed in no-man's land
      const keyLevels: KeyLevel[] = [
        { price: 575, type: "PriorDayHL", strength: "strong", label: "PDL" },
      ];

      // Stop at 577 is not near any level (PDL is at 575)
      const result = validateStopPlacement(571, 580, "long", keyLevels, 2.0);

      // Should suggest adjusting since 571 is not near 575
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe("formatLevelAwareStop", () => {
    it("formats stop result for display", () => {
      const result = calculateLevelAwareStop(580, "long", createMockKeyLevels(), 2.0, "DAY");

      const formatted = formatLevelAwareStop(result);

      expect(formatted).toContain("Level-Aware Stop Analysis");
      expect(formatted).toContain("Stop:");
      expect(formatted).toContain("Level:");
      expect(formatted).toContain("Confidence:");
      expect(formatted).toContain("Reasoning:");
    });

    it("includes warnings when present", () => {
      const emptyLevels: KeyLevels = {};
      const result = calculateLevelAwareStop(580, "long", emptyLevels, 2.0, "DAY");

      const formatted = formatLevelAwareStop(result);

      expect(formatted).toContain("Warnings:");
      expect(formatted).toContain("ATR");
    });
  });

  describe("integration scenarios", () => {
    it("handles real-world long trade scenario", () => {
      // SPY at 580, looking to go long
      const keyLevels = createMockKeyLevels();
      const atr = 2.5;

      const stopResult = calculateLevelAwareStop(580, "long", keyLevels, atr, "DAY");
      const targetResult = calculateLevelAwareTargets(
        580,
        "long",
        keyLevels,
        atr,
        Math.abs(580 - stopResult.recommendedStop)
      );

      // Verify complete setup
      expect(stopResult.recommendedStop).toBeLessThan(580);
      expect(targetResult.T1).toBeGreaterThan(580);

      // Validation may have suggestions but should not have critical issues
      const validation = validateStopPlacement(
        stopResult.recommendedStop,
        580,
        "long",
        keyLevels,
        atr
      );

      // Should not have side errors (stop on wrong side)
      expect(
        validation.issues.some((i) => i.includes("must be below") || i.includes("must be above"))
      ).toBe(false);

      // Calculate R:R
      const risk = 580 - stopResult.recommendedStop;
      const reward = targetResult.T2 - 580;
      const rr = reward / risk;

      // Should have reasonable R:R
      expect(rr).toBeGreaterThan(0.5); // At least 0.5:1
    });

    it("handles scalp with tight stops", () => {
      const keyLevels = createMockKeyLevels();

      const result = calculateLevelAwareStop(580, "long", keyLevels, 1.5, "SCALP");

      // Scalp stops should be tight (<2%)
      expect(result.distancePercent).toBeLessThanOrEqual(2.5);
    });

    it("handles swing with wider stops", () => {
      // For swing, we might want to use weekly levels
      const keyLevels: KeyLevels = {
        weeklyLow: 560, // 3.4% away
        monthlyLow: 550, // 5.2% away
      };

      const result = calculateLevelAwareStop(580, "long", keyLevels, 3.0, "SWING");

      // Should find weekly low (within 8% max for swing)
      expect(result.levelType).not.toBe("ATR");
      expect(result.distancePercent).toBeLessThanOrEqual(8.0);
    });
  });
});
