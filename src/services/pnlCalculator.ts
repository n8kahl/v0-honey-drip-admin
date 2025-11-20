/**
 * P&L Calculator with Commission and Slippage Modeling
 *
 * Calculates realistic profit/loss accounting for:
 * - Transaction commissions (entry + exit)
 * - Market slippage (bid-ask spread)
 * - Fills execution quality
 *
 * Without these costs, backtests show 5-10% rosier results than live trading.
 *
 * @module services/pnl-calculator
 */

import { getMetricsService } from './monitoring';

// ============================================================================
// Types
// ============================================================================

export interface CommissionConfig {
  // Per-contract commission at entry
  entryCommission: number; // Dollars (e.g., 0.65 per contract)

  // Per-contract commission at exit
  exitCommission: number; // Dollars (e.g., 0.65 per contract)

  // Per-contract exchange fees (already included in most brokers, but included for completeness)
  exchangeFee: number; // Dollars (e.g., 0.01 per contract)

  // Minimum commission per trade (some brokers have minimums)
  minCommissionPerTrade: number; // Dollars (e.g., 1.00)
}

export interface SlippageConfig {
  // Bid-ask spread slippage (already baked into entry/exit prices)
  // Captured as a percentage of mid-price
  bidAskSpreadPercent: number; // e.g., 0.5 means 0.5% slippage cost

  // Market impact slippage for large orders
  // Applies when position size exceeds normal retail order
  marketImpactFactor: number; // Multiplier: 1.0 = no additional impact, 1.5 = 50% additional

  // Execution quality factor (1.0 = perfect fills at mid)
  // Retail order execution typically fills slightly worse than mid
  executionQualityFactor: number; // e.g., 0.95 means 5% worse than mid on average
}

export interface PnLCalculationParams {
  // Position data
  entryPrice: number; // Price paid at entry (or mid if not specified)
  exitPrice: number; // Price received at exit (or mid if not specified)
  quantity: number; // Number of contracts

  // Optional: spread data for more accurate slippage
  entryBid?: number;
  entryAsk?: number;
  exitBid?: number;
  exitAsk?: number;

  // Configuration
  commission?: Partial<CommissionConfig>;
  slippage?: Partial<SlippageConfig>;
}

export interface PnLResult {
  // Gross P&L (before costs)
  grossPnL: number; // $ amount
  grossPnLPercent: number; // %

  // Cost breakdown
  entryCommission: number; // $ cost at entry
  exitCommission: number; // $ cost at exit
  totalCommission: number; // $ total commissions
  slippageCost: number; // $ slippage cost

  // Net P&L (after all costs)
  netPnL: number; // $ amount (gross - all costs)
  netPnLPercent: number; // %

  // Cost analysis
  commissionAsPercentOfGross: number; // % of gross
  slippageAsPercentOfGross: number; // % of gross
  totalCostAsPercentOfGross: number; // % of gross

  // Breakeven analysis
  breakevenPointPercent: number; // How much price must move to break even after costs
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  // Standard retail broker commissions ($0.65 per contract)
  entryCommission: 0.65,
  exitCommission: 0.65,
  exchangeFee: 0.01,
  minCommissionPerTrade: 1.00,
};

export const DEFAULT_SLIPPAGE_CONFIG: SlippageConfig = {
  // Typical for SPX/SPY/QQQ liquid contracts
  bidAskSpreadPercent: 0.5, // 0.5% of mid-price

  // No additional market impact for retail-sized orders (<10 contracts)
  marketImpactFactor: 1.0,

  // Retail execution typically fills 2-3% worse than mid for options
  executionQualityFactor: 0.98,
};

// ============================================================================
// Main Calculator Functions
// ============================================================================

/**
 * Calculate realistic P&L including commissions and slippage
 *
 * @param params - Trade parameters (prices, quantities, config)
 * @returns Detailed P&L breakdown
 */
export function calculatePnL(params: PnLCalculationParams): PnLResult {
  const { entryPrice, exitPrice, quantity } = params;
  const commission = { ...DEFAULT_COMMISSION_CONFIG, ...params.commission };
  const slippage = { ...DEFAULT_SLIPPAGE_CONFIG, ...params.slippage };

  // ===== Calculate Gross P&L =====
  const grossPnLPerContract = exitPrice - entryPrice;
  const grossPnLDollars = grossPnLPerContract * quantity;
  const grossPnLPercent = entryPrice > 0 ? (grossPnLPerContract / entryPrice) * 100 : 0;

  // ===== Calculate Commission Costs =====
  const entryCommissionCost = Math.max(
    commission.entryCommission * quantity + commission.exchangeFee * quantity,
    commission.minCommissionPerTrade / 2 // Assume half of minimum at entry
  );

  const exitCommissionCost = Math.max(
    commission.exitCommission * quantity + commission.exchangeFee * quantity,
    commission.minCommissionPerTrade / 2 // Assume half of minimum at exit
  );

  const totalCommissionCost = entryCommissionCost + exitCommissionCost;

  // ===== Calculate Slippage Costs =====
  const entrySlippage = calculateSlippageCost(
    entryPrice,
    quantity,
    'buy',
    params.entryBid,
    params.entryAsk,
    slippage
  );

  const exitSlippage = calculateSlippageCost(
    exitPrice,
    quantity,
    'sell',
    params.exitBid,
    params.exitAsk,
    slippage
  );

  const totalSlippageCost = entrySlippage + exitSlippage;

  // ===== Calculate Net P&L =====
  const totalCosts = totalCommissionCost + totalSlippageCost;
  const netPnLDollars = grossPnLDollars - totalCosts;

  // Net P&L percent: (netPnL) / (entryPrice * quantity + costs)
  const costAdjustedEntry = entryPrice * quantity + entryCommissionCost + entrySlippage;
  const netPnLPercent = costAdjustedEntry > 0 ? (netPnLDollars / costAdjustedEntry) * 100 : 0;

  // ===== Cost Analysis =====
  const commissionAsPercentOfGross = grossPnLDollars !== 0 ? (totalCommissionCost / Math.abs(grossPnLDollars)) * 100 : 0;
  const slippageAsPercentOfGross = grossPnLDollars !== 0 ? (totalSlippageCost / Math.abs(grossPnLDollars)) * 100 : 0;
  const totalCostAsPercentOfGross = commissionAsPercentOfGross + slippageAsPercentOfGross;

  // ===== Breakeven Analysis =====
  // How much the exit price needs to move (in %) to offset all costs
  const totalCostPerContract = totalCosts / quantity;
  const breakevenMove = entryPrice > 0 ? (totalCostPerContract / entryPrice) * 100 : 0;
  const breakevenPointPercent = breakevenMove;

  const result = {
    // Gross
    grossPnL: grossPnLDollars,
    grossPnLPercent,

    // Costs
    entryCommission: entryCommissionCost,
    exitCommission: exitCommissionCost,
    totalCommission: totalCommissionCost,
    slippageCost: totalSlippageCost,

    // Net
    netPnL: netPnLDollars,
    netPnLPercent,

    // Cost analysis
    commissionAsPercentOfGross,
    slippageAsPercentOfGross,
    totalCostAsPercentOfGross,

    // Breakeven
    breakevenPointPercent,
  };

  // Record P&L metrics
  try {
    getMetricsService().recordPnL(
      grossPnLPercent,
      netPnLPercent,
      totalCommissionCost,
      totalSlippageCost
    );
  } catch (e) {
    // Silently ignore metrics service errors
  }

  return result;
}

/**
 * Calculate slippage cost for a single leg (entry or exit)
 *
 * Takes into account: spread, market impact, and execution quality
 *
 * @param midPrice - Mid-price at entry/exit
 * @param quantity - Number of contracts
 * @param direction - 'buy' (entry) or 'sell' (exit)
 * @param bid - Actual bid (if known)
 * @param ask - Actual ask (if known)
 * @param config - Slippage configuration
 * @returns Slippage cost in dollars
 */
function calculateSlippageCost(
  midPrice: number,
  quantity: number,
  direction: 'buy' | 'sell',
  bid: number | undefined,
  ask: number | undefined,
  config: SlippageConfig
): number {
  let slippagePercent = config.bidAskSpreadPercent / 100; // Convert to decimal

  // If bid/ask provided, use actual spread
  if (bid !== undefined && ask !== undefined && bid > 0 && ask > 0) {
    const actualSpread = (ask - bid) / ((bid + ask) / 2);
    slippagePercent = actualSpread;
  }

  // Apply market impact factor (larger orders slip more)
  const impactAdjustedSlippage = slippagePercent * config.marketImpactFactor;

  // Apply execution quality factor (retail fills slightly worse)
  const finalSlippage = impactAdjustedSlippage * config.executionQualityFactor;

  // For buys (entry), you pay spread; for sells (exit), you lose spread
  // Both are costs in terms of P&L
  const slippageDollars = midPrice * quantity * finalSlippage;

  return slippageDollars;
}

/**
 * Simple P&L calculation (used in quick displays)
 *
 * Returns net P&L percent accounting for standard costs
 *
 * @param entryPrice - Entry price
 * @param exitPrice - Exit price
 * @param quantity - Contracts
 * @returns Net P&L percent
 */
export function calculateNetPnLPercent(
  entryPrice: number,
  exitPrice: number,
  quantity: number = 1
): number {
  const result = calculatePnL({
    entryPrice,
    exitPrice,
    quantity,
  });

  return result.netPnLPercent;
}

/**
 * Calculate breakeven price (price where net P&L = 0)
 *
 * @param entryPrice - Entry price
 * @param quantity - Number of contracts
 * @param commission - Optional commission config
 * @param slippage - Optional slippage config
 * @returns Breakeven price
 */
export function calculateBreakevenPrice(
  entryPrice: number,
  quantity: number = 1,
  commission?: Partial<CommissionConfig>,
  slippage?: Partial<SlippageConfig>
): number {
  const config = { ...DEFAULT_COMMISSION_CONFIG, ...commission };
  const slippageConfig = { ...DEFAULT_SLIPPAGE_CONFIG, ...slippage };

  // Total cost per contract
  const commissionPerContract = (config.entryCommission + config.exitCommission) / quantity;
  const slippagePerContract =
    (entryPrice * (slippageConfig.bidAskSpreadPercent / 100) *
      slippageConfig.marketImpactFactor *
      slippageConfig.executionQualityFactor) /
    quantity;

  const totalCostPerContract = commissionPerContract + slippagePerContract;

  return entryPrice + totalCostPerContract;
}

/**
 * Estimate impact of slippage on win rate
 *
 * If your win rate is X% gross, what is it after slippage/commissions?
 *
 * @param grossWinRate - Historical win rate % (gross)
 * @param averageWinSize - Average winning trade size %
 * @param averageLossSize - Average losing trade size %
 * @param costAsPercent - Total costs as % of mid-price
 * @returns Adjusted win rate accounting for costs
 */
export function adjustWinRateForCosts(
  grossWinRate: number,
  averageWinSize: number,
  averageLossSize: number,
  costAsPercent: number
): {
  adjustedWinRate: number;
  breakevenWinRate: number;
  expectedValue: number;
} {
  // Adjusted win amounts (after costs)
  const adjustedWinSize = Math.max(0.01, averageWinSize - costAsPercent);
  const adjustedLossSize = averageLossSize + costAsPercent;

  // Calculate which trades break even
  const winsAboveBreakeven = Math.max(0, grossWinRate - (costAsPercent / averageWinSize) * 100);
  const adjustedWinRate = Math.max(0, Math.min(100, winsAboveBreakeven));

  // Breakeven win rate: where expected value = 0
  // winRate * avgWin = (1-winRate) * avgLoss
  const breakevenWinRate = (adjustedLossSize / (adjustedWinSize + adjustedLossSize)) * 100;

  // Expected value (EV) of the trade
  // EV = (winRate * avgWin) - ((1-winRate) * avgLoss)
  const winProbability = adjustedWinRate / 100;
  const lossProbability = 1 - winProbability;
  const expectedValue =
    winProbability * adjustedWinSize - lossProbability * adjustedLossSize;

  return {
    adjustedWinRate,
    breakevenWinRate,
    expectedValue,
  };
}

/**
 * Format P&L for display
 *
 * @param pnl - P&L amount in dollars
 * @param pnlPercent - P&L percentage
 * @returns Formatted string like "+$1.50 (+5.2%)" or "-$0.50 (-2.1%)"
 */
export function formatPnL(pnl: number, pnlPercent: number): string {
  const sign = pnl >= 0 ? '+' : '';
  const percentSign = pnlPercent >= 0 ? '+' : '';
  return `${sign}$${Math.abs(pnl).toFixed(2)} (${percentSign}${pnlPercent.toFixed(1)}%)`;
}

/**
 * Color code P&L for UI display
 *
 * @param pnl - P&L amount in dollars
 * @returns Color class: 'text-green-600' | 'text-red-600' | 'text-gray-600'
 */
export function getPnLColor(pnl: number): 'text-green-600' | 'text-red-600' | 'text-gray-600' {
  if (pnl > 0) return 'text-green-600';
  if (pnl < 0) return 'text-red-600';
  return 'text-gray-600';
}
