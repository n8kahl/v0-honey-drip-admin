import { Trade } from '../../types';
import { ChartLevel, ChartLevelType } from '../../types/tradeLevels';
import { RiskCalculationInput, RiskCalculationResult, KeyLevels } from './types';
import { calculateRisk } from './calculator';

/**
 * Build chart levels for a trade based on risk engine context
 */
export function buildChartLevelsForTrade(
  trade: Trade,
  keyLevels: KeyLevels,
  riskResult?: RiskCalculationResult
): ChartLevel[] {
  const levels: ChartLevel[] = [];
  
  // Always include ENTRY if known
  if (trade.entryPrice) {
    levels.push({
      type: 'ENTRY',
      label: 'Entry',
      price: trade.entryPrice,
    });
  }
  
  // Always include TP levels
  if (trade.targetPrice) {
    levels.push({
      type: 'TP',
      label: 'TP1',
      price: trade.targetPrice,
      meta: {
        tpIndex: 1,
        reason: riskResult?.reasoning,
      },
    });
  }
  
  // TP2 if available
  if (riskResult?.targetPrice2) {
    levels.push({
      type: 'TP',
      label: 'TP2',
      price: riskResult.targetPrice2,
      meta: {
        tpIndex: 2,
      },
    });
  }
  
  // Always include SL
  if (trade.stopLoss) {
    levels.push({
      type: 'SL',
      label: 'SL',
      price: trade.stopLoss,
      meta: {
        reason: riskResult?.reasoning,
      },
    });
  }
  
  // Add key levels if they exist and are meaningful
  if (keyLevels.preMarketHigh && keyLevels.preMarketHigh > 0) {
    levels.push({
      type: 'PREMARKET_HIGH',
      label: 'PM High',
      price: keyLevels.preMarketHigh,
    });
  }
  
  if (keyLevels.preMarketLow && keyLevels.preMarketLow > 0) {
    levels.push({
      type: 'PREMARKET_LOW',
      label: 'PM Low',
      price: keyLevels.preMarketLow,
    });
  }
  
  if (keyLevels.orbHigh && keyLevels.orbHigh > 0) {
    levels.push({
      type: 'ORB_HIGH',
      label: 'ORB High',
      price: keyLevels.orbHigh,
    });
  }
  
  if (keyLevels.orbLow && keyLevels.orbLow > 0) {
    levels.push({
      type: 'ORB_LOW',
      label: 'ORB Low',
      price: keyLevels.orbLow,
    });
  }
  
  if (keyLevels.priorDayHigh && keyLevels.priorDayHigh > 0) {
    levels.push({
      type: 'PREV_DAY_HIGH',
      label: 'PDH',
      price: keyLevels.priorDayHigh,
    });
  }
  
  if (keyLevels.priorDayLow && keyLevels.priorDayLow > 0) {
    levels.push({
      type: 'PREV_DAY_LOW',
      label: 'PDL',
      price: keyLevels.priorDayLow,
    });
  }
  
  if (keyLevels.vwap && keyLevels.vwap > 0) {
    levels.push({
      type: 'VWAP',
      label: 'VWAP',
      price: keyLevels.vwap,
    });
  }
  
  if (keyLevels.vwapUpperBand && keyLevels.vwapUpperBand > 0) {
    levels.push({
      type: 'VWAP_BAND',
      label: 'VWAP +1σ',
      price: keyLevels.vwapUpperBand,
    });
  }
  
  if (keyLevels.vwapLowerBand && keyLevels.vwapLowerBand > 0) {
    levels.push({
      type: 'VWAP_BAND',
      label: 'VWAP -1σ',
      price: keyLevels.vwapLowerBand,
    });
  }
  
  if (keyLevels.bollingerUpper && keyLevels.bollingerUpper > 0) {
    levels.push({
      type: 'BOLLINGER',
      label: 'BB Upper',
      price: keyLevels.bollingerUpper,
    });
  }
  
  if (keyLevels.bollingerLower && keyLevels.bollingerLower > 0) {
    levels.push({
      type: 'BOLLINGER',
      label: 'BB Lower',
      price: keyLevels.bollingerLower,
    });
  }
  
  return levels;
}

/**
 * Build chart levels for an "about to enter" candidate
 */
export function buildChartLevelsForCandidate(
  ticker: string,
  currentPrice: number,
  keyLevels: KeyLevels,
  riskInput: RiskCalculationInput
): ChartLevel[] {
  const levels: ChartLevel[] = [];
  
  // Calculate TP/SL
  const riskResult = calculateRisk(riskInput);
  
  // Add TP levels
  if (riskResult.targetPrice) {
    levels.push({
      type: 'TP',
      label: 'TP1',
      price: riskResult.targetPrice,
      meta: {
        tpIndex: 1,
        reason: riskResult.reasoning,
      },
    });
  }
  
  if (riskResult.targetPrice2) {
    levels.push({
      type: 'TP',
      label: 'TP2',
      price: riskResult.targetPrice2,
      meta: {
        tpIndex: 2,
      },
    });
  }
  
  // Add SL
  if (riskResult.stopLoss) {
    levels.push({
      type: 'SL',
      label: 'SL',
      price: riskResult.stopLoss,
      meta: {
        reason: riskResult.reasoning,
      },
    });
  }
  
  // Add key levels (same as above)
  if (keyLevels.preMarketHigh && keyLevels.preMarketHigh > 0) {
    levels.push({
      type: 'PREMARKET_HIGH',
      label: 'PM High',
      price: keyLevels.preMarketHigh,
    });
  }
  
  if (keyLevels.preMarketLow && keyLevels.preMarketLow > 0) {
    levels.push({
      type: 'PREMARKET_LOW',
      label: 'PM Low',
      price: keyLevels.preMarketLow,
    });
  }
  
  if (keyLevels.orbHigh && keyLevels.orbHigh > 0) {
    levels.push({
      type: 'ORB_HIGH',
      label: 'ORB High',
      price: keyLevels.orbHigh,
    });
  }
  
  if (keyLevels.orbLow && keyLevels.orbLow > 0) {
    levels.push({
      type: 'ORB_LOW',
      label: 'ORB Low',
      price: keyLevels.orbLow,
    });
  }
  
  if (keyLevels.priorDayHigh && keyLevels.priorDayHigh > 0) {
    levels.push({
      type: 'PREV_DAY_HIGH',
      label: 'PDH',
      price: keyLevels.priorDayHigh,
    });
  }
  
  if (keyLevels.priorDayLow && keyLevels.priorDayLow > 0) {
    levels.push({
      type: 'PREV_DAY_LOW',
      label: 'PDL',
      price: keyLevels.priorDayLow,
    });
  }
  
  if (keyLevels.vwap && keyLevels.vwap > 0) {
    levels.push({
      type: 'VWAP',
      label: 'VWAP',
      price: keyLevels.vwap,
    });
  }
  
  if (keyLevels.vwapUpperBand && keyLevels.vwapUpperBand > 0) {
    levels.push({
      type: 'VWAP_BAND',
      label: 'VWAP +1σ',
      price: keyLevels.vwapUpperBand,
    });
  }
  
  if (keyLevels.vwapLowerBand && keyLevels.vwapLowerBand > 0) {
    levels.push({
      type: 'VWAP_BAND',
      label: 'VWAP -1σ',
      price: keyLevels.vwapLowerBand,
    });
  }
  
  if (keyLevels.bollingerUpper && keyLevels.bollingerUpper > 0) {
    levels.push({
      type: 'BOLLINGER',
      label: 'BB Upper',
      price: keyLevels.bollingerUpper,
    });
  }
  
  if (keyLevels.bollingerLower && keyLevels.bollingerLower > 0) {
    levels.push({
      type: 'BOLLINGER',
      label: 'BB Lower',
      price: keyLevels.bollingerLower,
    });
  }
  
  return levels;
}
