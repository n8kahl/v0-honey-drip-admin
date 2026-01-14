/**
 * CockpitLayout Tests
 *
 * Verifies the cockpit layout components render correctly
 * and adhere to the no-scroll, no-collapsible requirements.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CockpitLayout, type CockpitViewState } from "../CockpitLayout";
import { CockpitHeader } from "../CockpitHeader";
import { CockpitActionsBar } from "../CockpitActionsBar";
import type { Contract, Trade, Ticker } from "../../../../types";

// Mock the FlowPulse component
vi.mock("../../../hd/flow", () => ({
  FlowPulse: () => <div data-testid="mock-flow-pulse">FlowPulse</div>,
}));

// Mock useSymbolConfluence hook
vi.mock("../../../../hooks/useSymbolConfluence", () => ({
  useSymbolConfluence: () => ({
    confluenceScore: 75,
    factors: [
      { name: "RVOL", value: 1.5, weight: 20, direction: "bullish" },
      { name: "RSI", value: 45, weight: 15, direction: "neutral" },
    ],
    mtfAlignment: { "1m": "bull", "5m": "bull", "15m": "neutral", "60m": "bear" },
    flowContext: null,
  }),
}));

// Mock useActiveTradeLiveModel
vi.mock("../../../../hooks/useActiveTradeLiveModel", () => ({
  useActiveTradeLiveModel: () => ({
    pnlPercent: 5.5,
    pnlDollars: 110,
    rMultiple: 1.2,
    progressToTarget: 45,
    holdTimeFormatted: "15m",
    entryPrice: 2.0,
    effectiveMid: 2.11,
    targetPrice: 2.5,
    stopPrice: 1.8,
    delta: 0.45,
    gamma: 0.02,
    theta: -0.05,
    iv: 0.35,
  }),
}));

// Sample test data
const mockContract: Contract = {
  symbol: "O:SPY250117C00600000",
  strike: 600,
  type: "C",
  expiry: "2025-01-17",
  daysToExpiry: 3,
  bid: 3.45,
  ask: 3.55,
  mid: 3.5,
  volume: 1500,
  openInterest: 5000,
  delta: 0.45,
  gamma: 0.02,
  theta: -0.05,
  iv: 0.35,
};

const mockTicker: Ticker = {
  symbol: "SPY",
  last: 598.5,
  open: 596.0,
  high: 599.5,
  low: 595.5,
  close: 596.0,
  changePercent: 0.42,
  volume: 50000000,
  prevClose: 596.0,
  timestamp: Date.now(),
};

describe("CockpitLayout", () => {
  it("renders with all required child slots", () => {
    render(
      <CockpitLayout
        viewState="watch"
        symbol="SPY"
        contract={mockContract}
        activeTicker={mockTicker}
        keyLevels={null}
      >
        {{
          header: <div data-testid="header-slot">Header</div>,
          chart: <div data-testid="chart-slot">Chart</div>,
          confluence: <div data-testid="confluence-slot">Confluence</div>,
          plan: <div data-testid="plan-slot">Plan</div>,
          contractPanel: <div data-testid="contract-slot">Contract</div>,
          actions: <div data-testid="actions-slot">Actions</div>,
        }}
      </CockpitLayout>
    );

    // All slots should be rendered
    expect(screen.getByTestId("header-slot")).toBeInTheDocument();
    expect(screen.getByTestId("chart-slot")).toBeInTheDocument();
    expect(screen.getByTestId("confluence-slot")).toBeInTheDocument();
    expect(screen.getByTestId("plan-slot")).toBeInTheDocument();
    expect(screen.getByTestId("contract-slot")).toBeInTheDocument();
    expect(screen.getByTestId("actions-slot")).toBeInTheDocument();
  });

  it("does not render any collapsible or accordion components", () => {
    const { container } = render(
      <CockpitLayout
        viewState="loaded"
        symbol="SPY"
        contract={mockContract}
        activeTicker={mockTicker}
        keyLevels={null}
      >
        {{
          header: <div>Header</div>,
          chart: <div>Chart</div>,
          confluence: <div>Confluence</div>,
          plan: <div>Plan</div>,
          contractPanel: <div>Contract</div>,
          actions: <div>Actions</div>,
        }}
      </CockpitLayout>
    );

    // Should not have any collapsible/accordion elements
    expect(container.querySelector('[data-state="open"]')).toBeNull();
    expect(container.querySelector('[data-state="closed"]')).toBeNull();
    expect(container.querySelector('[role="button"][aria-expanded]')).toBeNull();
  });

  it("has no-scroll layout (overflow-hidden)", () => {
    const { container } = render(
      <CockpitLayout
        viewState="entered"
        symbol="SPY"
        contract={mockContract}
        activeTicker={mockTicker}
        keyLevels={null}
      >
        {{
          header: <div>Header</div>,
          chart: <div>Chart</div>,
          confluence: <div>Confluence</div>,
          plan: <div>Plan</div>,
          contractPanel: <div>Contract</div>,
          actions: <div>Actions</div>,
        }}
      </CockpitLayout>
    );

    // Main container should have overflow-hidden
    const mainLayout = container.querySelector('[data-testid="cockpit-layout"]');
    expect(mainLayout).toHaveClass("overflow-hidden");
  });
});

describe("CockpitHeader", () => {
  it("renders dual pricing - both underlying and contract", () => {
    render(
      <CockpitHeader
        viewState="loaded"
        symbol="SPY"
        contract={mockContract}
        activeTicker={mockTicker}
        underlyingPrice={598.5}
        underlyingChange={0.42}
        contractBid={3.45}
        contractAsk={3.55}
        contractMid={3.5}
        lastUpdateTime={new Date()}
        isStale={false}
      />
    );

    // Should show underlying label
    expect(screen.getByText("Underlying")).toBeInTheDocument();

    // Should show contract label
    expect(screen.getByText("Contract")).toBeInTheDocument();

    // Should show the underlying price
    expect(screen.getByText("$598.50")).toBeInTheDocument();

    // Should show the contract mid price
    expect(screen.getByText("$3.50")).toBeInTheDocument();
  });

  it("displays correct state badge for each view state", () => {
    const viewStates: CockpitViewState[] = [
      "watch",
      "plan",
      "loaded",
      "entered",
      "exited",
      "expired",
    ];
    const expectedLabels = ["WATCH", "PLAN", "LOADED", "MANAGE", "REVIEW", "EXPIRED"];

    viewStates.forEach((viewState, idx) => {
      const { unmount } = render(
        <CockpitHeader viewState={viewState} symbol="SPY" underlyingPrice={598.5} />
      );

      expect(screen.getByTestId("state-badge")).toHaveTextContent(expectedLabels[idx]);
      unmount();
    });
  });

  it("shows stale indicator when data is stale", () => {
    render(
      <CockpitHeader viewState="entered" symbol="SPY" underlyingPrice={598.5} isStale={true} />
    );

    expect(screen.getByText("Stale")).toBeInTheDocument();
  });
});

describe("CockpitActionsBar", () => {
  it("renders Load Plan button for plan state", () => {
    render(
      <CockpitActionsBar
        viewState="plan"
        contract={mockContract}
        hasDiscordChannels={true}
        onLoadPlan={vi.fn()}
      />
    );

    expect(screen.getByText("Load Plan")).toBeInTheDocument();
  });

  it("renders Enter Trade button for loaded state", () => {
    render(
      <CockpitActionsBar
        viewState="loaded"
        contract={mockContract}
        hasDiscordChannels={true}
        onEnterTrade={vi.fn()}
      />
    );

    expect(screen.getByText("Enter Trade")).toBeInTheDocument();
  });

  it("renders management buttons for entered state", () => {
    render(
      <CockpitActionsBar
        viewState="entered"
        contract={mockContract}
        onTakeProfit={vi.fn()}
        onMoveStop={vi.fn()}
        onTrim={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText("TP")).toBeInTheDocument();
    expect(screen.getByText("SL→BE")).toBeInTheDocument();
    expect(screen.getByText("Trim")).toBeInTheDocument();
    expect(screen.getByText("Exit")).toBeInTheDocument();
  });

  it("shows expired warning for expired state", () => {
    render(<CockpitActionsBar viewState="expired" contract={mockContract} onExit={vi.fn()} />);

    expect(screen.getByText("Contract Expired")).toBeInTheDocument();
    expect(screen.getByText("Manual Exit Required")).toBeInTheDocument();
  });
});
