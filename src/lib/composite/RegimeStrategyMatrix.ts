/**
 * Regime Strategy Matrix
 * Phase 3: VIX Regime Gating
 *
 * Only run certain detectors in appropriate market conditions.
 * This prevents signals from firing in hostile market regimes.
 *
 * VIX Levels:
 * - low (<15): Complacent markets - favor trend following
 * - medium (15-25): Normal markets - all strategies viable
 * - high (25-35): Fear markets - favor mean reversion
 * - extreme (>35): Panic markets - only flow-based signals
 */

export type VIXLevel = "low" | "medium" | "high" | "extreme";

interface RegimeRules {
  enabled: string[] | "all";
  disabled: string[];
  reason: string;
}

/**
 * Strategy-Regime Matrix
 * Defines which detectors are enabled/disabled at each VIX level
 */
const STRATEGY_REGIME_MATRIX: Record<VIXLevel, RegimeRules> = {
  // VIX < 15: Low volatility, complacent markets
  // Trends are stable, mean reversion fails, breakouts work
  low: {
    enabled: [
      "breakout_bullish",
      "breakout_bearish",
      "trend_continuation_long",
      "trend_continuation_short",
      "sweep_momentum_long",
      "sweep_momentum_short",
      "opening_drive_bullish",
      "opening_drive_bearish",
    ],
    disabled: [
      "mean_reversion_long",
      "mean_reversion_short",
      "index_mean_reversion_long",
      "index_mean_reversion_short",
      "power_hour_reversal_bullish",
      "power_hour_reversal_bearish",
    ],
    reason: "Mean reversion doesn't work in low-vol trending markets",
  },

  // VIX 15-25: Normal markets
  // All strategies are viable
  medium: {
    enabled: "all",
    disabled: [],
    reason: "Normal volatility - all strategies viable",
  },

  // VIX 25-35: High volatility, fear markets
  // Trends fail, mean reversion works, reversals are common
  high: {
    enabled: [
      "mean_reversion_long",
      "mean_reversion_short",
      "index_mean_reversion_long",
      "index_mean_reversion_short",
      "sweep_momentum_long",
      "sweep_momentum_short",
      "power_hour_reversal_bullish",
      "power_hour_reversal_bearish",
    ],
    disabled: [
      "trend_continuation_long",
      "trend_continuation_short",
      "breakout_bullish",
      "breakout_bearish",
    ],
    reason: "Trends fail in high-vol markets, favor reversals",
  },

  // VIX > 35: Extreme volatility, panic markets
  // Only trade with institutional flow confirmation
  extreme: {
    enabled: ["sweep_momentum_long", "sweep_momentum_short"],
    disabled: [
      "breakout_bullish",
      "breakout_bearish",
      "trend_continuation_long",
      "trend_continuation_short",
      "mean_reversion_long",
      "mean_reversion_short",
      "index_mean_reversion_long",
      "index_mean_reversion_short",
      "opening_drive_bullish",
      "opening_drive_bearish",
      "power_hour_reversal_bullish",
      "power_hour_reversal_bearish",
    ],
    reason: "Extreme volatility - only trade with institutional flow confirmation",
  },
};

/**
 * Check if a detector should run based on VIX regime
 */
export function shouldRunDetectorForRegime(
  detectorType: string,
  vixLevel: VIXLevel,
  flowBias?: "bullish" | "bearish" | "neutral"
): { run: boolean; reason?: string } {
  const rules = STRATEGY_REGIME_MATRIX[vixLevel];

  // Check if explicitly disabled
  if (rules.disabled.includes(detectorType)) {
    return {
      run: false,
      reason: `${detectorType} disabled in ${vixLevel} VIX regime: ${rules.reason}`,
    };
  }

  // In extreme VIX, require flow data for flow-based signals
  if (vixLevel === "extreme") {
    // Only sweep_momentum detectors are enabled in extreme
    if (!detectorType.includes("sweep_momentum")) {
      return {
        run: false,
        reason: `Only flow-based signals allowed in extreme VIX (${detectorType} blocked)`,
      };
    }

    // For sweep_momentum, require flow bias to be present
    if (!flowBias) {
      return {
        run: false,
        reason: "Extreme VIX requires flow data for sweep_momentum signals",
      };
    }
  }

  // Check if enabled is "all" or detector is in enabled list
  if (rules.enabled === "all" || rules.enabled.includes(detectorType)) {
    return { run: true };
  }

  // Not explicitly enabled, but also not disabled
  // Default to allowing it (backwards compatible)
  return { run: true };
}

/**
 * Get all enabled detectors for a given VIX level
 */
export function getEnabledDetectors(vixLevel: VIXLevel, allDetectorTypes: string[]): string[] {
  const rules = STRATEGY_REGIME_MATRIX[vixLevel];

  if (rules.enabled === "all") {
    return allDetectorTypes.filter((type) => !rules.disabled.includes(type));
  }

  return rules.enabled.filter((type) => allDetectorTypes.includes(type));
}

/**
 * Get the regime rules for a VIX level
 */
export function getRegimeRules(vixLevel: VIXLevel): RegimeRules {
  return STRATEGY_REGIME_MATRIX[vixLevel];
}

/**
 * Classify VIX value into a regime level
 */
export function classifyVIXToLevel(vix: number): VIXLevel {
  if (vix < 15) return "low";
  if (vix < 25) return "medium";
  if (vix < 35) return "high";
  return "extreme";
}

/**
 * Get a human-readable description of the current regime
 */
export function getRegimeDescription(vixLevel: VIXLevel): string {
  switch (vixLevel) {
    case "low":
      return "Low volatility (VIX < 15) - Complacent markets, favor trend following";
    case "medium":
      return "Normal volatility (VIX 15-25) - All strategies viable";
    case "high":
      return "High volatility (VIX 25-35) - Fear markets, favor mean reversion";
    case "extreme":
      return "Extreme volatility (VIX > 35) - Panic, only follow smart money";
  }
}
