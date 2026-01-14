/**
 * NowPanel Header Alert Tests
 *
 * Tests the alert button rendering in NowPanel header:
 * - When channels=[] shows "Configure Alerts" button
 * - When channels=[{id,...}] shows the alert composer trigger
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NowPanel } from "../NowPanel";
import type { Ticker, Contract, Trade, DiscordChannel } from "../../../types";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

// Mock HDAlertComposerPopover
vi.mock("../../hd/alerts/HDAlertComposerPopover", () => ({
  HDAlertComposerPopover: ({
    channels,
  }: {
    trade?: Trade;
    mode: string;
    channels: DiscordChannel[];
    onSend: () => void;
  }) => (
    <button data-testid="alert-composer-trigger">
      Alert ({channels.length} channels)
    </button>
  ),
}));

// Mock useDiscord hook
vi.mock("../../../hooks/useDiscord", () => ({
  useDiscord: () => ({
    sendUpdateAlert: vi.fn(),
  }),
}));

// Mock useTradeActionManager hook
vi.mock("../../../hooks/useTradeActionManager", () => ({
  useTradeActionManager: () => ({
    state: { isLoading: false, currentAction: null },
    alertConfig: { channelIds: [], challengeIds: [] },
    actions: {
      updateAlertSettings: vi.fn(),
      enterTrade: vi.fn(),
      exitTrade: vi.fn(),
    },
  }),
}));

// Mock uiStore
const mockOpenDiscordSettings = vi.fn();
vi.mock("../../../stores/uiStore", () => ({
  useUIStore: {
    getState: () => ({
      openDiscordSettings: mockOpenDiscordSettings,
    }),
  },
}));

// Mock AuthContext for NowPanelManage
vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-123" },
    session: null,
    loading: false,
  }),
}));

// Helper to create a minimal valid ticker
const createTicker = (overrides: Partial<Ticker> = {}): Ticker => ({
  id: "ticker-1",
  symbol: "SPY",
  last: 595.5,
  change: 2.5,
  changePercent: 0.42,
  ...overrides,
});

// Helper to create a minimal valid contract
const createContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: "contract-1",
  strike: 600,
  expiry: "2025-01-17",
  expiryDate: new Date("2025-01-17"),
  daysToExpiry: 5,
  type: "C",
  mid: 5.0,
  bid: 4.95,
  ask: 5.05,
  volume: 1000,
  openInterest: 5000,
  ...overrides,
});

// Helper to create a minimal valid trade
const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: "trade-1",
  ticker: "SPY",
  contract: createContract(),
  tradeType: "Day",
  state: "LOADED",
  updates: [],
  discordChannels: [],
  challenges: [],
  ...overrides,
});

// Helper to create a minimal valid discord channel
const createChannel = (overrides: Partial<DiscordChannel> = {}): DiscordChannel => ({
  id: "channel-1",
  name: "trading-alerts",
  webhookUrl: "https://discord.com/api/webhooks/123/abc",
  ...overrides,
});

describe("NowPanel Header Alert Rendering", () => {
  const defaultProps = {
    focus: { kind: "symbol" as const, symbol: "SPY" },
    activeTicker: createTicker(),
    currentTrade: null,
    tradeState: "WATCHING" as const,
    contracts: [createContract()],
    activeTrades: [],
    onContractSelect: vi.fn(),
    watchlist: [createTicker()],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Configure Alerts' button when channels is empty", () => {
    render(<NowPanel {...defaultProps} channels={[]} />);

    const configureBtn = screen.getByTestId("configure-alerts-btn");
    expect(configureBtn).toBeInTheDocument();
    expect(configureBtn).toHaveTextContent("Configure Alerts");
  });

  it("opens Discord Settings dialog when 'Configure Alerts' is clicked", () => {
    render(<NowPanel {...defaultProps} channels={[]} />);

    const configureBtn = screen.getByTestId("configure-alerts-btn");
    fireEvent.click(configureBtn);

    expect(mockOpenDiscordSettings).toHaveBeenCalled();
  });

  it("shows alert composer trigger when channels exist", () => {
    const channels = [createChannel()];
    render(<NowPanel {...defaultProps} channels={channels} />);

    const composerTrigger = screen.getByTestId("alert-composer-trigger");
    expect(composerTrigger).toBeInTheDocument();
    expect(composerTrigger).toHaveTextContent("Alert (1 channels)");
  });

  it("shows alert composer with multiple channels", () => {
    const channels = [
      createChannel({ id: "ch1", name: "alerts-1" }),
      createChannel({ id: "ch2", name: "alerts-2" }),
      createChannel({ id: "ch3", name: "alerts-3" }),
    ];
    render(<NowPanel {...defaultProps} channels={channels} />);

    const composerTrigger = screen.getByTestId("alert-composer-trigger");
    expect(composerTrigger).toHaveTextContent("Alert (3 channels)");
  });

  it("does not show 'Configure Alerts' when channels exist", () => {
    const channels = [createChannel()];
    render(<NowPanel {...defaultProps} channels={channels} />);

    expect(screen.queryByTestId("configure-alerts-btn")).not.toBeInTheDocument();
  });

  it("does not show alert controls when viewState is empty", () => {
    render(
      <NowPanel
        {...defaultProps}
        focus={null as any}
        activeTicker={null}
        channels={[createChannel()]}
      />
    );

    // Header should not be visible for empty state
    expect(screen.queryByTestId("alert-composer-trigger")).not.toBeInTheDocument();
    expect(screen.queryByTestId("configure-alerts-btn")).not.toBeInTheDocument();
  });

  it("shows alert controls for loaded trade state", () => {
    const trade = createTrade({ state: "LOADED" });
    const channels = [createChannel()];

    render(
      <NowPanel
        {...defaultProps}
        focus={{ kind: "trade", tradeId: trade.id }}
        currentTrade={trade}
        tradeState="LOADED"
        activeTrades={[trade]}
        channels={channels}
      />
    );

    expect(screen.getByTestId("alert-composer-trigger")).toBeInTheDocument();
  });

  it("shows configure alerts for loaded trade when no channels", () => {
    const trade = createTrade({ state: "LOADED" });

    render(
      <NowPanel
        {...defaultProps}
        focus={{ kind: "trade", tradeId: trade.id }}
        currentTrade={trade}
        tradeState="LOADED"
        activeTrades={[trade]}
        channels={[]}
      />
    );

    expect(screen.getByTestId("configure-alerts-btn")).toBeInTheDocument();
  });
});

describe("NowPanel Sticky Header", () => {
  const defaultProps = {
    focus: { kind: "symbol" as const, symbol: "SPY" },
    activeTicker: createTicker(),
    currentTrade: null,
    tradeState: "WATCHING" as const,
    contracts: [createContract()],
    activeTrades: [],
    onContractSelect: vi.fn(),
    watchlist: [createTicker()],
    channels: [],
  };

  it("renders sticky header with data-testid", () => {
    render(<NowPanel {...defaultProps} />);

    const stickyHeader = screen.getByTestId("now-panel-sticky-header");
    expect(stickyHeader).toBeInTheDocument();
  });

  it("shows state badge in header", () => {
    render(<NowPanel {...defaultProps} />);

    const stateBadge = screen.getByTestId("state-badge");
    expect(stateBadge).toBeInTheDocument();
    expect(stateBadge).toHaveTextContent("WATCH");
  });

  it("shows PLAN state badge for WATCHING trade", () => {
    const trade = createTrade({ state: "WATCHING" });

    render(
      <NowPanel
        {...defaultProps}
        focus={{ kind: "trade", tradeId: trade.id }}
        currentTrade={trade}
        tradeState="WATCHING"
        activeTrades={[trade]}
      />
    );

    const stateBadge = screen.getByTestId("state-badge");
    expect(stateBadge).toHaveTextContent("PLAN");
  });

  it("shows LOADED state badge for LOADED trade", () => {
    const trade = createTrade({ state: "LOADED" });

    render(
      <NowPanel
        {...defaultProps}
        focus={{ kind: "trade", tradeId: trade.id }}
        currentTrade={trade}
        tradeState="LOADED"
        activeTrades={[trade]}
      />
    );

    const stateBadge = screen.getByTestId("state-badge");
    expect(stateBadge).toHaveTextContent("LOADED");
  });

  it("shows MANAGE state badge for ENTERED trade", () => {
    const trade = createTrade({ state: "ENTERED", entryPrice: 5.0, entryTime: new Date() });

    render(
      <NowPanel
        {...defaultProps}
        focus={{ kind: "trade", tradeId: trade.id }}
        currentTrade={trade}
        tradeState="ENTERED"
        activeTrades={[trade]}
      />
    );

    const stateBadge = screen.getByTestId("state-badge");
    expect(stateBadge).toHaveTextContent("MANAGE");
  });

  it("shows next action CTA for symbol view", () => {
    render(<NowPanel {...defaultProps} />);

    const nextActionCta = screen.getByTestId("next-action-cta");
    expect(nextActionCta).toBeInTheDocument();
    expect(nextActionCta).toHaveTextContent("Select contract to load");
  });

  it("shows next action CTA for loaded trade", () => {
    const trade = createTrade({ state: "LOADED" });

    render(
      <NowPanel
        {...defaultProps}
        focus={{ kind: "trade", tradeId: trade.id }}
        currentTrade={trade}
        tradeState="LOADED"
        activeTrades={[trade]}
      />
    );

    const nextActionCta = screen.getByTestId("next-action-cta");
    expect(nextActionCta).toHaveTextContent("Execute →");
  });
});
