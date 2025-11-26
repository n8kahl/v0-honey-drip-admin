/**
 * Adaptive Thresholds
 * Phase 1.1: Dynamic threshold adjustment based on context
 *
 * Provides intelligent threshold management that adapts to:
 * - Time of day (opening drive vs lunch chop vs power hour)
 * - VIX level (low/medium/high/extreme volatility)
 * - Market regime (trending/ranging/choppy/volatile)
 * - Strategy type (breakout/meanReversion/trendContinuation)
 *
 * This significantly improves signal quality by:
 * - Lowering bar during high-momentum periods (opening, power hour)
 * - Raising bar during choppy periods (lunch, low VIX breakouts)
 * - Adjusting position sizing based on volatility regime
 */

export type TimeOfDayWindow =
  | "pre_market"
  | "opening_drive"
  | "mid_morning"
  | "late_morning"
  | "lunch_chop"
  | "early_afternoon"
  | "afternoon"
  | "power_hour"
  | "after_hours"
  | "weekend";

export type VIXLevel = "low" | "medium" | "high" | "extreme";

export type MarketRegime = "trending" | "ranging" | "choppy" | "volatile";

export type StrategyCategory =
  | "breakout"
  | "meanReversion"
  | "trendContinuation"
  | "gamma"
  | "reversal"
  | "all";

/**
 * Window configuration for time-of-day thresholds
 */
export interface TimeWindowConfig {
  name: TimeOfDayWindow;
  label: string;
  startMinutes: number; // Minutes since midnight (EST)
  endMinutes: number; // Minutes since midnight (EST)
  thresholds: {
    minBase: number;
    minStyle: number;
    minRR: number;
  };
  sizeMultiplier: number;
  rationale: string;
}

/**
 * Complete adaptive threshold configuration
 */
export interface AdaptiveThresholdConfig {
  timeWindows: TimeWindowConfig[];
  byVIX: Record<
    VIXLevel,
    {
      minBaseAdjustment: number; // Add to base threshold
      minStyleAdjustment: number; // Add to style threshold
      minRRAdjustment: number; // Add to R:R threshold
      sizeMultiplier: number; // Position size multiplier
    }
  >;
  byRegime: Record<
    MarketRegime,
    Record<
      StrategyCategory,
      {
        minBase: number;
        minRR: number;
        enabled: boolean; // Whether this strategy works in this regime
        notes: string;
      }
    >
  >;
}

/**
 * Default time-of-day windows with optimized thresholds
 *
 * Based on market microstructure research:
 * - 9:30-10:00: High volatility, momentum-driven (lower bar)
 * - 10:00-11:30: Post-ORB stabilization (moderate bar)
 * - 11:30-13:30: Low volume, choppy (highest bar)
 * - 13:30-15:00: Volume returns (moderate bar)
 * - 15:00-16:00: High momentum, reversals (lower bar)
 */
export const DEFAULT_TIME_WINDOWS: TimeWindowConfig[] = [
  {
    name: "pre_market",
    label: "Pre-Market",
    startMinutes: 4 * 60, // 4:00 AM
    endMinutes: 9 * 60 + 30, // 9:30 AM
    thresholds: { minBase: 80, minStyle: 82, minRR: 2.0 },
    sizeMultiplier: 0.5,
    rationale: "Pre-market: Low liquidity, wider spreads, higher bar required",
  },
  {
    name: "opening_drive",
    label: "Opening Drive",
    startMinutes: 9 * 60 + 30, // 9:30 AM
    endMinutes: 10 * 60, // 10:00 AM
    thresholds: { minBase: 65, minStyle: 70, minRR: 1.2 },
    sizeMultiplier: 1.0,
    rationale: "First 30min: High momentum, gap plays, ORB setups - lower bar for breakouts",
  },
  {
    name: "mid_morning",
    label: "Mid-Morning",
    startMinutes: 10 * 60, // 10:00 AM
    endMinutes: 11 * 60, // 11:00 AM
    thresholds: { minBase: 72, minStyle: 75, minRR: 1.5 },
    sizeMultiplier: 1.0,
    rationale: "Post-ORB stabilization: Trend confirmation setups",
  },
  {
    name: "late_morning",
    label: "Late Morning",
    startMinutes: 11 * 60, // 11:00 AM
    endMinutes: 11 * 60 + 30, // 11:30 AM
    thresholds: { minBase: 75, minStyle: 78, minRR: 1.6 },
    sizeMultiplier: 0.9,
    rationale: "Transition to lunch: Volume declining, be more selective",
  },
  {
    name: "lunch_chop",
    label: "Lunch Chop",
    startMinutes: 11 * 60 + 30, // 11:30 AM
    endMinutes: 13 * 60 + 30, // 1:30 PM
    thresholds: { minBase: 85, minStyle: 88, minRR: 2.2 },
    sizeMultiplier: 0.6,
    rationale: "Lunch hours: Low volume, choppy action, false breakouts - only best setups",
  },
  {
    name: "early_afternoon",
    label: "Early Afternoon",
    startMinutes: 13 * 60 + 30, // 1:30 PM
    endMinutes: 14 * 60 + 30, // 2:30 PM
    thresholds: { minBase: 72, minStyle: 75, minRR: 1.5 },
    sizeMultiplier: 0.9,
    rationale: "Volume returning: Institutional activity picks up",
  },
  {
    name: "afternoon",
    label: "Afternoon",
    startMinutes: 14 * 60 + 30, // 2:30 PM
    endMinutes: 15 * 60, // 3:00 PM
    thresholds: { minBase: 70, minStyle: 73, minRR: 1.4 },
    sizeMultiplier: 1.0,
    rationale: "Pre-power hour: Good setups developing for EOD moves",
  },
  {
    name: "power_hour",
    label: "Power Hour",
    startMinutes: 15 * 60, // 3:00 PM
    endMinutes: 16 * 60, // 4:00 PM
    thresholds: { minBase: 68, minStyle: 72, minRR: 1.3 },
    sizeMultiplier: 1.1,
    rationale: "Power hour: High momentum, reversals, end-of-day positioning - lower bar",
  },
  {
    name: "after_hours",
    label: "After Hours",
    startMinutes: 16 * 60, // 4:00 PM
    endMinutes: 20 * 60, // 8:00 PM
    thresholds: { minBase: 85, minStyle: 88, minRR: 2.5 },
    sizeMultiplier: 0.3,
    rationale: "After hours: Very low liquidity, wide spreads - highest bar",
  },
];

/**
 * VIX-based adjustments
 *
 * Research shows:
 * - Low VIX (<15): Breakouts work well, can be more aggressive
 * - Medium VIX (15-25): Normal conditions
 * - High VIX (25-35): Mean reversion works, tighten breakout criteria
 * - Extreme VIX (>35): Reduce size significantly, only best setups
 */
export const DEFAULT_VIX_ADJUSTMENTS: AdaptiveThresholdConfig["byVIX"] = {
  low: {
    minBaseAdjustment: -5, // Lower bar by 5 points
    minStyleAdjustment: -3,
    minRRAdjustment: -0.2,
    sizeMultiplier: 1.2, // Can size up in calm markets
  },
  medium: {
    minBaseAdjustment: 0, // Normal conditions
    minStyleAdjustment: 0,
    minRRAdjustment: 0,
    sizeMultiplier: 1.0,
  },
  high: {
    minBaseAdjustment: 5, // Raise bar by 5 points
    minStyleAdjustment: 5,
    minRRAdjustment: 0.3,
    sizeMultiplier: 0.7, // Reduce size
  },
  extreme: {
    minBaseAdjustment: 15, // Significantly raise bar
    minStyleAdjustment: 12,
    minRRAdjustment: 0.7,
    sizeMultiplier: 0.4, // Half size or less
  },
};

/**
 * Regime-specific strategy thresholds
 *
 * Different strategies work in different market regimes:
 * - Trending: Breakouts and trend continuation work well
 * - Ranging: Mean reversion at extremes
 * - Choppy: Avoid most strategies, only extreme setups
 * - Volatile: Wide stops needed, size down
 */
export const DEFAULT_REGIME_THRESHOLDS: AdaptiveThresholdConfig["byRegime"] = {
  trending: {
    breakout: {
      minBase: 65,
      minRR: 1.3,
      enabled: true,
      notes: "Breakouts work well in trends - lower threshold",
    },
    meanReversion: {
      minBase: 85,
      minRR: 2.0,
      enabled: false, // Generally avoid
      notes: "Fighting the trend - high risk, require extreme setup",
    },
    trendContinuation: {
      minBase: 60,
      minRR: 1.2,
      enabled: true,
      notes: "Best strategy for trending markets - lowest threshold",
    },
    gamma: {
      minBase: 70,
      minRR: 1.5,
      enabled: true,
      notes: "Gamma plays can work with trend",
    },
    reversal: {
      minBase: 88,
      minRR: 2.2,
      enabled: false,
      notes: "Reversals in trends are counter-trend - very risky",
    },
    all: {
      minBase: 70,
      minRR: 1.5,
      enabled: true,
      notes: "Generic catch-all for trending markets",
    },
  },
  ranging: {
    breakout: {
      minBase: 85,
      minRR: 2.0,
      enabled: false, // Most breakouts fail in ranges
      notes: "Breakouts fail 70%+ in ranges - avoid or require extreme setup",
    },
    meanReversion: {
      minBase: 65,
      minRR: 1.3,
      enabled: true,
      notes: "Mean reversion is the play in ranges - lower threshold",
    },
    trendContinuation: {
      minBase: 80,
      minRR: 1.8,
      enabled: false,
      notes: "No trend to continue - avoid",
    },
    gamma: {
      minBase: 72,
      minRR: 1.5,
      enabled: true,
      notes: "Gamma pinning can work well in ranges",
    },
    reversal: {
      minBase: 70,
      minRR: 1.4,
      enabled: true,
      notes: "Range reversals at extremes work well",
    },
    all: {
      minBase: 72,
      minRR: 1.5,
      enabled: true,
      notes: "Generic catch-all for ranging markets",
    },
  },
  choppy: {
    breakout: {
      minBase: 92,
      minRR: 2.5,
      enabled: false,
      notes: "Choppy markets = false breakouts - avoid",
    },
    meanReversion: {
      minBase: 78,
      minRR: 1.5,
      enabled: true,
      notes: "Can work with extra confirmation",
    },
    trendContinuation: {
      minBase: 88,
      minRR: 2.2,
      enabled: false,
      notes: "No trend in chop - avoid",
    },
    gamma: {
      minBase: 82,
      minRR: 1.8,
      enabled: true,
      notes: "Gamma plays can work but need wider stops",
    },
    reversal: {
      minBase: 75,
      minRR: 1.5,
      enabled: true,
      notes: "Reversals at extreme chop levels can work",
    },
    all: {
      minBase: 82,
      minRR: 1.8,
      enabled: true,
      notes: "Generic catch-all for choppy markets - require higher confidence",
    },
  },
  volatile: {
    breakout: {
      minBase: 85,
      minRR: 2.0,
      enabled: true,
      notes: "Breakouts can work but need wider stops",
    },
    meanReversion: {
      minBase: 80,
      minRR: 1.8,
      enabled: true,
      notes: "Extreme moves often revert - but volatile",
    },
    trendContinuation: {
      minBase: 82,
      minRR: 2.0,
      enabled: true,
      notes: "Can ride volatility but size down",
    },
    gamma: {
      minBase: 78,
      minRR: 1.6,
      enabled: true,
      notes: "Gamma squeezes love volatility",
    },
    reversal: {
      minBase: 72,
      minRR: 1.4,
      enabled: true,
      notes: "Volatility creates reversal opportunities",
    },
    all: {
      minBase: 78,
      minRR: 1.6,
      enabled: true,
      notes: "Generic catch-all for volatile markets - size down",
    },
  },
};

/**
 * Default adaptive threshold configuration
 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveThresholdConfig = {
  timeWindows: DEFAULT_TIME_WINDOWS,
  byVIX: DEFAULT_VIX_ADJUSTMENTS,
  byRegime: DEFAULT_REGIME_THRESHOLDS,
};

/**
 * Result of adaptive threshold calculation
 */
export interface AdaptiveThresholdResult {
  // Final thresholds
  minBase: number;
  minStyle: number;
  minRR: number;
  sizeMultiplier: number;

  // Context used
  timeWindow: TimeOfDayWindow;
  timeWindowLabel: string;
  vixLevel: VIXLevel;
  regime: MarketRegime;
  strategyCategory: StrategyCategory;

  // Breakdown for transparency
  breakdown: {
    baseFromTime: number;
    baseFromVIX: number;
    baseFromRegime: number;
    styleFromTime: number;
    styleFromVIX: number;
    rrFromTime: number;
    rrFromVIX: number;
    rrFromRegime: number;
    sizeFromTime: number;
    sizeFromVIX: number;
  };

  // Strategy enabled in this regime?
  strategyEnabled: boolean;
  strategyNotes: string;

  // Warnings
  warnings: string[];
}

/**
 * Get time-of-day window for a given timestamp
 *
 * @param timestamp - Unix timestamp or Date
 * @param timezone - Timezone (default: America/New_York)
 * @returns Time window configuration
 */
export function getTimeWindow(
  timestamp: number | Date,
  config: AdaptiveThresholdConfig = DEFAULT_ADAPTIVE_CONFIG,
  timezone: string = "America/New_York"
): TimeWindowConfig | null {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  // Convert to ET
  const etTime = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  const minutesSinceMidnight = etTime.getHours() * 60 + etTime.getMinutes();

  // Check weekend
  const dayOfWeek = etTime.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend - return null (use weekend thresholds separately)
    return null;
  }

  // Find matching window
  for (const window of config.timeWindows) {
    if (minutesSinceMidnight >= window.startMinutes && minutesSinceMidnight < window.endMinutes) {
      return window;
    }
  }

  // Outside trading hours
  return null;
}

/**
 * Categorize an opportunity type into a strategy category
 */
export function categorizeStrategy(opportunityType: string): StrategyCategory {
  const lowerType = opportunityType.toLowerCase();

  if (lowerType.includes("breakout")) {
    return "breakout";
  }
  if (lowerType.includes("mean_reversion") || lowerType.includes("reversion")) {
    return "meanReversion";
  }
  if (lowerType.includes("trend_continuation") || lowerType.includes("continuation")) {
    return "trendContinuation";
  }
  if (lowerType.includes("gamma")) {
    return "gamma";
  }
  if (lowerType.includes("reversal") || lowerType.includes("power_hour")) {
    return "reversal";
  }

  // Default to breakout if unknown
  return "breakout";
}

/**
 * Get adaptive thresholds based on all context factors
 *
 * This is the main function that combines time-of-day, VIX, and regime
 * to produce final threshold values.
 *
 * @param timeISO - ISO timestamp of the signal
 * @param vixLevel - Current VIX classification
 * @param regime - Current market regime
 * @param opportunityType - The opportunity type being evaluated
 * @param config - Adaptive threshold configuration
 * @returns Complete adaptive threshold result
 */
export function getAdaptiveThresholds(
  timeISO: string,
  vixLevel: VIXLevel,
  regime: MarketRegime,
  opportunityType: string,
  config: AdaptiveThresholdConfig = DEFAULT_ADAPTIVE_CONFIG
): AdaptiveThresholdResult {
  const timestamp = new Date(timeISO);
  const timeWindow = getTimeWindow(timestamp, config);
  const strategyCategory = categorizeStrategy(opportunityType);
  const warnings: string[] = [];

  // Start with base values from time window
  let baseThresholds = {
    minBase: 75, // Default if outside hours
    minStyle: 78,
    minRR: 1.5,
    sizeMultiplier: 0.5,
  };

  let timeWindowName: TimeOfDayWindow = "after_hours";
  let timeWindowLabel = "After Hours";

  if (timeWindow) {
    baseThresholds = {
      minBase: timeWindow.thresholds.minBase,
      minStyle: timeWindow.thresholds.minStyle,
      minRR: timeWindow.thresholds.minRR,
      sizeMultiplier: timeWindow.sizeMultiplier,
    };
    timeWindowName = timeWindow.name;
    timeWindowLabel = timeWindow.label;
  } else {
    warnings.push("Outside regular trading hours - using conservative defaults");
  }

  // Get VIX adjustments
  const vixAdj = config.byVIX[vixLevel];

  // Get regime-specific thresholds for this strategy
  const regimeConfig = config.byRegime[regime]?.[strategyCategory];
  const strategyEnabled = regimeConfig?.enabled ?? true;
  const strategyNotes = regimeConfig?.notes ?? "";

  if (!strategyEnabled) {
    warnings.push(
      `${strategyCategory} strategy not recommended in ${regime} regime: ${strategyNotes}`
    );
  }

  // Calculate final values
  // Time window provides base, VIX adds/subtracts, regime can override strategy-specific

  // Base score: time + VIX adjustment, or regime override if higher
  const baseFromTime = baseThresholds.minBase;
  const baseFromVIX = vixAdj.minBaseAdjustment;
  const baseFromRegime = regimeConfig?.minBase ?? baseThresholds.minBase;

  // Take the maximum of (time + VIX) and regime-specific
  const timeVIXBase = baseFromTime + baseFromVIX;
  const finalMinBase = Math.max(
    timeVIXBase,
    strategyEnabled ? baseFromRegime : baseFromRegime + 10
  );

  // Style score: time + VIX adjustment
  const styleFromTime = baseThresholds.minStyle;
  const styleFromVIX = vixAdj.minStyleAdjustment;
  const finalMinStyle = styleFromTime + styleFromVIX;

  // R:R: time + VIX + regime
  const rrFromTime = baseThresholds.minRR;
  const rrFromVIX = vixAdj.minRRAdjustment;
  const rrFromRegime = regimeConfig?.minRR ?? baseThresholds.minRR;
  const finalMinRR = Math.max(rrFromTime + rrFromVIX, rrFromRegime);

  // Size multiplier: time * VIX
  const sizeFromTime = baseThresholds.sizeMultiplier;
  const sizeFromVIX = vixAdj.sizeMultiplier;
  const finalSizeMultiplier = sizeFromTime * sizeFromVIX;

  // Add warnings for extreme conditions
  if (finalMinBase > 85) {
    warnings.push("Very high threshold - only best-in-class setups will qualify");
  }
  if (finalSizeMultiplier < 0.5) {
    warnings.push("Low position size recommended - high volatility environment");
  }

  return {
    minBase: Math.round(finalMinBase),
    minStyle: Math.round(finalMinStyle),
    minRR: Math.round(finalMinRR * 10) / 10, // Round to 1 decimal
    sizeMultiplier: Math.round(finalSizeMultiplier * 100) / 100, // Round to 2 decimals

    timeWindow: timeWindowName,
    timeWindowLabel,
    vixLevel,
    regime,
    strategyCategory,

    breakdown: {
      baseFromTime,
      baseFromVIX,
      baseFromRegime,
      styleFromTime,
      styleFromVIX,
      rrFromTime,
      rrFromVIX,
      rrFromRegime,
      sizeFromTime,
      sizeFromVIX,
    },

    strategyEnabled,
    strategyNotes,
    warnings,
  };
}

/**
 * Check if a signal passes adaptive thresholds
 *
 * @param signal - Signal to check
 * @param thresholds - Adaptive thresholds
 * @returns Pass/fail with reason
 */
export function passesAdaptiveThresholds(
  signal: {
    baseScore: number;
    recommendedStyleScore: number;
    riskReward: number;
  },
  thresholds: AdaptiveThresholdResult
): { pass: boolean; reason?: string } {
  // Check if strategy is enabled for this regime
  if (!thresholds.strategyEnabled) {
    return {
      pass: false,
      reason: `Strategy disabled in ${thresholds.regime} regime: ${thresholds.strategyNotes}`,
    };
  }

  // Check base score
  if (signal.baseScore < thresholds.minBase) {
    return {
      pass: false,
      reason: `Base score ${signal.baseScore.toFixed(1)} < adaptive threshold ${thresholds.minBase} (${thresholds.timeWindowLabel}, VIX: ${thresholds.vixLevel}, Regime: ${thresholds.regime})`,
    };
  }

  // Check style score
  if (signal.recommendedStyleScore < thresholds.minStyle) {
    return {
      pass: false,
      reason: `Style score ${signal.recommendedStyleScore.toFixed(1)} < adaptive threshold ${thresholds.minStyle}`,
    };
  }

  // Check R:R
  if (signal.riskReward < thresholds.minRR) {
    return {
      pass: false,
      reason: `Risk/Reward ${signal.riskReward.toFixed(1)} < adaptive threshold ${thresholds.minRR}`,
    };
  }

  return { pass: true };
}

/**
 * Get weekend-specific thresholds
 * Weekend analysis has limited data (no live VWAP, volume, flow)
 * so we use more conservative thresholds
 */
export function getWeekendThresholds(): {
  minBase: number;
  minStyle: number;
  minRR: number;
  sizeMultiplier: number;
} {
  return {
    minBase: 60, // Lower bar for weekend planning signals
    minStyle: 65, // Weekend signals are planning-only
    minRR: 1.3, // Lower R:R acceptable for planning
    sizeMultiplier: 0.0, // Don't take positions on weekend signals directly
  };
}

/**
 * Format adaptive thresholds for display
 */
export function formatAdaptiveThresholds(result: AdaptiveThresholdResult): string {
  const lines = [
    `Time: ${result.timeWindowLabel}`,
    `VIX: ${result.vixLevel.toUpperCase()}`,
    `Regime: ${result.regime}`,
    `Strategy: ${result.strategyCategory}`,
    "",
    `Min Base Score: ${result.minBase}`,
    `Min Style Score: ${result.minStyle}`,
    `Min R:R: ${result.minRR}:1`,
    `Size Multiplier: ${(result.sizeMultiplier * 100).toFixed(0)}%`,
  ];

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    result.warnings.forEach((w) => lines.push(`  - ${w}`));
  }

  return lines.join("\n");
}
