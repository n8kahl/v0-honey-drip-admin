/**
 * Confidence Scoring
 * Phase 1.4: Data availability-based confidence adjustment
 *
 * Penalizes signal scores when critical data is missing.
 * This prevents false positives during:
 * - Weekend analysis (no live VWAP, volume, flow)
 * - Pre/post market (limited data)
 * - Data provider outages
 *
 * Each data point has a weight and criticality level.
 * Missing critical data caps maximum confidence.
 */

import type { SymbolFeatures } from "../strategy/engine.js";

/**
 * Data availability flags
 */
export interface DataAvailability {
  // Price data (critical)
  price: boolean;
  priceChange: boolean;

  // Volume data (critical for most strategies)
  volume: boolean;
  volumeAvg: boolean;
  relativeVolume: boolean;

  // Technical indicators
  vwap: boolean;
  vwapDistance: boolean;
  rsi: boolean;
  ema: boolean;
  atr: boolean;

  // Multi-timeframe data
  mtf_1m: boolean;
  mtf_5m: boolean;
  mtf_15m: boolean;
  mtf_60m: boolean;

  // Options/flow data
  flow: boolean;
  flowScore: boolean;
  flowBias: boolean;

  // Pattern data
  orb: boolean;
  priorDayLevels: boolean;
  swingLevels: boolean;

  // Context data
  vixLevel: boolean;
  marketRegime: boolean;
  session: boolean;
}

/**
 * Weight configuration for each data point
 */
export interface DataWeightConfig {
  weight: number; // 0-100, contribution to completeness
  critical: boolean; // If true, missing = hard cap on confidence
  category: "price" | "volume" | "technical" | "mtf" | "flow" | "pattern" | "context";
}

/**
 * Default data weights
 *
 * Weights are based on importance for signal quality:
 * - Price (20): Can't trade without price
 * - Volume (15): Critical for breakouts, less for mean reversion
 * - VWAP (12): Important anchor but not critical
 * - ATR (10): Needed for stops/targets
 * - Flow (8): Nice to have, not critical
 * - MTF (3-5 each): Confirmation, not required
 */
export const DEFAULT_DATA_WEIGHTS: Record<keyof DataAvailability, DataWeightConfig> = {
  // Price - CRITICAL
  price: { weight: 20, critical: true, category: "price" },
  priceChange: { weight: 5, critical: false, category: "price" },

  // Volume - CRITICAL for most strategies
  volume: { weight: 12, critical: true, category: "volume" },
  volumeAvg: { weight: 5, critical: false, category: "volume" },
  relativeVolume: { weight: 8, critical: false, category: "volume" },

  // Technical - Important but not critical
  vwap: { weight: 10, critical: false, category: "technical" },
  vwapDistance: { weight: 5, critical: false, category: "technical" },
  rsi: { weight: 8, critical: false, category: "technical" },
  ema: { weight: 6, critical: false, category: "technical" },
  atr: { weight: 10, critical: true, category: "technical" }, // Need for stops

  // MTF - Confirmation
  mtf_1m: { weight: 2, critical: false, category: "mtf" },
  mtf_5m: { weight: 4, critical: false, category: "mtf" },
  mtf_15m: { weight: 3, critical: false, category: "mtf" },
  mtf_60m: { weight: 2, critical: false, category: "mtf" },

  // Flow - Nice to have
  flow: { weight: 5, critical: false, category: "flow" },
  flowScore: { weight: 4, critical: false, category: "flow" },
  flowBias: { weight: 3, critical: false, category: "flow" },

  // Pattern - Context
  orb: { weight: 3, critical: false, category: "pattern" },
  priorDayLevels: { weight: 4, critical: false, category: "pattern" },
  swingLevels: { weight: 2, critical: false, category: "pattern" },

  // Context
  vixLevel: { weight: 5, critical: false, category: "context" },
  marketRegime: { weight: 5, critical: false, category: "context" },
  session: { weight: 3, critical: false, category: "context" },
};

/**
 * Result of confidence calculation
 */
export interface ConfidenceResult {
  // Scores
  dataCompletenessScore: number; // 0-100: % of weighted data available
  baseConfidence: number; // 0-100: Confidence before critical penalty
  adjustedConfidence: number; // 0-100: Final confidence after all penalties
  confidenceMultiplier: number; // 0-1: Multiplier to apply to signal score

  // Data analysis
  totalWeight: number;
  availableWeight: number;
  missingWeight: number;

  // Missing data breakdown
  missingCritical: string[];
  missingImportant: string[]; // weight >= 5
  missingMinor: string[]; // weight < 5

  // Category breakdown
  categoryScores: Record<string, { available: number; total: number; percent: number }>;

  // Penalties applied
  penalties: {
    criticalDataPenalty: number; // Penalty for missing critical data
    lowCompletenessBonus: number; // Negative bonus for low completeness
  };

  // Human-readable summary
  summary: string;
  warnings: string[];
}

/**
 * Extract data availability from SymbolFeatures
 */
export function extractDataAvailability(features: SymbolFeatures): DataAvailability {
  const mtf = features.mtf || {};

  return {
    // Price
    price: features.price?.current !== undefined && features.price.current > 0,
    priceChange: features.price?.prev !== undefined,

    // Volume
    volume: features.volume?.current !== undefined && features.volume.current > 0,
    volumeAvg: features.volume?.avg !== undefined && features.volume.avg > 0,
    relativeVolume: features.volume?.relativeToAvg !== undefined,

    // Technical
    vwap: features.vwap?.value !== undefined && features.vwap.value > 0,
    vwapDistance: features.vwap?.distancePct !== undefined,
    rsi: features.rsi?.["14"] !== undefined,
    ema: features.ema?.["21"] !== undefined,
    atr: (mtf["5m"] as any)?.atr !== undefined && (mtf["5m"] as any)?.atr > 0,

    // MTF
    mtf_1m: mtf["1m"] !== undefined && (mtf["1m"] as any)?.price?.current !== undefined,
    mtf_5m: mtf["5m"] !== undefined && (mtf["5m"] as any)?.price?.current !== undefined,
    mtf_15m: mtf["15m"] !== undefined && (mtf["15m"] as any)?.price?.current !== undefined,
    mtf_60m: mtf["60m"] !== undefined && (mtf["60m"] as any)?.price?.current !== undefined,

    // Flow
    flow: features.flow !== undefined,
    flowScore: features.flow?.flowScore !== undefined,
    flowBias: features.flow?.flowBias !== undefined,

    // Pattern
    orb: features.pattern?.orbHigh !== undefined && features.pattern?.orbLow !== undefined,
    priorDayLevels: features.price?.prevClose !== undefined,
    swingLevels:
      features.pattern?.swingHigh !== undefined && features.pattern?.swingLow !== undefined,

    // Context
    vixLevel: features.pattern?.vix_level !== undefined,
    marketRegime: features.pattern?.market_regime !== undefined,
    session: features.session?.isRegularHours !== undefined,
  };
}

/**
 * Calculate confidence score based on data availability
 */
export function calculateDataConfidence(
  availability: DataAvailability,
  weights: Record<keyof DataAvailability, DataWeightConfig> = DEFAULT_DATA_WEIGHTS
): ConfidenceResult {
  let totalWeight = 0;
  let availableWeight = 0;
  const missingCritical: string[] = [];
  const missingImportant: string[] = [];
  const missingMinor: string[] = [];
  const warnings: string[] = [];

  // Category tracking
  const categoryTotals: Record<string, { available: number; total: number }> = {};

  // Calculate weights
  for (const [key, config] of Object.entries(weights)) {
    const dataKey = key as keyof DataAvailability;
    const isAvailable = availability[dataKey];

    totalWeight += config.weight;

    // Initialize category
    if (!categoryTotals[config.category]) {
      categoryTotals[config.category] = { available: 0, total: 0 };
    }
    categoryTotals[config.category].total += config.weight;

    if (isAvailable) {
      availableWeight += config.weight;
      categoryTotals[config.category].available += config.weight;
    } else {
      // Track missing data
      if (config.critical) {
        missingCritical.push(key);
      } else if (config.weight >= 5) {
        missingImportant.push(key);
      } else {
        missingMinor.push(key);
      }
    }
  }

  const missingWeight = totalWeight - availableWeight;
  const dataCompletenessScore = Math.round((availableWeight / totalWeight) * 100);

  // Calculate category scores
  const categoryScores: Record<string, { available: number; total: number; percent: number }> = {};
  for (const [category, data] of Object.entries(categoryTotals)) {
    categoryScores[category] = {
      ...data,
      percent: Math.round((data.available / data.total) * 100),
    };
  }

  // Calculate base confidence
  // Start at 100, reduce based on missing data
  let baseConfidence = 100;

  // Critical data penalty
  // Each missing critical data point caps confidence
  let criticalDataPenalty = 0;
  if (missingCritical.length > 0) {
    // Each critical missing = -15 confidence cap
    criticalDataPenalty = missingCritical.length * 15;
    baseConfidence = Math.min(baseConfidence, 100 - criticalDataPenalty);
    warnings.push(`Missing critical data: ${missingCritical.join(", ")}`);
  }

  // Low completeness penalty/bonus
  let lowCompletenessBonus = 0;
  if (dataCompletenessScore < 50) {
    // Very low completeness = additional penalty
    lowCompletenessBonus = -20;
    warnings.push("Data completeness below 50% - signal reliability significantly reduced");
  } else if (dataCompletenessScore < 70) {
    lowCompletenessBonus = -10;
    warnings.push("Data completeness below 70% - signal may be unreliable");
  } else if (dataCompletenessScore >= 90) {
    lowCompletenessBonus = 5; // Bonus for high completeness
  }

  // Final adjusted confidence
  const adjustedConfidence = Math.max(
    0,
    Math.min(100, (baseConfidence * dataCompletenessScore) / 100 + lowCompletenessBonus)
  );

  // Confidence multiplier (0-1)
  const confidenceMultiplier = adjustedConfidence / 100;

  // Generate summary
  let summary = `Data: ${dataCompletenessScore}% complete`;
  if (missingCritical.length > 0) {
    summary += ` (${missingCritical.length} critical missing)`;
  }
  summary += ` → ${adjustedConfidence.toFixed(0)}% confidence`;

  return {
    dataCompletenessScore,
    baseConfidence,
    adjustedConfidence,
    confidenceMultiplier,

    totalWeight,
    availableWeight,
    missingWeight,

    missingCritical,
    missingImportant,
    missingMinor,

    categoryScores,

    penalties: {
      criticalDataPenalty,
      lowCompletenessBonus,
    },

    summary,
    warnings,
  };
}

/**
 * Apply confidence adjustment to a signal score
 *
 * @param rawScore - Original signal score (0-100)
 * @param confidence - Confidence result from calculateDataConfidence
 * @returns Adjusted score and reasoning
 */
export function applyConfidenceToScore(
  rawScore: number,
  confidence: ConfidenceResult
): { adjustedScore: number; reasoning: string; wasReduced: boolean } {
  const adjustedScore = Math.round(rawScore * confidence.confidenceMultiplier);
  const reduction = rawScore - adjustedScore;
  const wasReduced = reduction > 0;

  let reasoning = "";

  if (wasReduced) {
    reasoning = `Score reduced from ${rawScore} to ${adjustedScore} (${confidence.dataCompletenessScore}% data available`;

    if (confidence.missingCritical.length > 0) {
      reasoning += `, missing critical: ${confidence.missingCritical.join(", ")}`;
    }

    reasoning += ")";
  } else {
    reasoning = `Score maintained at ${adjustedScore} (${confidence.dataCompletenessScore}% data available)`;
  }

  return {
    adjustedScore,
    reasoning,
    wasReduced,
  };
}

/**
 * Quick check if signal should be filtered due to low confidence
 *
 * @param confidence - Confidence result
 * @param minConfidence - Minimum confidence required (default: 40)
 * @returns Whether signal should be filtered
 */
export function shouldFilterLowConfidence(
  confidence: ConfidenceResult,
  minConfidence: number = 40
): { filter: boolean; reason?: string } {
  if (confidence.adjustedConfidence < minConfidence) {
    return {
      filter: true,
      reason: `Confidence too low: ${confidence.adjustedConfidence.toFixed(0)}% < ${minConfidence}% minimum. ${confidence.summary}`,
    };
  }

  return { filter: false };
}

/**
 * Get confidence level category
 */
export function getConfidenceLevel(confidence: number): "high" | "medium" | "low" | "very_low" {
  if (confidence >= 80) return "high";
  if (confidence >= 60) return "medium";
  if (confidence >= 40) return "low";
  return "very_low";
}

/**
 * Format confidence result for display
 */
export function formatConfidenceResult(result: ConfidenceResult): string {
  const lines = [
    `Data Completeness: ${result.dataCompletenessScore}%`,
    `Confidence: ${result.adjustedConfidence.toFixed(0)}% (${getConfidenceLevel(result.adjustedConfidence)})`,
    "",
    "Category Breakdown:",
  ];

  for (const [category, scores] of Object.entries(result.categoryScores)) {
    const bar =
      "█".repeat(Math.round(scores.percent / 10)) +
      "░".repeat(10 - Math.round(scores.percent / 10));
    lines.push(`  ${category}: ${bar} ${scores.percent}%`);
  }

  if (result.missingCritical.length > 0) {
    lines.push("", "Missing Critical Data:");
    result.missingCritical.forEach((d) => lines.push(`  ❌ ${d}`));
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    result.warnings.forEach((w) => lines.push(`  ⚠️ ${w}`));
  }

  return lines.join("\n");
}

/**
 * Calculate confidence for weekend/off-hours mode
 * Uses relaxed weights since we expect less data
 */
export function calculateWeekendConfidence(features: SymbolFeatures): ConfidenceResult {
  // Weekend-specific weights - less emphasis on live data
  const weekendWeights: Record<keyof DataAvailability, DataWeightConfig> = {
    ...DEFAULT_DATA_WEIGHTS,
    // Don't penalize for missing live data on weekends
    volume: { weight: 5, critical: false, category: "volume" },
    relativeVolume: { weight: 2, critical: false, category: "volume" },
    vwap: { weight: 3, critical: false, category: "technical" },
    vwapDistance: { weight: 2, critical: false, category: "technical" },
    flow: { weight: 2, critical: false, category: "flow" },
    flowScore: { weight: 1, critical: false, category: "flow" },
    flowBias: { weight: 1, critical: false, category: "flow" },
    // Emphasize historical data
    priorDayLevels: { weight: 10, critical: false, category: "pattern" },
    swingLevels: { weight: 8, critical: false, category: "pattern" },
  };

  const availability = extractDataAvailability(features);
  return calculateDataConfidence(availability, weekendWeights);
}
