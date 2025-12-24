import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HDPanelWatchlist } from "../HDPanelWatchlist";
import { useUIStore } from "../../../../stores/uiStore";

// Mock dependencies
vi.mock("../../../../stores/marketDataStore", () => ({
  useEnrichedMarketSession: vi.fn(() => ({ isWeekend: false, session: "OPEN" })),
  useMarketDataStore: vi.fn((selector) => {
    const state = {
      symbols: {
        SPY: { confluence: { overall: 60, components: {} } },
        AAPL: { confluence: { overall: 80, components: {} } },
        MSFT: { confluence: { overall: 70, components: {} } },
      },
    };
    return selector(state);
  }),
}));

vi.mock("../../../../hooks/useTradeConfluenceMonitor", () => ({
  useTradeConfluenceMonitor: vi.fn(() => ({
    isTickerFlashing: vi.fn(() => false),
  })),
}));

vi.mock("../../../WatchlistRecapCard", () => ({
  WatchlistRecapCard: () => null,
}));

vi.mock("../../../Watchlist/MobileWatchlist", () => ({
  default: () => <div data-testid="mobile-watchlist" />,
}));

vi.mock("../../cards/HDRowWatchlist", () => ({
  HDRowWatchlist: ({ ticker, viewMode, isExpanded }: any) => (
    <div
      data-testid={`watchlist-row-${ticker.symbol}`}
      data-viewmode={viewMode}
      data-expanded={isExpanded}
    >
      {ticker.symbol}
    </div>
  ),
}));

vi.mock("../../cards/HDRowTrade", () => ({
  HDRowTrade: () => <div data-testid="trade-row" />,
}));

vi.mock("../../cards/HDRowChallenge", () => ({
  HDRowChallenge: () => <div data-testid="challenge-row" />,
}));

vi.mock("../../forms/HDConfirmDialog", () => ({
  HDConfirmDialog: () => null,
}));

describe("HDPanelWatchlist sorting", () => {
  const mockWatchlist = [
    { id: "1", symbol: "SPY", name: "SPY", last: 600, change: 3.0, changePercent: 0.5 },
    { id: "2", symbol: "AAPL", name: "AAPL", last: 200, change: 2.4, changePercent: 1.2 },
    { id: "3", symbol: "MSFT", name: "MSFT", last: 400, change: -1.2, changePercent: -0.3 },
  ];

  beforeEach(() => {
    // Reset Zustand store to default values
    useUIStore.setState({
      watchlistViewMode: "clean",
      watchlistSortMode: "score",
      expandedWatchlistRow: null,
    });
  });

  it("renders watchlist with mode toggle and sort select", () => {
    render(<HDPanelWatchlist watchlist={mockWatchlist} challenges={[]} allTrades={[]} />);

    expect(screen.getByTestId("watchlist-mode-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("watchlist-sort-select")).toBeInTheDocument();
  });

  it("sorts by confluence score descending", () => {
    useUIStore.setState({ watchlistSortMode: "score" });

    render(<HDPanelWatchlist watchlist={mockWatchlist} challenges={[]} allTrades={[]} />);

    const rows = screen.getAllByTestId(/watchlist-row-/);

    // AAPL (80) should be first, MSFT (70) second, SPY (60) third
    expect(rows[0]).toHaveAttribute("data-testid", "watchlist-row-AAPL");
    expect(rows[1]).toHaveAttribute("data-testid", "watchlist-row-MSFT");
    expect(rows[2]).toHaveAttribute("data-testid", "watchlist-row-SPY");
  });

  it("sorts alphabetically A-Z", () => {
    useUIStore.setState({ watchlistSortMode: "alphabetical" });

    render(<HDPanelWatchlist watchlist={mockWatchlist} challenges={[]} allTrades={[]} />);

    const rows = screen.getAllByTestId(/watchlist-row-/);

    // AAPL, MSFT, SPY in alphabetical order
    expect(rows[0]).toHaveAttribute("data-testid", "watchlist-row-AAPL");
    expect(rows[1]).toHaveAttribute("data-testid", "watchlist-row-MSFT");
    expect(rows[2]).toHaveAttribute("data-testid", "watchlist-row-SPY");
  });

  it("sorts by change percent descending", () => {
    useUIStore.setState({ watchlistSortMode: "change" });

    render(<HDPanelWatchlist watchlist={mockWatchlist} challenges={[]} allTrades={[]} />);

    const rows = screen.getAllByTestId(/watchlist-row-/);

    // AAPL (1.2%), SPY (0.5%), MSFT (-0.3%) by change descending
    expect(rows[0]).toHaveAttribute("data-testid", "watchlist-row-AAPL");
    expect(rows[1]).toHaveAttribute("data-testid", "watchlist-row-SPY");
    expect(rows[2]).toHaveAttribute("data-testid", "watchlist-row-MSFT");
  });

  it("toggles view mode when mode button clicked", () => {
    render(<HDPanelWatchlist watchlist={mockWatchlist} challenges={[]} allTrades={[]} />);

    const modeToggle = screen.getByTestId("watchlist-mode-toggle");

    // Initially clean mode
    expect(useUIStore.getState().watchlistViewMode).toBe("clean");

    // Click to switch to power
    fireEvent.click(modeToggle);
    expect(useUIStore.getState().watchlistViewMode).toBe("power");

    // Click again to switch back to clean
    fireEvent.click(modeToggle);
    expect(useUIStore.getState().watchlistViewMode).toBe("clean");
  });

  it("changes sort mode when select value changes", () => {
    render(<HDPanelWatchlist watchlist={mockWatchlist} challenges={[]} allTrades={[]} />);

    const sortSelect = screen.getByTestId("watchlist-sort-select") as HTMLSelectElement;

    // Change to alphabetical
    fireEvent.change(sortSelect, { target: { value: "alphabetical" } });
    expect(useUIStore.getState().watchlistSortMode).toBe("alphabetical");

    // Change to change
    fireEvent.change(sortSelect, { target: { value: "change" } });
    expect(useUIStore.getState().watchlistSortMode).toBe("change");

    // Change back to score
    fireEvent.change(sortSelect, { target: { value: "score" } });
    expect(useUIStore.getState().watchlistSortMode).toBe("score");
  });

  it("passes viewMode to HDRowWatchlist", () => {
    useUIStore.setState({ watchlistViewMode: "power" });

    render(<HDPanelWatchlist watchlist={mockWatchlist} challenges={[]} allTrades={[]} />);

    const rows = screen.getAllByTestId(/watchlist-row-/);
    rows.forEach((row) => {
      expect(row).toHaveAttribute("data-viewmode", "power");
    });
  });

  it("tracks expanded row state", () => {
    useUIStore.setState({ expandedWatchlistRow: "SPY" });

    render(<HDPanelWatchlist watchlist={mockWatchlist} challenges={[]} allTrades={[]} />);

    const spyRow = screen.getByTestId("watchlist-row-SPY");
    const aaplRow = screen.getByTestId("watchlist-row-AAPL");

    expect(spyRow).toHaveAttribute("data-expanded", "true");
    expect(aaplRow).toHaveAttribute("data-expanded", "false");
  });
});
