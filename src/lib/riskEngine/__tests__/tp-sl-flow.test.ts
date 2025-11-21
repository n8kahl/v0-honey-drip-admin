import { describe, it, expect } from "vitest";
import { calculateRisk } from "../calculator";
import { buildChartLevelsForTrade } from "../chartLevels";
import { inferTradeTypeByDTE, DEFAULT_DTE_THRESHOLDS } from "../profiles";
import { Trade, Contract } from "../../../types";

/**
 * End-to-End TP/SL Flow Tests
 *
 * These tests verify that TP/SL calculations happen correctly:
 * 1. When a contract is selected (LOADED state)
 * 2. When a trade is entered (ENTERED state)
 * 3. Chart levels are generated with correct TP/SL
 */
describe("TP/SL Calculation Flow", () => {
  const mockKeyLevels = {
    preMarketHigh: 105,
    preMarketLow: 95,
    orbHigh: 104,
    orbLow: 96,
    priorDayHigh: 110,
    priorDayLow: 90,
    vwap: 100,
    vwapUpperBand: 102,
    vwapLowerBand: 98,
    bollingerUpper: 103,
    bollingerLower: 97,
    weeklyHigh: 115,
    weeklyLow: 85,
    monthlyHigh: 120,
    monthlyLow: 80,
    quarterlyHigh: 125,
    quarterlyLow: 75,
    yearlyHigh: 130,
    yearlyLow: 70,
  };

  describe("LOADED State - Contract Selection", () => {
    it("should calculate TP/SL for a scalp trade (DTE < 1)", () => {
      // Expiration today (0 DTE)
      const expiry = new Date();
      expiry.setHours(16, 0, 0, 0);
      const expirationISO = expiry.toISOString();

      const tradeType = inferTradeTypeByDTE(expirationISO, new Date(), DEFAULT_DTE_THRESHOLDS);
      expect(tradeType).toBe("SCALP");

      const result = calculateRisk({
        entryPrice: 5.0,
        currentUnderlyingPrice: 100,
        currentOptionMid: 5.0,
        keyLevels: mockKeyLevels,
        atr: 2.5,
        expirationISO,
        tradeType,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      // Scalp should have tight TP/SL
      expect(result.targetPrice).toBeGreaterThan(5.0);
      expect(result.targetPrice).toBeLessThan(7.5); // Not more than 50% gain typically
      expect(result.stopLoss).toBeLessThan(5.0);
      expect(result.stopLoss).toBeGreaterThan(3.5); // Not more than 30% loss typically
      expect(result.tradeType).toBe("SCALP");
      expect(result.reasoning).toContain("SCALP");
    });

    it("should calculate TP/SL for a day trade (3 <= DTE <= 14)", () => {
      // Expiration 5 days out (5 DTE)
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 5);
      expiry.setHours(16, 0, 0, 0);
      const expirationISO = expiry.toISOString();

      const tradeType = inferTradeTypeByDTE(expirationISO, new Date(), DEFAULT_DTE_THRESHOLDS);
      expect(tradeType).toBe("DAY");

      const result = calculateRisk({
        entryPrice: 5.0,
        currentUnderlyingPrice: 100,
        currentOptionMid: 5.0,
        keyLevels: mockKeyLevels,
        atr: 2.5,
        expirationISO,
        tradeType,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      expect(result.targetPrice).toBeGreaterThan(5.0);
      expect(result.stopLoss).toBeLessThan(5.0);
      expect(result.tradeType).toBe("DAY");
    });

    it("should calculate TP/SL for a swing trade (15 <= DTE <= 60)", () => {
      // Expiration in 30 days
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      expiry.setHours(16, 0, 0, 0);
      const expirationISO = expiry.toISOString();

      const tradeType = inferTradeTypeByDTE(expirationISO, new Date(), DEFAULT_DTE_THRESHOLDS);
      expect(tradeType).toBe("SWING");

      const result = calculateRisk({
        entryPrice: 5.0,
        currentUnderlyingPrice: 100,
        currentOptionMid: 5.0,
        keyLevels: mockKeyLevels,
        atr: 2.5,
        expirationISO,
        tradeType,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      expect(result.targetPrice).toBeGreaterThan(5.0);
      expect(result.stopLoss).toBeLessThan(5.0);
      expect(result.tradeType).toBe("SWING");
    });

    it("should calculate TP/SL for a LEAP (DTE >= 61)", () => {
      // Expiration in 90 days
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 90);
      expiry.setHours(16, 0, 0, 0);
      const expirationISO = expiry.toISOString();

      const tradeType = inferTradeTypeByDTE(expirationISO, new Date(), DEFAULT_DTE_THRESHOLDS);
      expect(tradeType).toBe("LEAP");

      const result = calculateRisk({
        entryPrice: 5.0,
        currentUnderlyingPrice: 100,
        currentOptionMid: 5.0,
        keyLevels: mockKeyLevels,
        atr: 2.5,
        expirationISO,
        tradeType,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      // LEAP should have wider TP/SL
      expect(result.targetPrice).toBeGreaterThan(5.0);
      expect(result.stopLoss).toBeLessThan(5.0);
      expect(result.tradeType).toBe("LEAP");
    });
  });

  describe("ENTERED State - Trade Entry with Recalculation", () => {
    it("should recalculate TP/SL when entering at a different price", () => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1);
      const expirationISO = expiry.toISOString();

      // Initial calculation at contract mid $5.00
      const loadedResult = calculateRisk({
        entryPrice: 5.0,
        currentUnderlyingPrice: 100,
        currentOptionMid: 5.0,
        keyLevels: mockKeyLevels,
        atr: 2.5,
        expirationISO,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      // Recalculate at actual entry $4.50 (better price)
      const enteredResult = calculateRisk({
        entryPrice: 4.5,
        currentUnderlyingPrice: 100,
        currentOptionMid: 4.5,
        keyLevels: mockKeyLevels,
        atr: 2.5,
        expirationISO,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      // TP/SL should be different based on entry price
      expect(enteredResult.targetPrice).not.toBe(loadedResult.targetPrice);
      expect(enteredResult.stopLoss).not.toBe(loadedResult.stopLoss);

      // Verify TP is higher and SL is lower than entry
      expect(enteredResult.targetPrice).toBeGreaterThan(4.5);
      expect(enteredResult.stopLoss).toBeLessThan(4.5);
    });

    it("should preserve TP/SL when entering at contract mid price", () => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1);
      const expirationISO = expiry.toISOString();

      const entryPrice = 5.0;

      const result1 = calculateRisk({
        entryPrice,
        currentUnderlyingPrice: 100,
        currentOptionMid: entryPrice,
        keyLevels: mockKeyLevels,
        atr: 2.5,
        expirationISO,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      const result2 = calculateRisk({
        entryPrice,
        currentUnderlyingPrice: 100,
        currentOptionMid: entryPrice,
        keyLevels: mockKeyLevels,
        atr: 2.5,
        expirationISO,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      // Same inputs should produce same outputs
      expect(result1.targetPrice).toBe(result2.targetPrice);
      expect(result1.stopLoss).toBe(result2.stopLoss);
    });
  });

  describe("Chart Levels Generation", () => {
    const createMockTrade = (entryPrice: number, targetPrice: number, stopLoss: number): Trade => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1);

      return {
        id: "test-trade-1",
        ticker: "SPY",
        contract: {
          id: "SPY-500C-2024-11-20",
          strike: 500,
          expiry: expiry.toISOString().split("T")[0],
          expiryDate: expiry,
          daysToExpiry: 1,
          type: "C",
          mid: entryPrice,
          bid: entryPrice - 0.05,
          ask: entryPrice + 0.05,
          volume: 1000,
          openInterest: 5000,
        } as Contract,
        tradeType: "Day",
        state: "ENTERED",
        entryPrice,
        targetPrice,
        stopLoss,
        currentPrice: entryPrice,
        movePercent: 0,
        discordChannels: [],
        challenges: [],
        updates: [],
      };
    };

    it("should generate chart levels with TP and SL", () => {
      const trade = createMockTrade(5.0, 6.5, 4.0);

      const levels = buildChartLevelsForTrade(trade, mockKeyLevels);

      // Find TP and SL levels
      const tpLevels = levels.filter((l) => l.type === "TP");
      const slLevels = levels.filter((l) => l.type === "SL");

      expect(tpLevels.length).toBeGreaterThan(0);
      expect(slLevels.length).toBeGreaterThan(0);

      // Verify TP price
      const tp1 = tpLevels.find((l) => l.label === "TP1");
      expect(tp1).toBeDefined();
      expect(tp1?.price).toBe(6.5);

      // Verify SL price
      const sl = slLevels.find((l) => l.label === "SL");
      expect(sl).toBeDefined();
      expect(sl?.price).toBe(4.0);
    });

    it("should include Entry level for ENTERED trades", () => {
      const trade = createMockTrade(5.0, 6.5, 4.0);

      const levels = buildChartLevelsForTrade(trade, mockKeyLevels);

      const entryLevel = levels.find((l) => l.type === "ENTRY");
      expect(entryLevel).toBeDefined();
      expect(entryLevel?.price).toBe(5.0);
    });

    it("should generate key levels (VWAP, ORB, etc.)", () => {
      const trade = createMockTrade(5.0, 6.5, 4.0);

      const levels = buildChartLevelsForTrade(trade, mockKeyLevels);

      // Should have various key levels (VWAP, ORB, Prior Day)
      const keyLevelTypes = [
        "PREMARKET_HIGH",
        "PREMARKET_LOW",
        "ORB_HIGH",
        "ORB_LOW",
        "PREV_DAY_HIGH",
        "PREV_DAY_LOW",
        "VWAP",
      ];
      const keyLevelsFound = levels.filter((l) => keyLevelTypes.includes(l.type));

      expect(keyLevelsFound.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing keyLevels gracefully", () => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1);
      const expirationISO = expiry.toISOString();

      const result = calculateRisk({
        entryPrice: 5.0,
        currentUnderlyingPrice: 100,
        currentOptionMid: 5.0,
        keyLevels: {
          preMarketHigh: 0,
          preMarketLow: 0,
          orbHigh: 0,
          orbLow: 0,
          priorDayHigh: 0,
          priorDayLow: 0,
          vwap: 0,
          vwapUpperBand: 0,
          vwapLowerBand: 0,
          bollingerUpper: 0,
          bollingerLower: 0,
          weeklyHigh: 0,
          weeklyLow: 0,
          monthlyHigh: 0,
          monthlyLow: 0,
          quarterlyHigh: 0,
          quarterlyLow: 0,
          yearlyHigh: 0,
          yearlyLow: 0,
        },
        atr: 2.5,
        expirationISO,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      // Should still calculate TP/SL using ATR-based fallback
      expect(result.targetPrice).toBeGreaterThan(5.0);
      expect(result.stopLoss).toBeLessThan(5.0);
    });

    it("should handle missing ATR gracefully", () => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1);
      const expirationISO = expiry.toISOString();

      const result = calculateRisk({
        entryPrice: 5.0,
        currentUnderlyingPrice: 100,
        currentOptionMid: 5.0,
        keyLevels: mockKeyLevels,
        atr: 0, // No ATR data
        expirationISO,
        delta: 0.5,
        gamma: 0.02,
        defaults: {
          mode: "calculated",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      // Should still calculate using key levels
      expect(result.targetPrice).toBeGreaterThan(5.0);
      expect(result.stopLoss).toBeLessThan(5.0);
    });

    it("should handle percent mode fallback", () => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1);
      const expirationISO = expiry.toISOString();

      const result = calculateRisk({
        entryPrice: 5.0,
        currentUnderlyingPrice: 100,
        currentOptionMid: 5.0,
        keyLevels: mockKeyLevels,
        expirationISO,
        defaults: {
          mode: "percent",
          tpPercent: 50,
          slPercent: 30,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });

      // Percent mode: +50% TP, -30% SL
      expect(result.targetPrice).toBe(7.5); // 5.00 * 1.5
      expect(result.stopLoss).toBe(3.5); // 5.00 * 0.7
    });
  });
});
