import { describe, it, expect } from "vitest";
import {
  calculateATR,
  calculateVWAP,
  calculateBollingerBands,
  calculateORB,
  calculatePreMarketLevels,
} from "../indicators";
import { Bar } from "../types";

describe("Risk Engine Indicators", () => {
  const mockBars: Bar[] = [
    { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
    { timestamp: 2000, open: 103, high: 107, low: 102, close: 106, volume: 1200 },
    { timestamp: 3000, open: 106, high: 110, low: 105, close: 108, volume: 1500 },
    { timestamp: 4000, open: 108, high: 112, low: 107, close: 111, volume: 1300 },
    { timestamp: 5000, open: 111, high: 115, low: 110, close: 113, volume: 1400 },
    { timestamp: 6000, open: 113, high: 116, low: 111, close: 114, volume: 1100 },
    { timestamp: 7000, open: 114, high: 118, low: 113, close: 117, volume: 1600 },
    { timestamp: 8000, open: 117, high: 120, low: 116, close: 119, volume: 1250 },
    { timestamp: 9000, open: 119, high: 122, low: 118, close: 121, volume: 1350 },
    { timestamp: 10000, open: 121, high: 124, low: 120, close: 122, volume: 1450 },
    { timestamp: 11000, open: 122, high: 125, low: 121, close: 124, volume: 1200 },
    { timestamp: 12000, open: 124, high: 127, low: 123, close: 126, volume: 1500 },
    { timestamp: 13000, open: 126, high: 128, low: 125, close: 127, volume: 1300 },
    { timestamp: 14000, open: 127, high: 130, low: 126, close: 129, volume: 1400 },
    { timestamp: 15000, open: 129, high: 131, low: 128, close: 130, volume: 1250 },
  ];

  describe("calculateATR", () => {
    it("should calculate ATR correctly", () => {
      const atr = calculateATR(mockBars, 14);
      expect(atr).toBeGreaterThan(0);
      expect(atr).toBeLessThan(10); // Reasonable range for these bars
    });

    it("should return 0 for insufficient data", () => {
      const atr = calculateATR(mockBars.slice(0, 5), 14);
      expect(atr).toBe(0);
    });
  });

  describe("calculateVWAP", () => {
    it("should calculate VWAP and bands correctly", () => {
      const { vwap, upperBand, lowerBand } = calculateVWAP(mockBars);

      expect(vwap).toBeGreaterThan(0);
      expect(upperBand).toBeGreaterThan(vwap);
      expect(lowerBand).toBeLessThan(vwap);
    });

    it("should handle empty bars", () => {
      const { vwap, upperBand, lowerBand } = calculateVWAP([]);
      expect(vwap).toBe(0);
      expect(upperBand).toBe(0);
      expect(lowerBand).toBe(0);
    });
  });

  describe("calculateBollingerBands", () => {
    it("should calculate Bollinger Bands correctly", () => {
      // Use period=10 since we have 15 bars (need at least 10)
      const { middle, upper, lower } = calculateBollingerBands(mockBars, 10, 2);

      expect(middle).toBeGreaterThan(0);
      expect(upper).toBeGreaterThan(middle);
      expect(lower).toBeLessThan(middle);
    });

    it("should return 0 for insufficient data", () => {
      const { middle, upper, lower } = calculateBollingerBands(mockBars.slice(0, 5), 20, 2);
      expect(middle).toBe(0);
      expect(upper).toBe(0);
      expect(lower).toBe(0);
    });
  });

  describe("calculateORB", () => {
    it("should calculate ORB high/low correctly", () => {
      const { high, low } = calculateORB(mockBars, 5);

      expect(high).toBe(115); // Max high of first 5 bars
      expect(low).toBe(98); // Min low of first 5 bars
    });

    it("should handle empty bars", () => {
      const { high, low } = calculateORB([], 5);
      expect(high).toBe(0);
      expect(low).toBe(0);
    });
  });

  describe("calculatePreMarketLevels", () => {
    it("should calculate pre-market high/low correctly", () => {
      const { high, low } = calculatePreMarketLevels(mockBars);

      expect(high).toBe(131); // Max high of all bars
      expect(low).toBe(98); // Min low of all bars
    });

    it("should handle empty bars", () => {
      const { high, low } = calculatePreMarketLevels([]);
      expect(high).toBe(0);
      expect(low).toBe(0);
    });
  });
});
