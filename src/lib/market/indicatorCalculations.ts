/**
 * Indicator Calculation Utilities
 *
 * Pure functions for technical indicator calculations:
 * - Basic indicators from candles (EMA, RSI, VWAP, ATR, Bollinger Bands)
 * - Multi-timeframe trend analysis
 * - Comprehensive indicator aggregation
 */

import type { Candle, Indicators, MTFTrend, Timeframe, SymbolData } from '../../stores/marketDataStore';
import {
  calculateEMA,
  calculateVWAP,
  rsiWilder,
  atrWilder,
  calculateBollingerBands,
} from '../indicators';

/**
 * Calculate indicators from candle array
 * @param candles - Array of candles
 * @returns Computed indicators object
 */
export function computeIndicatorsFromCandles(candles: Candle[]): Indicators {
  if (candles.length === 0) return {};

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // EMA calculations
  const ema9Array = calculateEMA(closes, 9);
  const ema20Array = calculateEMA(closes, 20);
  const ema50Array = calculateEMA(closes, 50);
  const ema200Array = calculateEMA(closes, 200);

  // RSI calculation
  const rsi14Array = rsiWilder(closes, 14);

  // VWAP calculation - ensure candles have 'time' field for Bar compatibility
  const barsWithTime = candles.map(c => ({
    ...c,
    time: c.time || c.timestamp || 0
  }));
  const vwapArray = calculateVWAP(barsWithTime);

  // Get latest values (last element)
  const lastIdx = candles.length - 1;

  return {
    ema9: ema9Array[lastIdx],
    ema20: ema20Array[lastIdx],
    ema50: ema50Array[lastIdx],
    ema200: ema200Array[lastIdx],
    rsi14: rsi14Array[lastIdx],
    vwap: vwapArray[lastIdx],
    // TODO: Add MACD, ADX, Pivots when needed
  };
}

/**
 * Calculate comprehensive indicators from multiple timeframes
 * @param symbolData - Symbol data with multi-timeframe candles
 * @returns Comprehensive indicators from primary timeframe
 */
export function calculateComprehensiveIndicators(symbolData: SymbolData): Indicators {
  // Use primary timeframe (default 5m) for main indicators
  const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];
  if (primaryCandles.length === 0) return {};

  const closes = primaryCandles.map(c => c.close);
  const highs = primaryCandles.map(c => c.high);
  const lows = primaryCandles.map(c => c.low);

  // EMA calculations
  const ema9Array = calculateEMA(closes, 9);
  const ema20Array = calculateEMA(closes, 20);
  const ema50Array = calculateEMA(closes, 50);
  const ema200Array = calculateEMA(closes, 200);

  // RSI calculation
  const rsi14Array = rsiWilder(closes, 14);

  // ATR calculation
  const atr14Array = atrWilder(highs, lows, closes, 14);

  // VWAP calculation (session-based)
  const barsWithTime = primaryCandles.map(c => ({
    ...c,
    time: c.time || c.timestamp || 0
  }));
  const vwapArray = calculateVWAP(barsWithTime);

  // Bollinger Bands
  const { upper, middle, lower } = calculateBollingerBands(closes, 20, 2);

  // Get latest values (last element)
  const lastIdx = primaryCandles.length - 1;

  return {
    ema9: ema9Array[lastIdx],
    ema20: ema20Array[lastIdx],
    ema50: ema50Array[lastIdx],
    ema200: ema200Array[lastIdx],
    rsi14: rsi14Array[lastIdx],
    atr14: atr14Array[lastIdx],
    vwap: vwapArray[lastIdx],
    bollingerBands: {
      upper: upper[lastIdx],
      middle: middle[lastIdx],
      lower: lower[lastIdx],
    },
  };
}

/**
 * Determine trend from indicators
 * @param candles - Array of candles
 * @param indicators - Computed indicators
 * @returns Trend direction (bull, bear, or neutral)
 */
export function determineTrend(candles: Candle[], indicators: Indicators): MTFTrend {
  if (candles.length === 0) return 'neutral';

  const lastClose = candles[candles.length - 1].close;
  const { ema9, ema20, ema50 } = indicators;

  // Simple trend logic: price above EMAs = bull, below = bear
  if (ema9 && ema20 && ema50) {
    if (lastClose > ema9 && ema9 > ema20 && ema20 > ema50) {
      return 'bull';
    }
    if (lastClose < ema9 && ema9 < ema20 && ema20 < ema50) {
      return 'bear';
    }
  }

  return 'neutral';
}

/**
 * Calculate MTF trend alignment across all timeframes
 * @param symbolData - Symbol data with multi-timeframe candles
 * @returns Trend for each timeframe
 */
export function calculateMTFTrends(symbolData: SymbolData): Record<Timeframe, MTFTrend> {
  const mtfTrend: Record<Timeframe, MTFTrend> = {} as Record<Timeframe, MTFTrend>;

  (['1m', '5m', '15m', '60m', '1D'] as Timeframe[]).forEach(tf => {
    const tfCandles = symbolData.candles[tf];
    if (tfCandles.length === 0) {
      mtfTrend[tf] = 'neutral';
      return;
    }

    const closes = tfCandles.map(c => c.close);
    const ema9 = calculateEMA(closes, 9);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);

    const lastIdx = closes.length - 1;
    const lastClose = closes[lastIdx];
    const lastEma9 = ema9[lastIdx];
    const lastEma20 = ema20[lastIdx];
    const lastEma50 = ema50[lastIdx];

    // Determine trend: price and EMAs aligned
    if (lastEma9 && lastEma20 && lastEma50) {
      if (lastClose > lastEma9 && lastEma9 > lastEma20 && lastEma20 > lastEma50) {
        mtfTrend[tf] = 'bull';
      } else if (lastClose < lastEma9 && lastEma9 < lastEma20 && lastEma20 < lastEma50) {
        mtfTrend[tf] = 'bear';
      } else {
        mtfTrend[tf] = 'neutral';
      }
    } else {
      mtfTrend[tf] = 'neutral';
    }
  });

  return mtfTrend;
}
