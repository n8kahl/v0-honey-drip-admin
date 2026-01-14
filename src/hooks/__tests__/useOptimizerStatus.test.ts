/**
 * Tests for useOptimizerStatus hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useOptimizerStatus,
  getTopDetectors,
  formatWinRate,
  formatProfitFactor,
  formatLastUpdated,
  type OptimizerStatusResponse,
} from "../useOptimizerStatus";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock buildApiUrl
vi.mock("../../lib/env", () => ({
  buildApiUrl: (path: string) => `http://localhost:3000${path}`,
}));

describe("useOptimizerStatus", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches optimizer status on mount", async () => {
    const mockData: OptimizerStatusResponse = {
      paramsConfig: {
        parameters: {
          minScores: { scalp: 80, day: 80, swing: 80 },
          ivBoosts: { lowIV: 0.15, highIV: -0.2 },
          gammaBoosts: { shortGamma: 0.15, longGamma: -0.1 },
          flowBoosts: { aligned: 0.2, opposed: -0.15 },
          mtfWeights: { weekly: 3, daily: 2, hourly: 1, fifteenMin: 0.5 },
          riskReward: { targetMultiple: 2.42, stopMultiple: 1.16, maxHoldBars: 16 },
        },
        performance: { winRate: 0.55, profitFactor: 1.8, totalTrades: 100 },
        timestamp: "2026-01-04T07:57:37.251Z",
        phase: 4,
      },
      performanceSummary: { winRate: 0.55, profitFactor: 1.8, totalTrades: 100 },
      report: null,
      missingFiles: ["optimized-report.json"],
      lastUpdated: "2026-01-04T07:57:37.251Z",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useOptimizerStatus());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBe(null);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/optimizer/status");
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useOptimizerStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toContain("Failed to fetch optimizer status");
  });

  it("handles network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useOptimizerStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe("Network error");
  });

  it("provides refetch function", async () => {
    const mockData: OptimizerStatusResponse = {
      paramsConfig: null,
      performanceSummary: null,
      report: null,
      missingFiles: ["optimized-params.json", "optimized-report.json"],
      lastUpdated: null,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useOptimizerStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Call refetch
    await result.current.refetch();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("getTopDetectors", () => {
  it("returns empty array for null report", () => {
    expect(getTopDetectors(null)).toEqual([]);
  });

  it("returns empty array for report without perDetectorStats", () => {
    const report = {
      timestamp: "2026-01-04T07:57:37.251Z",
      parametersSummary: { targetMultiple: 2.42, stopMultiple: 1.16, maxHoldBars: 16 },
      perDetectorStats: [],
      ranking: [],
      testedSymbols: ["SPY"],
      windowStartDate: "2025-12-01",
      windowEndDate: "2026-01-01",
      totalTrades: 0,
      avgWinRate: 0,
      avgProfitFactor: 0,
    };
    expect(getTopDetectors(report)).toEqual([]);
  });

  it("filters detectors with fewer than 3 trades", () => {
    const report = {
      timestamp: "2026-01-04T07:57:37.251Z",
      parametersSummary: { targetMultiple: 2.42, stopMultiple: 1.16, maxHoldBars: 16 },
      perDetectorStats: [
        { detector: "breakout_bullish", winRate: 0.8, profitFactor: 2.0, totalTrades: 2 },
        { detector: "mean_reversion", winRate: 0.6, profitFactor: 1.5, totalTrades: 5 },
      ],
      ranking: ["breakout_bullish", "mean_reversion"],
      testedSymbols: ["SPY"],
      windowStartDate: "2025-12-01",
      windowEndDate: "2026-01-01",
      totalTrades: 7,
      avgWinRate: 0.7,
      avgProfitFactor: 1.75,
    };

    const result = getTopDetectors(report);
    expect(result).toHaveLength(1);
    expect(result[0].detector).toBe("mean_reversion");
  });

  it("sorts by win rate descending", () => {
    const report = {
      timestamp: "2026-01-04T07:57:37.251Z",
      parametersSummary: { targetMultiple: 2.42, stopMultiple: 1.16, maxHoldBars: 16 },
      perDetectorStats: [
        { detector: "detector_a", winRate: 0.5, profitFactor: 1.2, totalTrades: 10 },
        { detector: "detector_b", winRate: 0.7, profitFactor: 1.8, totalTrades: 8 },
        { detector: "detector_c", winRate: 0.6, profitFactor: 1.5, totalTrades: 12 },
      ],
      ranking: [],
      testedSymbols: ["SPY"],
      windowStartDate: "2025-12-01",
      windowEndDate: "2026-01-01",
      totalTrades: 30,
      avgWinRate: 0.6,
      avgProfitFactor: 1.5,
    };

    const result = getTopDetectors(report);
    expect(result[0].detector).toBe("detector_b");
    expect(result[1].detector).toBe("detector_c");
    expect(result[2].detector).toBe("detector_a");
  });

  it("respects limit parameter", () => {
    const report = {
      timestamp: "2026-01-04T07:57:37.251Z",
      parametersSummary: { targetMultiple: 2.42, stopMultiple: 1.16, maxHoldBars: 16 },
      perDetectorStats: [
        { detector: "detector_a", winRate: 0.5, profitFactor: 1.2, totalTrades: 10 },
        { detector: "detector_b", winRate: 0.7, profitFactor: 1.8, totalTrades: 8 },
        { detector: "detector_c", winRate: 0.6, profitFactor: 1.5, totalTrades: 12 },
      ],
      ranking: [],
      testedSymbols: ["SPY"],
      windowStartDate: "2025-12-01",
      windowEndDate: "2026-01-01",
      totalTrades: 30,
      avgWinRate: 0.6,
      avgProfitFactor: 1.5,
    };

    const result = getTopDetectors(report, 2);
    expect(result).toHaveLength(2);
  });
});

describe("formatWinRate", () => {
  it("formats win rate as percentage", () => {
    expect(formatWinRate(0.5)).toBe("50.0%");
    expect(formatWinRate(0.65)).toBe("65.0%");
    expect(formatWinRate(0.123)).toBe("12.3%");
    expect(formatWinRate(1.0)).toBe("100.0%");
    expect(formatWinRate(0)).toBe("0.0%");
  });
});

describe("formatProfitFactor", () => {
  it("formats profit factor with 2 decimals", () => {
    expect(formatProfitFactor(1.5)).toBe("1.50");
    expect(formatProfitFactor(2.123)).toBe("2.12");
    expect(formatProfitFactor(0.99)).toBe("0.99");
  });

  it("returns dash for zero or invalid values", () => {
    expect(formatProfitFactor(0)).toBe("—");
    expect(formatProfitFactor(Infinity)).toBe("—");
    expect(formatProfitFactor(-Infinity)).toBe("—");
  });
});

describe("formatLastUpdated", () => {
  it("returns 'Never' for null timestamp", () => {
    expect(formatLastUpdated(null)).toBe("Never");
  });

  it("returns 'Just now' for very recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatLastUpdated(now)).toBe("Just now");
  });

  it("returns minutes ago for timestamps within an hour", () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(formatLastUpdated(thirtyMinsAgo)).toBe("30 mins ago");
  });

  it("returns hours ago for timestamps within a day", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(formatLastUpdated(fiveHoursAgo)).toBe("5 hours ago");
  });

  it("returns days ago for older timestamps", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatLastUpdated(threeDaysAgo)).toBe("3 days ago");
  });
});
