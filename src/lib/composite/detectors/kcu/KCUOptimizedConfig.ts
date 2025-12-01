/**
 * KCU LTP Strategy Optimized Configuration
 *
 * Based on backtest results:
 * - Long detectors outperform shorts (47-51% vs 16-32%)
 * - VWAP detectors have too few trades (need looser conditions)
 * - EMA bounce long is best performer at 51.2%
 *
 * Optimizations:
 * 1. Raise minimum score threshold from 40 to 70
 * 2. Disable short-side detectors (or make them much stricter)
 * 3. Widen VWAP proximity zones
 * 4. Require stronger trend confirmation
 */

export interface KCUOptimizedParams {
  // Minimum scores for different trade styles
  minScores: {
    scalp: number;
    day: number;
    swing: number;
  };

  // Risk/reward settings
  riskReward: {
    targetMultiple: number;
    stopMultiple: number;
    maxHoldBars: number;
  };

  // Detector-specific overrides
  detectorOverrides: {
    [detectorType: string]: {
      enabled: boolean;
      minScore?: number;
      extraRequirements?: string[];
    };
  };

  // VWAP settings
  vwap: {
    proximityZonePercent: number; // Widen from 0.3% to 0.5%
    approachZonePercent: number;
  };

  // Trend requirements
  trend: {
    requireStrongTrend: boolean;
    minTrendScore: number;
  };
}

/**
 * Default KCU Optimized Parameters
 *
 * UPDATED: Based on Dec 1 backtest results showing only ORB Breakout Long
 * achieves target win rate (64.3% with 4.32 PF). All other detectors disabled.
 */
export const KCU_OPTIMIZED_PARAMS: KCUOptimizedParams = {
  // Minimum scores - balanced for trade volume vs quality
  minScores: {
    scalp: 60,
    day: 60,
    swing: 55,
  },

  riskReward: {
    targetMultiple: 1.5,
    stopMultiple: 1.0,
    maxHoldBars: 16,
  },

  // Enable ORB Breakout (Long and Short)
  detectorOverrides: {
    // ORB Breakout Long - 64.3% win rate on indices
    kcu_orb_breakout_long: {
      enabled: true,
      minScore: 60,
    },
    // ORB Breakout Short - enabled for two-sided trading
    kcu_orb_breakout_short: {
      enabled: true,
      minScore: 60,
    },

    // Disable all other detectors based on backtest results
    kcu_ema_bounce_long: {
      enabled: false, // 47.5% win rate - below target
    },
    kcu_king_queen_long: {
      enabled: false, // 35.0% win rate - below target
    },
    kcu_vwap_standard_long: {
      enabled: false, // 33.3% win rate - below target
    },

    // Other SHORT detectors - disabled
    kcu_ema_bounce_short: {
      enabled: false,
    },
    // kcu_orb_breakout_short is enabled above
    kcu_king_queen_short: {
      enabled: false,
    },
    kcu_vwap_standard_short: {
      enabled: false,
    },
  },

  // VWAP proximity - widen to get more signals
  vwap: {
    proximityZonePercent: 0.5, // Was 0.3%, now 0.5%
    approachZonePercent: 0.8, // Was 0.5%, now 0.8%
  },

  // Require stronger trend for entries
  trend: {
    requireStrongTrend: true,
    minTrendScore: 60,
  },
};

/**
 * Conservative config - only use top performers
 */
export const KCU_CONSERVATIVE_PARAMS: KCUOptimizedParams = {
  minScores: {
    scalp: 80,
    day: 80,
    swing: 75,
  },

  riskReward: {
    targetMultiple: 2.0, // Higher target for fewer but better trades
    stopMultiple: 1.0,
    maxHoldBars: 12,
  },

  detectorOverrides: {
    // Only keep the best performer
    kcu_ema_bounce_long: {
      enabled: true,
      minScore: 75,
    },
    // Disable everything else
    kcu_orb_breakout_long: { enabled: false },
    kcu_king_queen_long: { enabled: false },
    kcu_vwap_standard_long: { enabled: false },
    kcu_ema_bounce_short: { enabled: false },
    kcu_orb_breakout_short: { enabled: false },
    kcu_king_queen_short: { enabled: false },
    kcu_vwap_standard_short: { enabled: false },
  },

  vwap: {
    proximityZonePercent: 0.3,
    approachZonePercent: 0.5,
  },

  trend: {
    requireStrongTrend: true,
    minTrendScore: 70,
  },
};

/**
 * Aggressive config - long-biased but more signals
 */
export const KCU_AGGRESSIVE_PARAMS: KCUOptimizedParams = {
  minScores: {
    scalp: 60,
    day: 60,
    swing: 55,
  },

  riskReward: {
    targetMultiple: 1.5,
    stopMultiple: 1.0,
    maxHoldBars: 20,
  },

  detectorOverrides: {
    // All longs enabled with lower thresholds
    kcu_ema_bounce_long: { enabled: true, minScore: 55 },
    kcu_orb_breakout_long: { enabled: true, minScore: 60 },
    kcu_king_queen_long: { enabled: true, minScore: 60 },
    kcu_vwap_standard_long: { enabled: true, minScore: 50 },

    // Shorts still disabled
    kcu_ema_bounce_short: { enabled: false },
    kcu_orb_breakout_short: { enabled: false },
    kcu_king_queen_short: { enabled: false },
    kcu_vwap_standard_short: { enabled: false },
  },

  vwap: {
    proximityZonePercent: 0.6,
    approachZonePercent: 1.0,
  },

  trend: {
    requireStrongTrend: false,
    minTrendScore: 50,
  },
};

/**
 * Get parameters for backtest optimization
 */
export function getKCUBacktestParams(mode: "default" | "conservative" | "aggressive" = "default") {
  switch (mode) {
    case "conservative":
      return KCU_CONSERVATIVE_PARAMS;
    case "aggressive":
      return KCU_AGGRESSIVE_PARAMS;
    default:
      return KCU_OPTIMIZED_PARAMS;
  }
}

/**
 * Check if a detector is enabled in current config
 */
export function isDetectorEnabled(
  detectorType: string,
  params: KCUOptimizedParams = KCU_OPTIMIZED_PARAMS
): boolean {
  const override = params.detectorOverrides[detectorType];
  return override?.enabled ?? true;
}

/**
 * Get minimum score for a detector
 */
export function getDetectorMinScore(
  detectorType: string,
  tradeStyle: "scalp" | "day" | "swing" = "day",
  params: KCUOptimizedParams = KCU_OPTIMIZED_PARAMS
): number {
  const override = params.detectorOverrides[detectorType];
  if (override?.minScore !== undefined) {
    return override.minScore;
  }
  return params.minScores[tradeStyle];
}
