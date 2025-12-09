import { describe, it, expect } from "vitest";
import type { TradeConfluence } from "../../types";
import type { KeyLevels } from "../../lib/riskEngine/types";

describe("TradeConfluence Interface - KeyLevels Field", () => {
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

  it("should create TradeConfluence with keyLevels", () => {
    const confluence: TradeConfluence = {
      score: 80,
      direction: "LONG",
      factors: {
        technicalScore: 85,
        volumeScore: 75,
        sentimentScore: 80,
      },
      keyLevels: mockKeyLevels,
      updatedAt: new Date(),
    };

    expect(confluence.keyLevels).toBeDefined();
    expect(confluence.keyLevels?.vwap).toBe(590.5);
    expect(confluence.keyLevels?.orbHigh).toBe(592.0);
  });

  it("should create TradeConfluence without keyLevels (optional)", () => {
    const confluence: TradeConfluence = {
      score: 75,
      direction: "SHORT",
      factors: {},
      updatedAt: new Date(),
    };

    expect(confluence.keyLevels).toBeUndefined();
    expect(confluence.score).toBe(75);
  });

  it("should allow null keyLevels", () => {
    const confluence: TradeConfluence = {
      score: 70,
      direction: "LONG",
      factors: {},
      keyLevels: undefined,
      updatedAt: new Date(),
    };

    expect(confluence.keyLevels).toBeUndefined();
  });

  it("should serialize to JSON correctly with keyLevels", () => {
    const confluence: TradeConfluence = {
      score: 85,
      direction: "LONG",
      factors: {},
      keyLevels: mockKeyLevels,
      updatedAt: new Date("2025-12-08T12:00:00Z"),
    };

    const json = JSON.stringify(confluence);
    const parsed = JSON.parse(json);

    expect(parsed.keyLevels).toBeDefined();
    expect(parsed.keyLevels.vwap).toBe(590.5);
    expect(parsed.keyLevels.orbHigh).toBe(592.0);
  });

  it("should validate keyLevels structure when present", () => {
    const confluence: TradeConfluence = {
      score: 80,
      direction: "LONG",
      factors: {},
      keyLevels: mockKeyLevels,
      updatedAt: new Date(),
    };

    // Verify all required fields
    expect(confluence.keyLevels).toHaveProperty("vwap");
    expect(confluence.keyLevels).toHaveProperty("orbHigh");
    expect(confluence.keyLevels).toHaveProperty("orbLow");
    expect(confluence.keyLevels).toHaveProperty("priorDayHigh");
    expect(confluence.keyLevels).toHaveProperty("priorDayLow");
    expect(confluence.keyLevels).toHaveProperty("weeklyHigh");
    expect(confluence.keyLevels).toHaveProperty("weeklyLow");
    expect(confluence.keyLevels).toHaveProperty("monthlyHigh");
    expect(confluence.keyLevels).toHaveProperty("monthlyLow");
  });

  it("should maintain type safety for numeric values", () => {
    const confluence: TradeConfluence = {
      score: 80,
      direction: "LONG",
      factors: {},
      keyLevels: mockKeyLevels,
      updatedAt: new Date(),
    };

    if (confluence.keyLevels) {
      // All values should be numbers
      expect(typeof confluence.keyLevels.vwap).toBe("number");
      expect(typeof confluence.keyLevels.orbHigh).toBe("number");
      expect(typeof confluence.keyLevels.priorDayHigh).toBe("number");
      
      // Verify numeric operations work
      const range = confluence.keyLevels.orbHigh - confluence.keyLevels.orbLow;
      expect(range).toBe(4.0);
    }
  });

  it("should support database JSONB storage pattern", () => {
    const dbRecord = {
      id: "trade-123",
      ticker: "SPY",
      state: "LOADED",
      confluence: {
        score: 80,
        direction: "LONG",
        factors: {},
        keyLevels: mockKeyLevels,
        updatedAt: new Date().toISOString(),
      },
    };

    expect(dbRecord.confluence.keyLevels).toBeDefined();
    expect(dbRecord.confluence.keyLevels.vwap).toBe(590.5);
  });
});
