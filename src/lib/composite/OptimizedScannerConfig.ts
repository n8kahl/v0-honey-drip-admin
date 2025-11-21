/**
 * Optimized Scanner Configuration
 * High-Accuracy, Low False Signal Configuration
 *
 * This configuration is optimized for:
 * - Higher win rate (targeting 65%+ accuracy)
 * - Fewer false signals (< 3 signals per symbol per day)
 * - Better risk/reward ratios (minimum 2:1)
 * - Strong confluence requirements
 * - Market regime awareness
 */

import type { ScannerConfig, SignalThresholds, UniversalFilters } from "./ScannerConfig.js";
import type { AssetClass, OpportunityType } from "./OpportunityDetector.js";

/**
 * TIER 1: Highest Quality Strategies
 * These have proven track records and strong edge
 * Lower score requirements but still selective
 */
const TIER_1_STRATEGIES: OpportunityType[] = [
  "breakout_bullish",
  "breakout_bearish",
  "mean_reversion_long",
  "mean_reversion_short",
  "trend_continuation_long",
  "trend_continuation_short",
];

/**
 * TIER 2: Index-Specific Strategies
 * Require strong confirmation and higher scores
 * More volatile, need stricter filtering
 */
const TIER_2_STRATEGIES: OpportunityType[] = [
  "gamma_squeeze_bullish",
  "gamma_squeeze_bearish",
  "index_mean_reversion_long",
  "index_mean_reversion_short",
  "power_hour_reversal_bullish",
  "power_hour_reversal_bearish",
];

/**
 * TIER 3: Advanced/Exotic Strategies
 * Highest requirements, most selective
 * Only trade when setup is perfect
 */
const TIER_3_STRATEGIES: OpportunityType[] = [
  "gamma_flip_bullish",
  "gamma_flip_bearish",
  "eod_pin_setup",
  "opening_drive_bullish",
  "opening_drive_bearish",
];

/**
 * Optimized default thresholds
 * Significantly more selective than defaults
 */
export const OPTIMIZED_DEFAULT_THRESHOLDS: SignalThresholds = {
  minBaseScore: 80, // Increased from 70 - only top 20% of setups
  minStyleScore: 85, // Increased from 75 - must be ideal for trading style
  minRiskReward: 2.0, // Increased from 1.5 - better R:R required
  maxSignalsPerSymbolPerHour: 1, // Reduced from 2 - less overtrading
  cooldownMinutes: 30, // Increased from 15 - more breathing room
};

/**
 * SPX/NDX optimized thresholds
 * Indices require even stronger setups
 */
export const OPTIMIZED_INDEX_THRESHOLDS: SignalThresholds = {
  minBaseScore: 85, // Very high bar for indices
  minStyleScore: 88, // Near-perfect style fit required
  minRiskReward: 2.5, // Excellent R:R required
  maxSignalsPerSymbolPerHour: 2, // Can handle slightly more due to liquidity
  cooldownMinutes: 20, // Shorter due to faster movement
};

/**
 * Equity-specific optimized thresholds
 * More selective than defaults but slightly looser than indices
 */
export const OPTIMIZED_EQUITY_THRESHOLDS: SignalThresholds = {
  minBaseScore: 78,
  minStyleScore: 83,
  minRiskReward: 2.0,
  maxSignalsPerSymbolPerHour: 1,
  cooldownMinutes: 30,
};

/**
 * Optimized universal filters
 * Stricter liquidity and quality requirements
 */
export const OPTIMIZED_FILTERS: UniversalFilters = {
  marketHoursOnly: true, // Critical - only trade during regular hours
  minRVOL: 0.0, // Temporarily disabled - intraday bars don't have daily avg volume data
  maxSpread: 0.003, // Tightened from 0.005 - better execution
  blacklist: [
    // Add problematic symbols with poor fill quality
    // These can be customized per user
  ],
  requireMinimumLiquidity: false, // Temporarily disabled - need daily volume data for this
  minAvgVolume: 0, // Temporarily disabled - intraday bars don't have this data
};

/**
 * Strategy-specific threshold overrides
 * Each strategy gets customized requirements based on historical performance
 */
const STRATEGY_THRESHOLDS: Partial<Record<OpportunityType, Partial<SignalThresholds>>> = {
  // TIER 1: Proven strategies - slightly relaxed but still high bar
  breakout_bullish: {
    minBaseScore: 78,
    minStyleScore: 82,
    minRiskReward: 2.0,
  },
  breakout_bearish: {
    minBaseScore: 78,
    minStyleScore: 82,
    minRiskReward: 2.0,
  },
  mean_reversion_long: {
    minBaseScore: 80,
    minStyleScore: 85,
    minRiskReward: 2.2,
  },
  mean_reversion_short: {
    minBaseScore: 80,
    minStyleScore: 85,
    minRiskReward: 2.2,
  },
  trend_continuation_long: {
    minBaseScore: 75,
    minStyleScore: 80,
    minRiskReward: 2.5, // Higher R:R for trends
  },
  trend_continuation_short: {
    minBaseScore: 75,
    minStyleScore: 80,
    minRiskReward: 2.5,
  },

  // TIER 2: Index strategies - higher requirements
  gamma_squeeze_bullish: {
    minBaseScore: 85,
    minStyleScore: 88,
    minRiskReward: 2.5,
    cooldownMinutes: 45, // Less frequent
  },
  gamma_squeeze_bearish: {
    minBaseScore: 85,
    minStyleScore: 88,
    minRiskReward: 2.5,
    cooldownMinutes: 45,
  },
  index_mean_reversion_long: {
    minBaseScore: 82,
    minStyleScore: 86,
    minRiskReward: 2.3,
  },
  index_mean_reversion_short: {
    minBaseScore: 82,
    minStyleScore: 86,
    minRiskReward: 2.3,
  },
  power_hour_reversal_bullish: {
    minBaseScore: 85,
    minStyleScore: 88,
    minRiskReward: 2.0,
    maxSignalsPerSymbolPerHour: 1, // Only one power hour setup per day
  },
  power_hour_reversal_bearish: {
    minBaseScore: 85,
    minStyleScore: 88,
    minRiskReward: 2.0,
    maxSignalsPerSymbolPerHour: 1,
  },

  // TIER 3: Advanced strategies - extremely selective
  gamma_flip_bullish: {
    minBaseScore: 90,
    minStyleScore: 92,
    minRiskReward: 3.0,
    maxSignalsPerSymbolPerHour: 1,
    cooldownMinutes: 60, // Rare setups
  },
  gamma_flip_bearish: {
    minBaseScore: 90,
    minStyleScore: 92,
    minRiskReward: 3.0,
    maxSignalsPerSymbolPerHour: 1,
    cooldownMinutes: 60,
  },
  eod_pin_setup: {
    minBaseScore: 88,
    minStyleScore: 90,
    minRiskReward: 2.8,
    maxSignalsPerSymbolPerHour: 1,
    cooldownMinutes: 120, // Once per symbol per day max
  },
  opening_drive_bullish: {
    minBaseScore: 85,
    minStyleScore: 88,
    minRiskReward: 2.5,
    maxSignalsPerSymbolPerHour: 1,
  },
  opening_drive_bearish: {
    minBaseScore: 85,
    minStyleScore: 88,
    minRiskReward: 2.5,
    maxSignalsPerSymbolPerHour: 1,
  },
};

/**
 * Optimized scanner configuration
 * Targets 65%+ win rate with 2:1+ average R:R
 */
export const OPTIMIZED_SCANNER_CONFIG: ScannerConfig = {
  defaultThresholds: OPTIMIZED_DEFAULT_THRESHOLDS,

  assetClassThresholds: {
    INDEX: OPTIMIZED_INDEX_THRESHOLDS,
    EQUITY_ETF: OPTIMIZED_EQUITY_THRESHOLDS,
    STOCK: OPTIMIZED_EQUITY_THRESHOLDS,
  },

  opportunityTypeThresholds: STRATEGY_THRESHOLDS,

  filters: OPTIMIZED_FILTERS,

  enableOptionsDataFetch: true,
  detectorVersion: "1.1.0-optimized",
  maxConcurrentScans: 10,
};

/**
 * Additional confluence requirements (to be enforced in scanner)
 * These are the minimum number of confirming factors required
 */
export const CONFLUENCE_REQUIREMENTS = {
  // Minimum confluence factors that must be present
  minFactorsRequired: 3, // At least 3 factors must score > 70

  // Factor-specific minimums (0-100 scale)
  minimumFactorScores: {
    trend: 60, // Trend must be reasonably strong
    momentum: 65, // Momentum should be present
    volatility: 50, // Volatility within acceptable range
    volume: 70, // Volume must be strong
    vwap: 60, // Price relative to VWAP matters
    support_resistance: 70, // Technical levels critical
    pattern: 65, // Pattern quality important
  },

  // Factor weights (used in weighted average)
  factorWeights: {
    trend: 0.2, // 20% weight
    momentum: 0.18,
    volatility: 0.08,
    volume: 0.18,
    vwap: 0.12,
    support_resistance: 0.14,
    pattern: 0.1,
  },
};

/**
 * Market regime filters
 * Only trade certain strategies in certain market conditions
 */
export const MARKET_REGIME_FILTERS = {
  // VIX level filters (affects strategy selection)
  vixLevels: {
    low: {
      max: 15,
      allowedStrategies: [
        "trend_continuation_long",
        "trend_continuation_short",
        "breakout_bullish",
        "breakout_bearish",
      ],
    },
    normal: { min: 15, max: 25, allowedStrategies: [...TIER_1_STRATEGIES, ...TIER_2_STRATEGIES] },
    elevated: {
      min: 25,
      max: 35,
      allowedStrategies: [
        "mean_reversion_long",
        "mean_reversion_short",
        "gamma_squeeze_bullish",
        "gamma_squeeze_bearish",
      ],
    },
    high: { min: 35, allowedStrategies: ["mean_reversion_long", "index_mean_reversion_long"] }, // Very selective in high VIX
  },

  // Time-of-day filters (certain strategies work better at certain times)
  timeOfDayFilters: {
    opening_drive: { minMinutes: 0, maxMinutes: 60 }, // First hour only
    power_hour: { minMinutes: 330, maxMinutes: 390 }, // Last hour only
    eod_pin: { minMinutes: 360, maxMinutes: 390 }, // Last 30 min only
    regular: { minMinutes: 30, maxMinutes: 360 }, // Avoid first 30 min and last 30 min
  },

  // Trend regime (require alignment for directional trades)
  trendFilters: {
    strong_uptrend: ["breakout_bullish", "trend_continuation_long"],
    weak_uptrend: ["mean_reversion_long", "trend_continuation_long"],
    choppy: ["mean_reversion_long", "mean_reversion_short"],
    weak_downtrend: ["mean_reversion_short", "trend_continuation_short"],
    strong_downtrend: ["breakout_bearish", "trend_continuation_short"],
  },
};

/**
 * Performance tracking thresholds
 * Used to auto-adjust thresholds based on live performance
 */
export const PERFORMANCE_THRESHOLDS = {
  // If win rate drops below this, increase thresholds
  minWinRate: 0.6, // 60%

  // If win rate exceeds this, can slightly relax thresholds
  targetWinRate: 0.7, // 70%

  // If average R:R drops below this, increase requirements
  minAvgRiskReward: 1.8,

  // Sample size before making adjustments
  minTradesForAdjustment: 50,

  // Auto-adjustment increments
  scoreAdjustmentStep: 2, // Increase/decrease by 2 points
  rrAdjustmentStep: 0.2, // Increase/decrease by 0.2
};

/**
 * Helper: Get strategy tier
 */
export function getStrategyTier(opportunityType: OpportunityType): 1 | 2 | 3 {
  if (TIER_1_STRATEGIES.includes(opportunityType)) return 1;
  if (TIER_2_STRATEGIES.includes(opportunityType)) return 2;
  if (TIER_3_STRATEGIES.includes(opportunityType)) return 3;
  return 2; // Default to tier 2
}

/**
 * Helper: Check if strategy is allowed in current market regime
 */
export function isStrategyAllowedInRegime(
  opportunityType: OpportunityType,
  vixLevel: number,
  minutesSinceOpen: number,
  trendStrength: number
): { allowed: boolean; reason?: string } {
  // VIX check
  let vixRegime: keyof typeof MARKET_REGIME_FILTERS.vixLevels = "normal";
  if (vixLevel < 15) vixRegime = "low";
  else if (vixLevel >= 35) vixRegime = "high";
  else if (vixLevel >= 25) vixRegime = "elevated";

  const allowedByVix =
    MARKET_REGIME_FILTERS.vixLevels[vixRegime].allowedStrategies.includes(opportunityType);
  if (!allowedByVix) {
    return { allowed: false, reason: `Strategy not suitable for ${vixRegime} VIX regime` };
  }

  // Time-of-day check
  if (opportunityType.includes("opening_drive")) {
    const { minMinutes, maxMinutes } = MARKET_REGIME_FILTERS.timeOfDayFilters.opening_drive;
    if (minutesSinceOpen < minMinutes || minutesSinceOpen > maxMinutes) {
      return { allowed: false, reason: "Opening drive only valid in first hour" };
    }
  }

  if (opportunityType.includes("power_hour")) {
    const { minMinutes, maxMinutes } = MARKET_REGIME_FILTERS.timeOfDayFilters.power_hour;
    if (minutesSinceOpen < minMinutes || minutesSinceOpen > maxMinutes) {
      return { allowed: false, reason: "Power hour reversal only valid in last hour" };
    }
  }

  if (opportunityType.includes("eod_pin")) {
    const { minMinutes, maxMinutes } = MARKET_REGIME_FILTERS.timeOfDayFilters.eod_pin;
    if (minutesSinceOpen < minMinutes || minutesSinceOpen > maxMinutes) {
      return { allowed: false, reason: "EOD pin setup only valid in last 30 minutes" };
    }
  }

  // Trend alignment check for directional trades
  if (opportunityType.includes("bullish") || opportunityType.includes("long")) {
    if (trendStrength < -30) {
      return { allowed: false, reason: "Strong downtrend - bullish trades not advised" };
    }
  }

  if (opportunityType.includes("bearish") || opportunityType.includes("short")) {
    if (trendStrength > 30) {
      return { allowed: false, reason: "Strong uptrend - bearish trades not advised" };
    }
  }

  return { allowed: true };
}

/**
 * Export everything
 */
export { TIER_1_STRATEGIES, TIER_2_STRATEGIES, TIER_3_STRATEGIES };
