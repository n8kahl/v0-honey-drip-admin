/**
 * NowPanelSymbol - Unit Tests
 *
 * Tests the decoupled contract selection behavior:
 * - Contract selection updates local state only, NOT trade creation
 * - Trade creation only happens via explicit "LOAD STRATEGY" action
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NowPanelSymbol } from "../NowPanelSymbol";
import type { Contract, Ticker } from "../../../types";

// ============================================================================
// Mocks
// ============================================================================

// Mock hooks
vi.mock("../../../hooks/useContractRecommendation", () => ({
  useContractRecommendation: vi.fn(() => ({
    bestContract: mockContracts[0],
    fallbackContracts: [],
    reasons: [],
  })),
}));

vi.mock("../../../hooks/useKeyLevels", () => ({
  useKeyLevels: vi.fn(() => ({
    keyLevels: {
      vwap: 100,
      priorDayHigh: 105,
      priorDayLow: 95,
    },
  })),
}));

vi.mock("../../../hooks/useLoadedTradeLiveModel", () => ({
  useLoadedTradeLiveModel: vi.fn(() => ({
    option: { bid: 1.5, ask: 1.6, mid: 1.55 },
    greeks: { delta: 0.5, gamma: 0.02, theta: -0.05, iv: 0.25 },
  })),
}));

vi.mock("../../../stores/marketDataStore", () => ({
  useMarketDataStore: vi.fn(() => ({
    symbols: {},
    lastUpdated: Date.now(),
  })),
}));

// Mock cockpit components to simplify testing
vi.mock("../cockpit", () => ({
  CockpitLayout: ({ children, "data-testid": testId, ...props }: any) => (
    <div data-testid={testId || "cockpit-layout"}>
      {children.header}
      {children.chart}
      {children.confluence}
      {children.plan}
      {children.contractPanel}
      {children.actions}
    </div>
  ),
  CockpitHeader: () => <div data-testid="cockpit-header" />,
  CockpitPlanPanel: () => <div data-testid="cockpit-plan-panel" />,
  CockpitContractPanel: () => <div data-testid="cockpit-contract-panel" />,
  CockpitActionsBar: ({ onLoadPlan, contract }: any) => (
    <div data-testid="cockpit-actions-bar">
      <button
        data-testid="load-strategy-button"
        onClick={() => onLoadPlan(false)}
        disabled={!contract}
      >
        LOAD STRATEGY
      </button>
    </div>
  ),
}));

vi.mock("../panels/ConfluencePanelPro", () => ({
  ConfluencePanelPro: () => <div data-testid="confluence-panel-pro" />,
}));

vi.mock("../../hd/charts/HDLiveChart", () => ({
  HDLiveChart: () => <div data-testid="hd-live-chart" />,
}));

// ============================================================================
// Test Data
// ============================================================================

const mockContracts: Contract[] = [
  {
    symbol: "SPY",
    type: "C",
    strike: 600,
    expiry: "2025-01-17",
    daysToExpiry: 3,
    bid: 1.5,
    ask: 1.6,
    mid: 1.55,
    volume: 1000,
    openInterest: 5000,
    delta: 0.5,
    gamma: 0.02,
    theta: -0.05,
    iv: 0.25,
    ticker: "O:SPY250117C00600000",
  },
  {
    symbol: "SPY",
    type: "P",
    strike: 595,
    expiry: "2025-01-17",
    daysToExpiry: 3,
    bid: 1.2,
    ask: 1.3,
    mid: 1.25,
    volume: 800,
    openInterest: 4000,
    delta: -0.35,
    gamma: 0.02,
    theta: -0.04,
    iv: 0.22,
    ticker: "O:SPY250117P00595000",
  },
];

const mockTicker: Ticker = {
  symbol: "SPY",
  last: 598.5,
  changePercent: 0.5,
  volume: 1000000,
  bid: 598.4,
  ask: 598.6,
};

// ============================================================================
// Tests
// ============================================================================

describe("NowPanelSymbol", () => {
  let mockOnContractSelect: ReturnType<typeof vi.fn>;
  let mockOnLoadStrategy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnContractSelect = vi.fn();
    mockOnLoadStrategy = vi.fn();
  });

  describe("Contract Selection Decoupling", () => {
    it("does NOT call onContractSelect on initial render when recommendation exists", async () => {
      render(
        <NowPanelSymbol
          symbol="SPY"
          activeTicker={mockTicker}
          contracts={mockContracts}
          onContractSelect={mockOnContractSelect}
          onLoadStrategy={mockOnLoadStrategy}
        />
      );

      // Wait for any potential async effects
      await waitFor(() => {
        expect(screen.getByTestId("now-panel-symbol-cockpit")).toBeInTheDocument();
      });

      // onContractSelect should NOT have been called
      // The recommendation exists (mocked) but we no longer auto-call onContractSelect
      expect(mockOnContractSelect).not.toHaveBeenCalled();
    });

    it("does NOT call onContractSelect when activeContract is computed from recommendation", async () => {
      render(
        <NowPanelSymbol
          symbol="SPY"
          activeTicker={mockTicker}
          contracts={mockContracts}
          onContractSelect={mockOnContractSelect}
        />
      );

      // Panels should update with activeContract from recommendation
      expect(screen.getByTestId("cockpit-contract-panel")).toBeInTheDocument();

      // But onContractSelect should NOT have been called
      expect(mockOnContractSelect).not.toHaveBeenCalled();
    });

    it("calls onLoadStrategy when LOAD STRATEGY button is clicked", async () => {
      render(
        <NowPanelSymbol
          symbol="SPY"
          activeTicker={mockTicker}
          contracts={mockContracts}
          onContractSelect={mockOnContractSelect}
          onLoadStrategy={mockOnLoadStrategy}
        />
      );

      const loadButton = screen.getByTestId("load-strategy-button");
      expect(loadButton).toBeInTheDocument();

      fireEvent.click(loadButton);

      // onLoadStrategy should be called with the activeContract and tradeType
      expect(mockOnLoadStrategy).toHaveBeenCalledTimes(1);
      expect(mockOnLoadStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: "SPY",
          type: "C",
          strike: 600,
        }),
        expect.objectContaining({
          tradeType: "day", // Default trade type
        })
      );
    });

    it("falls back to onContractSelect if onLoadStrategy is not provided", async () => {
      render(
        <NowPanelSymbol
          symbol="SPY"
          activeTicker={mockTicker}
          contracts={mockContracts}
          onContractSelect={mockOnContractSelect}
          // No onLoadStrategy provided
        />
      );

      const loadButton = screen.getByTestId("load-strategy-button");
      fireEvent.click(loadButton);

      // Should fall back to onContractSelect
      expect(mockOnContractSelect).toHaveBeenCalledTimes(1);
      expect(mockOnContractSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: "SPY",
          type: "C",
          strike: 600,
        }),
        expect.objectContaining({
          tradeType: "day",
        })
      );
    });
  });

  describe("Component Rendering", () => {
    it("renders cockpit layout with all panels", () => {
      render(
        <NowPanelSymbol
          symbol="SPY"
          activeTicker={mockTicker}
          contracts={mockContracts}
          onContractSelect={mockOnContractSelect}
        />
      );

      expect(screen.getByTestId("now-panel-symbol-cockpit")).toBeInTheDocument();
      expect(screen.getByTestId("cockpit-header")).toBeInTheDocument();
      expect(screen.getByTestId("hd-live-chart")).toBeInTheDocument();
      expect(screen.getByTestId("confluence-panel-pro")).toBeInTheDocument();
      expect(screen.getByTestId("cockpit-plan-panel")).toBeInTheDocument();
      expect(screen.getByTestId("cockpit-contract-panel")).toBeInTheDocument();
      expect(screen.getByTestId("cockpit-actions-bar")).toBeInTheDocument();
    });

    it("shows Plan Active indicator when contract is selected", () => {
      render(
        <NowPanelSymbol
          symbol="SPY"
          activeTicker={mockTicker}
          contracts={mockContracts}
          onContractSelect={mockOnContractSelect}
        />
      );

      // The activeContract comes from recommendation, so Plan Active should show
      expect(screen.getByText("Plan Active")).toBeInTheDocument();
    });
  });

  describe("Symbol Change Behavior", () => {
    it("resets manual contract selection when symbol changes", async () => {
      const { rerender } = render(
        <NowPanelSymbol
          symbol="SPY"
          activeTicker={mockTicker}
          contracts={mockContracts}
          onContractSelect={mockOnContractSelect}
        />
      );

      // Change symbol
      rerender(
        <NowPanelSymbol
          symbol="QQQ"
          activeTicker={{ ...mockTicker, symbol: "QQQ" }}
          contracts={mockContracts}
          onContractSelect={mockOnContractSelect}
        />
      );

      // onContractSelect should NOT be called on symbol change
      expect(mockOnContractSelect).not.toHaveBeenCalled();
    });
  });
});
