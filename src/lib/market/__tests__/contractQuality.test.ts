/**
 * Contract Quality Tests
 *
 * Tests for liquidity grade, spread, and slippage calculations
 */

import { describe, it, expect } from "vitest";
import {
  getLiquidityGrade,
  calculateContractQuality,
  formatSpreadPct,
  formatSlippageRange,
  getLiquidityGradeStyle,
  SPREAD_THRESHOLDS,
  SLIPPAGE_MULTIPLIERS,
} from "../contractQuality";

describe("getLiquidityGrade", () => {
  it("returns A for spread <= 3%", () => {
    expect(getLiquidityGrade(0.01)).toBe("A");
    expect(getLiquidityGrade(0.02)).toBe("A");
    expect(getLiquidityGrade(0.03)).toBe("A");
    expect(getLiquidityGrade(SPREAD_THRESHOLDS.GRADE_A_MAX)).toBe("A");
  });

  it("returns B for spread > 3% and <= 8%", () => {
    expect(getLiquidityGrade(0.031)).toBe("B");
    expect(getLiquidityGrade(0.05)).toBe("B");
    expect(getLiquidityGrade(0.08)).toBe("B");
    expect(getLiquidityGrade(SPREAD_THRESHOLDS.GRADE_B_MAX)).toBe("B");
  });

  it("returns C for spread > 8%", () => {
    expect(getLiquidityGrade(0.081)).toBe("C");
    expect(getLiquidityGrade(0.10)).toBe("C");
    expect(getLiquidityGrade(0.15)).toBe("C");
    expect(getLiquidityGrade(0.25)).toBe("C");
  });

  it("handles edge cases", () => {
    expect(getLiquidityGrade(0)).toBe("A");
    expect(getLiquidityGrade(0.0001)).toBe("A");
    expect(getLiquidityGrade(1.0)).toBe("C"); // 100% spread
  });
});

describe("calculateContractQuality", () => {
  it("calculates spread correctly", () => {
    const result = calculateContractQuality(1.00, 1.10);
    expect(result).not.toBeNull();
    expect(result!.spreadAbs).toBeCloseTo(0.10, 4);
    expect(result!.spreadPct).toBeCloseTo(0.0952, 3); // 0.10 / 1.05 mid
  });

  it("uses provided mid for calculations", () => {
    const result = calculateContractQuality(1.00, 1.10, 1.05);
    expect(result).not.toBeNull();
    expect(result!.spreadPct).toBeCloseTo(0.10 / 1.05, 4);
  });

  it("calculates mid if not provided", () => {
    const result = calculateContractQuality(2.00, 2.20);
    expect(result).not.toBeNull();
    // Mid should be (2.00 + 2.20) / 2 = 2.10
    // Spread = 0.20 / 2.10 = 0.0952
    expect(result!.spreadPct).toBeCloseTo(0.0952, 3);
  });

  it("assigns correct liquidity grades", () => {
    // Grade A: 2% spread (0.02 / 1.00 = 2%)
    const gradeA = calculateContractQuality(0.99, 1.01, 1.00);
    expect(gradeA!.liquidityGrade).toBe("A");

    // Grade B: 6% spread
    const gradeB = calculateContractQuality(0.97, 1.03, 1.00);
    expect(gradeB!.liquidityGrade).toBe("B");

    // Grade C: 12% spread
    const gradeC = calculateContractQuality(0.94, 1.06, 1.00);
    expect(gradeC!.liquidityGrade).toBe("C");
  });

  it("calculates slippage estimates", () => {
    // Grade A contract with $0.10 spread
    const result = calculateContractQuality(1.00, 1.10, 1.05);
    expect(result).not.toBeNull();

    // Should be grade B (0.10 / 1.05 = 9.5%)
    expect(result!.liquidityGrade).toBe("C"); // Actually C since 9.5% > 8%

    // Slippage for grade C: spread * 1.5 to spread * 2.5
    expect(result!.expectedSlippageMin).toBeCloseTo(0.10 * SLIPPAGE_MULTIPLIERS.C.min, 4);
    expect(result!.expectedSlippageMax).toBeCloseTo(0.10 * SLIPPAGE_MULTIPLIERS.C.max, 4);
  });

  it("returns null for invalid inputs", () => {
    expect(calculateContractQuality(0, 1.10)).toBeNull();
    expect(calculateContractQuality(1.00, 0)).toBeNull();
    expect(calculateContractQuality(-1.00, 1.10)).toBeNull();
    expect(calculateContractQuality(1.00, -1.10)).toBeNull();
    expect(calculateContractQuality(1.10, 1.00)).toBeNull(); // bid > ask
  });

  it("sets isWideSpread for spreads > 10%", () => {
    // Wide spread (11% spread)
    const wide = calculateContractQuality(0.945, 1.055, 1.00);
    expect(wide!.isWideSpread).toBe(true);

    // Narrow spread (2% spread)
    const narrow = calculateContractQuality(0.99, 1.01, 1.00);
    expect(narrow!.isWideSpread).toBe(false);
  });

  it("adds warnings for poor liquidity", () => {
    // Grade C with wide spread
    const result = calculateContractQuality(0.90, 1.10, 1.00);
    expect(result!.warnings.length).toBeGreaterThan(0);
    expect(result!.warnings.some((w) => w.includes("Wide spread"))).toBe(true);
    expect(result!.warnings.some((w) => w.includes("Poor liquidity"))).toBe(true);
  });

  it("warns for penny options", () => {
    const result = calculateContractQuality(0.01, 0.05);
    expect(result!.warnings.some((w) => w.includes("penny option"))).toBe(true);
  });
});

describe("formatSpreadPct", () => {
  it("formats percentage correctly", () => {
    expect(formatSpreadPct(0.05)).toBe("5.0%");
    expect(formatSpreadPct(0.123)).toBe("12.3%");
    expect(formatSpreadPct(0.001)).toBe("0.1%");
  });
});

describe("formatSlippageRange", () => {
  it("formats range correctly", () => {
    expect(formatSlippageRange(0.05, 0.10)).toBe("$0.05 - $0.10");
    expect(formatSlippageRange(0.15, 0.25)).toBe("$0.15 - $0.25");
  });

  it("formats single value when min equals max", () => {
    expect(formatSlippageRange(0.10, 0.10)).toBe("$0.10");
  });
});

describe("getLiquidityGradeStyle", () => {
  it("returns correct styles for each grade", () => {
    const gradeA = getLiquidityGradeStyle("A");
    expect(gradeA.className).toContain("green");
    expect(gradeA.label).toBe("A");
    expect(gradeA.description).toContain("Excellent");

    const gradeB = getLiquidityGradeStyle("B");
    expect(gradeB.className).toContain("yellow");
    expect(gradeB.label).toBe("B");
    expect(gradeB.description).toContain("Good");

    const gradeC = getLiquidityGradeStyle("C");
    expect(gradeC.className).toContain("red");
    expect(gradeC.label).toBe("C");
    expect(gradeC.description).toContain("Poor");
  });
});

describe("Ranking Stability", () => {
  it("deterministically ranks contracts by liquidity grade", () => {
    const contracts = [
      { bid: 0.94, ask: 1.06, mid: 1.00 }, // C - 12%
      { bid: 0.97, ask: 1.03, mid: 1.00 }, // B - 6%
      { bid: 0.99, ask: 1.01, mid: 1.00 }, // A - 2%
      { bid: 0.95, ask: 1.05, mid: 1.00 }, // C - 10%
    ];

    const ranked = contracts
      .map((c) => ({
        ...c,
        quality: calculateContractQuality(c.bid, c.ask, c.mid)!,
      }))
      .sort((a, b) => {
        // Sort by grade (A < B < C), then by spread
        const gradeOrder = { A: 0, B: 1, C: 2 };
        const gradeDiff =
          gradeOrder[a.quality.liquidityGrade] - gradeOrder[b.quality.liquidityGrade];
        if (gradeDiff !== 0) return gradeDiff;
        return a.quality.spreadPct - b.quality.spreadPct;
      });

    // Best should be A grade with 2% spread
    expect(ranked[0].quality.liquidityGrade).toBe("A");
    expect(ranked[0].quality.spreadPct).toBeCloseTo(0.02, 2);

    // Second should be B grade with 6% spread
    expect(ranked[1].quality.liquidityGrade).toBe("B");

    // Last two should be C grade, sorted by spread
    expect(ranked[2].quality.liquidityGrade).toBe("C");
    expect(ranked[3].quality.liquidityGrade).toBe("C");
    expect(ranked[2].quality.spreadPct).toBeLessThan(ranked[3].quality.spreadPct);
  });
});
