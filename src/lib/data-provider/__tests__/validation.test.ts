/**
 * Unit Tests - Data Validation Layer
 * @module data-provider/__tests__/validation.test
 */

import { describe, it, expect } from "vitest";
import {
  validateOptionContract,
  validateOptionChain,
  validateIndexSnapshot,
  createQualityFlags,
} from "../validation";
import type { OptionContractData, OptionChainData, IndexSnapshot } from "../types";

// ============================================================================
// TEST DATA
// ============================================================================

const mockOptionContract: OptionContractData = {
  ticker: "SPY   240119C00450000",
  rootSymbol: "SPY",
  strike: 450,
  expiration: "2024-01-19",
  type: "call",
  dte: 5,

  quote: {
    bid: 2.5,
    ask: 2.6,
    mid: 2.55,
    last: 2.55,
    bidSize: 100,
    askSize: 100,
  },

  greeks: {
    delta: 0.65,
    gamma: 0.02,
    theta: -0.05,
    vega: 0.15,
    rho: 0.1,
    iv: 0.22,
    ivBid: 0.21,
    ivAsk: 0.23,
  },

  liquidity: {
    volume: 500,
    openInterest: 5000,
    spreadPercent: 0.39,
    spreadPoints: 0.1,
    liquidityQuality: "excellent",
  },

  quality: {
    source: "massive",
    isStale: false,
    hasWarnings: false,
    warnings: [],
    confidence: 100,
    updatedAt: Date.now(),
  },
};

// ============================================================================
// TESTS - OPTION CONTRACT VALIDATION
// ============================================================================

describe("validateOptionContract", () => {
  it("should validate a good contract", () => {
    const result = validateOptionContract(mockOptionContract);

    expect(result.isValid).toBe(true);
    expect(result.quality).toBe("excellent");
    expect(result.errors).toHaveLength(0);
  });

  it("should reject contract with invalid strike", () => {
    const contract = { ...mockOptionContract, strike: -100 };
    const result = validateOptionContract(contract);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Invalid strike: -100");
  });

  it("should reject contract with inverted quote", () => {
    const contract = {
      ...mockOptionContract,
      quote: { ...mockOptionContract.quote, bid: 3.0, ask: 2.0 },
    };
    const result = validateOptionContract(contract);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Inverted"))).toBe(true);
  });

  it("should warn on wide spread", () => {
    const contract = {
      ...mockOptionContract,
      quote: { ...mockOptionContract.quote, bid: 2.0, ask: 4.0 },
    };
    const result = validateOptionContract(contract);

    expect(result.quality).not.toBe("excellent");
    expect(result.warnings.some((w) => w.includes("spread"))).toBe(true);
  });

  it("should warn on zero volume", () => {
    const contract = {
      ...mockOptionContract,
      liquidity: { ...mockOptionContract.liquidity, volume: 0 },
    };
    const result = validateOptionContract(contract);

    expect(result.warnings.some((w) => w.includes("Zero volume"))).toBe(true);
  });

  it("should handle stale data", () => {
    const oldTime = Date.now() - 20000; // 20 seconds ago (between 15s and 30s thresholds)
    const contract = {
      ...mockOptionContract,
      quality: { ...mockOptionContract.quality, updatedAt: oldTime },
    };
    const result = validateOptionContract(contract);

    // Data between 15-30s old should trigger a warning, not an error
    expect(result.warnings.some((w) => w.includes("old"))).toBe(true);
  });

  it("should penalize confidence for old data", () => {
    const oldTime = Date.now() - 30000; // 30 seconds ago
    const contract = {
      ...mockOptionContract,
      quality: { ...mockOptionContract.quality, updatedAt: oldTime },
    };
    const result = validateOptionContract(contract);

    expect(result.confidence).toBeLessThan(100);
  });
});

// ============================================================================
// TESTS - OPTIONS CHAIN VALIDATION
// ============================================================================

describe("validateOptionChain", () => {
  const mockChain: OptionChainData = {
    underlying: "SPY",
    underlyingPrice: 450,
    contracts: [
      {
        ...mockOptionContract,
        strike: 450,
        type: "call",
      },
      {
        ...mockOptionContract,
        strike: 450,
        type: "put",
      },
      {
        ...mockOptionContract,
        strike: 445,
        type: "call",
      },
    ],
    quality: {
      source: "massive",
      isStale: false,
      hasWarnings: false,
      warnings: [],
      confidence: 100,
      updatedAt: Date.now(),
    },
  };

  it("should validate a good chain", () => {
    const result = validateOptionChain(mockChain);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject empty chain", () => {
    const chain = { ...mockChain, contracts: [] };
    const result = validateOptionChain(chain);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Empty"))).toBe(true);
  });

  it("should warn if no calls", () => {
    const chain = {
      ...mockChain,
      contracts: mockChain.contracts.filter((c) => c.type === "put"),
    };
    const result = validateOptionChain(chain);

    expect(result.warnings.some((w) => w.includes("No calls"))).toBe(true);
  });

  it("should warn if no puts", () => {
    const chain = {
      ...mockChain,
      contracts: mockChain.contracts.filter((c) => c.type === "call"),
    };
    const result = validateOptionChain(chain);

    expect(result.warnings.some((w) => w.includes("No puts"))).toBe(true);
  });

  it("should handle invalid underlying price", () => {
    const chain = { ...mockChain, underlyingPrice: -100 };
    const result = validateOptionChain(chain);

    expect(result.isValid).toBe(false);
  });
});

// ============================================================================
// TESTS - INDEX SNAPSHOT VALIDATION
// ============================================================================

describe("validateIndexSnapshot", () => {
  const mockSnapshot: IndexSnapshot = {
    symbol: "SPX",
    quote: {
      symbol: "SPX",
      value: 4500,
      change: 50,
      changePercent: 1.12,
      open: 4480,
      high: 4510,
      low: 4470,
      prevClose: 4450,
    },
    timeframes: new Map([
      [
        "1m",
        {
          period: "1m",
          candles: [
            {
              time: Date.now(),
              open: 4495,
              high: 4510,
              low: 4480,
              close: 4500,
              volume: 1000000,
            },
          ],
          indicators: {},
          updatedAt: Date.now(),
        },
      ],
    ]),
    quality: {
      source: "massive",
      isStale: false,
      hasWarnings: false,
      warnings: [],
      confidence: 100,
      updatedAt: Date.now(),
    },
    updatedAt: Date.now(),
  };

  it("should validate a good snapshot", () => {
    const result = validateIndexSnapshot(mockSnapshot);

    expect(result.isValid).toBe(true);
  });

  it("should reject invalid value", () => {
    const snapshot = {
      ...mockSnapshot,
      quote: { ...mockSnapshot.quote, value: -100 },
    };
    const result = validateIndexSnapshot(snapshot);

    expect(result.isValid).toBe(false);
  });

  it("should warn on inverted candles", () => {
    const snapshot = {
      ...mockSnapshot,
      timeframes: new Map([
        [
          "1m",
          {
            period: "1m",
            candles: [
              {
                time: Date.now(),
                open: 4495,
                high: 4400, // High < Low
                low: 4500,
                close: 4450,
                volume: 1000000,
              },
            ],
            indicators: {},
            updatedAt: Date.now(),
          },
        ],
      ]),
    };
    const result = validateIndexSnapshot(snapshot);

    // Inverted candles are errors, not warnings
    expect(result.errors.some((e) => e.includes("inverted"))).toBe(true);
    expect(result.isValid).toBe(false);
  });
});

// ============================================================================
// TESTS - QUALITY FLAGS CREATION
// ============================================================================

describe("createQualityFlags", () => {
  it("should create flags from validation result", () => {
    const validation = {
      isValid: true,
      quality: "excellent" as const,
      confidence: 100,
      errors: [],
      warnings: [],
      info: [],
    };

    const flags = createQualityFlags(validation, "massive");

    expect(flags.source).toBe("massive");
    expect(flags.quality).toBe("excellent");
    expect(flags.confidence).toBe(100);
    expect(flags.hasWarnings).toBe(false);
  });

  it("should include fallback reason", () => {
    const validation = {
      isValid: true,
      quality: "good" as const,
      confidence: 80,
      errors: [],
      warnings: ["Some warning"],
      info: [],
    };

    const flags = createQualityFlags(validation, "tradier", "Massive provider failed");

    expect(flags.source).toBe("tradier");
    expect(flags.fallbackReason).toBe("Massive provider failed");
    expect(flags.hasWarnings).toBe(true);
  });
});
