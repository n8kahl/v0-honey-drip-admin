/**
 * Backtest Types & Configuration
 * Shared types used by EventDrivenBacktestEngine and related modules
 */

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  symbols: string[]; // Symbols to backtest
  startDate: string; // Start date (YYYY-MM-DD)
  endDate: string; // End date (YYYY-MM-DD)
  timeframe: string; // Primary timeframe (e.g., '15m')
  targetMultiple: number; // Target profit multiple (e.g., 1.5 = 1.5R)
  stopMultiple: number; // Stop loss multiple (e.g., 1.0 = 1R)
  maxHoldBars: number; // Max bars to hold position
  slippage: number; // Slippage in % (e.g., 0.001 = 0.1%) - fallback if no quote data
  enableTrailingStop?: boolean; // Enable trailing stop logic

  // Realistic slippage options (uses options_quotes table)
  useRealisticSlippage?: boolean; // Use bid/ask data for slippage (default: true)
  maxSpreadPercent?: number; // Max spread to accept trade (default: 2.0%)
  minLiquiditySize?: number; // Min bid/ask size in lots (default: 10)
  filterIlliquid?: boolean; // Skip trades with poor liquidity (default: true)
}

/**
 * Watchlist for backtesting - symbols with available historical data
 */
export const BACKTEST_WATCHLIST = [
  // Indices - best ORB performance
  "SPY",
  "SPX",
  "NDX",
  "QQQ",
  // Individual stocks
  "TSLA",
  "SOFI",
  "AMD",
  "NVDA",
  "MSFT",
  "PLTR",
  "UNH",
];

/**
 * Default backtest configuration
 */
export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  symbols: BACKTEST_WATCHLIST,
  startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  endDate: new Date().toISOString().split("T")[0],
  timeframe: "15m",
  // OPTIMIZED: Increased target for better R:R, tighter stops, shorter hold
  targetMultiple: 2.0, // WAS: 1.5 - larger targets for better expectancy
  stopMultiple: 0.75, // WAS: 1.0 - tighter stops reduce losers
  maxHoldBars: 15, // WAS: 20 (~3.75 hours on 15m) - reduce exposure
  slippage: 0.001, // Fallback slippage (0.1% - realistic for underlying)

  // Realistic slippage options (requires options_quotes data)
  useRealisticSlippage: false, // Disabled until options quote data is available
  maxSpreadPercent: 2.0, // Max 2% spread to take trade
  minLiquiditySize: 10, // Min 10 lots on bid/ask
  filterIlliquid: false, // Disabled until options quote data is available
  enableTrailingStop: false,
};

/**
 * Backtest result for a single trade
 */
export interface BacktestTrade {
  timestamp: number;
  symbol: string;
  detector: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  exitPrice: number;
  exitTimestamp: number;
  exitReason: "TARGET_HIT" | "STOP_HIT" | "MAX_HOLD" | "EOD";
  pnl: number;
  pnlPercent: number;
  rMultiple: number; // Actual R achieved (e.g., 1.5R or -1.0R)
  barsHeld: number;
  timeframe?: string; // Phase 5: The strategy's base timeframe
  initialStopDist?: number; // Phase 5: Initial risk for R calculation
  marketRegime?: string;
  vixLevel?: number;
  ivPercentile?: number;
  // PHASE 5: Advanced Management
  isTrimmed?: boolean; // True if partial profit was taken
  breakevenTriggered?: boolean; // True if stop was moved to entry
  atr?: number; // ATR at time of entry
}

/**
 * Backtest statistics for a detector
 */
export interface BacktestStats {
  detector: string;
  symbol?: string;

  // Trade counts
  totalTrades: number;
  winners: number;
  losers: number;
  breakeven: number;

  // Win rate
  winRate: number;

  // P&L stats
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;

  // Risk metrics
  profitFactor: number; // Gross profit / Gross loss
  expectancy: number; // Average R per trade
  avgRMultiple: number;

  // Time metrics
  avgBarsHeld: number;
  avgWinBars: number;
  avgLossBars: number;

  // Distribution
  byRegime?: Record<string, Partial<BacktestStats>>;
  byTimeOfDay?: Record<string, Partial<BacktestStats>>;
  bySymbol?: Record<string, Partial<BacktestStats>>;

  // Trade list
  trades: BacktestTrade[];
}

/**
 * Calculate statistics from a list of trades
 */
export function calculateStats(
  detectorName: string,
  trades: BacktestTrade[],
  symbol?: string
): BacktestStats {
  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl < 0);
  const breakeven = trades.filter((t) => t.pnl === 0);

  const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));

  return {
    detector: detectorName,
    symbol,
    totalTrades: trades.length,
    winners: winners.length,
    losers: losers.length,
    breakeven: breakeven.length,
    winRate: trades.length > 0 ? winners.length / trades.length : 0,
    totalPnl: trades.reduce((sum, t) => sum + t.pnl, 0),
    totalPnlPercent: trades.reduce((sum, t) => sum + t.pnlPercent, 0),
    avgWin: winners.length > 0 ? grossProfit / winners.length : 0,
    avgLoss: losers.length > 0 ? grossLoss / losers.length : 0,
    largestWin: winners.length > 0 ? Math.max(...winners.map((t) => t.pnl)) : 0,
    largestLoss: losers.length > 0 ? Math.max(...losers.map((t) => Math.abs(t.pnl))) : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    expectancy:
      trades.length > 0 ? trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length : 0,
    avgRMultiple:
      trades.length > 0 ? trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length : 0,
    avgBarsHeld:
      trades.length > 0 ? trades.reduce((sum, t) => sum + t.barsHeld, 0) / trades.length : 0,
    avgWinBars:
      winners.length > 0 ? winners.reduce((sum, t) => sum + t.barsHeld, 0) / winners.length : 0,
    avgLossBars:
      losers.length > 0 ? losers.reduce((sum, t) => sum + t.barsHeld, 0) / losers.length : 0,
    trades,
  };
}
