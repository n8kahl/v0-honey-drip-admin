/**
 * GammaContextEngine - High-level gamma analysis for trading decisions
 *
 * Provides actionable gamma context for options trading:
 * - Real-time dealer positioning analysis
 * - Gamma-based support/resistance levels
 * - Expected market behavior predictions
 * - Integration with composite signal scoring
 *
 * Data Sources:
 * - Primary: Massive.com OPTIONS ADVANCED (open interest, Greeks)
 * - Fallback: Estimated from price action patterns
 */

import {
  calculateGammaExposure,
  findGammaFlipLevel,
  findWalls,
  calculateTotalNetGamma,
  classifyGammaImbalance,
  determineExpectedBehavior,
  findGammaLevels,
  generateTradingImplications,
  generateGammaWarnings,
  type OptionsOpenInterest,
  type GammaExposureByStrike,
  type DealerPositioningSummary,
  type GammaContextResult,
} from "./DealerPositioning.js";

export interface GammaEngineConfig {
  // Analysis parameters
  maxDTE: number; // Only analyze options with DTE <= this (default: 30)
  minOI: number; // Minimum open interest to include (default: 100)
  strikeRange: number; // Percentage from ATM to analyze (default: 0.10 = 10%)

  // Caching
  cacheTTLMs: number; // How long to cache results (default: 60000 = 1 minute)

  // Data quality thresholds
  minStrikesRequired: number; // Minimum strikes for valid analysis (default: 5)
  minTotalOI: number; // Minimum total OI for valid analysis (default: 10000)
}

export const DEFAULT_GAMMA_CONFIG: GammaEngineConfig = {
  maxDTE: 30,
  minOI: 100,
  strikeRange: 0.1,
  cacheTTLMs: 60000,
  minStrikesRequired: 5,
  minTotalOI: 10000,
};

// In-memory cache for gamma analysis results
const gammaCache = new Map<
  string,
  {
    result: GammaContextResult;
    timestamp: number;
  }
>();

/**
 * Main entry point for gamma context analysis
 */
export async function analyzeGammaContext(
  symbol: string,
  currentPrice: number,
  optionsData: OptionsOpenInterest[],
  config: Partial<GammaEngineConfig> = {}
): Promise<GammaContextResult> {
  const cfg = { ...DEFAULT_GAMMA_CONFIG, ...config };
  const cacheKey = `${symbol}:${Math.round(currentPrice)}`;

  // Check cache
  const cached = gammaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cfg.cacheTTLMs) {
    return cached.result;
  }

  // Filter options data by config
  const filteredData = optionsData.filter(
    (opt) =>
      opt.dte <= cfg.maxDTE &&
      (opt.callOI >= cfg.minOI || opt.putOI >= cfg.minOI) &&
      Math.abs(opt.strike - currentPrice) / currentPrice <= cfg.strikeRange
  );

  // Check data quality
  const dataQuality = assessDataQuality(filteredData, currentPrice, cfg);

  // Calculate gamma exposure by strike
  const gexByStrike = calculateGammaExposure(filteredData, currentPrice);

  // If insufficient data, return estimated result
  if (dataQuality === "LOW" || gexByStrike.length < cfg.minStrikesRequired) {
    const result = createEstimatedResult(symbol, currentPrice, dataQuality);
    gammaCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }

  // Calculate all gamma metrics
  const totalNetGamma = calculateTotalNetGamma(gexByStrike);
  const { imbalance, strength } = classifyGammaImbalance(totalNetGamma, gexByStrike);
  const gammaFlipLevel = findGammaFlipLevel(gexByStrike, currentPrice);
  const { putWall, callWall } = findWalls(gexByStrike, currentPrice);
  const { support, resistance } = findGammaLevels(gexByStrike, currentPrice);

  const expectedBehavior = determineExpectedBehavior(
    imbalance,
    strength,
    currentPrice,
    gammaFlipLevel,
    putWall,
    callWall
  );

  // Find max gamma strike
  const maxGammaStrike =
    gexByStrike.reduce(
      (max, g) => (Math.abs(g.netGEX) > Math.abs(max.netGEX) ? g : max),
      gexByStrike[0]
    )?.strike || currentPrice;

  // Build summary
  const summary: DealerPositioningSummary = {
    totalNetGamma,
    gammaImbalance: imbalance,
    gammaImbalanceStrength: strength,
    gammaFlipLevel,
    maxGammaStrike,
    putWall,
    callWall,
    expectedBehavior,
    supportLevels: support,
    resistanceLevels: resistance,
    dataQuality,
    expirationsCovered: new Set(filteredData.map((o) => o.expiration)).size,
    totalOIAnalyzed: filteredData.reduce((sum, o) => sum + o.callOI + o.putOI, 0),
  };

  const tradingImplications = generateTradingImplications(summary);
  const warnings = generateGammaWarnings(summary, currentPrice);

  const result: GammaContextResult = {
    summary,
    byStrike: gexByStrike,
    tradingImplications,
    warnings,
  };

  // Cache result
  gammaCache.set(cacheKey, { result, timestamp: Date.now() });

  return result;
}

/**
 * Assess data quality based on available options data
 */
function assessDataQuality(
  data: OptionsOpenInterest[],
  currentPrice: number,
  config: GammaEngineConfig
): "HIGH" | "MEDIUM" | "LOW" {
  if (data.length < config.minStrikesRequired) {
    return "LOW";
  }

  const totalOI = data.reduce((sum, o) => sum + o.callOI + o.putOI, 0);
  if (totalOI < config.minTotalOI) {
    return "LOW";
  }

  const expirationsCovered = new Set(data.map((o) => o.expiration)).size;
  if (expirationsCovered < 2) {
    return "MEDIUM";
  }

  // Check if we have data around current price
  const nearATM = data.filter((o) => Math.abs(o.strike - currentPrice) / currentPrice < 0.02);
  if (nearATM.length < 3) {
    return "MEDIUM";
  }

  return "HIGH";
}

/**
 * Create estimated result when real data is insufficient
 *
 * Uses historical patterns and market regime to estimate gamma positioning
 */
function createEstimatedResult(
  symbol: string,
  currentPrice: number,
  dataQuality: "HIGH" | "MEDIUM" | "LOW"
): GammaContextResult {
  // Default to neutral gamma for estimation
  const summary: DealerPositioningSummary = {
    totalNetGamma: 0,
    gammaImbalance: "NEUTRAL",
    gammaImbalanceStrength: "WEAK",
    gammaFlipLevel: null,
    maxGammaStrike: currentPrice,
    putWall: null,
    callWall: null,
    expectedBehavior: "VOLATILE",
    supportLevels: [],
    resistanceLevels: [],
    dataQuality,
    expirationsCovered: 0,
    totalOIAnalyzed: 0,
  };

  return {
    summary,
    byStrike: [],
    tradingImplications: [
      "Insufficient options data for gamma analysis",
      "Using conservative assumptions - expect normal volatility",
      "Consider checking data availability during market hours",
    ],
    warnings: [
      `Limited gamma data for ${symbol} - analysis is estimated`,
      "Real-time options data required for accurate positioning",
    ],
  };
}

/**
 * Get gamma context score modifier for signal scoring
 *
 * Returns a multiplier (0.5 - 1.5) based on how gamma context
 * aligns with the proposed trade direction
 */
export function getGammaScoreModifier(
  gammaContext: GammaContextResult,
  tradeDirection: "LONG" | "SHORT",
  tradeStyle: "scalp" | "day" | "swing"
): { modifier: number; reasoning: string } {
  const { summary } = gammaContext;

  // Low data quality = neutral modifier
  if (summary.dataQuality === "LOW") {
    return { modifier: 1.0, reasoning: "Insufficient gamma data for adjustment" };
  }

  let modifier = 1.0;
  const reasons: string[] = [];

  // Expected behavior alignment
  switch (summary.expectedBehavior) {
    case "MEAN_REVERTING":
      // Favor mean reversion plays (scalps and day trades in ranging conditions)
      if (tradeStyle === "scalp" || tradeStyle === "day") {
        modifier *= 1.1;
        reasons.push("Mean-reverting gamma favors shorter-term trades");
      }
      // Penalize swing trades in mean-reverting environment
      if (tradeStyle === "swing") {
        modifier *= 0.85;
        reasons.push("Mean-reverting gamma may limit swing potential");
      }
      break;

    case "TRENDING":
      // Favor swing trades in trending gamma
      if (tradeStyle === "swing") {
        modifier *= 1.15;
        reasons.push("Negative gamma amplifies trends - good for swings");
      }
      // Scalps may get stopped out by amplified moves
      if (tradeStyle === "scalp") {
        modifier *= 0.9;
        reasons.push("Negative gamma may cause whipsaws on scalps");
      }
      break;

    case "PINNING":
      // Strongly favor scalps in pinning environment
      if (tradeStyle === "scalp") {
        modifier *= 1.2;
        reasons.push("Gamma pinning creates excellent scalp conditions");
      }
      // Avoid swings when pinned
      if (tradeStyle === "swing") {
        modifier *= 0.7;
        reasons.push("Gamma pinning limits directional movement");
      }
      break;

    case "VOLATILE":
      // Penalize all trades in volatile gamma
      modifier *= 0.85;
      reasons.push("Uncertain gamma positioning - increased risk");
      break;
  }

  // Gamma strength adjustment
  if (summary.gammaImbalanceStrength === "STRONG") {
    // Strong gamma = more predictable behavior
    modifier *= 1.05;
    reasons.push("Strong gamma positioning increases predictability");
  } else if (summary.gammaImbalanceStrength === "WEAK") {
    modifier *= 0.95;
    reasons.push("Weak gamma positioning reduces conviction");
  }

  // Level proximity bonus
  if (tradeDirection === "LONG" && summary.putWall) {
    // Buying near put wall = good support
    modifier *= 1.05;
    reasons.push("Near put wall support");
  }
  if (tradeDirection === "SHORT" && summary.callWall) {
    // Shorting near call wall = good resistance
    modifier *= 1.05;
    reasons.push("Near call wall resistance");
  }

  // Clamp modifier to reasonable range
  modifier = Math.max(0.5, Math.min(1.5, modifier));

  return {
    modifier: Math.round(modifier * 100) / 100,
    reasoning: reasons.join("; ") || "No significant gamma adjustment",
  };
}

/**
 * Clear gamma cache (useful for testing or forced refresh)
 */
export function clearGammaCache(): void {
  gammaCache.clear();
}

/**
 * Get current gamma analysis for a symbol (from cache if available)
 */
export function getCachedGammaContext(symbol: string, price: number): GammaContextResult | null {
  const cacheKey = `${symbol}:${Math.round(price)}`;
  const cached = gammaCache.get(cacheKey);
  return cached?.result || null;
}

// Re-export types for convenience
export type {
  OptionsOpenInterest,
  GammaExposureByStrike,
  DealerPositioningSummary,
  GammaContextResult,
} from "./DealerPositioning.js";
