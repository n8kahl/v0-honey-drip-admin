import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HDRowWatchlist } from "../HDRowWatchlist";
import { useUIStore } from "../../../../stores/uiStore";

// Mock dependencies
vi.mock("../../../../stores/marketDataStore", () => ({
  useSymbolData: vi.fn(() => ({
    confluence: {
      overall: 75,
      components: {
        trendAlignment: true,
        rsiConfirm: true,
        volumeConfirm: false,
        aboveVWAP: true,
      },
    },
    candles: { "1m": [{ close: 100, time: Date.now() }] },
    lastUpdated: Date.now(),
  })),
}));

vi.mock("../../../../hooks/useWarehouseData", () => ({
  useWarehouseData: vi.fn(() => ({
    flowSummary: { netPremium: 1000000, callCount: 50, putCount: 30 },
    gammaData: { netGamma: 100, majorStrike: 600 },
    ivData: { iv_percentile: 45, iv_regime: "Normal" },
  })),
}));

vi.mock("../../../../stores", () => ({
  useUIStore: vi.fn(() => ({
    setMainCockpitSymbol: vi.fn(),
    scrollChartToBar: vi.fn(),
  })),
}));

vi.mock("../../signals/CompositeSignalBadge", () => ({
  CompositeSignalBadge: () => <div data-testid="composite-signal-badge" />,
}));

vi.mock("../../charts/HDMiniSparkline", () => ({
  HDMiniSparkline: () => <div data-testid="mini-sparkline" />,
  HDMiniSparklineSkeleton: () => <div data-testid="mini-sparkline-skeleton" />,
}));

vi.mock("../../common/HDLiveIndicator", () => ({
  HDLiveIndicator: () => <div data-testid="live-indicator" />,
}));

describe("HDRowWatchlist v2", () => {
  const mockTicker = {
    id: "1",
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    last: 605.23,
    changePercent: 0.45,
  };

  const mockOnExpandChange = vi.fn();
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders basic row elements", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="clean"
        isExpanded={false}
        onExpandChange={mockOnExpandChange}
      />
    );

    // Check symbol is displayed
    expect(screen.getByText("SPY")).toBeInTheDocument();

    // Check price is displayed (without $ prefix in the component)
    expect(screen.getByText("605.23")).toBeInTheDocument();

    // Check change percent is displayed
    expect(screen.getByText("+0.45%")).toBeInTheDocument();

    // Check expand button exists
    expect(screen.getByTestId("watchlist-expand-SPY")).toBeInTheDocument();

    // Check confluence meter exists
    expect(screen.getByTestId("confluence-meter-SPY")).toBeInTheDocument();
  });

  it("does not render full checklist text when collapsed", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="clean"
        isExpanded={false}
        onExpandChange={mockOnExpandChange}
      />
    );

    // Full checklist labels should NOT be visible when collapsed
    expect(screen.queryByText("Multi-Timeframe Trend Alignment")).not.toBeInTheDocument();
    expect(screen.queryByText("RSI Momentum Confirmation")).not.toBeInTheDocument();
    expect(screen.queryByText("Volume Confirmation")).not.toBeInTheDocument();
    expect(screen.queryByText("Above VWAP")).not.toBeInTheDocument();
  });

  it("reveals inline checklist when expanded", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="clean"
        isExpanded={true}
        onExpandChange={mockOnExpandChange}
      />
    );

    // Full checklist should be visible when expanded
    expect(screen.getByText("Multi-Timeframe Trend Alignment")).toBeInTheDocument();
    expect(screen.getByText("RSI Momentum Confirmation")).toBeInTheDocument();
    expect(screen.getByText("Volume Confirmation")).toBeInTheDocument();
    expect(screen.getByText("Above VWAP")).toBeInTheDocument();

    // Expanded section should have the data-testid
    expect(screen.getByTestId("watchlist-expanded-SPY")).toBeInTheDocument();
  });

  it("hides power badges in clean mode", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="clean"
        isExpanded={false}
        onExpandChange={mockOnExpandChange}
      />
    );

    // Flow/Gamma/IV badges should NOT be present in clean mode
    expect(screen.queryByTestId("flow-badge-SPY")).not.toBeInTheDocument();
    expect(screen.queryByTestId("gamma-badge-SPY")).not.toBeInTheDocument();
    expect(screen.queryByTestId("iv-badge-SPY")).not.toBeInTheDocument();
  });

  it("shows power badges in power mode", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="power"
        isExpanded={false}
        onExpandChange={mockOnExpandChange}
      />
    );

    // Flow/Gamma/IV badges SHOULD be present in power mode
    expect(screen.getByTestId("flow-badge-SPY")).toBeInTheDocument();
    expect(screen.getByTestId("gamma-badge-SPY")).toBeInTheDocument();
    expect(screen.getByTestId("iv-badge-SPY")).toBeInTheDocument();
  });

  it("limits signal chips to 3 in collapsed mode", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="clean"
        isExpanded={false}
        onExpandChange={mockOnExpandChange}
      />
    );

    // In our mock, we have 3 passing components (trendAlignment, rsiConfirm, aboveVWAP)
    // So we should see at most 3 chips
    const chips = screen.getAllByTestId(/signal-chip-/);
    expect(chips.length).toBeLessThanOrEqual(3);
  });

  it("calls onExpandChange when expand button clicked", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="clean"
        isExpanded={false}
        onExpandChange={mockOnExpandChange}
      />
    );

    const expandButton = screen.getByTestId("watchlist-expand-SPY");
    fireEvent.click(expandButton);

    expect(mockOnExpandChange).toHaveBeenCalledWith(true);
  });

  it("has correct data-testid for row", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="clean"
        isExpanded={false}
        onExpandChange={mockOnExpandChange}
      />
    );

    expect(screen.getByTestId("watchlist-row-SPY")).toBeInTheDocument();
  });

  it("shows remove button when onRemove is provided", () => {
    const mockOnRemove = vi.fn();
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="clean"
        isExpanded={false}
        onExpandChange={mockOnExpandChange}
        onRemove={mockOnRemove}
      />
    );

    // Find remove button by title
    const removeButton = screen.getByTitle("Remove from watchlist");
    expect(removeButton).toBeInTheDocument();
  });

  it("shows advanced metrics in expanded power mode", () => {
    render(
      <HDRowWatchlist
        ticker={mockTicker}
        viewMode="power"
        isExpanded={true}
        onExpandChange={mockOnExpandChange}
      />
    );

    // Should show "Advanced Metrics" section
    expect(screen.getByText("Advanced Metrics")).toBeInTheDocument();

    // Should show flow details
    expect(screen.getByText("$1.0M")).toBeInTheDocument();
    expect(screen.getByText("C: 50 / P: 30")).toBeInTheDocument();
  });
});
