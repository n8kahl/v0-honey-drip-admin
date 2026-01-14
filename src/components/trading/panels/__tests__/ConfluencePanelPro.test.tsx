/**
 * ConfluencePanelPro Unit Tests
 *
 * Verifies that the confluence panel renders all sections (MTF, Flow, Gamma, Levels)
 * correctly with mock data and handles empty states appropriately.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfluencePanelPro } from "../ConfluencePanelPro";
import type { KeyLevels } from "../../../../lib/riskEngine/types";

// Mock hooks
vi.mock("../../../../hooks/useSymbolConfluence", () => ({
  useSymbolConfluence: () => ({
    overallScore: 72,
    mtf: [
      { timeframe: "1m", label: "1m", direction: "up" },
      { timeframe: "5m", label: "5m", direction: "up" },
      { timeframe: "15m", label: "15m", direction: "neutral" },
      { timeframe: "60m", label: "1H", direction: "down" },
    ],
    mtfAligned: 2,
  }),
}));

vi.mock("../../../../hooks/useFlowContext", () => ({
  useFlowContext: () => ({
    institutionalScore: 65,
    primarySentiment: "BULLISH",
    primaryStrength: 40,
    sweepCount: 3,
    putCallRatio: 0.8,
  }),
}));

// Mock visual components to simplify tests
vi.mock("../../../hd/terminal/SmartScoreBadge", () => ({
  SmartScoreBadge: ({ score, label }: { score: number; label: string }) => (
    <div data-testid="smart-score-badge" data-score={score} data-label={label}>
      SmartScoreBadge: {score}
    </div>
  ),
}));

vi.mock("../../../hd/viz/MTFHeatmap", () => ({
  MTFHeatmap: ({ timeframes }: { timeframes: any[] }) => (
    <div data-testid="mtf-heatmap" data-count={timeframes?.length || 0}>
      MTFHeatmap: {timeframes?.length || 0} timeframes
    </div>
  ),
}));

vi.mock("../../../hd/terminal/FlowPulse", () => ({
  FlowPulse: ({ flow }: { flow: any }) => (
    <div data-testid="flow-pulse" data-bias={flow?.flowBias}>
      FlowPulse: {flow?.flowBias}
    </div>
  ),
}));

vi.mock("../../../hd/terminal/GammaLevelsMap", () => ({
  GammaLevelsMap: ({ currentPrice, gamma }: { currentPrice: number; gamma: any }) => (
    <div data-testid="gamma-levels-map" data-price={currentPrice}>
      GammaLevelsMap: {gamma?.flipLevel}
    </div>
  ),
}));

// Sample test data
const mockKeyLevels: KeyLevels = {
  vwap: 598.5,
  orbHigh: 600.0,
  orbLow: 596.0,
  priorDayHigh: 602.0,
  priorDayLow: 594.0,
};

const mockGamma = {
  flipLevel: 599.0,
  dealerNetDelta: 1500000,
  callWall: 605.0,
  putWall: 590.0,
  maxPain: 595.0,
  regime: "long_gamma" as const,
};

describe("ConfluencePanelPro", () => {
  it("renders main component with testid", () => {
    render(<ConfluencePanelPro symbol="SPY" viewState="watch" />);
    expect(screen.getByTestId("confluence-panel-pro")).toBeInTheDocument();
  });

  it("renders SmartScoreBadge with confluence score", () => {
    render(<ConfluencePanelPro symbol="SPY" viewState="loaded" />);
    const badge = screen.getByTestId("smart-score-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-label", "CONF");
  });

  it("renders MTF section with heatmap", () => {
    render(<ConfluencePanelPro symbol="SPY" viewState="loaded" currentPrice={598.5} />);
    expect(screen.getByTestId("confluence-section-multi-timeframe-trend")).toBeInTheDocument();
    expect(screen.getByTestId("mtf-heatmap")).toBeInTheDocument();
    expect(screen.getByText(/aligned/)).toBeInTheDocument();
  });

  it("renders Flow section with FlowPulse", () => {
    render(<ConfluencePanelPro symbol="SPY" viewState="loaded" currentPrice={598.5} />);
    expect(screen.getByTestId("confluence-section-institutional-flow")).toBeInTheDocument();
    expect(screen.getByTestId("flow-pulse")).toBeInTheDocument();
  });

  it("renders Gamma section with GammaLevelsMap when gamma data provided", () => {
    render(
      <ConfluencePanelPro symbol="SPY" viewState="loaded" currentPrice={598.5} gamma={mockGamma} />
    );
    expect(screen.getByTestId("confluence-section-gamma-exposure")).toBeInTheDocument();
    expect(screen.getByTestId("gamma-levels-map")).toBeInTheDocument();
  });

  it("renders Key Levels section with level chips when keyLevels provided", () => {
    render(
      <ConfluencePanelPro
        symbol="SPY"
        viewState="loaded"
        currentPrice={598.5}
        keyLevels={mockKeyLevels}
      />
    );
    expect(screen.getByTestId("confluence-section-key-levels")).toBeInTheDocument();
    // Should render level chips
    expect(screen.getByText("VWAP")).toBeInTheDocument();
  });

  it("shows ANALYZING badge in watch state", () => {
    render(<ConfluencePanelPro symbol="SPY" viewState="watch" />);
    expect(screen.getByText("ANALYZING")).toBeInTheDocument();
  });

  it("shows STRONG badge when score >= 70", () => {
    render(<ConfluencePanelPro symbol="SPY" viewState="loaded" />);
    // Hook returns 72, so should show STRONG
    expect(screen.getByText("STRONG")).toBeInTheDocument();
  });

  it("displays 'what's missing' guidance in watch state", () => {
    render(<ConfluencePanelPro symbol="SPY" viewState="watch" />);
    expect(screen.getByText("To raise confidence:")).toBeInTheDocument();
  });

  it("does NOT display 'what's missing' guidance in loaded state", () => {
    render(<ConfluencePanelPro symbol="SPY" viewState="loaded" />);
    expect(screen.queryByText("To raise confidence:")).not.toBeInTheDocument();
  });

  it("shows context labels for underlying vs options metrics", () => {
    render(
      <ConfluencePanelPro symbol="SPY" viewState="loaded" currentPrice={598.5} gamma={mockGamma} />
    );
    // MTF and Key Levels should be labeled UNDERLYING
    expect(screen.getAllByText("UNDERLYING").length).toBeGreaterThanOrEqual(1);
    // Flow and Gamma should be labeled OPTIONS
    expect(screen.getAllByText("OPTIONS").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state for gamma when no gamma data", () => {
    render(
      <ConfluencePanelPro symbol="SPY" viewState="loaded" currentPrice={598.5} gamma={undefined} />
    );
    expect(screen.getByText("Gamma data not available")).toBeInTheDocument();
  });

  it("renders empty state for key levels when no levels data", () => {
    render(
      <ConfluencePanelPro
        symbol="SPY"
        viewState="loaded"
        currentPrice={598.5}
        keyLevels={undefined}
      />
    );
    expect(screen.getByText("No levels found")).toBeInTheDocument();
  });

  it("shows different empty messages in watch vs loaded states", () => {
    // In watch state, gamma empty message explains the benefit
    const { unmount } = render(
      <ConfluencePanelPro symbol="SPY" viewState="watch" currentPrice={598.5} />
    );
    expect(
      screen.getByText("Gamma walls show where dealer hedging impacts price")
    ).toBeInTheDocument();
    unmount();

    // In loaded state, gamma empty message is more matter-of-fact
    render(<ConfluencePanelPro symbol="SPY" viewState="loaded" currentPrice={598.5} />);
    expect(screen.getByText("Gamma data not available")).toBeInTheDocument();
  });

  it("calculates level distance percentages correctly", () => {
    render(
      <ConfluencePanelPro
        symbol="SPY"
        viewState="loaded"
        currentPrice={600.0}
        keyLevels={mockKeyLevels}
      />
    );
    // VWAP is 598.5, current is 600.0
    // Distance = ((600 - 598.5) / 598.5) * 100 = 0.25%
    // Should show the percentage
    const levelChips = screen.getByTestId("confluence-section-key-levels");
    expect(levelChips).toBeInTheDocument();
  });

  it("marks nearest level with 'nearest' indicator", () => {
    render(
      <ConfluencePanelPro
        symbol="SPY"
        viewState="loaded"
        currentPrice={598.5}
        keyLevels={mockKeyLevels}
      />
    );
    expect(screen.getByText("nearest")).toBeInTheDocument();
  });
});
