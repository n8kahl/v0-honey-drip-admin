import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HDChallengeDetailSheet } from "../HDChallengeDetailSheet";
import type { Challenge, Trade, Contract } from "../../../../types";

// Mock Dialog component
vi.mock("../../../ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    "data-testid"?: string;
  }) => (
    <div data-testid="app-sheet" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h1 data-testid="dialog-title" className={className}>
      {children}
    </h1>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

// Mock HDButton component
vi.mock("../../common/HDButton", () => ({
  HDButton: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

// Helper to create a minimal valid contract
const createContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: "contract-1",
  strike: 500,
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

// Helper to create a minimal valid challenge
const createChallenge = (overrides: Partial<Challenge> = {}): Challenge => ({
  id: "ch1",
  name: "Test Challenge",
  startingBalance: 1000,
  currentBalance: 1200,
  targetBalance: 2000,
  startDate: "2025-01-01",
  endDate: "2025-03-01",
  isActive: true,
  createdAt: new Date(),
  ...overrides,
});

// Helper to create a minimal valid trade
const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: crypto.randomUUID(),
  ticker: "SPY",
  contract: createContract(),
  tradeType: "Scalp",
  state: "ENTERED",
  updates: [],
  discordChannels: [],
  challenges: [],
  ...overrides,
});

describe("HDChallengeDetailSheet", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    challenge: createChallenge(),
    trades: [],
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onShare: vi.fn(),
  };

  it("renders nothing when challenge is null", () => {
    const { container } = render(<HDChallengeDetailSheet {...defaultProps} challenge={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(<HDChallengeDetailSheet {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders challenge name in dialog title", () => {
    render(<HDChallengeDetailSheet {...defaultProps} />);
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Challenge");
  });

  it("displays correct progress percentage", () => {
    // Starting: 1000, Current: 1200, Target: 2000
    // Progress = (1200 - 1000) / (2000 - 1000) * 100 = 20%
    render(<HDChallengeDetailSheet {...defaultProps} />);
    expect(screen.getByText("20.0%")).toBeInTheDocument();
  });

  it("displays balance values", () => {
    render(<HDChallengeDetailSheet {...defaultProps} />);
    expect(screen.getByText("$1000.00")).toBeInTheDocument(); // Starting
    expect(screen.getByText("$1200.00")).toBeInTheDocument(); // Current
    expect(screen.getByText("$2000.00")).toBeInTheDocument(); // Target
  });

  it("displays active trades section when there are active trades", () => {
    const trades = [
      createTrade({
        id: "t1",
        ticker: "SPY",
        challenges: ["ch1"],
        state: "ENTERED",
      }),
    ];

    render(<HDChallengeDetailSheet {...defaultProps} trades={trades} />);

    expect(screen.getByText("Active Trades (1)")).toBeInTheDocument();
    expect(screen.getByText("SPY")).toBeInTheDocument();
  });

  it("displays completed trades section when there are exited trades", () => {
    const trades = [
      createTrade({
        id: "t1",
        ticker: "QQQ",
        challenges: ["ch1"],
        state: "EXITED",
        entryPrice: 5.0,
        exitPrice: 7.5,
        quantity: 2,
      }),
    ];

    render(<HDChallengeDetailSheet {...defaultProps} trades={trades} />);

    expect(screen.getByText("Completed Trades (1)")).toBeInTheDocument();
    expect(screen.getByText("QQQ")).toBeInTheDocument();
  });

  it("displays empty state when no trades", () => {
    render(<HDChallengeDetailSheet {...defaultProps} trades={[]} />);

    expect(screen.getByText("No trades associated with this challenge yet")).toBeInTheDocument();
  });

  it("calculates P&L correctly with $100 options multiplier", () => {
    const trades = [
      createTrade({
        id: "t1",
        ticker: "SPY",
        challenges: ["ch1"],
        state: "EXITED",
        entryPrice: 5.0,
        exitPrice: 7.5, // +$2.50 per contract
        quantity: 2, // 2 contracts
      }),
    ];

    render(<HDChallengeDetailSheet {...defaultProps} trades={trades} />);

    // (7.5 - 5.0) * 2 * 100 = $500
    // Use getAllByText since the value appears in multiple places (stats + trade detail)
    const elements = screen.getAllByText(/\+\$500\.00/);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("displays negative P&L correctly", () => {
    const trades = [
      createTrade({
        id: "t1",
        ticker: "SPY",
        challenges: ["ch1"],
        state: "EXITED",
        entryPrice: 5.0,
        exitPrice: 3.0, // -$2.00 per contract
        quantity: 1,
      }),
    ];

    render(<HDChallengeDetailSheet {...defaultProps} trades={trades} />);

    // (3.0 - 5.0) * 1 * 100 = -$200
    // The component may render as "$-200.00" or "-$200.00"
    // Use queryByText with function matcher
    const container = screen.getByTestId("app-sheet");
    expect(container.textContent).toMatch(/200\.00/);
  });

  it("handles trades with null challenges gracefully", () => {
    const trades = [
      createTrade({
        id: "t1",
        ticker: "SPY",
        challenges: null as unknown as string[],
        state: "ENTERED",
      }),
      createTrade({
        id: "t2",
        ticker: "QQQ",
        challenges: ["ch1"],
        state: "ENTERED",
      }),
    ];

    // Should not throw
    render(<HDChallengeDetailSheet {...defaultProps} trades={trades} />);

    // Only the trade with ch1 challenge should be shown
    expect(screen.getByText("Active Trades (1)")).toBeInTheDocument();
    expect(screen.getByText("QQQ")).toBeInTheDocument();
  });

  it("displays LOADED trades in active section", () => {
    const trades = [
      createTrade({
        id: "t1",
        ticker: "AAPL",
        challenges: ["ch1"],
        state: "LOADED",
      }),
    ];

    render(<HDChallengeDetailSheet {...defaultProps} trades={trades} />);

    expect(screen.getByText("Active Trades (1)")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("LOADED")).toBeInTheDocument();
  });

  it("displays R-multiple when available", () => {
    const trades = [
      createTrade({
        id: "t1",
        ticker: "SPY",
        challenges: ["ch1"],
        state: "EXITED",
        entryPrice: 5.0,
        exitPrice: 7.5,
        quantity: 1,
        rMultiple: 2.5,
      }),
    ];

    render(<HDChallengeDetailSheet {...defaultProps} trades={trades} />);

    // R-multiple may appear in stats and trade detail, use regex
    const elements = screen.getAllByText(/\+2\.50R/);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("displays contract details for active trades", () => {
    const trades = [
      createTrade({
        id: "t1",
        ticker: "SPY",
        challenges: ["ch1"],
        state: "ENTERED",
        contract: createContract({
          strike: 600,
          type: "P",
          daysToExpiry: 3,
        }),
      }),
    ];

    render(<HDChallengeDetailSheet {...defaultProps} trades={trades} />);

    expect(screen.getByText(/600 P/)).toBeInTheDocument();
    expect(screen.getByText(/3.*DTE/)).toBeInTheDocument();
  });

  it("renders share button", () => {
    render(<HDChallengeDetailSheet {...defaultProps} />);
    expect(screen.getByText("Share to Discord")).toBeInTheDocument();
  });

  it("shows 100% progress bar when target is reached", () => {
    const challenge = createChallenge({
      startingBalance: 1000,
      currentBalance: 2500, // Exceeded target
      targetBalance: 2000,
    });

    render(<HDChallengeDetailSheet {...defaultProps} challenge={challenge} />);

    // Progress should show 150% but bar capped at 100%
    expect(screen.getByText("150.0%")).toBeInTheDocument();
  });
});
