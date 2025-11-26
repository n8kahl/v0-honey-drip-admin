/**
 * Style Score Modifiers
 * Phase 2.1: Context-Aware Style Differentiation
 *
 * Calculates style-specific (scalp/day/swing) score modifiers based on:
 * - Time of day trading windows
 * - Volatility conditions (ATR as % of price)
 * - Volume spikes
 * - Key level proximity
 * - RSI extremes (mean reversion signals)
 * - Multi-timeframe alignment
 * - Market regime
 *
 * This module ensures that signals are appropriately scored for each trading style
 * based on current market conditions, not just the base confluence factors.
 */

import type { SymbolFeatures } from "../strategy/engine.js";
import type { TimeOfDayWindow, MarketRegime } from "./AdaptiveThresholds.js";

/**
 * Style multipliers for scalp, day trade, and swing trading
 */
export interface StyleModifiers {
  scalp: number; // Multiplier for scalp suitability (0.5 - 1.5)
  dayTrade: number; // Multiplier for day trade suitability (0.5 - 1.5)
  swing: number; // Multiplier for swing suitability (0.5 - 1.5)
}

/**
 * Factors used to calculate style modifiers
 */
export interface StyleScoreFactors {
  // Time factors
  timeOfDay: TimeOfDayWindow;
  minutesSinceOpen: number;
  minutesToClose: number;

  // Volatility factors
  atrPercent: number; // ATR as % of price
  volumeSpike: boolean; // Is volume >1.5x average?
  volumeRatio: number; // Current volume / average volume

  // Technical factors
  nearKeyLevel: boolean; // Price near support/resistance
  keyLevelType?: "support" | "resistance" | "vwap" | "orb";
  rsiExtreme: boolean; // RSI < 30 or > 70
  rsiValue?: number;

  // Trend factors
  mtfAlignment: number; // 0-100 score of multi-timeframe alignment
  regime: MarketRegime;

  // Session factors
  isPreMarket: boolean;
  isAfterHours: boolean;
  isWeekend: boolean;
}

/**
 * Style modifier calculation result with reasoning
 */
export interface StyleModifierResult {
  modifiers: StyleModifiers;
  factors: StyleScoreFactors;
  reasoning: StyleModifierReasoning;
}

/**
 * Detailed reasoning for style modifiers
 */
export interface StyleModifierReasoning {
  scalpReasons: string[];
  dayTradeReasons: string[];
  swingReasons: string[];
  warnings: string[];
}

/**
 * Default weights for style modifier calculations
 */
export const STYLE_MODIFIER_WEIGHTS = {
  timeOfDay: 0.25, // Time window impact
  volatility: 0.2, // ATR/VIX impact
  volume: 0.15, // Volume impact
  keyLevel: 0.15, // Support/resistance proximity
  mtf: 0.15, // Multi-timeframe alignment
  regime: 0.1, // Market regime
};

/**
 * Time of day modifiers for each style
 *
 * Opening drive: Great for scalps (momentum), good for day trades, poor for swings (too reactive)
 * Mid-morning: Good for all styles after ORB settles
 * Lunch chop: Poor for scalps (low volume), okay for day trades, neutral for swings
 * Afternoon: Good for day trades, okay for others
 * Power hour: Great for scalps (volume returns), good for day trades, poor for swings
 */
const TIME_OF_DAY_MODIFIERS: Record<TimeOfDayWindow, StyleModifiers> = {
  pre_market: { scalp: 0.6, dayTrade: 0.7, swing: 0.9 },
  opening_drive: { scalp: 1.35, dayTrade: 1.15, swing: 0.75 },
  mid_morning: { scalp: 1.1, dayTrade: 1.15, swing: 1.0 },
  late_morning: { scalp: 1.0, dayTrade: 1.1, swing: 1.05 },
  lunch_chop: { scalp: 0.55, dayTrade: 0.75, swing: 1.0 },
  early_afternoon: { scalp: 0.85, dayTrade: 1.0, swing: 1.05 },
  afternoon: { scalp: 0.95, dayTrade: 1.1, swing: 1.0 },
  power_hour: { scalp: 1.25, dayTrade: 1.2, swing: 0.85 },
  after_hours: { scalp: 0.5, dayTrade: 0.6, swing: 0.9 },
  weekend: { scalp: 0.4, dayTrade: 0.5, swing: 1.2 }, // Weekend for planning swings
};

/**
 * Regime modifiers for each style
 */
const REGIME_MODIFIERS: Record<MarketRegime, StyleModifiers> = {
  trending: { scalp: 1.0, dayTrade: 1.15, swing: 1.25 },
  ranging: { scalp: 1.1, dayTrade: 1.0, swing: 0.85 },
  choppy: { scalp: 0.65, dayTrade: 0.75, swing: 0.55 },
  volatile: { scalp: 0.85, dayTrade: 1.1, swing: 1.2 },
};

/**
 * Extract style score factors from symbol features
 *
 * @param features - Symbol features
 * @param currentTime - Optional time override for testing
 * @returns StyleScoreFactors
 */
export function extractStyleFactors(
  features: SymbolFeatures,
  currentTime?: Date
): StyleScoreFactors {
  const now = currentTime || new Date();
  const pattern = features.pattern as any;

  // Get time of day
  const timeOfDay = getTimeOfDayWindow(now, features.session?.isRegularHours ?? true);
  const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;
  // Calculate minutesToClose from minutesSinceOpen (regular hours = 390 minutes = 6.5 hours)
  const minutesToClose = Math.max(0, 390 - minutesSinceOpen);

  // Get volatility metrics
  const mtf5m = features.mtf?.["5m"] as any;
  const currentPrice = features.price?.current ?? 0;
  const atr = mtf5m?.atr ?? 0;
  const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;

  // Volume metrics
  const volumeRatio = features.volume?.relativeToAvg ?? 1.0;
  const volumeSpike = volumeRatio > 1.5;

  // Key level proximity
  const nearORB = pattern?.near_orb_high === true || pattern?.near_orb_low === true;
  const nearVWAP = Math.abs(features.vwap?.distancePct ?? 100) < 0.25; // Within 0.25% of VWAP
  const nearSwing = pattern?.near_swing_high === true || pattern?.near_swing_low === true;
  const nearKeyLevel = nearORB || nearVWAP || nearSwing;
  const keyLevelType = nearVWAP
    ? "vwap"
    : nearORB
      ? "orb"
      : nearSwing
        ? pattern?.near_swing_high
          ? "resistance"
          : "support"
        : undefined;

  // RSI extreme
  const rsi14 = mtf5m?.rsi?.["14"] ?? features.indicators?.rsi ?? 50;
  const rsiExtreme = rsi14 < 30 || rsi14 > 70;

  // MTF alignment (calculate from available timeframes)
  const mtfAlignment = calculateMTFAlignment(features);

  // Market regime
  const regime = (pattern?.market_regime ?? "trending") as MarketRegime;

  // Session flags
  const isPreMarket = pattern?.session === "pre_market";
  const isAfterHours = pattern?.session === "after_hours";
  const isWeekend = features.session?.isRegularHours !== true && isWeekendDay(now);

  return {
    timeOfDay,
    minutesSinceOpen,
    minutesToClose,
    atrPercent,
    volumeSpike,
    volumeRatio,
    nearKeyLevel,
    keyLevelType,
    rsiExtreme,
    rsiValue: rsi14,
    mtfAlignment,
    regime,
    isPreMarket,
    isAfterHours,
    isWeekend,
  };
}

/**
 * Calculate style modifiers based on market context
 *
 * @param factors - Style score factors
 * @returns Style modifier result with reasoning
 */
export function calculateStyleModifiers(factors: StyleScoreFactors): StyleModifierResult {
  let scalp = 1.0;
  let dayTrade = 1.0;
  let swing = 1.0;

  const scalpReasons: string[] = [];
  const dayTradeReasons: string[] = [];
  const swingReasons: string[] = [];
  const warnings: string[] = [];

  // === TIME OF DAY ADJUSTMENTS ===
  const timeModifiers = TIME_OF_DAY_MODIFIERS[factors.timeOfDay];
  scalp *= timeModifiers.scalp;
  dayTrade *= timeModifiers.dayTrade;
  swing *= timeModifiers.swing;

  if (timeModifiers.scalp > 1.1) {
    scalpReasons.push(`${factors.timeOfDay} is excellent for scalping`);
  } else if (timeModifiers.scalp < 0.8) {
    scalpReasons.push(`${factors.timeOfDay} is poor for scalping`);
  }

  if (timeModifiers.dayTrade > 1.1) {
    dayTradeReasons.push(`${factors.timeOfDay} favors day trades`);
  }

  if (timeModifiers.swing > 1.1) {
    swingReasons.push(`${factors.timeOfDay} good for swing entries`);
  } else if (timeModifiers.swing < 0.8) {
    swingReasons.push(`Avoid swing entries during ${factors.timeOfDay}`);
  }

  // === VOLATILITY (ATR) ADJUSTMENTS ===
  if (factors.atrPercent > 2.5) {
    // Very high volatility
    scalp *= 0.7;
    dayTrade *= 1.05;
    swing *= 1.25;
    scalpReasons.push("High volatility (ATR >2.5%) - tight scalp stops risky");
    swingReasons.push("High volatility favors swing moves");
  } else if (factors.atrPercent > 1.5) {
    // Moderate-high volatility
    scalp *= 0.9;
    dayTrade *= 1.1;
    swing *= 1.15;
  } else if (factors.atrPercent < 0.5) {
    // Low volatility
    scalp *= 1.15;
    dayTrade *= 0.85;
    swing *= 0.65;
    scalpReasons.push("Low volatility - tighter spreads, good for scalps");
    swingReasons.push("Low volatility means slow moves - poor for swings");
  } else if (factors.atrPercent < 1.0) {
    // Moderate-low volatility
    scalp *= 1.1;
    dayTrade *= 0.95;
    swing *= 0.8;
  }

  // === VOLUME SPIKE ADJUSTMENTS ===
  if (factors.volumeSpike) {
    scalp *= 1.3;
    dayTrade *= 1.15;
    swing *= 1.0;
    scalpReasons.push(`Volume spike (${factors.volumeRatio.toFixed(1)}x avg) - better fills`);
    dayTradeReasons.push("Volume surge supports day trade entries");
  } else if (factors.volumeRatio < 0.5) {
    // Very low volume
    scalp *= 0.6;
    dayTrade *= 0.75;
    swing *= 0.95;
    warnings.push("Low volume - wide spreads likely");
  } else if (factors.volumeRatio < 0.75) {
    // Below average volume
    scalp *= 0.8;
    dayTrade *= 0.9;
    swing *= 0.98;
  }

  // === KEY LEVEL PROXIMITY ===
  if (factors.nearKeyLevel) {
    scalp *= 1.25;
    dayTrade *= 1.15;
    swing *= 1.1;
    const levelDesc = factors.keyLevelType || "key level";
    scalpReasons.push(`Near ${levelDesc} - clear entry/exit reference`);
    dayTradeReasons.push(`Near ${levelDesc} - defined risk point`);
    swingReasons.push(`Near ${levelDesc} - good entry zone`);
  }

  // === RSI EXTREME (Mean Reversion Signals) ===
  if (factors.rsiExtreme) {
    // RSI extremes favor mean reversion which typically needs time to play out
    scalp *= 0.85;
    dayTrade *= 1.1;
    swing *= 1.25;

    if (factors.rsiValue !== undefined) {
      if (factors.rsiValue < 30) {
        scalpReasons.push("RSI oversold - mean reversion takes time, poor for scalps");
        swingReasons.push(`RSI ${factors.rsiValue.toFixed(0)} - swing bounce potential`);
      } else if (factors.rsiValue > 70) {
        scalpReasons.push("RSI overbought - reversal timing uncertain");
        swingReasons.push(`RSI ${factors.rsiValue.toFixed(0)} - swing pullback potential`);
      }
    }
  }

  // === MTF ALIGNMENT ===
  if (factors.mtfAlignment > 80) {
    scalp *= 1.05;
    dayTrade *= 1.15;
    swing *= 1.3;
    swingReasons.push("Strong MTF alignment - trend confirmed for swings");
    dayTradeReasons.push("MTF aligned - direction confidence high");
  } else if (factors.mtfAlignment > 60) {
    dayTrade *= 1.05;
    swing *= 1.1;
  } else if (factors.mtfAlignment < 40) {
    scalp *= 1.0; // Scalps don't need MTF alignment
    dayTrade *= 0.8;
    swing *= 0.6;
    warnings.push("Poor MTF alignment - avoid swing trades");
    swingReasons.push("Mixed timeframes - don't swing against HTF");
  }

  // === REGIME ADJUSTMENTS ===
  const regimeModifiers = REGIME_MODIFIERS[factors.regime];
  scalp *= regimeModifiers.scalp;
  dayTrade *= regimeModifiers.dayTrade;
  swing *= regimeModifiers.swing;

  if (factors.regime === "choppy") {
    warnings.push("Choppy regime - reduce position sizes");
  } else if (factors.regime === "trending") {
    swingReasons.push("Trending regime favors swing trades");
  } else if (factors.regime === "volatile") {
    swingReasons.push("Volatile regime - ride larger moves");
    dayTradeReasons.push("Volatility creates day trade opportunities");
  }

  // === SESSION ADJUSTMENTS ===
  if (factors.isPreMarket) {
    scalp *= 0.5;
    dayTrade *= 0.6;
    swing *= 0.85;
    warnings.push("Pre-market - liquidity may be thin");
  }

  if (factors.isAfterHours) {
    scalp *= 0.4;
    dayTrade *= 0.5;
    swing *= 0.8;
    warnings.push("After-hours - limited liquidity");
  }

  if (factors.isWeekend) {
    scalp *= 0.3;
    dayTrade *= 0.4;
    swing *= 1.15;
    warnings.push("Weekend - signals for planning only");
    swingReasons.push("Weekend review good for swing planning");
  }

  // === MINUTES TO CLOSE ADJUSTMENT ===
  if (factors.minutesToClose < 30 && !factors.isAfterHours && !factors.isWeekend) {
    scalp *= 1.1; // Quick scalps still viable
    dayTrade *= 0.6; // Day trades need more time
    swing *= 1.0; // Swings held overnight anyway
    dayTradeReasons.push("Less than 30 minutes - limited day trade runway");
  } else if (factors.minutesToClose < 60) {
    dayTrade *= 0.85;
  }

  // === NORMALIZE MODIFIERS ===
  // Clamp to reasonable bounds (0.5 - 1.5) to prevent extreme adjustments
  const modifiers: StyleModifiers = {
    scalp: clamp(scalp, 0.5, 1.5),
    dayTrade: clamp(dayTrade, 0.5, 1.5),
    swing: clamp(swing, 0.5, 1.5),
  };

  return {
    modifiers,
    factors,
    reasoning: {
      scalpReasons,
      dayTradeReasons,
      swingReasons,
      warnings,
    },
  };
}

/**
 * Apply style modifiers to base score
 *
 * @param baseScore - Base composite score
 * @param modifiers - Style modifiers
 * @returns Style scores
 */
export function applyStyleModifiersToScore(
  baseScore: number,
  modifiers: StyleModifiers
): {
  scalpScore: number;
  dayTradeScore: number;
  swingScore: number;
  recommendedStyle: "scalp" | "day_trade" | "swing";
  recommendedStyleScore: number;
} {
  const scalpScore = clamp(baseScore * modifiers.scalp, 0, 100);
  const dayTradeScore = clamp(baseScore * modifiers.dayTrade, 0, 100);
  const swingScore = clamp(baseScore * modifiers.swing, 0, 100);

  // Find recommended style
  const scores = {
    scalp: scalpScore,
    day_trade: dayTradeScore,
    swing: swingScore,
  };

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const recommended = entries[0];

  return {
    scalpScore,
    dayTradeScore,
    swingScore,
    recommendedStyle: recommended[0] as "scalp" | "day_trade" | "swing",
    recommendedStyleScore: recommended[1],
  };
}

/**
 * Calculate full style scores from features
 *
 * @param baseScore - Base composite score
 * @param features - Symbol features
 * @param currentTime - Optional time override
 * @returns Style modifier result with applied scores
 */
export function calculateFullStyleScores(
  baseScore: number,
  features: SymbolFeatures,
  currentTime?: Date
): {
  modifierResult: StyleModifierResult;
  scores: ReturnType<typeof applyStyleModifiersToScore>;
} {
  const factors = extractStyleFactors(features, currentTime);
  const modifierResult = calculateStyleModifiers(factors);
  const scores = applyStyleModifiersToScore(baseScore, modifierResult.modifiers);

  return {
    modifierResult,
    scores,
  };
}

// === Helper Functions ===

/**
 * Get time of day window from current time
 */
function getTimeOfDayWindow(time: Date, isRegularHours: boolean): TimeOfDayWindow {
  if (!isRegularHours) {
    if (isWeekendDay(time)) {
      return "weekend";
    }
    const hour = time.getHours();
    if (hour < 9 || (hour === 9 && time.getMinutes() < 30)) {
      return "pre_market";
    }
    return "after_hours";
  }

  const hour = time.getHours();
  const minute = time.getMinutes();
  const totalMinutes = hour * 60 + minute;

  // Market hours: 9:30 AM - 4:00 PM ET
  const marketOpen = 9 * 60 + 30; // 9:30
  const marketClose = 16 * 60; // 16:00

  if (totalMinutes < marketOpen) return "pre_market";
  if (totalMinutes >= marketClose) return "after_hours";

  const minutesSinceOpen = totalMinutes - marketOpen;

  if (minutesSinceOpen < 30) return "opening_drive"; // 9:30-10:00
  if (minutesSinceOpen < 90) return "mid_morning"; // 10:00-11:00
  if (minutesSinceOpen < 120) return "late_morning"; // 11:00-11:30
  if (minutesSinceOpen < 240) return "lunch_chop"; // 11:30-13:30
  if (minutesSinceOpen < 300) return "early_afternoon"; // 13:30-15:00
  if (minutesSinceOpen < 330) return "afternoon"; // 15:00-15:00
  return "power_hour"; // 15:00-16:00
}

/**
 * Check if date is a weekend day
 */
function isWeekendDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Calculate multi-timeframe alignment score
 */
function calculateMTFAlignment(features: SymbolFeatures): number {
  const mtf = features.mtf;
  if (!mtf) return 50;

  let alignedCount = 0;
  let totalChecked = 0;
  let weightedAlignment = 0;

  // Check each timeframe for trend alignment
  const timeframes = [
    { tf: "5m", weight: 0.2 },
    { tf: "15m", weight: 0.3 },
    { tf: "60m", weight: 0.3 },
    { tf: "240m", weight: 0.2 },
  ];

  for (const { tf, weight } of timeframes) {
    const tfData = mtf[tf] as any;
    if (!tfData) continue;

    totalChecked++;

    // Check EMA alignment (price above/below EMAs)
    const ema20 = tfData.ema?.["20"];
    const ema50 = tfData.ema?.["50"];
    const close = tfData.close;

    if (close && ema20 && ema50) {
      // Bullish: price > EMA20 > EMA50
      // Bearish: price < EMA20 < EMA50
      const bullishAligned = close > ema20 && ema20 > ema50;
      const bearishAligned = close < ema20 && ema20 < ema50;

      if (bullishAligned || bearishAligned) {
        alignedCount++;
        weightedAlignment += weight * 100;
      } else {
        // Partial alignment
        if (close > ema20 || close < ema20) {
          weightedAlignment += weight * 50;
        }
      }
    }

    // Check RSI for trend confirmation
    const rsi = tfData.rsi?.["14"];
    if (rsi !== undefined) {
      // RSI 45-55 is neutral, 55-65 is bullish confirmation, >65 is strong
      if (rsi >= 55 && rsi <= 70) {
        weightedAlignment += weight * 20;
      } else if (rsi <= 45 && rsi >= 30) {
        weightedAlignment += weight * 20;
      }
    }
  }

  if (totalChecked === 0) return 50;

  // Return weighted average, scaled to 0-100
  return Math.min(100, Math.round(weightedAlignment));
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format style modifiers for display
 */
export function formatStyleModifiers(result: StyleModifierResult): string {
  const { modifiers, factors, reasoning } = result;

  const lines = [
    `Style Score Modifiers (${factors.timeOfDay}, ${factors.regime} regime)`,
    `───────────────────────────────`,
    `Scalp:     ${(modifiers.scalp * 100).toFixed(0)}% ${modifiers.scalp > 1.1 ? "↑" : modifiers.scalp < 0.9 ? "↓" : "→"}`,
    `Day Trade: ${(modifiers.dayTrade * 100).toFixed(0)}% ${modifiers.dayTrade > 1.1 ? "↑" : modifiers.dayTrade < 0.9 ? "↓" : "→"}`,
    `Swing:     ${(modifiers.swing * 100).toFixed(0)}% ${modifiers.swing > 1.1 ? "↑" : modifiers.swing < 0.9 ? "↓" : "→"}`,
    "",
    `Context:`,
    `  ATR: ${factors.atrPercent.toFixed(2)}%`,
    `  Volume: ${factors.volumeRatio.toFixed(1)}x avg ${factors.volumeSpike ? "(spike)" : ""}`,
    `  MTF Alignment: ${factors.mtfAlignment}%`,
    `  RSI: ${factors.rsiValue?.toFixed(0) || "N/A"} ${factors.rsiExtreme ? "(extreme)" : ""}`,
    `  Key Level: ${factors.nearKeyLevel ? `Yes (${factors.keyLevelType})` : "No"}`,
  ];

  if (reasoning.warnings.length > 0) {
    lines.push("", "Warnings:");
    reasoning.warnings.forEach((w) => lines.push(`  ⚠️ ${w}`));
  }

  return lines.join("\n");
}
