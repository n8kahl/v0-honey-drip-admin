/**
 * ContractQualityScore - Multi-factor scoring for options contracts
 *
 * Scores contracts on 5 key dimensions:
 * 1. Liquidity Score (25%) - Volume, OI, spread
 * 2. Greeks Fit Score (25%) - Delta/gamma appropriate for trade style
 * 3. IV Value Score (20%) - IV percentile relative to buying/selling
 * 4. Flow Score (15%) - Smart money indicators
 * 5. Probability Score (15%) - Delta as probability proxy
 */

import type { Contract } from "../../types";

export interface ContractQualityResult {
  overallScore: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  recommendation: "strong_buy" | "buy" | "consider" | "avoid";
  scores: {
    liquidity: number;
    greeksFit: number;
    ivValue: number;
    flow: number;
    probability: number;
  };
  warnings: string[];
  strengths: string[];
}

export interface ContractQualityConfig {
  tradeStyle: "scalp" | "day_trade" | "swing";
  direction: "call" | "put";
  isDebit: boolean; // true = buying options, false = selling
  underlyingPrice: number;
  ivPercentile?: number; // 0-100
  flowBias?: "bullish" | "bearish" | "neutral";
  flowScore?: number; // 0-100
}

const WEIGHTS = {
  liquidity: 0.25,
  greeksFit: 0.25,
  ivValue: 0.2,
  flow: 0.15,
  probability: 0.15,
};

// Delta targets by trade style
const DELTA_TARGETS = {
  scalp: { call: 0.55, put: -0.55 }, // Near ATM for fast moves
  day_trade: { call: 0.45, put: -0.45 }, // Slightly OTM
  swing: { call: 0.35, put: -0.35 }, // More OTM for leverage
};

// DTE preferences by trade style
const DTE_PREFERENCES = {
  scalp: { min: 0, max: 3, optimal: 1 },
  day_trade: { min: 1, max: 7, optimal: 3 },
  swing: { min: 7, max: 45, optimal: 21 },
};

/**
 * Calculate liquidity score based on volume, OI, and spread
 */
function calculateLiquidityScore(contract: Contract): {
  score: number;
  warnings: string[];
  strengths: string[];
} {
  const warnings: string[] = [];
  const strengths: string[] = [];
  let score = 50; // Start neutral

  const { volume, openInterest, bid, ask, mid } = contract;
  const spreadPct = mid > 0 ? ((ask - bid) / mid) * 100 : 100;

  // Volume scoring (0-25 points)
  if (volume >= 1000) {
    score += 25;
    strengths.push("Excellent volume");
  } else if (volume >= 500) {
    score += 20;
    strengths.push("Good volume");
  } else if (volume >= 100) {
    score += 10;
  } else if (volume < 50) {
    score -= 15;
    warnings.push("Low volume - fills may be difficult");
  }

  // Open Interest scoring (0-25 points)
  if (openInterest >= 5000) {
    score += 25;
    strengths.push("Deep open interest");
  } else if (openInterest >= 1000) {
    score += 20;
  } else if (openInterest >= 500) {
    score += 10;
  } else if (openInterest < 100) {
    score -= 15;
    warnings.push("Low open interest");
  }

  // Spread scoring (0-25 points, penalty for wide spreads)
  if (spreadPct <= 1) {
    score += 25;
    strengths.push("Tight spread");
  } else if (spreadPct <= 2) {
    score += 20;
  } else if (spreadPct <= 5) {
    score += 10;
  } else if (spreadPct > 10) {
    score -= 25;
    warnings.push(`Wide spread (${spreadPct.toFixed(1)}%) - slippage risk`);
  } else if (spreadPct > 5) {
    score -= 10;
    warnings.push("Moderate spread");
  }

  return { score: Math.max(0, Math.min(100, score)), warnings, strengths };
}

/**
 * Calculate Greeks fit score based on trade style
 */
function calculateGreeksFitScore(
  contract: Contract,
  config: ContractQualityConfig
): { score: number; warnings: string[]; strengths: string[] } {
  const warnings: string[] = [];
  const strengths: string[] = [];
  let score = 50;

  const { delta, gamma, theta, vega } = contract;
  const dte = contract.daysToExpiry;
  const { tradeStyle, direction } = config;

  // Delta fit scoring
  const targetDelta = DELTA_TARGETS[tradeStyle][direction];
  const actualDelta = delta ?? 0;
  const deltaDistance = Math.abs(Math.abs(actualDelta) - Math.abs(targetDelta));

  if (deltaDistance <= 0.05) {
    score += 25;
    strengths.push("Optimal delta for style");
  } else if (deltaDistance <= 0.1) {
    score += 15;
  } else if (deltaDistance <= 0.15) {
    score += 5;
  } else if (deltaDistance > 0.25) {
    score -= 15;
    warnings.push("Delta far from optimal");
  }

  // DTE fit scoring
  const dtePrefs = DTE_PREFERENCES[tradeStyle];
  if (dte >= dtePrefs.min && dte <= dtePrefs.max) {
    if (Math.abs(dte - dtePrefs.optimal) <= 2) {
      score += 25;
      strengths.push("Optimal DTE");
    } else {
      score += 15;
    }
  } else {
    score -= 15;
    if (dte < dtePrefs.min) {
      warnings.push(`DTE too short for ${tradeStyle}`);
    } else {
      warnings.push(`DTE too long for ${tradeStyle}`);
    }
  }

  // Gamma awareness (high gamma = fast moves, good for scalps)
  const absGamma = Math.abs(gamma ?? 0);
  if (tradeStyle === "scalp" && absGamma > 0.03) {
    score += 10;
    strengths.push("High gamma - explosive moves");
  } else if (tradeStyle === "swing" && absGamma > 0.05) {
    warnings.push("High gamma may cause volatility");
    score -= 5;
  }

  // Theta awareness
  const absTheta = Math.abs(theta ?? 0);
  if (config.isDebit && dte <= 3 && absTheta > 0.05) {
    warnings.push("Rapid theta decay");
    score -= 10;
  }

  return { score: Math.max(0, Math.min(100, score)), warnings, strengths };
}

/**
 * Calculate IV value score - is the premium fair?
 */
function calculateIVValueScore(
  contract: Contract,
  config: ContractQualityConfig
): { score: number; warnings: string[]; strengths: string[] } {
  const warnings: string[] = [];
  const strengths: string[] = [];
  let score = 50;

  const ivPercentile = config.ivPercentile ?? 50;
  const { isDebit } = config;

  if (isDebit) {
    // Buying options - want low IV
    if (ivPercentile <= 20) {
      score += 40;
      strengths.push("IV cheap - good for buying");
    } else if (ivPercentile <= 35) {
      score += 25;
      strengths.push("IV below average");
    } else if (ivPercentile <= 50) {
      score += 10;
    } else if (ivPercentile >= 70) {
      score -= 20;
      warnings.push("IV elevated - premium expensive");
    } else if (ivPercentile >= 80) {
      score -= 35;
      warnings.push("IV very high - avoid buying");
    }
  } else {
    // Selling options - want high IV
    if (ivPercentile >= 80) {
      score += 40;
      strengths.push("IV elevated - good for selling");
    } else if (ivPercentile >= 65) {
      score += 25;
      strengths.push("IV above average");
    } else if (ivPercentile >= 50) {
      score += 10;
    } else if (ivPercentile <= 30) {
      score -= 20;
      warnings.push("IV low - poor premium");
    } else if (ivPercentile <= 20) {
      score -= 35;
      warnings.push("IV very low - avoid selling");
    }
  }

  return { score: Math.max(0, Math.min(100, score)), warnings, strengths };
}

/**
 * Calculate flow score based on smart money indicators
 */
function calculateFlowScore(
  _contract: Contract,
  config: ContractQualityConfig
): { score: number; warnings: string[]; strengths: string[] } {
  const warnings: string[] = [];
  const strengths: string[] = [];
  let score = 50;

  const { flowBias, flowScore, direction } = config;

  if (flowScore !== undefined) {
    // Use raw flow score if available
    score = flowScore;
    if (flowScore >= 70) {
      strengths.push("Strong flow signals");
    } else if (flowScore <= 30) {
      warnings.push("Weak flow support");
    }
  } else if (flowBias) {
    // Use flow bias direction
    const aligned =
      (direction === "call" && flowBias === "bullish") ||
      (direction === "put" && flowBias === "bearish");
    if (aligned) {
      score += 30;
      strengths.push(`Flow ${flowBias} - aligned with direction`);
    } else if (flowBias !== "neutral") {
      score -= 20;
      warnings.push(`Flow ${flowBias} - against direction`);
    }
  }

  return { score: Math.max(0, Math.min(100, score)), warnings, strengths };
}

/**
 * Calculate probability score using delta as proxy
 */
function calculateProbabilityScore(
  contract: Contract,
  config: ContractQualityConfig
): { score: number; warnings: string[]; strengths: string[] } {
  const warnings: string[] = [];
  const strengths: string[] = [];

  const delta = Math.abs(contract.delta ?? 0);
  const { tradeStyle } = config;

  // Delta approximates ITM probability
  const probITM = delta * 100;

  // Score based on trade style expectations
  let score: number;
  if (tradeStyle === "scalp") {
    // Scalps want higher probability (ATM)
    score = Math.min(100, probITM * 1.5);
    if (probITM >= 45) strengths.push("High ITM probability");
    if (probITM < 30) warnings.push("Low ITM probability for scalp");
  } else if (tradeStyle === "day_trade") {
    // Day trades want moderate probability
    score = probITM >= 30 && probITM <= 50 ? 75 : Math.min(100, probITM * 1.2);
    if (probITM >= 35 && probITM <= 50) strengths.push("Good probability range");
  } else {
    // Swings can accept lower probability for higher returns
    score = Math.min(100, probITM * 1.1 + 20);
    if (probITM < 20) warnings.push("Very low probability - speculative");
  }

  return { score: Math.max(0, Math.min(100, score)), warnings, strengths };
}

/**
 * Main function to calculate overall contract quality score
 */
export function calculateContractQuality(
  contract: Contract,
  config: ContractQualityConfig
): ContractQualityResult {
  const liquidityResult = calculateLiquidityScore(contract);
  const greeksFitResult = calculateGreeksFitScore(contract, config);
  const ivValueResult = calculateIVValueScore(contract, config);
  const flowResult = calculateFlowScore(contract, config);
  const probabilityResult = calculateProbabilityScore(contract, config);

  // Calculate weighted overall score
  const overallScore = Math.round(
    liquidityResult.score * WEIGHTS.liquidity +
      greeksFitResult.score * WEIGHTS.greeksFit +
      ivValueResult.score * WEIGHTS.ivValue +
      flowResult.score * WEIGHTS.flow +
      probabilityResult.score * WEIGHTS.probability
  );

  // Determine grade
  let grade: "A" | "B" | "C" | "D" | "F";
  if (overallScore >= 85) grade = "A";
  else if (overallScore >= 70) grade = "B";
  else if (overallScore >= 55) grade = "C";
  else if (overallScore >= 40) grade = "D";
  else grade = "F";

  // Determine recommendation
  let recommendation: "strong_buy" | "buy" | "consider" | "avoid";
  const warningCount = [
    ...liquidityResult.warnings,
    ...greeksFitResult.warnings,
    ...ivValueResult.warnings,
    ...flowResult.warnings,
    ...probabilityResult.warnings,
  ].length;

  if (overallScore >= 80 && warningCount <= 1) {
    recommendation = "strong_buy";
  } else if (overallScore >= 65 && warningCount <= 2) {
    recommendation = "buy";
  } else if (overallScore >= 50 && warningCount <= 3) {
    recommendation = "consider";
  } else {
    recommendation = "avoid";
  }

  return {
    overallScore,
    grade,
    recommendation,
    scores: {
      liquidity: liquidityResult.score,
      greeksFit: greeksFitResult.score,
      ivValue: ivValueResult.score,
      flow: flowResult.score,
      probability: probabilityResult.score,
    },
    warnings: [
      ...liquidityResult.warnings,
      ...greeksFitResult.warnings,
      ...ivValueResult.warnings,
      ...flowResult.warnings,
      ...probabilityResult.warnings,
    ],
    strengths: [
      ...liquidityResult.strengths,
      ...greeksFitResult.strengths,
      ...ivValueResult.strengths,
      ...flowResult.strengths,
      ...probabilityResult.strengths,
    ],
  };
}

/**
 * Rank contracts by quality score
 */
export function rankContractsByQuality(
  contracts: Contract[],
  config: ContractQualityConfig
): Array<{ contract: Contract; quality: ContractQualityResult; rank: number }> {
  const scored = contracts.map((contract) => ({
    contract,
    quality: calculateContractQuality(contract, config),
  }));

  // Sort by overall score descending
  scored.sort((a, b) => b.quality.overallScore - a.quality.overallScore);

  // Add rank
  return scored.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}
