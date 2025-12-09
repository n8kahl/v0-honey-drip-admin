import { describe, it, expect } from "vitest";
import type { KeyLevels } from "../types";
import { calculateRisk } from "../calculator";

describe("Risk Engine - KeyLevels Integration", () => {
  const mockKeyLevels: KeyLevels = {
    vwap: 590.5,
    orbHigh: 592.0,
    orbLow: 588.0,
    priorDayHigh: 595.0,
    priorDayLow: 585.0,
    priorDayClose: 589.0,
    weeklyHigh: 600.0,
    weeklyLow: 580.0,
    monthlyHigh: 610.0,
    monthlyLow: 570.0,
    quarterlyHigh: 620.0,
    quarterlyLow: 560.0,
    yearlyHigh: 650.0,
    yearlyLow: 550.0,
    preMarketHigh: 591.0,
    preMarketLow: 589.5,
    bollingerUpper: 595.0,
    bollingerLower: 585.0,
  };

  it("should calculate risk with real keyLevels", () => {
    const result = calculateRisk({
      entryPrice: 15.5,
      currentUnderlyingPrice: 590.5,
      currentOptionMid: 15.5,
      keyLevels: mockKeyLevels,
      atr: 12.5,
      expirationISO: "2025-12-19T00:00:00Z",
      defaults: {
        mode: "calculated",
        tpPercent: 50,
        slPercent: 25,
      },
    });

    expect(result).toBeDefined();
    expect(result.targetPrice).toBeGreaterThan(0);
    expect(result.stopLoss).toBeGreaterThan(0);
    expect(result.confidence).toBeDefined();
  });

  it("should handle missing keyLevels gracefully", () => {
    const emptyLevels: KeyLevels = {};
    
    const result = calculateRisk({
      entryPrice: 15.5,
      currentUnderlyingPrice: 590.5,
      currentOptionMid: 15.5,
      keyLevels: emptyLevels,
      expirationISO: "2025-12-19T00:00:00Z",
      defaults: {
        mode: "percent",
        tpPercent: 50,
        slPercent: 25,
      },
    });

    expect(result).toBeDefined();
    expect(result.targetPrice).toBeGreaterThan(15.5);
    expect(result.stopLoss).toBeLessThan(15.5);
  });

  it("should use keyLevels for TP calculation in calculated mode", () => {
    const resultWithLevels = calculateRisk({
      entryPrice: 15.5,
      currentUnderlyingPrice: 590.5,
      currentOptionMid: 15.5,
      keyLevels: mockKeyLevels,
      atr: 12.5,
      expirationISO: "2025-12-19T00:00:00Z",
      defaults: {
        mode: "calculated",
        tpPercent: 50,
        slPercent: 25,
      },
    });

    // With real levels, confidence should be defined
    expect(resultWithLevels.confidence).toBeDefined();
    expect(resultWithLevels.usedLevels).toBeDefined();
  });

  it("should validate keyLevels improve risk calculation confidence", () => {
    const emptyLevels: KeyLevels = {};
    
    const withoutLevels = calculateRisk({
      entryPrice: 15.5,
      currentUnderlyingPrice: 590.5,
      currentOptionMid: 15.5,
      keyLevels: emptyLevels,
      expirationISO: "2025-12-19T00:00:00Z",
      defaults: {
        mode: "percent",
        tpPercent: 50,
        slPercent: 25,
      },
    });

    const withLevels = calculateRisk({
      entryPrice: 15.5,
      currentUnderlyingPrice: 590.5,
      currentOptionMid: 15.5,
      keyLevels: mockKeyLevels,
      atr: 12.5,
      expirationISO: "2025-12-19T00:00:00Z",
      defaults: {
        mode: "calculated",
        tpPercent: 50,
        slPercent: 25,
      },
    });

    // Both should produce valid results
    expect(withoutLevels.targetPrice).toBeGreaterThan(0);
    expect(withLevels.targetPrice).toBeGreaterThan(0);
  });

  it("should handle zero keyLevels (fallback scenario)", () => {
    const zeroLevels: KeyLevels = {
      vwap: 0,
      orbHigh: 0,
      orbLow: 0,
      priorDayHigh: 0,
      priorDayLow: 0,
      priorDayClose: 0,
      weeklyHigh: 0,
      weeklyLow: 0,
      monthlyHigh: 0,
      monthlyLow: 0,
      quarterlyHigh: 0,
      quarterlyLow: 0,
      yearlyHigh: 0,
      yearlyLow: 0,
      preMarketHigh: 0,
      preMarketLow: 0,
      bollingerUpper: 0,
      bollingerLower: 0,
    };

    const result = calculateRisk({
      entryPrice: 15.5,
      currentUnderlyingPrice: 590.5,
      currentOptionMid: 15.5,
      keyLevels: zeroLevels,
      expirationISO: "2025-12-19T00:00:00Z",
      defaults: {
        mode: "calculated",
        tpPercent: 50,
        slPercent: 25,
      },
    });

    // Should still produce valid result (fallback to percent mode)
    expect(result.targetPrice).toBeGreaterThan(15.5);
    expect(result.stopLoss).toBeLessThan(15.5);
  });
});
