import {
  RiskCalculationInput,
  RiskCalculationResult,
  AdminRiskDefaults,
  KeyLevels,
  LevelCandidate,
  TradeType,
} from './types';
import {
  RISK_PROFILES,
  inferTradeTypeByDTE,
  DEFAULT_DTE_THRESHOLDS,
  RiskProfile,
} from './profiles';

import { evaluateContractLiquidity, OptionsSnapshot } from '../massive/options-advanced';

/**
 * Calculate TP/SL using percent mode
 */
function calculatePercentMode(input: RiskCalculationInput): RiskCalculationResult {
  const { entryPrice, defaults, expirationISO } = input;
  const tpPercent = defaults.tpPercent || 50;
  const slPercent = defaults.slPercent || 20;

  const targetPrice = entryPrice * (1 + tpPercent / 100);
  const stopLoss = entryPrice * (1 - slPercent / 100);

  const riskAmount = entryPrice - stopLoss;
  const rewardAmount = targetPrice - entryPrice;
  const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;

  // Infer trade type if expiration provided
  let tradeType: TradeType | undefined;
  let dte: number | undefined;
  if (expirationISO) {
    tradeType = inferTradeTypeByDTE(expirationISO, new Date(), defaults.dteThresholds);
    const expiration = new Date(expirationISO);
    dte = Math.max(0, Math.floor((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  return {
    targetPrice,
    stopLoss,
    riskRewardRatio,
    confidence: 'medium',
    reasoning: `Percent-based: +${tpPercent}% target, -${slPercent}% stop`,
    calculatedAt: Date.now(),
    usedLevels: ['percent'],
    tradeType,
    dte,
  };
}

/**
 * Project TP/SL levels based on profile and key levels
 */
function projectLevels(
  entryPrice: number,
  direction: 'long' | 'short',
  keyLevels: KeyLevels,
  profile: RiskProfile,
  atr: number
): {
  tpCandidates: LevelCandidate[];
  slCandidates: LevelCandidate[];
} {
  const tpCandidates: LevelCandidate[] = [];
  const slCandidates: LevelCandidate[] = [];

  // Build level map
  const levelMap: Record<string, number | undefined> = {
    PremarketHL: direction === 'long' ? keyLevels.preMarketHigh : keyLevels.preMarketLow,
    ORB: direction === 'long' ? keyLevels.orbHigh : keyLevels.orbLow,
    VWAP: keyLevels.vwap,
    VWAPBands: direction === 'long' ? keyLevels.vwapUpperBand : keyLevels.vwapLowerBand,
    PrevDayHL: direction === 'long' ? keyLevels.priorDayHigh : keyLevels.priorDayLow,
    WeeklyHL: direction === 'long' ? keyLevels.weeklyHigh : keyLevels.weeklyLow,
    MonthlyHL: direction === 'long' ? keyLevels.monthlyHigh : keyLevels.monthlyLow,
    QuarterlyHL: direction === 'long' ? keyLevels.quarterlyHigh : keyLevels.quarterlyLow,
    YearlyHL: direction === 'long' ? keyLevels.yearlyHigh : keyLevels.yearlyLow,
    Boll20: direction === 'long' ? keyLevels.bollingerUpper : keyLevels.bollingerLower,
  };

  // Filter to profile's used levels
  for (const levelName of profile.useLevels) {
    const price = levelMap[levelName];
    if (!price || price === 0) continue;

    const weight = profile.levelWeights[levelName] || 0;
    const distance = Math.abs(price - entryPrice);

    // TP candidates: above entry for long, below for short
    if (
      (direction === 'long' && price > entryPrice) ||
      (direction === 'short' && price < entryPrice)
    ) {
      // Within ATR budget
      const maxTP = atr * profile.tpATRFrac[1];
      if (distance <= maxTP) {
        tpCandidates.push({ price, reason: levelName, weight, distance });
      }
    }

    // SL candidates: below entry for long, above for short
    if (
      (direction === 'long' && price < entryPrice) ||
      (direction === 'short' && price > entryPrice)
    ) {
      // Within ATR budget
      const maxSL = atr * profile.slATRFrac;
      if (distance <= maxSL) {
        slCandidates.push({ price, reason: levelName, weight, distance });
      }
    }
  }

  // Add ATR-based candidates
  if (direction === 'long') {
    tpCandidates.push({
      price: entryPrice + atr * profile.tpATRFrac[0],
      reason: `ATR (${profile.tpATRFrac[0]}x)`,
      weight: 0.8,
      distance: atr * profile.tpATRFrac[0],
    });
    tpCandidates.push({
      price: entryPrice + atr * profile.tpATRFrac[1],
      reason: `ATR (${profile.tpATRFrac[1]}x)`,
      weight: 0.6,
      distance: atr * profile.tpATRFrac[1],
    });
    slCandidates.push({
      price: entryPrice - atr * profile.slATRFrac,
      reason: `ATR (${profile.slATRFrac}x)`,
      weight: 0.7,
      distance: atr * profile.slATRFrac,
    });
  } else {
    tpCandidates.push({
      price: entryPrice - atr * profile.tpATRFrac[0],
      reason: `ATR (${profile.tpATRFrac[0]}x)`,
      weight: 0.8,
      distance: atr * profile.tpATRFrac[0],
    });
    tpCandidates.push({
      price: entryPrice - atr * profile.tpATRFrac[1],
      reason: `ATR (${profile.tpATRFrac[1]}x)`,
      weight: 0.6,
      distance: atr * profile.tpATRFrac[1],
    });
    slCandidates.push({
      price: entryPrice + atr * profile.slATRFrac,
      reason: `ATR (${profile.slATRFrac}x)`,
      weight: 0.7,
      distance: atr * profile.slATRFrac,
    });
  }

  // Sort by weight desc, then distance asc
  tpCandidates.sort((a, b) => b.weight - a.weight || a.distance - b.distance);
  slCandidates.sort((a, b) => b.weight - a.weight || a.distance - b.distance);

  return { tpCandidates, slCandidates };
}

/**
 * Map underlying move to option premium using delta + gamma
 */
function mapUnderlyingMoveToOptionPremium(
  underlyingMove: number,
  currentOptionMid: number,
  delta: number = 0.5,
  gamma: number = 0,
  tradeType: TradeType
): number {
  // For SCALP/DAY, include gamma
  if (tradeType === 'SCALP' || tradeType === 'DAY') {
    return currentOptionMid + delta * underlyingMove + 0.5 * gamma * underlyingMove * underlyingMove;
  }
  // For SWING/LEAP, use delta only (gamma negligible)
  return currentOptionMid + delta * underlyingMove;
}

/**
 * Calculate TP/SL using calculated mode with DTE-aware profiles
 */
function calculateCalculatedMode(input: RiskCalculationInput): RiskCalculationResult {
  const {
    entryPrice,
    currentUnderlyingPrice,
    currentOptionMid,
    keyLevels,
    atr = 0,
    defaults,
    delta = 0.5,
    gamma = 0,
    expirationISO,
  } = input;

  // Infer trade type from DTE
  let tradeType: TradeType = input.tradeType || 'DAY';
  let dte = 0;
  if (expirationISO) {
    tradeType = inferTradeTypeByDTE(
      expirationISO,
      new Date(),
      defaults.dteThresholds || DEFAULT_DTE_THRESHOLDS
    );
    const expiration = new Date(expirationISO);
    dte = Math.max(0, Math.floor((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  const profile = RISK_PROFILES[tradeType];
  const direction: 'long' | 'short' = 'long'; // Assume long for options
  const usedLevels: string[] = [];

  let liquidityQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
  let liquidityWarnings: string[] = [];
  
  if (currentOptionMid > 0) {
    const snapshot: OptionsSnapshot = {
      ticker: '', // Not needed for evaluation
      bid: currentOptionMid * 0.98,
      bidSize: 0,
      ask: currentOptionMid * 1.02,
      askSize: 0,
      last: currentOptionMid,
      openInterest: 0,
      volume: 0,
      implied_volatility: 0,
      underlying_price: currentUnderlyingPrice,
    };
    
    const liquidity = evaluateContractLiquidity(snapshot, {
      maxSpreadPercent: 15,
      minVolume: 30,
      minOI: 50,
      minPrice: 0.05,
      maxPrice: 50,
      minBidSize: 5,
      minAskSize: 5,
    });
    
    liquidityQuality = liquidity.quality;
    liquidityWarnings = liquidity.warnings;
    
    if (liquidityWarnings.length > 0) {
      console.warn('[RiskEngine] Liquidity warnings:', liquidityWarnings);
    }
  }

  // Project levels
  const { tpCandidates, slCandidates } = projectLevels(
    currentUnderlyingPrice,
    direction,
    keyLevels,
    profile,
    atr || 1.0
  );

  // Choose best TP1 (highest weight, closest confluence)
  let targetPrice = currentUnderlyingPrice;
  let targetReasoning = 'Default';
  let targetPremium = currentOptionMid * 1.5;
  let targetPrice2: number | undefined;
  let targetPremium2: number | undefined;

  if (tpCandidates.length > 0) {
    const tp1 = tpCandidates[0];
    targetPrice = tp1.price;
    targetReasoning = tp1.reason;
    usedLevels.push(tp1.reason);

    // Calculate option premium for TP1
    const underlyingMove = targetPrice - currentUnderlyingPrice;
    targetPremium = mapUnderlyingMoveToOptionPremium(
      underlyingMove,
      currentOptionMid,
      delta,
      gamma,
      tradeType
    );

    // TP2 if available
    if (tpCandidates.length > 1) {
      const tp2 = tpCandidates[1];
      targetPrice2 = tp2.price;
      const underlyingMove2 = targetPrice2 - currentUnderlyingPrice;
      targetPremium2 = mapUnderlyingMoveToOptionPremium(
        underlyingMove2,
        currentOptionMid,
        delta,
        gamma,
        tradeType
      );
    }
  } else {
    // Fallback
    targetPrice = currentUnderlyingPrice + (atr || 1.0) * profile.tpATRFrac[0];
    const underlyingMove = targetPrice - currentUnderlyingPrice;
    targetPremium = mapUnderlyingMoveToOptionPremium(
      underlyingMove,
      currentOptionMid,
      delta,
      gamma,
      tradeType
    );
  }

  // Choose best SL (highest weight, closest support)
  let stopLoss = currentUnderlyingPrice;
  let stopReasoning = 'Default';
  let stopLossPremium = currentOptionMid * 0.5;

  if (slCandidates.length > 0) {
    const sl = slCandidates[0];
    stopLoss = sl.price;
    stopReasoning = sl.reason;
    usedLevels.push(sl.reason);

    // Calculate option premium for SL
    const underlyingMove = stopLoss - currentUnderlyingPrice;
    stopLossPremium = mapUnderlyingMoveToOptionPremium(
      underlyingMove,
      currentOptionMid,
      delta,
      gamma,
      tradeType
    );
  } else {
    // Fallback
    stopLoss = currentUnderlyingPrice - (atr || 1.0) * profile.slATRFrac;
    const underlyingMove = stopLoss - currentUnderlyingPrice;
    stopLossPremium = mapUnderlyingMoveToOptionPremium(
      underlyingMove,
      currentOptionMid,
      delta,
      gamma,
      tradeType
    );
  }

  const riskAmount = currentUnderlyingPrice - stopLoss;
  const rewardAmount = targetPrice - currentUnderlyingPrice;
  const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  const confluenceLevels = usedLevels.filter((l) => !l.includes('ATR'));
  if (confluenceLevels.length >= 2) {
    confidence = 'high';
  } else if (confluenceLevels.length === 0) {
    confidence = 'low';
  }

  return {
    targetPrice,
    stopLoss,
    targetPrice2,
    targetPremium,
    targetPremium2,
    stopLossPremium,
    riskRewardRatio,
    confidence,
    reasoning: `${tradeType}: TP=${targetReasoning}, SL=${stopReasoning}`,
    calculatedAt: Date.now(),
    usedLevels,
    tradeType,
    profile: tradeType,
    dte,
    liquidityQuality,
    liquidityWarnings,
  };
}

/**
 * Main risk calculation function
 */
export function calculateRisk(input: RiskCalculationInput): RiskCalculationResult {
  if (input.defaults.mode === 'percent') {
    return calculatePercentMode(input);
  } else {
    return calculateCalculatedMode(input);
  }
}

/**
 * Calculate breakeven stop loss
 */
export function calculateBreakevenStop(entryPrice: number): number {
  return entryPrice;
}

/**
 * Calculate trailing stop loss
 * @param currentPrice Current underlying price
 * @param highWaterMark Highest price reached since entry
 * @param atr Current ATR value
 * @param atrMultiplier ATR multiplier for trail distance (default 1.0)
 * @returns Trailing stop price
 */
export function calculateTrailingStop(
  currentPrice: number,
  highWaterMark: number,
  atr: number,
  atrMultiplier: number = 1.0
): number {
  return highWaterMark - atr * atrMultiplier;
}

export interface RiskCalculationResult {
  targetPrice: number;
  stopLoss: number;
  targetPrice2?: number;
  targetPremium?: number;
  targetPremium2?: number;
  stopLossPremium?: number;
  riskRewardRatio: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  calculatedAt: number;
  usedLevels: string[];
  tradeType?: TradeType;
  profile?: string;
  dte?: number;
  liquidityQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  liquidityWarnings?: string[];
}
