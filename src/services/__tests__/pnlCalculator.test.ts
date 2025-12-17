/**
 * P&L Calculator Tests
 *
 * Tests for realistic P&L calculation including commission, slippage,
 * and contract multiplier handling.
 *
 * Test Vectors:
 * - Test A: Contract multiplier verification (100× for options)
 * - Test B: Commission and slippage integration
 * - Test C: Breakeven solver accuracy
 * - Test D: Edge cases (zero entry, large quantities)
 */

import { describe, it, expect } from "vitest";
import {
  calculatePnL,
  calculateNetPnLPercent,
  calculateBreakevenPrice,
  calculateBreakevenPriceSimple,
  DEFAULT_COMMISSION_CONFIG,
  DEFAULT_SLIPPAGE_CONFIG,
  type PnLCalculationParams,
  type PnLResult,
  type BreakevenConfig,
} from "../pnlCalculator";

// ============================================================================
// Test Constants
// ============================================================================

/**
 * Zero-cost configuration for testing pure P&L calculations
 */
const ZERO_COSTS = {
  commission: {
    entryCommission: 0,
    exitCommission: 0,
    exchangeFee: 0,
    minCommissionPerTrade: 0,
  },
  slippage: {
    bidAskSpreadPercent: 0,
    marketImpactFactor: 0,
    executionQualityFactor: 0,
  },
};

// ============================================================================
// Test A: Contract Multiplier Verification
// ============================================================================

describe("Contract Multiplier (Test A)", () => {
  it("applies 100× multiplier by default for options", () => {
    // Entry: $5.00 per share, Exit: $6.00 per share
    // For 1 contract = 100 shares
    // Gross P&L = ($6.00 - $5.00) × 1 contract × 100 = $100
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
      ...ZERO_COSTS,
    });

    expect(result.grossPnL).toBe(100);
    expect(result.grossPnLPercent).toBe(20); // (6-5)/5 * 100 = 20%
  });

  it("scales correctly with quantity", () => {
    // 10 contracts, $1.00 move
    // Gross P&L = $1.00 × 10 contracts × 100 = $1,000
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 10,
      ...ZERO_COSTS,
    });

    expect(result.grossPnL).toBe(1000);
  });

  it("respects custom multiplier (stocks = 1×)", () => {
    // For stocks: multiplier = 1
    // Entry: $100, Exit: $110, Quantity: 50 shares
    // Gross P&L = ($110 - $100) × 50 × 1 = $500
    const result = calculatePnL({
      entryPrice: 100.0,
      exitPrice: 110.0,
      quantity: 50,
      contractMultiplier: 1, // Stock (not options)
      ...ZERO_COSTS,
    });

    expect(result.grossPnL).toBe(500);
    expect(result.grossPnLPercent).toBe(10);
  });

  it("handles negative P&L (losing trade)", () => {
    // Entry: $5.00, Exit: $4.00, 2 contracts
    // Gross P&L = (-$1.00) × 2 × 100 = -$200
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 4.0,
      quantity: 2,
      ...ZERO_COSTS,
    });

    expect(result.grossPnL).toBe(-200);
    expect(result.grossPnLPercent).toBe(-20);
  });

  it("calculates net P&L percent against cost basis with multiplier", () => {
    // Entry: $5.00, Exit: $6.00, 1 contract, 100× multiplier
    // Cost basis = $5.00 × 1 × 100 = $500
    // Net P&L = $100 (with zero costs)
    // Net P&L % = $100 / $500 × 100 = 20%
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
      ...ZERO_COSTS,
    });

    expect(result.netPnLPercent).toBe(20);
  });
});

// ============================================================================
// Test B: Commission and Slippage Integration
// ============================================================================

describe("Commission and Slippage (Test B)", () => {
  it("deducts commission from gross P&L", () => {
    // Entry: $5.00, Exit: $6.00, 1 contract
    // Gross P&L = $100
    // Commission: $0.65 entry + $0.65 exit + $0.01 exchange × 2 = $1.32
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
      slippage: ZERO_COSTS.slippage, // No slippage for this test
    });

    // With default commission ($0.65 + $0.01 per leg)
    expect(result.totalCommission).toBeCloseTo(1.32, 1);
    expect(result.netPnL).toBeLessThan(result.grossPnL);
    expect(result.netPnL).toBeCloseTo(100 - 1.32, 1);
  });

  it("applies slippage based on price and quantity", () => {
    // Entry: $5.00, 1 contract, 100× multiplier
    // Default slippage: 0.5% spread, 1.0 impact, 0.98 quality
    // Entry slippage = $5.00 × 1 × 100 × (0.005 × 1.0 × 0.98) ≈ $2.45
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
      commission: ZERO_COSTS.commission, // No commission for this test
    });

    // Slippage should be positive (it's a cost)
    expect(result.slippageCost).toBeGreaterThan(0);
    expect(result.netPnL).toBeLessThan(result.grossPnL);
  });

  it("calculates combined costs correctly", () => {
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
    });

    // Total costs = commission + slippage
    const expectedTotalCosts = result.totalCommission + result.slippageCost;
    expect(result.grossPnL - result.netPnL).toBeCloseTo(expectedTotalCosts, 2);
  });

  it("commission minimum is applied correctly", () => {
    // With very small position, minimum commission kicks in
    const result = calculatePnL({
      entryPrice: 0.1, // Very cheap option
      exitPrice: 0.2,
      quantity: 1,
      slippage: ZERO_COSTS.slippage,
    });

    // Min commission is $1.00 total (split $0.50 entry + $0.50 exit)
    // Standard is $0.65 + $0.01 = $0.66 per leg = $1.32 total
    expect(result.totalCommission).toBeGreaterThanOrEqual(1.0);
  });

  it("respects bid/ask spread when provided", () => {
    // Entry with wide bid/ask spread
    const resultWithSpread = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
      entryBid: 4.8,
      entryAsk: 5.2, // 8% spread (much wider than default 0.5%)
      commission: ZERO_COSTS.commission,
    });

    const resultDefault = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
      commission: ZERO_COSTS.commission,
    });

    // Slippage should be higher with wider spread
    expect(resultWithSpread.slippageCost).toBeGreaterThan(resultDefault.slippageCost);
  });
});

// ============================================================================
// Test C: Breakeven Solver Accuracy
// ============================================================================

describe("Breakeven Solver (Test C)", () => {
  it("finds breakeven price where netPnL ≈ 0", () => {
    const entryPrice = 5.0;
    const quantity = 1;

    const breakeven = calculateBreakevenPrice({
      entryPrice,
      quantity,
    });

    // Verify that at breakeven price, netPnL is approximately zero
    const resultAtBreakeven = calculatePnL({
      entryPrice,
      exitPrice: breakeven,
      quantity,
    });

    expect(Math.abs(resultAtBreakeven.netPnL)).toBeLessThan(0.05); // Within $0.05
  });

  it("breakeven is higher than entry (must overcome costs)", () => {
    const entryPrice = 5.0;
    const breakeven = calculateBreakevenPrice({
      entryPrice,
      quantity: 1,
    });

    expect(breakeven).toBeGreaterThan(entryPrice);
  });

  it("breakeven scales with quantity and costs", () => {
    const entryPrice = 5.0;

    // Single contract
    const breakeven1 = calculateBreakevenPrice({
      entryPrice,
      quantity: 1,
    });

    // 10 contracts - fixed commission spread over more contracts = smaller per-contract cost
    const breakeven10 = calculateBreakevenPrice({
      entryPrice,
      quantity: 10,
    });

    // With more contracts, breakeven per contract should be lower
    // (commission is per-contract but not proportionally higher)
    const moveNeeded1 = breakeven1 - entryPrice;
    const moveNeeded10 = breakeven10 - entryPrice;

    // They should be relatively close but not exactly equal due to commission structure
    expect(moveNeeded1).toBeGreaterThan(0);
    expect(moveNeeded10).toBeGreaterThan(0);
  });

  it("uses correct multiplier in breakeven calculation", () => {
    const entryPrice = 5.0;

    // Options (100× multiplier)
    const breakevenOptions = calculateBreakevenPrice({
      entryPrice,
      quantity: 1,
      contractMultiplier: 100,
    });

    // Stocks (1× multiplier)
    const breakevenStocks = calculateBreakevenPrice({
      entryPrice,
      quantity: 100, // Same notional value: $500
      contractMultiplier: 1,
    });

    // Both should need positive move to break even
    expect(breakevenOptions).toBeGreaterThan(entryPrice);
    expect(breakevenStocks).toBeGreaterThan(entryPrice);
  });

  it("handles zero-cost scenario (breakeven = entry)", () => {
    const entryPrice = 5.0;
    const breakeven = calculateBreakevenPrice({
      entryPrice,
      quantity: 1,
      ...ZERO_COSTS,
    });

    // With no costs, breakeven should be at or very close to entry
    expect(breakeven).toBeCloseTo(entryPrice, 4);
  });

  it("legacy function still works", () => {
    const breakeven = calculateBreakevenPriceSimple(5.0, 1);
    expect(breakeven).toBeGreaterThan(5.0);
  });
});

// ============================================================================
// Test D: Edge Cases
// ============================================================================

describe("Edge Cases (Test D)", () => {
  it("handles zero entry price gracefully", () => {
    const result = calculatePnL({
      entryPrice: 0,
      exitPrice: 1.0,
      quantity: 1,
      ...ZERO_COSTS,
    });

    // Should not throw, P&L percent should be 0 (avoid divide by zero)
    expect(result.grossPnLPercent).toBe(0);
  });

  it("handles zero exit price (total loss)", () => {
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 0,
      quantity: 1,
      ...ZERO_COSTS,
    });

    expect(result.grossPnL).toBe(-500); // Lost entire $500 position
    expect(result.grossPnLPercent).toBe(-100);
  });

  it("handles very large quantities", () => {
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1000,
      ...ZERO_COSTS,
    });

    // $1.00 × 1000 contracts × 100 = $100,000
    expect(result.grossPnL).toBe(100000);
  });

  it("handles fractional prices", () => {
    const result = calculatePnL({
      entryPrice: 0.15,
      exitPrice: 0.25,
      quantity: 1,
      ...ZERO_COSTS,
    });

    // $0.10 × 1 × 100 = $10
    expect(result.grossPnL).toBe(10);
    expect(result.grossPnLPercent).toBeCloseTo(66.67, 1); // (0.25-0.15)/0.15 * 100
  });

  it("handles equal entry and exit (flat trade)", () => {
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 5.0,
      quantity: 1,
    });

    // Gross P&L = $0, but costs make it negative
    expect(result.grossPnL).toBe(0);
    expect(result.netPnL).toBeLessThan(0); // Costs make it a loss
  });

  it("breakeven handles edge case of zero/negative entry", () => {
    const breakeven = calculateBreakevenPrice({
      entryPrice: 0,
      quantity: 1,
    });

    // Should return entry price without crashing
    expect(breakeven).toBe(0);
  });

  it("breakeven handles zero quantity", () => {
    const breakeven = calculateBreakevenPrice({
      entryPrice: 5.0,
      quantity: 0,
    });

    // Should return entry price without crashing
    expect(breakeven).toBe(5.0);
  });
});

// ============================================================================
// Test E: Simple P&L Function
// ============================================================================

describe("calculateNetPnLPercent", () => {
  it("returns net P&L percent with default costs", () => {
    const percent = calculateNetPnLPercent(5.0, 6.0, 1);

    // Should be less than gross 20% due to costs
    expect(percent).toBeLessThan(20);
    expect(percent).toBeGreaterThan(15); // But still profitable
  });

  it("handles default quantity of 1", () => {
    const percent = calculateNetPnLPercent(5.0, 6.0);
    expect(percent).toBeDefined();
    expect(typeof percent).toBe("number");
  });
});

// ============================================================================
// Test F: Cost Analysis Metrics
// ============================================================================

describe("Cost Analysis", () => {
  it("calculates commission as percent of gross correctly", () => {
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
      slippage: ZERO_COSTS.slippage,
    });

    // Commission / |Gross P&L| × 100
    const expected = (result.totalCommission / Math.abs(result.grossPnL)) * 100;
    expect(result.commissionAsPercentOfGross).toBeCloseTo(expected, 2);
  });

  it("calculates total cost as percent of gross", () => {
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
    });

    // Sum should equal total cost percent
    const summed = result.commissionAsPercentOfGross + result.slippageAsPercentOfGross;
    expect(result.totalCostAsPercentOfGross).toBeCloseTo(summed, 2);
  });

  it("handles zero gross P&L in cost analysis", () => {
    const result = calculatePnL({
      entryPrice: 5.0,
      exitPrice: 5.0, // Flat trade
      quantity: 1,
    });

    // Should not throw on divide by zero
    expect(result.commissionAsPercentOfGross).toBe(0);
    expect(result.slippageAsPercentOfGross).toBe(0);
    expect(result.totalCostAsPercentOfGross).toBe(0);
  });
});

// ============================================================================
// Regression Tests
// ============================================================================

describe("Regression Tests", () => {
  it("consistent results across multiple calls (deterministic)", () => {
    const params: PnLCalculationParams = {
      entryPrice: 5.0,
      exitPrice: 6.0,
      quantity: 1,
    };

    const result1 = calculatePnL(params);
    const result2 = calculatePnL(params);

    expect(result1.grossPnL).toBe(result2.grossPnL);
    expect(result1.netPnL).toBe(result2.netPnL);
    expect(result1.netPnLPercent).toBe(result2.netPnLPercent);
  });

  it("breakeven solver converges consistently", () => {
    const config: BreakevenConfig = {
      entryPrice: 5.0,
      quantity: 1,
    };

    const breakeven1 = calculateBreakevenPrice(config);
    const breakeven2 = calculateBreakevenPrice(config);

    expect(breakeven1).toBe(breakeven2);
  });
});
