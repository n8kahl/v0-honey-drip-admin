/**
 * ContractPicker Component Tests
 *
 * Tests for the contract selection modal/sheet component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContractPicker, ContractPickerTrigger } from "../ContractPicker";
import type { Contract } from "../../../../types";

// Mock dependencies
vi.mock("../../../../hooks/useStreamingOptionsChain", () => ({
  useStreamingOptionsChain: vi.fn(() => ({
    contracts: mockContracts,
    loading: false,
    error: null,
    isStale: false,
  })),
}));

vi.mock("../../../ui/use-mobile", () => ({
  useIsMobile: vi.fn(() => false), // Default to desktop
}));

// Mock HDContractGrid
vi.mock("../../../hd/common/HDContractGrid", () => ({
  HDContractGrid: ({ contracts, onContractSelect }: any) => (
    <div data-testid="contract-grid">
      {contracts.map((c: Contract) => (
        <button
          key={c.id}
          data-testid={`contract-${c.strike}${c.type}`}
          onClick={() => onContractSelect(c)}
        >
          ${c.strike}
          {c.type}
        </button>
      ))}
    </div>
  ),
}));

// Mock contracts
const mockContracts: Contract[] = [
  {
    id: "1",
    strike: 590,
    expiry: "2025-01-17",
    expiryDate: new Date("2025-01-17"),
    daysToExpiry: 5,
    type: "C",
    mid: 5.5,
    bid: 5.4,
    ask: 5.6,
    volume: 1000,
    openInterest: 5000,
  },
  {
    id: "2",
    strike: 595,
    expiry: "2025-01-17",
    expiryDate: new Date("2025-01-17"),
    daysToExpiry: 5,
    type: "C",
    mid: 3.0,
    bid: 2.9,
    ask: 3.1,
    volume: 2000,
    openInterest: 8000,
  },
  {
    id: "3",
    strike: 600,
    expiry: "2025-01-17",
    expiryDate: new Date("2025-01-17"),
    daysToExpiry: 5,
    type: "C",
    mid: 1.5,
    bid: 1.4,
    ask: 1.6,
    volume: 3000,
    openInterest: 10000,
  },
  {
    id: "4",
    strike: 595,
    expiry: "2025-01-17",
    expiryDate: new Date("2025-01-17"),
    daysToExpiry: 5,
    type: "P",
    mid: 2.8,
    bid: 2.7,
    ask: 2.9,
    volume: 1500,
    openInterest: 6000,
  },
];

describe("ContractPicker", () => {
  const defaultProps = {
    symbol: "SPY",
    currentPrice: 595,
    open: true,
    onOpenChange: vi.fn(),
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders contract grid when open", () => {
    render(<ContractPicker {...defaultProps} />);

    expect(screen.getByTestId("contract-grid")).toBeInTheDocument();
    expect(screen.getByText(/Select Contract.*SPY/)).toBeInTheDocument();
  });

  it("calls onSelect when a contract is clicked", () => {
    const onSelect = vi.fn();
    render(<ContractPicker {...defaultProps} onSelect={onSelect} />);

    // Click on the $595C contract
    fireEvent.click(screen.getByTestId("contract-595C"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        strike: 595,
        type: "C",
      })
    );
  });

  it("closes after contract selection", () => {
    const onOpenChange = vi.fn();
    render(<ContractPicker {...defaultProps} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByTestId("contract-600C"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when closed", () => {
    render(<ContractPicker {...defaultProps} open={false} />);

    expect(screen.queryByTestId("contract-grid")).not.toBeInTheDocument();
  });
});

describe("ContractPickerTrigger", () => {
  it("renders with default label", () => {
    render(<ContractPickerTrigger onClick={vi.fn()} />);

    expect(screen.getByText("Select Contract")).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<ContractPickerTrigger onClick={vi.fn()} label="Change" />);

    expect(screen.getByText("Change")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<ContractPickerTrigger onClick={onClick} />);

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    const onClick = vi.fn();
    render(<ContractPickerTrigger onClick={onClick} disabled />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows tooltip when disabled with reason", () => {
    render(
      <ContractPickerTrigger
        onClick={vi.fn()}
        disabled
        disabledReason="Can't change contract after entry"
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "Can't change contract after entry");
  });
});
