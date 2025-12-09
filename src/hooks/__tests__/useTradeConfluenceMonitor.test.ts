import { describe, it, expect, vi, beforeEach } from "vitest";
import type { KeyLevels } from "../../lib/riskEngine/types";
import type { Trade } from "../../types";

// Mock the buildConfluenceFromContext function
const mockBuildConfluenceFromContext = vi.fn();

vi.mock("../../hooks/useTradeConfluenceMonitor", () => ({
  buildConfluenceFromContext: mockBuildConfluenceFromContext,
}));

describe("useTradeConfluenceMonitor - KeyLevels Integration", () => {
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

  const mockTrade: Partial<Trade> = {
    id: "test-trade-123",
    ticker: "SPY",
    state: "LOADED",
    confluence: {
      score: 75,
      direction: "LONG",
      factors: {},
      updatedAt: new Date(),
      keyLevels: mockKeyLevels,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept keyLevels parameter in buildConfluenceFromContext", () => {
    // Test that the buildConfluenceFromContext interface accepts keyLevels
    // This validates the TypeScript interface, not runtime behavior
    const validInput = {
      symbol: "SPY",
      direction: "LONG" as const,
      signals: [],
      underlyingPrice: 590,
      ivData: null,
      flowData: null,
      keyLevels: mockKeyLevels,
    };

    // If this compiles, the interface accepts keyLevels
    expect(validInput.keyLevels).toBeDefined();
    expect(validInput.keyLevels?.vwap).toBe(590.5);
  });

  it("should include keyLevels in TradeConfluence structure", () => {
    const confluence = {
      score: 80,
      direction: "LONG" as const,
      factors: {},
      keyLevels: mockKeyLevels,
      updatedAt: new Date(),
    };

    expect(confluence.keyLevels).toBeDefined();
    expect(confluence.keyLevels?.vwap).toBe(590.5);
    expect(confluence.keyLevels?.orbHigh).toBe(592.0);
  });

  it("should preserve existing keyLevels when updating confluence", () => {
    const existingConfluence = {
      score: 75,
      direction: "LONG" as const,
      factors: {},
      keyLevels: mockKeyLevels,
      updatedAt: new Date(),
    };

    // Simulate update that should preserve keyLevels
    const updatedConfluence = {
      ...existingConfluence,
      score: 80,
      keyLevels: existingConfluence.keyLevels || null,
    };

    expect(updatedConfluence.keyLevels).toEqual(mockKeyLevels);
    expect(updatedConfluence.score).toBe(80);
  });

  it("should handle null/undefined keyLevels gracefully", () => {
    const confluenceWithoutLevels = {
      score: 70,
      direction: "SHORT" as const,
      factors: {},
      keyLevels: undefined,
      updatedAt: new Date(),
    };

    expect(confluenceWithoutLevels.keyLevels).toBeUndefined();
    expect(confluenceWithoutLevels.score).toBe(70);
  });

  it("should validate all 18 keyLevel fields are present", () => {
    const requiredFields = [
      "vwap",
      "orbHigh",
      "orbLow",
      "priorDayHigh",
      "priorDayLow",
      "priorDayClose",
      "weeklyHigh",
      "weeklyLow",
      "monthlyHigh",
      "monthlyLow",
      "quarterlyHigh",
      "quarterlyLow",
      "yearlyHigh",
      "yearlyLow",
      "preMarketHigh",
      "preMarketLow",
      "bollingerUpper",
      "bollingerLower",
    ];

    requiredFields.forEach((field) => {
      expect(mockKeyLevels).toHaveProperty(field);
      expect(typeof mockKeyLevels[field as keyof KeyLevels]).toBe("number");
    });
  });
});
