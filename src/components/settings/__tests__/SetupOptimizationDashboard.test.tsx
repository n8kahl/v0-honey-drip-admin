/**
 * SetupOptimizationDashboard Tests
 *
 * Tests the optimizer dashboard component rendering states:
 * - Loading state
 * - Error state
 * - No data state
 * - Full data rendering with all sections
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetupOptimizationDashboard } from "../SetupOptimizationDashboard";
import type { OptimizerStatusResponse } from "../../../hooks/useOptimizerStatus";

// Mock the useOptimizerStatus hook
const mockRefetch = vi.fn();
let mockHookReturn: {
  data: OptimizerStatusResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

vi.mock("../../../hooks/useOptimizerStatus", () => ({
  useOptimizerStatus: () => mockHookReturn,
  getTopDetectors: (report: any, limit: number = 10) => {
    if (!report?.perDetectorStats) return [];
    return [...report.perDetectorStats]
      .filter((d: any) => d.totalTrades >= 3)
      .sort((a: any, b: any) => b.winRate - a.winRate)
      .slice(0, limit);
  },
  formatWinRate: (wr: number) => `${(wr * 100).toFixed(1)}%`,
  formatProfitFactor: (pf: number) => (pf === 0 || !isFinite(pf) ? "—" : pf.toFixed(2)),
  formatLastUpdated: (ts: string | null) => (ts ? "9 days ago" : "Never"),
}));

describe("SetupOptimizationDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
  });

  describe("Loading State", () => {
    it("shows loading spinner when isLoading is true", () => {
      mockHookReturn = {
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("Loading optimizer status...")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error message when error is present", () => {
      mockHookReturn = {
        data: null,
        isLoading: false,
        error: "Network error: Failed to connect",
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("Failed to load optimizer status")).toBeInTheDocument();
      expect(screen.getByText("Network error: Failed to connect")).toBeInTheDocument();
    });

    it("shows retry button on error", () => {
      mockHookReturn = {
        data: null,
        isLoading: false,
        error: "Some error",
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it("calls refetch when retry button is clicked", async () => {
      mockHookReturn = {
        data: null,
        isLoading: false,
        error: "Some error",
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe("No Data State", () => {
    it("shows no data message when both config files are missing", () => {
      mockHookReturn = {
        data: {
          paramsConfig: null,
          performanceSummary: null,
          report: null,
          missingFiles: ["optimized-params.json", "optimized-report.json"],
          lastUpdated: null,
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("No Optimization Data")).toBeInTheDocument();
      expect(screen.getByText(/Run the optimizer to generate/)).toBeInTheDocument();
    });

    it("shows CLI commands when no data", () => {
      mockHookReturn = {
        data: {
          paramsConfig: null,
          performanceSummary: null,
          report: null,
          missingFiles: ["optimized-params.json", "optimized-report.json"],
          lastUpdated: null,
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("pnpm run optimizer")).toBeInTheDocument();
      expect(screen.getByText("pnpm run report")).toBeInTheDocument();
    });
  });

  describe("Data Loaded State", () => {
    const mockFullData: OptimizerStatusResponse = {
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
      report: {
        timestamp: "2026-01-04T07:57:37.251Z",
        parametersSummary: { targetMultiple: 2.42, stopMultiple: 1.16, maxHoldBars: 16 },
        perDetectorStats: [
          { detector: "breakout_bullish", winRate: 0.65, profitFactor: 2.1, totalTrades: 20 },
          { detector: "mean_reversion_long", winRate: 0.55, profitFactor: 1.5, totalTrades: 15 },
          { detector: "opening_drive_bearish", winRate: 0.45, profitFactor: 1.2, totalTrades: 10 },
        ],
        ranking: ["breakout_bullish", "mean_reversion_long", "opening_drive_bearish"],
        testedSymbols: ["SPY", "TSLA", "NVDA", "MSFT", "AMD"],
        windowStartDate: "2025-12-01",
        windowEndDate: "2026-01-01",
        totalTrades: 45,
        avgWinRate: 0.55,
        avgProfitFactor: 1.6,
      },
      missingFiles: [],
      lastUpdated: "2026-01-04T07:57:37.251Z",
    };

    it("renders header with title and refresh button", () => {
      mockHookReturn = {
        data: mockFullData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("Setup Detection & Optimization")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    });

    it("renders Last Optimization section", () => {
      mockHookReturn = {
        data: mockFullData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("Last Optimization")).toBeInTheDocument();
      expect(screen.getByText("Last Run")).toBeInTheDocument();
      // Use getAllByText since "Win Rate" appears in both stats and detector table
      expect(screen.getAllByText("Win Rate").length).toBeGreaterThan(0);
      expect(screen.getByText("Total Trades")).toBeInTheDocument();
    });

    it("renders Current Parameters section", () => {
      mockHookReturn = {
        data: mockFullData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("Current Parameters")).toBeInTheDocument();
      expect(screen.getByText("Risk/Reward")).toBeInTheDocument();
      expect(screen.getByText("Target Multiple")).toBeInTheDocument();
      expect(screen.getByText("Stop Multiple")).toBeInTheDocument();
      expect(screen.getByText("Max Hold Bars")).toBeInTheDocument();
    });

    it("renders Top Day Trader Detectors section", () => {
      mockHookReturn = {
        data: mockFullData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("Top Day Trader Detectors")).toBeInTheDocument();
      expect(screen.getByText("Detector")).toBeInTheDocument();
      // Detector names are formatted with underscores replaced by spaces
      expect(screen.getByText("breakout bullish")).toBeInTheDocument();
    });

    it("renders What's Enabled section", () => {
      mockHookReturn = {
        data: mockFullData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("What's Enabled")).toBeInTheDocument();
      expect(screen.getByText("Day Trader First Gating")).toBeInTheDocument();
      expect(screen.getByText("IV-Adjusted Entry")).toBeInTheDocument();
      expect(screen.getByText("Flow Confluence")).toBeInTheDocument();
      expect(screen.getByText("MTF Trend Weighting")).toBeInTheDocument();
    });

    it("displays tested symbols", () => {
      mockHookReturn = {
        data: mockFullData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      expect(screen.getByText("SPY")).toBeInTheDocument();
      expect(screen.getByText("TSLA")).toBeInTheDocument();
      expect(screen.getByText("NVDA")).toBeInTheDocument();
      expect(screen.getByText("MSFT")).toBeInTheDocument();
      expect(screen.getByText("AMD")).toBeInTheDocument();
    });

    it("calls refetch when refresh button is clicked", () => {
      mockHookReturn = {
        data: mockFullData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe("Partial Data State", () => {
    it("handles missing report gracefully", () => {
      mockHookReturn = {
        data: {
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
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<SetupOptimizationDashboard />);

      // Should still render the dashboard
      expect(screen.getByText("Setup Detection & Optimization")).toBeInTheDocument();
      expect(screen.getByText("Current Parameters")).toBeInTheDocument();
      // Detector table should show no data message
      expect(screen.getByText("No detector performance data available")).toBeInTheDocument();
    });
  });
});
