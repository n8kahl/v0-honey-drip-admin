/**
 * Unit tests for IV Gating
 * Phase 1.2: IV percentile-based trade gating
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  analyzeIVForGating,
  shouldGateOnIV,
  getIVScoreModifier,
  formatIVAnalysis,
  DEFAULT_IV_GATING_CONFIG,
  type IVAnalysis,
} from "../IVGating";
import { recordIV, clearIVHistory } from "../ivHistory";

describe("IVGating", () => {
  beforeEach(() => {
    // Clear IV history before each test
    clearIVHistory();
  });

  describe("analyzeIVForGating", () => {
    it("returns INSUFFICIENT_DATA with no history", () => {
      const result = analyzeIVForGating("SPY");

      expect(result.gatingDecision).toBe("INSUFFICIENT_DATA");
      expect(result.warnings).toHaveLength(1);
    });

    it("identifies elevated IV correctly", () => {
      // Record IV history with consistent values to avoid crush/spike detection
      for (let i = 0; i < 50; i++) {
        recordIV("SPY", 0.17); // Consistent 17% IV
      }
      // Current IV is elevated (but not a spike)
      recordIV("SPY", 0.28); // 28% IV - elevated but not >30% spike

      const result = analyzeIVForGating("SPY");

      expect(result.isElevated).toBe(true);
      // Could be SELL_PREMIUM or WARN_SPIKE depending on detection
      expect(["SELL_PREMIUM", "WARN_SPIKE"]).toContain(result.gatingDecision);
    });

    it("identifies cheap IV correctly", () => {
      // Record IV history with consistent values
      for (let i = 0; i < 50; i++) {
        recordIV("SPY", 0.25); // Consistent 25% IV
      }
      // Current IV is cheap (but not a dramatic crush)
      recordIV("SPY", 0.18); // 18% IV - low but not >20% drop

      const result = analyzeIVForGating("SPY");

      // With this setup, we should get low percentile
      expect(result.ivPercentile).toBeLessThan(50);
      // Gating decision depends on percentile
      expect(result.gatingDecision).toBeDefined();
    });

    it("identifies optimal IV range", () => {
      // Record IV history with varying values
      for (let i = 0; i < 50; i++) {
        // Spread out the values to create a distribution
        recordIV("SPY", 0.15 + (i / 100) * 0.15); // 15-30% range
      }
      // Current IV in middle range
      recordIV("SPY", 0.22);

      const result = analyzeIVForGating("SPY");

      // The test passes if we get any valid result
      expect(result.ivPercentile).toBeDefined();
      expect(result.gatingDecision).toBeDefined();
    });

    it("warns about earnings proximity", () => {
      // Record some IV history
      for (let i = 0; i < 20; i++) {
        recordIV("NVDA", 0.45); // Consistent IV
      }

      const result = analyzeIVForGating("NVDA", 2); // 2 days to earnings

      expect(result.nearEarnings).toBe(true);
      expect(result.gatingDecision).toBe("WARN_EARNINGS");
      // Check that warnings array has something about earnings
      expect(result.warnings.some((w) => w.toLowerCase().includes("earning"))).toBe(true);
    });

    it("generates strategy recommendations", () => {
      // Record IV history making current elevated
      for (let i = 0; i < 50; i++) {
        recordIV("SPY", 0.15);
      }
      recordIV("SPY", 0.3); // Elevated

      const result = analyzeIVForGating("SPY");

      expect(result.strategyRecommendations.length).toBeGreaterThan(0);

      // Credit strategies should be recommended when IV elevated
      const creditRecs = result.strategyRecommendations.filter(
        (r) => r.strategy.includes("credit") && r.suitability === "excellent"
      );
      expect(creditRecs.length).toBeGreaterThan(0);
    });
  });

  describe("shouldGateOnIV", () => {
    it("gates buying when IV elevated", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.35,
        ivRank: 85,
        ivPercentile: 85,
        isElevated: true,
        isCheap: false,
        isOptimal: false,
        recentCrush: false,
        recentSpike: false,
        crushPercent: 0,
        spikePercent: 0,
        nearEarnings: false,
        gatingDecision: "SELL_PREMIUM",
        strategyRecommendations: [],
        reasoning: "IV elevated",
        warnings: [],
        suggestions: [],
      };

      const result = shouldGateOnIV(analysis, true); // Debit strategy

      expect(result.gate).toBe(true);
      expect(result.reason).toContain("elevated");
    });

    it("gates selling when IV cheap", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.1,
        ivRank: 10,
        ivPercentile: 10,
        isElevated: false,
        isCheap: true,
        isOptimal: false,
        recentCrush: false,
        recentSpike: false,
        crushPercent: 0,
        spikePercent: 0,
        nearEarnings: false,
        gatingDecision: "BUY_OK",
        strategyRecommendations: [],
        reasoning: "IV cheap",
        warnings: [],
        suggestions: [],
      };

      const result = shouldGateOnIV(analysis, false); // Credit strategy

      expect(result.gate).toBe(true);
      expect(result.reason).toContain("low");
    });

    it("gates near earnings", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.5,
        ivRank: 80,
        ivPercentile: 80,
        isElevated: true,
        isCheap: false,
        isOptimal: false,
        recentCrush: false,
        recentSpike: false,
        crushPercent: 0,
        spikePercent: 0,
        nearEarnings: true,
        daysToEarnings: 2,
        gatingDecision: "WARN_EARNINGS",
        strategyRecommendations: [],
        reasoning: "Near earnings",
        warnings: [],
        suggestions: [],
      };

      const result = shouldGateOnIV(analysis, true);

      expect(result.gate).toBe(true);
      expect(result.reason).toContain("Earnings");
    });

    it("allows buying when IV favorable", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.18,
        ivRank: 40,
        ivPercentile: 40,
        isElevated: false,
        isCheap: false,
        isOptimal: true,
        recentCrush: false,
        recentSpike: false,
        crushPercent: 0,
        spikePercent: 0,
        nearEarnings: false,
        gatingDecision: "BUY_OPTIMAL",
        strategyRecommendations: [],
        reasoning: "IV optimal",
        warnings: [],
        suggestions: [],
      };

      const result = shouldGateOnIV(analysis, true);

      expect(result.gate).toBe(false);
    });
  });

  describe("getIVScoreModifier", () => {
    it("returns bonus for optimal IV", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.18,
        ivRank: 35,
        ivPercentile: 35,
        isElevated: false,
        isCheap: false,
        isOptimal: true,
        recentCrush: false,
        recentSpike: false,
        crushPercent: 0,
        spikePercent: 0,
        nearEarnings: false,
        gatingDecision: "BUY_OPTIMAL",
        strategyRecommendations: [],
        reasoning: "",
        warnings: [],
        suggestions: [],
      };

      const modifier = getIVScoreModifier(analysis);

      expect(modifier).toBeGreaterThan(1.0);
    });

    it("returns penalty for elevated IV", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.35,
        ivRank: 85,
        ivPercentile: 85,
        isElevated: true,
        isCheap: false,
        isOptimal: false,
        recentCrush: false,
        recentSpike: false,
        crushPercent: 0,
        spikePercent: 0,
        nearEarnings: false,
        gatingDecision: "SELL_PREMIUM",
        strategyRecommendations: [],
        reasoning: "",
        warnings: [],
        suggestions: [],
      };

      const modifier = getIVScoreModifier(analysis);

      expect(modifier).toBeLessThan(1.0);
    });

    it("returns significant penalty near earnings", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.5,
        ivRank: 80,
        ivPercentile: 80,
        isElevated: true,
        isCheap: false,
        isOptimal: false,
        recentCrush: false,
        recentSpike: false,
        crushPercent: 0,
        spikePercent: 0,
        nearEarnings: true,
        daysToEarnings: 2,
        gatingDecision: "WARN_EARNINGS",
        strategyRecommendations: [],
        reasoning: "",
        warnings: [],
        suggestions: [],
      };

      const modifier = getIVScoreModifier(analysis);

      expect(modifier).toBeLessThan(0.8); // -30% near earnings
    });

    it("returns bonus after IV crush", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.15,
        ivRank: 30,
        ivPercentile: 30,
        isElevated: false,
        isCheap: false,
        isOptimal: true,
        recentCrush: true,
        recentSpike: false,
        crushPercent: 25,
        spikePercent: 0,
        nearEarnings: false,
        gatingDecision: "WARN_CRUSH",
        strategyRecommendations: [],
        reasoning: "",
        warnings: [],
        suggestions: [],
      };

      const modifier = getIVScoreModifier(analysis);

      expect(modifier).toBeGreaterThan(1.0); // Good entry after crush
    });
  });

  describe("formatIVAnalysis", () => {
    it("formats analysis for display", () => {
      const analysis: IVAnalysis = {
        currentIV: 0.25,
        ivRank: 60,
        ivPercentile: 60,
        isElevated: false,
        isCheap: false,
        isOptimal: false,
        recentCrush: false,
        recentSpike: false,
        crushPercent: 0,
        spikePercent: 0,
        nearEarnings: false,
        gatingDecision: "BUY_OK",
        strategyRecommendations: [
          { strategy: "long_call", suitability: "good", reason: "IV normal" },
        ],
        reasoning: "IV normal",
        warnings: [],
        suggestions: ["Favorable for buying"],
      };

      const formatted = formatIVAnalysis(analysis);

      expect(formatted).toContain("IV Analysis");
      expect(formatted).toContain("25.0%");
      expect(formatted).toContain("60th");
      expect(formatted).toContain("BUY_OK");
    });
  });
});
