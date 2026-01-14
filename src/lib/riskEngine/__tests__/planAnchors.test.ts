/**
 * Plan Anchors Unit Tests
 *
 * Tests for anchor selection logic with mocked key levels and direction.
 * Verifies structural anchors are preferred over ATR fallbacks.
 */

import { describe, it, expect } from "vitest";
import { selectPlanAnchors, getShortAnchorLabel, formatAnchorType } from "../planAnchors";
import type { KeyLevels } from "../types";

// ============================================================================
// Test Data
// ============================================================================

const baseKeyLevels: KeyLevels = {
  vwap: 598.0,
  orbHigh: 600.0,
  orbLow: 596.0,
  priorDayHigh: 602.0,
  priorDayLow: 594.0,
  weeklyHigh: 605.0,
  weeklyLow: 590.0,
};

const keyLevelsWithGamma: KeyLevels = {
  ...baseKeyLevels,
  optionsFlow: {
    gammaWall: 599.0,
    callWall: 605.0,
    putWall: 592.0,
    maxPain: 597.0,
  },
};

const emptyKeyLevels: KeyLevels = {};

// ============================================================================
// Anchor Selection Tests
// ============================================================================

describe("selectPlanAnchors", () => {
  describe("LONG direction with structural levels", () => {
    it("selects stop anchor below current price", () => {
      const result = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      expect(result.stopAnchor).toBeDefined();
      expect(result.stopAnchor.price).toBeLessThan(599.0);
      expect(result.stopAnchor.isFallback).toBe(false);
    });

    it("selects target anchors above current price", () => {
      const result = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      expect(result.targets.length).toBeGreaterThan(0);
      result.targets.forEach((target) => {
        expect(target.price).toBeGreaterThan(599.0);
        expect(target.label).toMatch(/^TP[123]$/);
      });
    });

    it("includes VWAP as potential anchor", () => {
      const result = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      // VWAP at 598 is below current price, should be stop candidate
      expect(result.stopAnchor.type).toBe("VWAP");
      expect(result.stopAnchor.price).toBe(598.0);
    });

    it("includes ORB levels as anchors", () => {
      const result = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      // ORB high at 600 is above current, should be target candidate
      const orbTarget = result.targets.find((t) => t.type === "ORB_HIGH");
      expect(orbTarget).toBeDefined();
      expect(orbTarget?.price).toBe(600.0);
    });
  });

  describe("LONG direction with gamma levels", () => {
    it("prefers gamma walls as anchors", () => {
      const result = selectPlanAnchors({
        keyLevels: keyLevelsWithGamma,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      // Gamma levels should be weighted higher
      // Call wall at 605 should be a target
      const hasGammaTarget = result.targets.some(
        (t) => t.type === "CALL_WALL" || t.type === "GAMMA_WALL"
      );
      expect(hasGammaTarget).toBe(true);
    });

    it("includes put wall for stop consideration", () => {
      const result = selectPlanAnchors({
        keyLevels: keyLevelsWithGamma,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      // Put wall at 592 is below current but may be too far (>5%)
      // VWAP at 598 should be preferred as closer
      expect(result.stopAnchor.isFallback).toBe(false);
    });
  });

  describe("SHORT direction", () => {
    it("selects stop anchor above current price", () => {
      const result = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "short",
        currentOptionPremium: 3.5,
        delta: -0.5,
      });

      expect(result.stopAnchor).toBeDefined();
      expect(result.stopAnchor.price).toBeGreaterThan(599.0);
    });

    it("selects target anchors below current price", () => {
      const result = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "short",
        currentOptionPremium: 3.5,
        delta: -0.5,
      });

      expect(result.targets.length).toBeGreaterThan(0);
      result.targets.forEach((target) => {
        expect(target.price).toBeLessThan(599.0);
      });
    });
  });

  describe("ATR fallback behavior", () => {
    it("uses ATR fallback when no structural levels available", () => {
      const result = selectPlanAnchors({
        keyLevels: emptyKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
        atr: 2.0,
      });

      expect(result.stopAnchor.type).toBe("ATR_FALLBACK");
      expect(result.stopAnchor.isFallback).toBe(true);
      expect(result.stopAnchor.reason).toContain("ATR");
    });

    it("creates ATR-based targets when no levels", () => {
      const result = selectPlanAnchors({
        keyLevels: emptyKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
        atr: 2.0,
      });

      expect(result.targets.length).toBeGreaterThan(0);
      result.targets.forEach((target) => {
        expect(target.type).toBe("ATR_FALLBACK");
        expect(target.isFallback).toBe(true);
      });
    });

    it("includes ATR fallback warning in plan quality", () => {
      const result = selectPlanAnchors({
        keyLevels: emptyKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
        atr: 2.0,
      });

      expect(result.planQuality.warnings.length).toBeGreaterThan(0);
      expect(
        result.planQuality.warnings.some((w) => w.includes("ATR") || w.includes("structural"))
      ).toBe(true);
    });
  });

  describe("Percent fallback behavior", () => {
    it("uses percent fallback when no ATR available", () => {
      const result = selectPlanAnchors({
        keyLevels: emptyKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
        defaults: { tpPercent: 50, slPercent: 20 },
      });

      expect(result.stopAnchor.type).toBe("PERCENT_FALLBACK");
      expect(result.stopAnchor.isFallback).toBe(true);
    });
  });

  describe("Plan quality scoring", () => {
    it("gives higher score for structural anchors", () => {
      const structuralResult = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      const fallbackResult = selectPlanAnchors({
        keyLevels: emptyKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
        atr: 2.0,
      });

      expect(structuralResult.planQuality.score).toBeGreaterThan(fallbackResult.planQuality.score);
    });

    it("gives higher score for gamma-based anchors", () => {
      const gammaResult = selectPlanAnchors({
        keyLevels: keyLevelsWithGamma,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      const structuralResult = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      expect(gammaResult.planQuality.score).toBeGreaterThanOrEqual(
        structuralResult.planQuality.score
      );
    });

    it("sets quality level based on score", () => {
      const result = selectPlanAnchors({
        keyLevels: keyLevelsWithGamma,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      if (result.planQuality.score >= 70) {
        expect(result.planQuality.level).toBe("strong");
      } else if (result.planQuality.score >= 50) {
        expect(result.planQuality.level).toBe("moderate");
      } else {
        expect(result.planQuality.level).toBe("weak");
      }
    });
  });

  describe("Dual price calculation", () => {
    it("calculates premium prices using delta", () => {
      const result = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      // Stop anchor should have premium price
      expect(result.stopAnchor.premiumPrice).toBeDefined();
      expect(result.stopAnchor.underlyingPrice).toBeDefined();

      // Premium should be less than current for stops (LONG direction)
      if (result.stopAnchor.premiumPrice !== undefined) {
        expect(result.stopAnchor.premiumPrice).toBeLessThan(3.5);
      }
    });

    it("calculates target premium prices", () => {
      const result = selectPlanAnchors({
        keyLevels: baseKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
      });

      result.targets.forEach((target) => {
        expect(target.premiumPrice).toBeDefined();
        // Target premium should be higher than current for LONG
        if (target.premiumPrice !== undefined) {
          expect(target.premiumPrice).toBeGreaterThan(3.5);
        }
      });
    });
  });

  describe("Trade type adjustments", () => {
    it("uses tighter ATR multipliers for SCALP", () => {
      const scalpResult = selectPlanAnchors({
        keyLevels: emptyKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
        atr: 2.0,
        tradeType: "SCALP",
      });

      const dayResult = selectPlanAnchors({
        keyLevels: emptyKeyLevels,
        currentUnderlyingPrice: 599.0,
        direction: "long",
        currentOptionPremium: 3.5,
        delta: 0.5,
        atr: 2.0,
        tradeType: "DAY",
      });

      // SCALP stop should be tighter (closer to current price)
      expect(Math.abs(scalpResult.stopAnchor.price - 599.0)).toBeLessThan(
        Math.abs(dayResult.stopAnchor.price - 599.0)
      );
    });
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe("getShortAnchorLabel", () => {
  it("returns short labels for anchor types", () => {
    expect(getShortAnchorLabel("VWAP")).toBe("VWAP");
    expect(getShortAnchorLabel("ORB_HIGH")).toBe("ORH");
    expect(getShortAnchorLabel("ORB_LOW")).toBe("ORL");
    expect(getShortAnchorLabel("PDH")).toBe("PDH");
    expect(getShortAnchorLabel("PDL")).toBe("PDL");
    expect(getShortAnchorLabel("GAMMA_WALL")).toBe("GEX");
    expect(getShortAnchorLabel("CALL_WALL")).toBe("C.Wall");
    expect(getShortAnchorLabel("PUT_WALL")).toBe("P.Wall");
    expect(getShortAnchorLabel("ATR_FALLBACK")).toBe("ATR");
    expect(getShortAnchorLabel("PERCENT_FALLBACK")).toBe("%");
  });
});

describe("formatAnchorType", () => {
  it("returns human-readable labels", () => {
    expect(formatAnchorType("VWAP")).toBe("VWAP");
    expect(formatAnchorType("ORB_HIGH")).toBe("ORB High");
    expect(formatAnchorType("PDH")).toBe("Prior Day High");
    expect(formatAnchorType("CALL_WALL")).toBe("Call Wall");
    expect(formatAnchorType("ATR_FALLBACK")).toBe("ATR");
  });
});
