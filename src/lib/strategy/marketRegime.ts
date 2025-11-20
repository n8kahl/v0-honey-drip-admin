/**
 * Market Regime Detection
 *
 * Identifies current market conditions to optimize strategy selection:
 * - trending: Strong directional movement (ADX > 25, low volatility)
 * - choppy: Range-bound with false breakouts (ADX < 20, moderate volatility)
 * - volatile: High volatility with unpredictable direction (ATR spike, high VIX)
 * - ranging: Calm, range-bound movement (ADX < 20, low volatility)
 */

import type { Bar } from './patternDetection.js';

export type MarketRegime = 'trending' | 'choppy' | 'volatile' | 'ranging';

export interface MarketRegimeResult {
  regime: MarketRegime;
  adx: number;
  atr: number;
  confidence: number; // 0-100
}

/**
 * Calculate Average Directional Index (ADX)
 * Measures trend strength (0-100):
 * - < 20: Weak/no trend (ranging)
 * - 20-25: Developing trend
 * - 25-50: Strong trend
 * - > 50: Very strong trend
 *
 * @param bars Historical bars (needs at least 14 + period)
 * @param period ADX smoothing period (default 14)
 */
export function calculateADX(bars: Bar[], period: number = 14): number {
  if (!bars || bars.length < period + 1) {
    return 0;
  }

  // Step 1: Calculate True Range (TR), +DM, -DM for each bar
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const current = bars[i];
    const prev = bars[i - 1];

    // True Range = max of:
    // 1. current high - current low
    // 2. abs(current high - previous close)
    // 3. abs(current low - previous close)
    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    tr.push(trueRange);

    // Directional Movement
    const upMove = current.high - prev.high;
    const downMove = prev.low - current.low;

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
    } else {
      plusDM.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
    } else {
      minusDM.push(0);
    }
  }

  // Step 2: Smooth TR, +DM, -DM using Wilder's smoothing (similar to EMA)
  const smoothTR = smoothWilders(tr, period);
  const smoothPlusDM = smoothWilders(plusDM, period);
  const smoothMinusDM = smoothWilders(minusDM, period);

  // Step 3: Calculate +DI and -DI (Directional Indicators)
  const plusDI: number[] = [];
  const minusDI: number[] = [];

  for (let i = 0; i < smoothTR.length; i++) {
    if (smoothTR[i] === 0) {
      plusDI.push(0);
      minusDI.push(0);
    } else {
      plusDI.push((smoothPlusDM[i] / smoothTR[i]) * 100);
      minusDI.push((smoothMinusDM[i] / smoothTR[i]) * 100);
    }
  }

  // Step 4: Calculate DX (Directional Movement Index)
  const dx: number[] = [];
  for (let i = 0; i < plusDI.length; i++) {
    const sum = plusDI[i] + minusDI[i];
    if (sum === 0) {
      dx.push(0);
    } else {
      dx.push((Math.abs(plusDI[i] - minusDI[i]) / sum) * 100);
    }
  }

  // Step 5: Calculate ADX (smoothed DX)
  const adxValues = smoothWilders(dx, period);

  // Return most recent ADX value
  return adxValues.length > 0 ? adxValues[adxValues.length - 1] : 0;
}

/**
 * Wilder's smoothing method (exponential moving average variant)
 * First value = simple average of first N periods
 * Subsequent values = (previous * (N-1) + current) / N
 */
function smoothWilders(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const smoothed: number[] = [];

  // First smoothed value = simple average
  const firstSum = values.slice(0, period).reduce((a, b) => a + b, 0);
  smoothed.push(firstSum / period);

  // Subsequent values use Wilder's smoothing
  for (let i = period; i < values.length; i++) {
    const newSmoothed = (smoothed[smoothed.length - 1] * (period - 1) + values[i]) / period;
    smoothed.push(newSmoothed);
  }

  return smoothed;
}

/**
 * Calculate Average True Range (ATR)
 * Measures volatility (absolute price movement)
 *
 * @param bars Historical bars (needs at least period + 1)
 * @param period ATR period (default 14)
 */
export function calculateATR(bars: Bar[], period: number = 14): number {
  if (!bars || bars.length < period + 1) {
    return 0;
  }

  const tr: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const current = bars[i];
    const prev = bars[i - 1];

    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    tr.push(trueRange);
  }

  // Smooth using Wilder's method
  const atrValues = smoothWilders(tr, period);

  return atrValues.length > 0 ? atrValues[atrValues.length - 1] : 0;
}

/**
 * Detect current market regime based on ADX and ATR
 *
 * Regimes:
 * - TRENDING: ADX > 25 (strong trend, low false breakouts)
 * - CHOPPY: ADX < 20, ATR/Price > 1.5% (range-bound with whipsaws)
 * - VOLATILE: ATR spike > 2x recent average (unpredictable, wide swings)
 * - RANGING: ADX < 20, ATR/Price < 1.5% (calm, predictable range)
 *
 * @param bars Historical bars (needs at least 30 for reliable detection)
 * @param adxPeriod ADX period (default 14)
 * @param atrPeriod ATR period (default 14)
 */
export function detectMarketRegime(
  bars: Bar[],
  adxPeriod: number = 14,
  atrPeriod: number = 14
): MarketRegimeResult {
  if (!bars || bars.length < 30) {
    return {
      regime: 'ranging',
      adx: 0,
      atr: 0,
      confidence: 0,
    };
  }

  // Calculate ADX and ATR
  const adx = calculateADX(bars, adxPeriod);
  const atr = calculateATR(bars, atrPeriod);

  // Get current price for ATR percentage calculation
  const currentPrice = bars[bars.length - 1].close;
  const atrPct = (atr / currentPrice) * 100;

  // Calculate recent ATR average (for volatility spike detection)
  const recentBars = bars.slice(-30);
  const atrHistory: number[] = [];
  for (let i = atrPeriod; i < recentBars.length; i++) {
    const slicedBars = recentBars.slice(0, i + 1);
    atrHistory.push(calculateATR(slicedBars, atrPeriod));
  }
  const avgRecentATR = atrHistory.reduce((a, b) => a + b, 0) / atrHistory.length;
  const atrRatio = avgRecentATR > 0 ? atr / avgRecentATR : 1;

  // Regime detection logic
  let regime: MarketRegime;
  let confidence: number;

  if (adx > 25) {
    // Strong trend
    regime = 'trending';
    confidence = Math.min(100, (adx - 25) * 2 + 70); // 25 ADX = 70 conf, 50 ADX = 100 conf
  } else if (atrRatio > 2.0) {
    // Volatility spike (ATR doubled)
    regime = 'volatile';
    confidence = Math.min(100, (atrRatio - 1) * 50); // 2x = 50 conf, 3x = 100 conf
  } else if (adx < 20 && atrPct > 1.5) {
    // No trend + elevated volatility = choppy
    regime = 'choppy';
    confidence = Math.min(100, atrPct * 20); // 1.5% = 30 conf, 5% = 100 conf
  } else {
    // Low ADX, low volatility = ranging
    regime = 'ranging';
    confidence = Math.min(100, (20 - adx) * 5 + 50); // ADX 20 = 50 conf, ADX 10 = 100 conf
  }

  return {
    regime,
    adx,
    atr,
    confidence,
  };
}

/**
 * Get recommended strategy types for each regime
 */
export function getRegimeStrategyRecommendations(regime: MarketRegime): string[] {
  switch (regime) {
    case 'trending':
      return ['trend-continuation', 'breakout', 'pullback'];
    case 'choppy':
      return ['avoid-breakouts', 'mean-reversion-with-confirmation'];
    case 'volatile':
      return ['avoid-tight-stops', 'wait-for-consolidation'];
    case 'ranging':
      return ['mean-reversion', 'support-resistance-bounce'];
    default:
      return [];
  }
}
