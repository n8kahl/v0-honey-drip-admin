/**
 * ContractRecommendationScorer - Strategy-Aware Contract Selection
 *
 * Maps OpportunityTypes (signals) to optimal contract characteristics:
 * - Gamma squeeze → ATM, high gamma, 0-1 DTE, high volume
 * - Breakout → Slightly OTM, 2-5 DTE, momentum-friendly delta
 * - Mean reversion → ATM, 3-7 DTE for confirmation time
 * - Opening drive → 0DTE, ATM
 * - And more...
 *
 * Each strategy has different contract needs - this scorer ensures
 * the recommended contract aligns with the detected signal type.
 */

import type { Contract } from "../../types";
import type { OpportunityType } from "../composite/OpportunityDetector";

/**
 * Strategy-specific criteria for contract selection
 */
export interface StrategyContractCriteria {
  // Delta preferences
  idealDeltaRange: { min: number; max: number }; // Absolute values
  deltaWeight: number; // How important delta match is (0-1)

  // DTE preferences
  idealDTERange: { min: number; max: number };
  dteWeight: number;

  // Gamma preferences
  preferHighGamma: boolean;
  gammaWeight: number;

  // Liquidity requirements
  minVolume: number;
  minOpenInterest: number;
  maxSpreadPercent: number;
  liquidityWeight: number;

  // Description for UI
  description: string;
  rationale: string;
}

/**
 * Result of scoring a contract for a strategy
 */
export interface ContractRecommendationResult {
  contract: Contract;
  score: number; // 0-100
  strategyFit: "excellent" | "good" | "fair" | "poor";
  isRecommended: boolean; // Top pick for this strategy
  scores: {
    delta: number;
    dte: number;
    gamma: number;
    liquidity: number;
  };
  reasons: string[];
  warnings: string[];
}

/**
 * Strategy-to-criteria mapping
 */
export const STRATEGY_CRITERIA: Record<OpportunityType, StrategyContractCriteria> = {
  // ===== BREAKOUT STRATEGIES =====
  breakout_bullish: {
    idealDeltaRange: { min: 0.35, max: 0.5 }, // Slightly OTM for leverage
    deltaWeight: 0.25,
    idealDTERange: { min: 2, max: 7 }, // Time for breakout to develop
    dteWeight: 0.25,
    preferHighGamma: true, // Want explosive moves
    gammaWeight: 0.2,
    minVolume: 100,
    minOpenInterest: 500,
    maxSpreadPercent: 5,
    liquidityWeight: 0.3,
    description: "Breakout calls",
    rationale:
      "Slightly OTM delta (0.35-0.50) captures breakout leverage. 2-7 DTE provides time for move to develop.",
  },
  breakout_bearish: {
    idealDeltaRange: { min: 0.35, max: 0.5 },
    deltaWeight: 0.25,
    idealDTERange: { min: 2, max: 7 },
    dteWeight: 0.25,
    preferHighGamma: true,
    gammaWeight: 0.2,
    minVolume: 100,
    minOpenInterest: 500,
    maxSpreadPercent: 5,
    liquidityWeight: 0.3,
    description: "Breakout puts",
    rationale:
      "Slightly OTM delta (0.35-0.50) captures breakdown leverage. 2-7 DTE provides time for move.",
  },

  // ===== MEAN REVERSION STRATEGIES =====
  mean_reversion_long: {
    idealDeltaRange: { min: 0.45, max: 0.55 }, // ATM for probability
    deltaWeight: 0.3,
    idealDTERange: { min: 3, max: 10 }, // Time for reversion to play out
    dteWeight: 0.3,
    preferHighGamma: false, // Want stability
    gammaWeight: 0.1,
    minVolume: 100,
    minOpenInterest: 500,
    maxSpreadPercent: 5,
    liquidityWeight: 0.3,
    description: "Mean reversion calls",
    rationale: "ATM delta (0.45-0.55) for higher probability. 3-10 DTE allows time for reversion.",
  },
  mean_reversion_short: {
    idealDeltaRange: { min: 0.45, max: 0.55 },
    deltaWeight: 0.3,
    idealDTERange: { min: 3, max: 10 },
    dteWeight: 0.3,
    preferHighGamma: false,
    gammaWeight: 0.1,
    minVolume: 100,
    minOpenInterest: 500,
    maxSpreadPercent: 5,
    liquidityWeight: 0.3,
    description: "Mean reversion puts",
    rationale: "ATM delta for higher probability. Needs time for reversion to complete.",
  },

  // ===== TREND CONTINUATION STRATEGIES =====
  trend_continuation_long: {
    idealDeltaRange: { min: 0.4, max: 0.55 }, // ATM to slightly OTM
    deltaWeight: 0.25,
    idealDTERange: { min: 5, max: 14 }, // Swingable timeframe
    dteWeight: 0.25,
    preferHighGamma: false, // Prefer time value
    gammaWeight: 0.1,
    minVolume: 100,
    minOpenInterest: 500,
    maxSpreadPercent: 5,
    liquidityWeight: 0.4,
    description: "Trend continuation calls",
    rationale: "Moderate delta for trend following. 5-14 DTE for swing holding period.",
  },
  trend_continuation_short: {
    idealDeltaRange: { min: 0.4, max: 0.55 },
    deltaWeight: 0.25,
    idealDTERange: { min: 5, max: 14 },
    dteWeight: 0.25,
    preferHighGamma: false,
    gammaWeight: 0.1,
    minVolume: 100,
    minOpenInterest: 500,
    maxSpreadPercent: 5,
    liquidityWeight: 0.4,
    description: "Trend continuation puts",
    rationale: "Moderate delta follows downtrend. Longer DTE for swing trades.",
  },

  // ===== GAMMA STRATEGIES - Need HIGH gamma, ATM, SHORT DTE =====
  gamma_squeeze_bullish: {
    idealDeltaRange: { min: 0.48, max: 0.55 }, // ATM for max gamma
    deltaWeight: 0.25,
    idealDTERange: { min: 0, max: 2 }, // 0-2 DTE for gamma exposure
    dteWeight: 0.3,
    preferHighGamma: true, // CRITICAL - this is a gamma play
    gammaWeight: 0.35, // High weight on gamma
    minVolume: 500, // Higher liquidity needed for fast moves
    minOpenInterest: 1000,
    maxSpreadPercent: 3,
    liquidityWeight: 0.1,
    description: "Gamma squeeze calls",
    rationale: "ATM (delta ~0.50) maximizes gamma. 0-2 DTE required for gamma squeeze dynamics.",
  },
  gamma_squeeze_bearish: {
    idealDeltaRange: { min: 0.48, max: 0.55 },
    deltaWeight: 0.25,
    idealDTERange: { min: 0, max: 2 },
    dteWeight: 0.3,
    preferHighGamma: true,
    gammaWeight: 0.35,
    minVolume: 500,
    minOpenInterest: 1000,
    maxSpreadPercent: 3,
    liquidityWeight: 0.1,
    description: "Gamma squeeze puts",
    rationale: "ATM maximizes gamma exposure. Short DTE required for gamma squeeze.",
  },
  gamma_flip_bullish: {
    idealDeltaRange: { min: 0.45, max: 0.55 }, // ATM
    deltaWeight: 0.25,
    idealDTERange: { min: 0, max: 3 }, // Short-term flip
    dteWeight: 0.3,
    preferHighGamma: true,
    gammaWeight: 0.3,
    minVolume: 300,
    minOpenInterest: 800,
    maxSpreadPercent: 4,
    liquidityWeight: 0.15,
    description: "Gamma flip calls",
    rationale: "Gamma flip needs ATM options with short expiry for dealer hedging effect.",
  },
  gamma_flip_bearish: {
    idealDeltaRange: { min: 0.45, max: 0.55 },
    deltaWeight: 0.25,
    idealDTERange: { min: 0, max: 3 },
    dteWeight: 0.3,
    preferHighGamma: true,
    gammaWeight: 0.3,
    minVolume: 300,
    minOpenInterest: 800,
    maxSpreadPercent: 4,
    liquidityWeight: 0.15,
    description: "Gamma flip puts",
    rationale: "Gamma flip needs ATM puts with short expiry.",
  },

  // ===== INTRADAY STRATEGIES - 0DTE focus =====
  opening_drive_bullish: {
    idealDeltaRange: { min: 0.5, max: 0.6 }, // ATM to slightly ITM
    deltaWeight: 0.3,
    idealDTERange: { min: 0, max: 1 }, // 0DTE preferred
    dteWeight: 0.35,
    preferHighGamma: true, // Fast moves
    gammaWeight: 0.25,
    minVolume: 500, // Need good fills during opening
    minOpenInterest: 1000,
    maxSpreadPercent: 2,
    liquidityWeight: 0.1,
    description: "Opening drive calls",
    rationale: "0DTE ATM/ITM for morning momentum. Needs high liquidity for quick fills.",
  },
  opening_drive_bearish: {
    idealDeltaRange: { min: 0.5, max: 0.6 },
    deltaWeight: 0.3,
    idealDTERange: { min: 0, max: 1 },
    dteWeight: 0.35,
    preferHighGamma: true,
    gammaWeight: 0.25,
    minVolume: 500,
    minOpenInterest: 1000,
    maxSpreadPercent: 2,
    liquidityWeight: 0.1,
    description: "Opening drive puts",
    rationale: "0DTE ATM/ITM for morning momentum down.",
  },
  power_hour_reversal_bullish: {
    idealDeltaRange: { min: 0.45, max: 0.55 }, // ATM
    deltaWeight: 0.25,
    idealDTERange: { min: 0, max: 1 }, // Same day or next day
    dteWeight: 0.35,
    preferHighGamma: true,
    gammaWeight: 0.25,
    minVolume: 300,
    minOpenInterest: 500,
    maxSpreadPercent: 3,
    liquidityWeight: 0.15,
    description: "Power hour reversal calls",
    rationale: "0DTE ATM for last hour reversals. Needs gamma for quick move.",
  },
  power_hour_reversal_bearish: {
    idealDeltaRange: { min: 0.45, max: 0.55 },
    deltaWeight: 0.25,
    idealDTERange: { min: 0, max: 1 },
    dteWeight: 0.35,
    preferHighGamma: true,
    gammaWeight: 0.25,
    minVolume: 300,
    minOpenInterest: 500,
    maxSpreadPercent: 3,
    liquidityWeight: 0.15,
    description: "Power hour reversal puts",
    rationale: "0DTE ATM for last hour reversals down.",
  },

  // ===== INDEX-SPECIFIC STRATEGIES =====
  index_mean_reversion_long: {
    idealDeltaRange: { min: 0.4, max: 0.5 }, // Slightly OTM
    deltaWeight: 0.25,
    idealDTERange: { min: 1, max: 5 }, // Short-term reversion
    dteWeight: 0.3,
    preferHighGamma: false,
    gammaWeight: 0.15,
    minVolume: 200,
    minOpenInterest: 1000, // Indices have high OI
    maxSpreadPercent: 3,
    liquidityWeight: 0.3,
    description: "Index reversion calls",
    rationale: "Index mean reversion often completes 1-5 days. Slightly OTM for leverage.",
  },
  index_mean_reversion_short: {
    idealDeltaRange: { min: 0.4, max: 0.5 },
    deltaWeight: 0.25,
    idealDTERange: { min: 1, max: 5 },
    dteWeight: 0.3,
    preferHighGamma: false,
    gammaWeight: 0.15,
    minVolume: 200,
    minOpenInterest: 1000,
    maxSpreadPercent: 3,
    liquidityWeight: 0.3,
    description: "Index reversion puts",
    rationale: "Index mean reversion down. 1-5 DTE timeframe.",
  },

  // ===== PINNING STRATEGY =====
  eod_pin_setup: {
    idealDeltaRange: { min: 0.48, max: 0.52 }, // ATM - pinning happens at strike
    deltaWeight: 0.35, // Very important to be ATM
    idealDTERange: { min: 0, max: 0 }, // 0DTE only
    dteWeight: 0.35,
    preferHighGamma: true, // Max gamma at pin
    gammaWeight: 0.2,
    minVolume: 500,
    minOpenInterest: 2000, // High OI creates pin
    maxSpreadPercent: 2,
    liquidityWeight: 0.1,
    description: "EOD pin setup",
    rationale: "0DTE ATM at high OI strike. Pinning happens where dealer hedging is concentrated.",
  },
};

/**
 * Score how well a contract's delta fits the strategy
 */
function scoreDelta(
  contract: Contract,
  criteria: StrategyContractCriteria
): { score: number; reason: string } {
  const delta = Math.abs(contract.delta ?? 0);
  const { min, max } = criteria.idealDeltaRange;
  const midpoint = (min + max) / 2;

  // Perfect score if within range
  if (delta >= min && delta <= max) {
    const distanceFromMid = Math.abs(delta - midpoint);
    const rangeHalf = (max - min) / 2;
    const score = 100 - (distanceFromMid / rangeHalf) * 20; // 80-100 within range
    return { score, reason: `Delta ${delta.toFixed(2)} is in ideal range` };
  }

  // Score decreases outside range
  const distanceFromRange = delta < min ? min - delta : delta - max;
  const penalty = Math.min(80, distanceFromRange * 200); // Lose ~20 points per 0.10 delta off
  const score = Math.max(0, 80 - penalty);

  if (delta < min) {
    return { score, reason: `Delta ${delta.toFixed(2)} too low (want ${min.toFixed(2)}+)` };
  } else {
    return { score, reason: `Delta ${delta.toFixed(2)} too high (want ≤${max.toFixed(2)})` };
  }
}

/**
 * Score how well a contract's DTE fits the strategy
 */
function scoreDTE(
  contract: Contract,
  criteria: StrategyContractCriteria
): { score: number; reason: string } {
  const dte = contract.daysToExpiry ?? 0;
  const { min, max } = criteria.idealDTERange;
  const midpoint = (min + max) / 2;

  // Perfect score if within range
  if (dte >= min && dte <= max) {
    if (max === min) return { score: 100, reason: `${dte}DTE matches requirement` };
    const distanceFromMid = Math.abs(dte - midpoint);
    const rangeHalf = Math.max(1, (max - min) / 2);
    const score = 100 - (distanceFromMid / rangeHalf) * 15; // 85-100 within range
    return { score, reason: `${dte}DTE is in ideal range` };
  }

  // Score decreases outside range
  if (dte < min) {
    const daysShort = min - dte;
    const penalty = Math.min(70, daysShort * 15); // Lose ~15 points per day short
    return { score: Math.max(0, 85 - penalty), reason: `${dte}DTE too short (want ${min}+)` };
  } else {
    const daysLong = dte - max;
    const penalty = Math.min(60, daysLong * 8); // Lose ~8 points per day long
    return { score: Math.max(0, 85 - penalty), reason: `${dte}DTE too long (want ≤${max})` };
  }
}

/**
 * Score gamma characteristics
 */
function scoreGamma(
  contract: Contract,
  criteria: StrategyContractCriteria
): { score: number; reason: string } {
  const gamma = Math.abs(contract.gamma ?? 0);

  if (!criteria.preferHighGamma) {
    // Strategy doesn't need high gamma - give neutral score unless extremely high
    if (gamma > 0.08) {
      return { score: 60, reason: "Very high gamma (may be too volatile)" };
    }
    return { score: 75, reason: "Gamma acceptable" };
  }

  // Strategy wants high gamma
  if (gamma >= 0.04) {
    return { score: 100, reason: `High gamma (${gamma.toFixed(3)}) - excellent for strategy` };
  } else if (gamma >= 0.02) {
    return { score: 80, reason: `Good gamma (${gamma.toFixed(3)})` };
  } else if (gamma >= 0.01) {
    return { score: 60, reason: `Moderate gamma (${gamma.toFixed(3)})` };
  } else {
    return { score: 30, reason: `Low gamma (${gamma.toFixed(3)}) - strategy needs more` };
  }
}

/**
 * Score liquidity characteristics
 */
function scoreLiquidity(
  contract: Contract,
  criteria: StrategyContractCriteria
): { score: number; reason: string; warning?: string } {
  let score = 50; // Start neutral
  const reasons: string[] = [];
  let warning: string | undefined;

  const { volume, openInterest, bid, ask, mid } = contract;
  const spreadPct = mid > 0 ? ((ask - bid) / mid) * 100 : 100;

  // Volume check
  if (volume >= criteria.minVolume * 3) {
    score += 20;
    reasons.push("excellent volume");
  } else if (volume >= criteria.minVolume) {
    score += 12;
    reasons.push("good volume");
  } else if (volume >= criteria.minVolume * 0.5) {
    score += 5;
  } else {
    score -= 15;
    warning = `Low volume (${volume} vs ${criteria.minVolume} needed)`;
  }

  // Open interest check
  if (openInterest >= criteria.minOpenInterest * 2) {
    score += 20;
    reasons.push("deep OI");
  } else if (openInterest >= criteria.minOpenInterest) {
    score += 12;
    reasons.push("good OI");
  } else if (openInterest >= criteria.minOpenInterest * 0.5) {
    score += 5;
  } else {
    score -= 15;
    warning = warning || `Low open interest (${openInterest})`;
  }

  // Spread check
  if (spreadPct <= criteria.maxSpreadPercent * 0.5) {
    score += 15;
    reasons.push("tight spread");
  } else if (spreadPct <= criteria.maxSpreadPercent) {
    score += 8;
  } else if (spreadPct <= criteria.maxSpreadPercent * 1.5) {
    score -= 5;
  } else {
    score -= 20;
    warning = warning || `Wide spread (${spreadPct.toFixed(1)}%)`;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reason: reasons.length > 0 ? reasons.join(", ") : "adequate liquidity",
    warning,
  };
}

/**
 * Score a single contract for a specific strategy
 */
export function scoreContractForStrategy(
  contract: Contract,
  strategy: OpportunityType
): ContractRecommendationResult {
  const criteria = STRATEGY_CRITERIA[strategy];
  if (!criteria) {
    // Unknown strategy - return neutral score
    return {
      contract,
      score: 50,
      strategyFit: "fair",
      isRecommended: false,
      scores: { delta: 50, dte: 50, gamma: 50, liquidity: 50 },
      reasons: ["Unknown strategy type"],
      warnings: [],
    };
  }

  const deltaResult = scoreDelta(contract, criteria);
  const dteResult = scoreDTE(contract, criteria);
  const gammaResult = scoreGamma(contract, criteria);
  const liquidityResult = scoreLiquidity(contract, criteria);

  // Weighted overall score
  const overallScore = Math.round(
    deltaResult.score * criteria.deltaWeight +
      dteResult.score * criteria.dteWeight +
      gammaResult.score * criteria.gammaWeight +
      liquidityResult.score * criteria.liquidityWeight
  );

  // Collect reasons and warnings
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (deltaResult.score >= 80) reasons.push(deltaResult.reason);
  else if (deltaResult.score < 60) warnings.push(deltaResult.reason);

  if (dteResult.score >= 80) reasons.push(dteResult.reason);
  else if (dteResult.score < 60) warnings.push(dteResult.reason);

  if (gammaResult.score >= 80) reasons.push(gammaResult.reason);
  else if (gammaResult.score < 50 && criteria.preferHighGamma) warnings.push(gammaResult.reason);

  if (liquidityResult.warning) warnings.push(liquidityResult.warning);
  else if (liquidityResult.score >= 70) reasons.push(liquidityResult.reason);

  // Determine fit level
  let strategyFit: "excellent" | "good" | "fair" | "poor";
  if (overallScore >= 85) strategyFit = "excellent";
  else if (overallScore >= 70) strategyFit = "good";
  else if (overallScore >= 50) strategyFit = "fair";
  else strategyFit = "poor";

  return {
    contract,
    score: overallScore,
    strategyFit,
    isRecommended: false, // Set by ranking function
    scores: {
      delta: deltaResult.score,
      dte: dteResult.score,
      gamma: gammaResult.score,
      liquidity: liquidityResult.score,
    },
    reasons,
    warnings,
  };
}

/**
 * Rank all contracts for a strategy and mark the best one(s)
 */
export function rankContractsForStrategy(
  contracts: Contract[],
  strategy: OpportunityType,
  direction: "call" | "put"
): ContractRecommendationResult[] {
  // Filter by direction
  const filteredContracts = contracts.filter((c) =>
    direction === "call" ? c.type === "C" : c.type === "P"
  );

  // Score all contracts
  const scored = filteredContracts.map((contract) => scoreContractForStrategy(contract, strategy));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Mark top contracts as recommended
  if (scored.length > 0) {
    scored[0].isRecommended = true;
    // If there's a close second, also mark it
    if (scored.length > 1 && scored[1].score >= scored[0].score - 5) {
      scored[1].isRecommended = true;
    }
  }

  return scored;
}

/**
 * Get the best contract for a strategy
 */
export function getBestContractForStrategy(
  contracts: Contract[],
  strategy: OpportunityType,
  direction: "call" | "put"
): ContractRecommendationResult | null {
  const ranked = rankContractsForStrategy(contracts, strategy, direction);
  return ranked.length > 0 ? ranked[0] : null;
}

/**
 * Get strategy criteria description (for UI)
 */
export function getStrategyCriteriaDescription(strategy: OpportunityType): {
  description: string;
  rationale: string;
  idealDelta: string;
  idealDTE: string;
  needsHighGamma: boolean;
} {
  const criteria = STRATEGY_CRITERIA[strategy];
  if (!criteria) {
    return {
      description: "Unknown strategy",
      rationale: "",
      idealDelta: "N/A",
      idealDTE: "N/A",
      needsHighGamma: false,
    };
  }

  return {
    description: criteria.description,
    rationale: criteria.rationale,
    idealDelta: `${criteria.idealDeltaRange.min.toFixed(2)}-${criteria.idealDeltaRange.max.toFixed(2)}`,
    idealDTE:
      criteria.idealDTERange.min === criteria.idealDTERange.max
        ? `${criteria.idealDTERange.min}DTE`
        : `${criteria.idealDTERange.min}-${criteria.idealDTERange.max}DTE`,
    needsHighGamma: criteria.preferHighGamma,
  };
}
