/**
 * IV Gating
 * Phase 1.2: Intelligent IV-based trade gating
 *
 * Prevents costly mistakes:
 * - Don't buy options when IV is elevated (>75th percentile)
 * - Don't sell premium when IV is cheap (<25th percentile)
 * - Warn about earnings proximity (IV crush risk)
 * - Recommend strategy adjustments based on IV regime
 *
 * This can save 15%+ in premium costs by avoiding
 * buying expensive options at the wrong time.
 */

import { getIVStats, detectIVCrush, detectIVSpike, type IVStats } from "./ivHistory.js";

/**
 * Configuration for IV gating decisions
 */
export interface IVGatingConfig {
  // Percentile thresholds
  maxIVPercentileForBuying: number; // Don't buy if IV > this (default: 75)
  minIVPercentileForSelling: number; // Don't sell if IV < this (default: 25)
  optimalIVRangeForBuying: [number, number]; // Best range for buying (default: [10, 50])

  // IV crush/spike detection
  ivCrushWarningThreshold: number; // Warn if post-event IV drop > this (default: 15%)
  ivSpikeWarningThreshold: number; // Warn if recent IV spike > this (default: 25%)

  // Earnings proximity
  earningsProximityDays: number; // Days before earnings to flag (default: 3)
  earningsIVPremiumThreshold: number; // Extra IV % that indicates earnings premium (default: 30%)

  // Strategy-specific overrides
  allowHighIVForCreditStrategies: boolean; // Credit spreads can benefit from high IV
  allowLowIVForDebitStrategies: boolean; // Debit spreads can work with low IV
}

/**
 * Default IV gating configuration
 */
export const DEFAULT_IV_GATING_CONFIG: IVGatingConfig = {
  maxIVPercentileForBuying: 75,
  minIVPercentileForSelling: 25,
  optimalIVRangeForBuying: [10, 50],

  ivCrushWarningThreshold: 15,
  ivSpikeWarningThreshold: 25,

  earningsProximityDays: 3,
  earningsIVPremiumThreshold: 30,

  allowHighIVForCreditStrategies: true,
  allowLowIVForDebitStrategies: true,
};

/**
 * Gating decision types
 */
export type GatingDecision =
  | "BUY_OK" // IV is favorable for buying options
  | "BUY_OPTIMAL" // IV is in optimal range for buying
  | "SELL_PREMIUM" // IV is elevated, consider selling premium instead
  | "AVOID" // IV conditions unfavorable, avoid the trade
  | "WARN_EARNINGS" // Near earnings, IV crush risk
  | "WARN_CRUSH" // Recent IV crush detected
  | "WARN_SPIKE" // Recent IV spike, may be temporary
  | "INSUFFICIENT_DATA"; // Not enough IV history

/**
 * Strategy type for gating decisions
 */
export type OptionsStrategy =
  | "long_call"
  | "long_put"
  | "short_call"
  | "short_put"
  | "call_spread_debit"
  | "put_spread_debit"
  | "call_spread_credit"
  | "put_spread_credit"
  | "straddle_long"
  | "straddle_short"
  | "strangle_long"
  | "strangle_short"
  | "iron_condor"
  | "butterfly";

/**
 * Complete IV analysis result
 */
export interface IVAnalysis {
  // Current IV state
  currentIV: number;
  ivRank: number; // 0-100: Where IV is vs 52-week range
  ivPercentile: number; // 0-100: % of days IV was lower than current

  // Categorical flags
  isElevated: boolean; // IV > 75th percentile
  isCheap: boolean; // IV < 25th percentile
  isOptimal: boolean; // IV in optimal range for buying

  // Event detection
  recentCrush: boolean; // IV crushed recently
  recentSpike: boolean; // IV spiked recently
  crushPercent: number; // % drop if crush
  spikePercent: number; // % rise if spike

  // Earnings proximity (if provided)
  nearEarnings: boolean;
  daysToEarnings?: number;
  earningsIVPremium?: number; // Estimated extra IV due to earnings

  // Gating decision
  gatingDecision: GatingDecision;
  strategyRecommendations: StrategyRecommendation[];

  // Human-readable
  reasoning: string;
  warnings: string[];
  suggestions: string[];
}

/**
 * Strategy recommendation based on IV conditions
 */
export interface StrategyRecommendation {
  strategy: OptionsStrategy;
  suitability: "excellent" | "good" | "neutral" | "poor" | "avoid";
  reason: string;
}

/**
 * Analyze IV conditions for gating decision
 *
 * @param symbol - Symbol to analyze
 * @param daysToEarnings - Optional days until earnings
 * @param config - IV gating configuration
 * @returns Complete IV analysis
 */
export function analyzeIVForGating(
  symbol: string,
  daysToEarnings?: number,
  config: IVGatingConfig = DEFAULT_IV_GATING_CONFIG
): IVAnalysis {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Get IV stats
  const ivStats = getIVStats(symbol);

  if (!ivStats) {
    return {
      currentIV: 0,
      ivRank: 50,
      ivPercentile: 50,
      isElevated: false,
      isCheap: false,
      isOptimal: true,
      recentCrush: false,
      recentSpike: false,
      crushPercent: 0,
      spikePercent: 0,
      nearEarnings: false,
      daysToEarnings,
      gatingDecision: "INSUFFICIENT_DATA",
      strategyRecommendations: [],
      reasoning: "Insufficient IV history for analysis",
      warnings: ["Not enough IV data - using default assumptions"],
      suggestions: ["Continue trading but monitor IV closely"],
    };
  }

  // Extract values
  const currentIV = ivStats.current;
  const ivRank = ivStats.rank;
  const ivPercentile = ivStats.percentile;

  // Categorical checks
  const isElevated = ivPercentile >= config.maxIVPercentileForBuying;
  const isCheap = ivPercentile <= config.minIVPercentileForSelling;
  const isOptimal =
    ivPercentile >= config.optimalIVRangeForBuying[0] &&
    ivPercentile <= config.optimalIVRangeForBuying[1];

  // Event detection
  const { isCrush: recentCrush, dropPercent: crushPercent } = detectIVCrush(symbol);
  const { isSpike: recentSpike, risePercent: spikePercent } = detectIVSpike(symbol);

  // Earnings proximity
  const nearEarnings =
    daysToEarnings !== undefined &&
    daysToEarnings >= 0 &&
    daysToEarnings <= config.earningsProximityDays;

  // Estimate earnings IV premium (rough heuristic)
  let earningsIVPremium: number | undefined;
  if (nearEarnings && daysToEarnings !== undefined) {
    // IV typically elevated 20-50% before earnings
    earningsIVPremium = Math.max(0, ivPercentile - 50);
  }

  // Make gating decision
  let gatingDecision: GatingDecision = "BUY_OK";
  let reasoning = "";

  if (nearEarnings) {
    gatingDecision = "WARN_EARNINGS";
    reasoning = `Earnings in ${daysToEarnings} days - IV crush risk after announcement`;
    warnings.push(`Earnings proximity: ${daysToEarnings} days`);
    warnings.push("IV may crush 20-50% after earnings regardless of price move");
    suggestions.push("Consider waiting until after earnings to buy options");
    suggestions.push("If bullish, consider selling put spreads instead of buying calls");
  } else if (recentCrush && crushPercent > config.ivCrushWarningThreshold) {
    gatingDecision = "WARN_CRUSH";
    reasoning = `Recent IV crush of ${crushPercent.toFixed(1)}% - IV may continue falling`;
    warnings.push("Recent IV crush detected");
    suggestions.push("Good time to buy options if you missed the IV spike");
  } else if (recentSpike && spikePercent > config.ivSpikeWarningThreshold) {
    gatingDecision = "WARN_SPIKE";
    reasoning = `Recent IV spike of ${spikePercent.toFixed(1)}% - may be temporary`;
    warnings.push("Recent IV spike detected - may revert");
    suggestions.push("Wait for IV to stabilize before buying");
    suggestions.push("Consider selling premium to benefit from high IV");
  } else if (isElevated) {
    gatingDecision = "SELL_PREMIUM";
    reasoning = `IV at ${ivPercentile.toFixed(0)}th percentile (elevated) - expensive to buy options`;
    warnings.push(
      `IV elevated: ${(currentIV * 100).toFixed(1)}% (${ivPercentile.toFixed(0)}th percentile)`
    );
    suggestions.push("Consider selling premium (credit spreads, iron condors)");
    suggestions.push("If must buy, use spreads to reduce IV exposure");
  } else if (isCheap) {
    gatingDecision = "BUY_OK";
    reasoning = `IV at ${ivPercentile.toFixed(0)}th percentile (cheap) - good time to buy options`;
    suggestions.push("Favorable IV for buying options");
    suggestions.push("Avoid selling naked premium at low IV");
  } else if (isOptimal) {
    gatingDecision = "BUY_OPTIMAL";
    reasoning = `IV at ${ivPercentile.toFixed(0)}th percentile (optimal range) - best conditions for buying`;
    suggestions.push("Optimal IV conditions for directional option plays");
  } else {
    gatingDecision = "BUY_OK";
    reasoning = `IV at ${ivPercentile.toFixed(0)}th percentile (normal) - no significant IV concerns`;
  }

  // Generate strategy recommendations
  const strategyRecommendations = generateStrategyRecommendations(
    ivPercentile,
    isElevated,
    isCheap,
    nearEarnings,
    config
  );

  return {
    currentIV,
    ivRank,
    ivPercentile,
    isElevated,
    isCheap,
    isOptimal,
    recentCrush,
    recentSpike,
    crushPercent,
    spikePercent,
    nearEarnings,
    daysToEarnings,
    earningsIVPremium,
    gatingDecision,
    strategyRecommendations,
    reasoning,
    warnings,
    suggestions,
  };
}

/**
 * Generate strategy recommendations based on IV conditions
 */
function generateStrategyRecommendations(
  ivPercentile: number,
  isElevated: boolean,
  isCheap: boolean,
  nearEarnings: boolean,
  config: IVGatingConfig
): StrategyRecommendation[] {
  const recommendations: StrategyRecommendation[] = [];

  // Long options (buying)
  if (isElevated) {
    recommendations.push({
      strategy: "long_call",
      suitability: "poor",
      reason: "IV elevated - paying extra premium",
    });
    recommendations.push({
      strategy: "long_put",
      suitability: "poor",
      reason: "IV elevated - paying extra premium",
    });
  } else if (isCheap) {
    recommendations.push({
      strategy: "long_call",
      suitability: "excellent",
      reason: "IV cheap - options are inexpensive",
    });
    recommendations.push({
      strategy: "long_put",
      suitability: "excellent",
      reason: "IV cheap - options are inexpensive",
    });
  } else {
    recommendations.push({
      strategy: "long_call",
      suitability: "good",
      reason: "IV normal - reasonable pricing",
    });
    recommendations.push({
      strategy: "long_put",
      suitability: "good",
      reason: "IV normal - reasonable pricing",
    });
  }

  // Credit spreads (selling premium)
  if (isElevated) {
    recommendations.push({
      strategy: "call_spread_credit",
      suitability: "excellent",
      reason: "IV elevated - collect more premium",
    });
    recommendations.push({
      strategy: "put_spread_credit",
      suitability: "excellent",
      reason: "IV elevated - collect more premium",
    });
    recommendations.push({
      strategy: "iron_condor",
      suitability: "excellent",
      reason: "IV elevated - wide strikes, good premium",
    });
  } else if (isCheap) {
    recommendations.push({
      strategy: "call_spread_credit",
      suitability: "poor",
      reason: "IV cheap - not enough premium",
    });
    recommendations.push({
      strategy: "put_spread_credit",
      suitability: "poor",
      reason: "IV cheap - not enough premium",
    });
    recommendations.push({
      strategy: "iron_condor",
      suitability: "avoid",
      reason: "IV cheap - insufficient premium for risk",
    });
  }

  // Debit spreads (reduced IV exposure)
  if (isElevated) {
    recommendations.push({
      strategy: "call_spread_debit",
      suitability: "good",
      reason: "Spread reduces IV exposure vs naked long",
    });
    recommendations.push({
      strategy: "put_spread_debit",
      suitability: "good",
      reason: "Spread reduces IV exposure vs naked long",
    });
  }

  // Volatility plays
  if (isCheap) {
    recommendations.push({
      strategy: "straddle_long",
      suitability: "good",
      reason: "IV cheap - good for volatility expansion plays",
    });
    recommendations.push({
      strategy: "strangle_long",
      suitability: "good",
      reason: "IV cheap - good for volatility expansion plays",
    });
  } else if (isElevated) {
    recommendations.push({
      strategy: "straddle_short",
      suitability: "excellent",
      reason: "IV elevated - good for volatility contraction plays",
    });
    recommendations.push({
      strategy: "strangle_short",
      suitability: "excellent",
      reason: "IV elevated - good for volatility contraction plays",
    });
  }

  // Near earnings adjustments
  if (nearEarnings) {
    recommendations.forEach((rec) => {
      if (rec.strategy.includes("long")) {
        rec.suitability = "avoid";
        rec.reason = "Near earnings - IV crush risk";
      } else if (rec.strategy.includes("short") || rec.strategy.includes("credit")) {
        rec.suitability = "good";
        rec.reason = "Can benefit from post-earnings IV crush";
      }
    });
  }

  return recommendations;
}

/**
 * Quick check if signal should be gated based on IV
 *
 * @param analysis - IV analysis result
 * @param isDebitStrategy - True if buying options (vs credit/selling)
 * @returns Whether to gate and reason
 */
export function shouldGateOnIV(
  analysis: IVAnalysis,
  isDebitStrategy: boolean = true
): { gate: boolean; reason?: string } {
  if (analysis.gatingDecision === "INSUFFICIENT_DATA") {
    // Don't gate if we don't have data
    return { gate: false };
  }

  if (isDebitStrategy) {
    // Buying options
    if (analysis.gatingDecision === "AVOID") {
      return { gate: true, reason: analysis.reasoning };
    }
    if (analysis.gatingDecision === "SELL_PREMIUM" && analysis.isElevated) {
      return {
        gate: true,
        reason: `IV too elevated (${analysis.ivPercentile.toFixed(0)}th percentile) - avoid buying premium`,
      };
    }
    if (analysis.gatingDecision === "WARN_EARNINGS" && analysis.nearEarnings) {
      return {
        gate: true,
        reason: `Earnings in ${analysis.daysToEarnings} days - IV crush risk`,
      };
    }
  } else {
    // Selling premium
    if (analysis.isCheap) {
      return {
        gate: true,
        reason: `IV too low (${analysis.ivPercentile.toFixed(0)}th percentile) - insufficient premium for selling`,
      };
    }
  }

  return { gate: false };
}

/**
 * Get IV-adjusted score modifier
 *
 * Returns a multiplier to apply to signal score based on IV conditions.
 * Favorable IV = higher score, unfavorable = lower score
 */
export function getIVScoreModifier(analysis: IVAnalysis): number {
  // Base modifier
  let modifier = 1.0;

  // Optimal IV = bonus
  if (analysis.isOptimal) {
    modifier *= 1.1; // +10% for optimal IV
  }

  // Cheap IV = small bonus
  if (analysis.isCheap) {
    modifier *= 1.05; // +5% for cheap IV
  }

  // Elevated IV = penalty for buying
  if (analysis.isElevated) {
    modifier *= 0.85; // -15% for elevated IV
  }

  // Near earnings = significant penalty
  if (analysis.nearEarnings) {
    modifier *= 0.7; // -30% near earnings
  }

  // Recent crush = bonus (good entry)
  if (analysis.recentCrush) {
    modifier *= 1.1; // +10% post-crush
  }

  // Recent spike = penalty (bad entry)
  if (analysis.recentSpike) {
    modifier *= 0.9; // -10% during spike
  }

  // Clamp to reasonable range
  return Math.max(0.5, Math.min(1.2, modifier));
}

/**
 * Format IV analysis for display
 */
export function formatIVAnalysis(analysis: IVAnalysis): string {
  const lines = [
    `IV Analysis`,
    `───────────────────────────`,
    `Current IV: ${(analysis.currentIV * 100).toFixed(1)}%`,
    `IV Percentile: ${analysis.ivPercentile.toFixed(0)}th`,
    `IV Rank: ${analysis.ivRank.toFixed(0)}`,
    "",
    `Status: ${analysis.isElevated ? "🔴 ELEVATED" : analysis.isCheap ? "🟢 CHEAP" : analysis.isOptimal ? "✅ OPTIMAL" : "⚪ NORMAL"}`,
    `Decision: ${analysis.gatingDecision}`,
    "",
    `Reasoning: ${analysis.reasoning}`,
  ];

  if (analysis.warnings.length > 0) {
    lines.push("", "Warnings:");
    analysis.warnings.forEach((w) => lines.push(`  ⚠️ ${w}`));
  }

  if (analysis.suggestions.length > 0) {
    lines.push("", "Suggestions:");
    analysis.suggestions.forEach((s) => lines.push(`  💡 ${s}`));
  }

  if (analysis.strategyRecommendations.length > 0) {
    lines.push("", "Strategy Recommendations:");
    analysis.strategyRecommendations
      .filter((r) => r.suitability !== "neutral")
      .slice(0, 5)
      .forEach((r) => {
        const icon =
          r.suitability === "excellent"
            ? "⭐"
            : r.suitability === "good"
              ? "✅"
              : r.suitability === "poor"
                ? "⚠️"
                : "❌";
        lines.push(`  ${icon} ${r.strategy}: ${r.reason}`);
      });
  }

  return lines.join("\n");
}
