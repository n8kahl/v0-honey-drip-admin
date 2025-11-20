import type { OptionContract } from './options-advanced';
import type { TradeTape } from './options-advanced';

/**
 * Contract recommendation engine for SPX/NDX 0DTE options trading
 * Scores contracts based on Greeks, flow, liquidity, and probability of profit
 */

export interface ContractScore {
  ticker: string;
  score: number; // 0-100 overall recommendation score
  rank: number; // 1-based ranking within the chain
  recommendation: 'strong_buy' | 'buy' | 'consider' | 'avoid';
  reasons: string[]; // Human-readable reasons for the score
  warnings: string[]; // Risk warnings
  metrics: {
    flowScore: number;
    liquidityScore: number;
    greeksScore: number;
    valueScore: number;
    probabilityScore: number;
  };
}

export interface RecommendationConfig {
  // Strategy bias
  direction: 'bullish' | 'bearish' | 'neutral';
  timeHorizon: '0dte' | 'same_day' | 'next_day' | 'weekly' | 'monthly';

  // Risk tolerance
  riskProfile: 'conservative' | 'moderate' | 'aggressive';

  // Position type
  positionType: 'long' | 'short' | 'spread';

  // Delta preferences (for directional trades)
  minDelta?: number; // e.g., 0.30 for moderate OTM
  maxDelta?: number; // e.g., 0.70 for near ATM

  // Liquidity requirements
  minVolume?: number;
  minOpenInterest?: number;
  maxSpreadPercent?: number;

  // Price constraints
  minPremium?: number;
  maxPremium?: number;
}

export interface ContractWithFlow extends OptionContract {
  flow?: TradeTape;
}

/**
 * Calculate gamma risk level based on absolute gamma value
 * High gamma = explosive moves near ATM (risk + opportunity for 0DTE)
 */
export function calculateGammaRisk(gamma: number | undefined, delta: number | undefined): 'high' | 'medium' | 'low' {
  if (!gamma) return 'low';
  const absGamma = Math.abs(gamma);

  // For ATM options (delta ~0.5), gamma is highest
  const absDelta = delta ? Math.abs(delta) : 0.5;
  const isNearATM = absDelta >= 0.40 && absDelta <= 0.60;

  if (absGamma > 0.05 && isNearATM) return 'high';
  if (absGamma > 0.03 || isNearATM) return 'medium';
  return 'low';
}

/**
 * Calculate theta decay rate for time-sensitive strategies
 * 0DTE options decay exponentially in final hours
 */
export function calculateThetaDecayRate(
  theta: number | undefined,
  dte: number,
  hoursToExpiry: number
): 'extreme' | 'high' | 'moderate' | 'low' {
  if (!theta || dte > 0) return 'low'; // Not 0DTE

  const absTheta = Math.abs(theta);

  // 0DTE options decay rapidly in final hours
  if (hoursToExpiry < 1) return 'extreme'; // <1 hour: 50%+ decay per hour
  if (hoursToExpiry < 2) return 'high';    // 1-2 hours: 25-50% decay
  if (hoursToExpiry < 4) return 'moderate'; // 2-4 hours: 10-25% decay
  return 'low'; // >4 hours on 0DTE
}

/**
 * Score contract based on options flow (sweeps, blocks, unusual activity)
 */
function scoreFlow(contract: ContractWithFlow, config: RecommendationConfig): { score: number; reasons: string[] } {
  const flow = contract.flow;
  if (!flow) return { score: 50, reasons: [] };

  let score = 50; // Neutral baseline
  const reasons: string[] = [];

  // Sweep activity indicates smart money (high conviction)
  if (flow.sweepCount > 0) {
    score += 15;
    reasons.push(`${flow.sweepCount} sweep${flow.sweepCount > 1 ? 's' : ''} detected (smart money)`);
  }

  // Block trades indicate institutional interest
  if (flow.blockCount > 0) {
    score += 12;
    reasons.push(`${flow.blockCount} block trade${flow.blockCount > 1 ? 's' : ''} (institutional)`);
  }

  // Unusual activity suggests significant move expected
  if (flow.unusualActivity) {
    score += 10;
    reasons.push('Unusual volume activity detected');
  }

  // Flow bias alignment with strategy direction
  const flowAligned =
    (config.direction === 'bullish' && flow.flowBias === 'bullish') ||
    (config.direction === 'bearish' && flow.flowBias === 'bearish');

  if (flowAligned) {
    score += 10;
    reasons.push(`Flow bias (${flow.flowBias}) aligns with strategy`);
  } else if (config.direction !== 'neutral' && flow.flowBias !== 'neutral' && !flowAligned) {
    score -= 15;
    reasons.push(`⚠️ Flow bias (${flow.flowBias}) opposes strategy direction`);
  }

  // Buy pressure for directional trades
  if (config.direction === 'bullish' && flow.buyPressure > 60) {
    score += 5;
    reasons.push(`Strong buy pressure (${flow.buyPressure.toFixed(0)}%)`);
  } else if (config.direction === 'bearish' && flow.buyPressure < 40) {
    score += 5;
    reasons.push(`Strong sell pressure (${(100 - flow.buyPressure).toFixed(0)}%)`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/**
 * Score contract liquidity (spread, volume, OI)
 */
function scoreLiquidity(contract: OptionContract, config: RecommendationConfig): { score: number; reasons: string[]; warnings: string[] } {
  const bid = contract.last_quote?.bid ?? contract.last_quote?.bp ?? 0;
  const ask = contract.last_quote?.ask ?? contract.last_quote?.ap ?? 0;
  const volume = contract.day?.volume ?? contract.volume ?? 0;
  const oi = contract.day?.open_interest ?? contract.open_interest ?? 0;

  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
  const spread = ask - bid;
  const spreadPercent = mid > 0 ? (spread / mid) * 100 : 100;

  let score = 50;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Spread scoring (tighter is better)
  if (spreadPercent <= 1) {
    score += 20;
    reasons.push('Excellent spread (<1%)');
  } else if (spreadPercent <= 3) {
    score += 10;
    reasons.push('Good spread (1-3%)');
  } else if (spreadPercent <= 5) {
    score += 0;
    reasons.push('Fair spread (3-5%)');
  } else {
    score -= 15;
    warnings.push(`Wide spread (${spreadPercent.toFixed(1)}%)`);
  }

  // Volume scoring
  const minVol = config.minVolume ?? 500;
  if (volume >= minVol * 2) {
    score += 15;
    reasons.push(`High volume (${volume})`);
  } else if (volume >= minVol) {
    score += 5;
    reasons.push(`Adequate volume (${volume})`);
  } else {
    score -= 10;
    warnings.push(`Low volume (${volume}, min ${minVol})`);
  }

  // Open interest scoring
  const minOI = config.minOpenInterest ?? 1000;
  if (oi >= minOI * 5) {
    score += 15;
    reasons.push(`Excellent OI (${oi})`);
  } else if (oi >= minOI) {
    score += 5;
  } else {
    score -= 10;
    warnings.push(`Low open interest (${oi}, min ${minOI})`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, warnings };
}

/**
 * Score contract based on Greeks (delta, gamma, theta, vega)
 */
function scoreGreeks(contract: OptionContract, config: RecommendationConfig, hoursToExpiry: number): { score: number; reasons: string[]; warnings: string[] } {
  const greeks = contract.greeks;
  if (!greeks) return { score: 50, reasons: [], warnings: [] };

  const delta = greeks.delta ?? 0;
  const gamma = greeks.gamma ?? 0;
  const theta = greeks.theta ?? 0;
  const vega = greeks.vega ?? 0;

  let score = 50;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const absDelta = Math.abs(delta);
  const isCall = contract.contract_type === 'call';

  // Delta scoring based on direction and position type
  if (config.direction === 'bullish' && isCall) {
    // For bullish calls, prefer moderate OTM to ATM
    if (delta >= 0.30 && delta <= 0.60) {
      score += 15;
      reasons.push(`Optimal delta (${delta.toFixed(2)}) for bullish call`);
    } else if (delta > 0.60) {
      score += 5;
      reasons.push(`High delta (${delta.toFixed(2)}) - ITM call`);
    }
  } else if (config.direction === 'bearish' && !isCall) {
    // For bearish puts, prefer moderate OTM to ATM
    if (absDelta >= 0.30 && absDelta <= 0.60) {
      score += 15;
      reasons.push(`Optimal delta (${delta.toFixed(2)}) for bearish put`);
    } else if (absDelta > 0.60) {
      score += 5;
      reasons.push(`High delta (${Math.abs(delta).toFixed(2)}) - ITM put`);
    }
  }

  // Apply user delta constraints if specified
  if (config.minDelta && absDelta < config.minDelta) {
    score -= 20;
    warnings.push(`Delta ${absDelta.toFixed(2)} below minimum ${config.minDelta.toFixed(2)}`);
  }
  if (config.maxDelta && absDelta > config.maxDelta) {
    score -= 20;
    warnings.push(`Delta ${absDelta.toFixed(2)} above maximum ${config.maxDelta.toFixed(2)}`);
  }

  // Gamma scoring (high gamma = high risk/reward for 0DTE)
  const gammaRisk = calculateGammaRisk(gamma, delta);
  if (config.timeHorizon === '0dte') {
    if (gammaRisk === 'high' && config.riskProfile === 'aggressive') {
      score += 10;
      reasons.push('High gamma (explosive potential for 0DTE)');
    } else if (gammaRisk === 'high' && config.riskProfile === 'conservative') {
      score -= 10;
      warnings.push('High gamma risk (volatile for 0DTE)');
    }
  }

  // Theta decay warnings for long positions
  if (config.positionType === 'long' && config.timeHorizon === '0dte') {
    const decayRate = calculateThetaDecayRate(theta, 0, hoursToExpiry);
    if (decayRate === 'extreme') {
      score -= 15;
      warnings.push('⚠️ EXTREME theta decay (<1 hour to expiry)');
    } else if (decayRate === 'high') {
      score -= 5;
      warnings.push('High theta decay (1-2 hours to expiry)');
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, warnings };
}

/**
 * Score contract value (premium relative to expected move)
 */
function scoreValue(contract: OptionContract, config: RecommendationConfig): { score: number; reasons: string[] } {
  const bid = contract.last_quote?.bid ?? contract.last_quote?.bp ?? 0;
  const ask = contract.last_quote?.ask ?? contract.last_quote?.ap ?? 0;
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;

  let score = 50;
  const reasons: string[] = [];

  // Premium range checks
  if (config.minPremium && mid < config.minPremium) {
    score -= 20;
    reasons.push(`Premium $${mid.toFixed(2)} below minimum $${config.minPremium.toFixed(2)}`);
  }
  if (config.maxPremium && mid > config.maxPremium) {
    score -= 20;
    reasons.push(`Premium $${mid.toFixed(2)} above maximum $${config.maxPremium.toFixed(2)}`);
  }

  // Relative value based on IV (if available)
  const iv = contract.implied_volatility;
  if (iv) {
    // For 0DTE, prefer lower IV for long positions (cheaper entry)
    if (config.positionType === 'long' && config.timeHorizon === '0dte') {
      if (iv < 0.20) {
        score += 10;
        reasons.push('Low IV (good value for long)');
      } else if (iv > 0.40) {
        score -= 5;
        reasons.push('High IV (expensive for long)');
      }
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/**
 * Score probability of profit based on strike distance and delta
 */
function scoreProbability(contract: OptionContract, underlyingPrice: number, config: RecommendationConfig): { score: number; reasons: string[] } {
  const strike = contract.strike_price ?? 0;
  const delta = contract.greeks?.delta ?? 0;
  const isCall = contract.contract_type === 'call';

  let score = 50;
  const reasons: string[] = [];

  // Distance to strike as % of underlying
  const distancePercent = Math.abs((strike - underlyingPrice) / underlyingPrice) * 100;

  // For 0DTE, strikes within 1% have highest probability
  if (config.timeHorizon === '0dte') {
    if (distancePercent < 0.5) {
      score += 15;
      reasons.push(`Strike within 0.5% of underlying (high probability)`);
    } else if (distancePercent < 1.0) {
      score += 10;
      reasons.push(`Strike within 1% of underlying`);
    } else if (distancePercent > 2.0) {
      score -= 10;
      reasons.push(`Strike ${distancePercent.toFixed(1)}% away (lower probability)`);
    }
  }

  // Delta-based probability (delta approximates ITM probability)
  const absDelta = Math.abs(delta);
  if (absDelta > 0.60) {
    reasons.push(`~${(absDelta * 100).toFixed(0)}% probability ITM`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/**
 * Recommend best contracts from an options chain
 * Returns sorted array with top contracts highlighted
 */
export function recommendContracts(
  contracts: ContractWithFlow[],
  underlyingPrice: number,
  config: RecommendationConfig,
  hoursToExpiry: number = 6.5
): ContractScore[] {
  const scores: ContractScore[] = [];

  // Calculate hours to expiry from market close (4pm ET)
  const effectiveHours = config.timeHorizon === '0dte' ? hoursToExpiry : 24;

  for (const contract of contracts) {
    // Skip if wrong type
    const isCall = contract.contract_type === 'call';
    if (config.direction === 'bullish' && !isCall) continue;
    if (config.direction === 'bearish' && isCall) continue;

    const allReasons: string[] = [];
    const allWarnings: string[] = [];

    // Score each dimension
    const flowResult = scoreFlow(contract, config);
    const liquidityResult = scoreLiquidity(contract, config);
    const greeksResult = scoreGreeks(contract, config, effectiveHours);
    const valueResult = scoreValue(contract, config);
    const probabilityResult = scoreProbability(contract, underlyingPrice, config);

    allReasons.push(...flowResult.reasons);
    allReasons.push(...liquidityResult.reasons);
    allReasons.push(...greeksResult.reasons);
    allReasons.push(...valueResult.reasons);
    allReasons.push(...probabilityResult.reasons);

    allWarnings.push(...liquidityResult.warnings);
    allWarnings.push(...greeksResult.warnings);

    // Weighted overall score
    const weights = {
      flow: 0.25,        // 25% - Flow is critical for 0DTE
      liquidity: 0.25,   // 25% - Must be able to enter/exit
      greeks: 0.25,      // 25% - Risk/reward profile
      value: 0.10,       // 10% - Premium value
      probability: 0.15, // 15% - Probability of profit
    };

    const overallScore =
      flowResult.score * weights.flow +
      liquidityResult.score * weights.liquidity +
      greeksResult.score * weights.greeks +
      valueResult.score * weights.value +
      probabilityResult.score * weights.probability;

    // Recommendation tier
    let recommendation: ContractScore['recommendation'];
    if (overallScore >= 75 && allWarnings.length === 0) {
      recommendation = 'strong_buy';
    } else if (overallScore >= 60) {
      recommendation = 'buy';
    } else if (overallScore >= 45) {
      recommendation = 'consider';
    } else {
      recommendation = 'avoid';
    }

    scores.push({
      ticker: contract.ticker,
      score: Math.round(overallScore),
      rank: 0, // Will be set after sorting
      recommendation,
      reasons: allReasons,
      warnings: allWarnings,
      metrics: {
        flowScore: Math.round(flowResult.score),
        liquidityScore: Math.round(liquidityResult.score),
        greeksScore: Math.round(greeksResult.score),
        valueScore: Math.round(valueResult.score),
        probabilityScore: Math.round(probabilityResult.score),
      },
    });
  }

  // Sort by score descending and assign ranks
  scores.sort((a, b) => b.score - a.score);
  scores.forEach((s, i) => { s.rank = i + 1; });

  return scores;
}

/**
 * Get default config for SPX 0DTE day trading
 */
export function getDefaultSPX0DTEConfig(direction: 'bullish' | 'bearish' | 'neutral'): RecommendationConfig {
  return {
    direction,
    timeHorizon: '0dte',
    riskProfile: 'moderate',
    positionType: 'long',
    minDelta: 0.25,  // Moderate OTM
    maxDelta: 0.65,  // Near ATM
    minVolume: 1000,
    minOpenInterest: 5000,
    maxSpreadPercent: 3,
    minPremium: 1.0,  // $1 minimum (avoid lottery tickets)
    maxPremium: 50.0, // $50 maximum (avoid deep ITM)
  };
}

/**
 * Get default config for NDX 0DTE day trading
 */
export function getDefaultNDX0DTEConfig(direction: 'bullish' | 'bearish' | 'neutral'): RecommendationConfig {
  return {
    direction,
    timeHorizon: '0dte',
    riskProfile: 'moderate',
    positionType: 'long',
    minDelta: 0.25,
    maxDelta: 0.65,
    minVolume: 500,   // NDX has lower volume than SPX
    minOpenInterest: 2000,
    maxSpreadPercent: 5, // NDX spreads tend to be wider
    minPremium: 2.0,
    maxPremium: 100.0,
  };
}
