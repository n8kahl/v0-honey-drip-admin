/**
 * Tests for useEdgeStats hook and utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useEdgeStats,
  formatOpportunityType,
  formatStyle,
  formatWinRate,
  formatProfitFactor,
  formatRMultiple,
  formatLastUpdated,
  getConfidenceBadge,
  isProfitable,
  isUnderperforming,
  type EdgeSummaryResponse,
  type TopSetupsResponse,
  type EdgeStat,
} from "../useEdgeStats";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock buildApiUrl
vi.mock("../../lib/env", () => ({
  buildApiUrl: (path: string) => `http://localhost:3000${path}`,
}));

describe("useEdgeStats", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches edge stats on mount", async () => {
    const mockSummary: EdgeSummaryResponse = {
      stats: [
        {
          opportunityType: "breakout_bullish",
          recommendedStyle: "day_trade",
          winRate: 55.5,
          profitFactor: 1.8,
          totalExited: 40,
          avgRiskReward: 2.1,
          totalWins: 22,
          totalLosses: 18,
          avgRMultiple: 0.45,
          lastUpdated: "2026-01-14T10:00:00Z",
          confidence: "high",
        },
      ],
      windowDays: 30,
      totalSignals: 100,
      totalExited: 40,
      lastUpdated: "2026-01-14T10:00:00Z",
    };

    const mockTopSetups: TopSetupsResponse = {
      setups: [
        {
          opportunityType: "breakout_bullish",
          recommendedStyle: "day_trade",
          winRate: 55.5,
          profitFactor: 1.8,
          totalExited: 40,
          avgRiskReward: 2.1,
          totalWins: 22,
          totalLosses: 18,
          avgRMultiple: 0.45,
          lastUpdated: "2026-01-14T10:00:00Z",
          confidence: "high",
          expectancyScore: 75.5,
          rank: 1,
        },
      ],
      windowDays: 30,
      limit: 5,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTopSetups,
      });

    const { result } = renderHook(() => useEdgeStats());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.summary).toBe(null);
    expect(result.current.topSetups).toBe(null);
    expect(result.current.error).toBe(null);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual(mockSummary);
    expect(result.current.topSetups).toEqual(mockTopSetups);
    expect(result.current.error).toBe(null);
  });

  it("handles fetch error for summary", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useEdgeStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toBe(null);
    expect(result.current.error).toContain("Failed to fetch edge summary");
  });

  it("handles network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useEdgeStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toBe(null);
    expect(result.current.error).toBe("Network error");
  });

  it("uses custom window days parameter", async () => {
    const mockSummary: EdgeSummaryResponse = {
      stats: [],
      windowDays: 7,
      totalSignals: 0,
      totalExited: 0,
      lastUpdated: null,
    };

    const mockTopSetups: TopSetupsResponse = {
      setups: [],
      windowDays: 7,
      limit: 5,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTopSetups,
      });

    const { result } = renderHook(() => useEdgeStats(7));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/performance/edge-summary?windowDays=7"
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/performance/top-setups?windowDays=7&limit=5"
    );
  });

  it("provides refetch function", async () => {
    const mockSummary: EdgeSummaryResponse = {
      stats: [],
      windowDays: 30,
      totalSignals: 0,
      totalExited: 0,
      lastUpdated: null,
    };

    const mockTopSetups: TopSetupsResponse = {
      setups: [],
      windowDays: 30,
      limit: 5,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTopSetups,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTopSetups,
      });

    const { result } = renderHook(() => useEdgeStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Call refetch
    await result.current.refetch();

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe("formatOpportunityType", () => {
  it("formats snake_case to Title Case", () => {
    expect(formatOpportunityType("breakout_bullish")).toBe("Breakout Bullish");
    expect(formatOpportunityType("mean_reversion_long")).toBe("Mean Reversion Long");
    expect(formatOpportunityType("gamma_squeeze_bearish")).toBe("Gamma Squeeze Bearish");
  });
});

describe("formatStyle", () => {
  it("formats common styles", () => {
    expect(formatStyle("scalp")).toBe("Scalp");
    expect(formatStyle("day_trade")).toBe("Day Trade");
    expect(formatStyle("swing")).toBe("Swing");
  });

  it("handles unknown styles", () => {
    expect(formatStyle("unknown_style")).toBe("Unknown Style");
  });
});

describe("formatWinRate", () => {
  it("formats win rate as percentage (0-100 scale)", () => {
    expect(formatWinRate(50)).toBe("50.0%");
    expect(formatWinRate(65.5)).toBe("65.5%");
    expect(formatWinRate(12.34)).toBe("12.3%");
    expect(formatWinRate(100)).toBe("100.0%");
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

describe("formatRMultiple", () => {
  it("formats positive R-multiples with sign", () => {
    expect(formatRMultiple(1.5)).toBe("+1.50R");
    expect(formatRMultiple(0.45)).toBe("+0.45R");
    expect(formatRMultiple(0)).toBe("+0.00R");
  });

  it("formats negative R-multiples", () => {
    expect(formatRMultiple(-1.0)).toBe("-1.00R");
    expect(formatRMultiple(-0.5)).toBe("-0.50R");
  });

  it("returns dash for invalid values", () => {
    expect(formatRMultiple(Infinity)).toBe("—");
    expect(formatRMultiple(-Infinity)).toBe("—");
    expect(formatRMultiple(NaN)).toBe("—");
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

describe("getConfidenceBadge", () => {
  it("returns correct badge labels", () => {
    expect(getConfidenceBadge("high")).toBe("High Confidence");
    expect(getConfidenceBadge("medium")).toBe("Medium Confidence");
    expect(getConfidenceBadge("low")).toBe("Low Sample");
  });
});

describe("isProfitable", () => {
  it("returns true for profitable setups", () => {
    const stat: EdgeStat = {
      opportunityType: "breakout_bullish",
      recommendedStyle: "day_trade",
      winRate: 55,
      profitFactor: 1.5,
      totalExited: 40,
      avgRiskReward: 2.0,
      totalWins: 22,
      totalLosses: 18,
      avgRMultiple: 0.5,
      lastUpdated: null,
      confidence: "high",
    };
    expect(isProfitable(stat)).toBe(true);
  });

  it("returns false for low win rate", () => {
    const stat: EdgeStat = {
      opportunityType: "breakout_bullish",
      recommendedStyle: "day_trade",
      winRate: 45,
      profitFactor: 1.5,
      totalExited: 40,
      avgRiskReward: 2.0,
      totalWins: 18,
      totalLosses: 22,
      avgRMultiple: 0.5,
      lastUpdated: null,
      confidence: "high",
    };
    expect(isProfitable(stat)).toBe(false);
  });

  it("returns false for low profit factor", () => {
    const stat: EdgeStat = {
      opportunityType: "breakout_bullish",
      recommendedStyle: "day_trade",
      winRate: 55,
      profitFactor: 0.9,
      totalExited: 40,
      avgRiskReward: 2.0,
      totalWins: 22,
      totalLosses: 18,
      avgRMultiple: -0.2,
      lastUpdated: null,
      confidence: "high",
    };
    expect(isProfitable(stat)).toBe(false);
  });
});

describe("isUnderperforming", () => {
  it("returns true for low win rate", () => {
    const stat: EdgeStat = {
      opportunityType: "breakout_bullish",
      recommendedStyle: "day_trade",
      winRate: 40,
      profitFactor: 1.2,
      totalExited: 40,
      avgRiskReward: 2.0,
      totalWins: 16,
      totalLosses: 24,
      avgRMultiple: -0.2,
      lastUpdated: null,
      confidence: "high",
    };
    expect(isUnderperforming(stat)).toBe(true);
  });

  it("returns true for low profit factor", () => {
    const stat: EdgeStat = {
      opportunityType: "breakout_bullish",
      recommendedStyle: "day_trade",
      winRate: 50,
      profitFactor: 0.8,
      totalExited: 40,
      avgRiskReward: 2.0,
      totalWins: 20,
      totalLosses: 20,
      avgRMultiple: -0.3,
      lastUpdated: null,
      confidence: "high",
    };
    expect(isUnderperforming(stat)).toBe(true);
  });

  it("returns false for acceptable performance", () => {
    const stat: EdgeStat = {
      opportunityType: "breakout_bullish",
      recommendedStyle: "day_trade",
      winRate: 50,
      profitFactor: 1.0,
      totalExited: 40,
      avgRiskReward: 2.0,
      totalWins: 20,
      totalLosses: 20,
      avgRMultiple: 0.0,
      lastUpdated: null,
      confidence: "high",
    };
    expect(isUnderperforming(stat)).toBe(false);
  });
});
