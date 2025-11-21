/**
 * Confluence Score Calculation Utilities
 *
 * Pure functions for calculating market confluence scores:
 * - Basic confluence from indicators and trend
 * - Advanced confluence with weighted components
 * - Multi-factor analysis for trade setup quality
 */

import type { Candle, Indicators, ConfluenceScore, MTFTrend, Timeframe, SymbolData } from '../../stores/marketDataStore';

/**
 * Calculate confluence score from market data
 * @param symbol - Symbol ticker
 * @param candles - Candle array
 * @param indicators - Computed indicators
 * @param mtfTrend - Multi-timeframe trends
 * @returns Confluence score object
 */
export function calculateConfluence(
  symbol: string,
  candles: Candle[],
  indicators: Indicators,
  mtfTrend: Record<Timeframe, MTFTrend>
): ConfluenceScore {
  if (candles.length === 0) {
    return {
      overall: 0,
      trend: 0,
      momentum: 0,
      volatility: 0,
      volume: 0,
      technical: 0,
      components: {
        trendAlignment: false,
        aboveVWAP: false,
        rsiConfirm: false,
        volumeConfirm: false,
        supportResistance: false,
      },
      lastUpdated: Date.now(),
    };
  }

  const lastClose = candles[candles.length - 1].close;
  const { ema9, ema20, ema50, vwap, rsi14 } = indicators;

  // Component checks
  const trendAlignment = mtfTrend['5m'] === mtfTrend['15m'] && mtfTrend['15m'] === mtfTrend['60m'];
  const aboveVWAP = vwap ? lastClose > vwap : false;
  const rsiConfirm = rsi14 ? (rsi14 > 40 && rsi14 < 70) : false;
  const supportResistance = ema9 && ema20 && ema50 ? (ema9 > ema20 && ema20 > ema50) : false;
  const volumeConfirm = candles.length > 1 ? candles[candles.length - 1].volume > candles[candles.length - 2].volume : false;

  // Score components (0-100)
  const trend = trendAlignment ? 100 : 50;
  const momentum = rsiConfirm ? 100 : 50;
  const volatility = 50; // Placeholder
  const volume = volumeConfirm ? 100 : 50;
  const technical = supportResistance ? 100 : 50;

  const overall = Math.round((trend + momentum + volatility + volume + technical) / 5);

  return {
    overall,
    trend,
    momentum,
    volatility,
    volume,
    technical,
    components: {
      trendAlignment,
      aboveVWAP,
      rsiConfirm,
      volumeConfirm,
      supportResistance,
    },
    lastUpdated: Date.now(),
  };
}

/**
 * Calculate advanced confluence score with weighted components
 * Matches useConfluenceData logic for consistency
 * @param symbol - Symbol ticker
 * @param symbolData - Full symbol data with multi-timeframe candles
 * @param indicators - Computed indicators
 * @param mtfTrend - Multi-timeframe trends
 * @returns Advanced confluence score object
 */
export function calculateAdvancedConfluence(
  symbol: string,
  symbolData: SymbolData,
  indicators: Indicators,
  mtfTrend: Record<Timeframe, MTFTrend>
): ConfluenceScore {
  const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];

  if (primaryCandles.length === 0) {
    return {
      overall: 0,
      trend: 0,
      momentum: 0,
      volatility: 0,
      volume: 0,
      technical: 0,
      components: {
        trendAlignment: false,
        aboveVWAP: false,
        rsiConfirm: false,
        volumeConfirm: false,
        supportResistance: false,
      },
      lastUpdated: Date.now(),
    };
  }

  const lastCandle = primaryCandles[primaryCandles.length - 1];
  const lastClose = lastCandle.close;
  const { vwap, rsi14, ema9, ema20, atr14, bollingerBands } = indicators;

  // ===== Component Checks (matching useConfluenceData patterns) =====

  // 1. Trend Alignment: multiple timeframes agree
  const bullCount = Object.values(mtfTrend).filter(t => t === 'bull').length;
  const bearCount = Object.values(mtfTrend).filter(t => t === 'bear').length;
  const trendAlignment = (bullCount >= 3) || (bearCount >= 3);
  const primaryTrendBullish = mtfTrend[symbolData.primaryTimeframe] === 'bull';

  // 2. Price above VWAP (bullish signal)
  const aboveVWAP = vwap ? lastClose > vwap : false;

  // 3. RSI confirmation (not overbought/oversold)
  const rsiConfirm = rsi14 ? (rsi14 > 30 && rsi14 < 70) : false;
  const rsiStrong = rsi14 ? (primaryTrendBullish ? rsi14 > 50 : rsi14 < 50) : false;

  // 4. Volume confirmation (above average)
  const recentVolumes = primaryCandles.slice(-20).map(c => c.volume);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const volumeConfirm = lastCandle.volume > avgVolume * 1.2;

  // 5. Support/Resistance near EMA levels
  const nearEma20 = ema20 ? Math.abs(lastClose - ema20) / lastClose < 0.01 : false;
  const nearEma50 = ema9 && ema20 ? Math.abs(ema9 - ema20) / ema20 < 0.005 : false;
  const supportResistance = nearEma20 || nearEma50;

  // 6. Volatility assessment (Bollinger Bands)
  const bbWidth = bollingerBands && bollingerBands.upper && bollingerBands.lower
    ? (bollingerBands.upper - bollingerBands.lower) / lastClose
    : 0;
  const lowVolatility = bbWidth < 0.02; // Narrow bands = low volatility
  const highVolatility = bbWidth > 0.05; // Wide bands = high volatility

  // ===== Score Calculations (0-100 scale) =====

  // Trend score: weighted by timeframe agreement + direction
  let trendScore = 50;
  if (trendAlignment) {
    trendScore = primaryTrendBullish ? 85 : 15; // Strong bull or bear
  } else if (mtfTrend['5m'] === mtfTrend['15m']) {
    trendScore = mtfTrend['5m'] === 'bull' ? 70 : 30; // Moderate agreement
  }

  // Momentum score: RSI + EMA positioning
  let momentumScore = 50;
  if (rsiConfirm && rsiStrong) {
    momentumScore = 80;
  } else if (rsiConfirm) {
    momentumScore = 65;
  } else if (rsi14 && (rsi14 < 30 || rsi14 > 70)) {
    momentumScore = 30; // Overbought/oversold
  }

  // Volatility score: prefer moderate volatility
  let volatilityScore = 50;
  if (lowVolatility) {
    volatilityScore = 40; // Too quiet, breakout potential but risky
  } else if (highVolatility) {
    volatilityScore = 35; // Too wild, hard to manage
  } else {
    volatilityScore = 75; // Sweet spot
  }

  // Volume score: higher is better
  const volumeScore = volumeConfirm ? 80 : 45;

  // Technical score: VWAP + support/resistance
  let technicalScore = 50;
  if (aboveVWAP && supportResistance) {
    technicalScore = 85;
  } else if (aboveVWAP || supportResistance) {
    technicalScore = 65;
  } else if (!aboveVWAP && !supportResistance) {
    technicalScore = 35;
  }

  // ===== Weighted Average (matching real trading priorities) =====
  const overall = Math.round(
    trendScore * 0.30 +      // Trend is king
    momentumScore * 0.25 +   // Momentum confirms
    technicalScore * 0.20 +  // Levels matter
    volumeScore * 0.15 +     // Volume validates
    volatilityScore * 0.10   // Volatility context
  );

  return {
    overall,
    trend: trendScore,
    momentum: momentumScore,
    volatility: volatilityScore,
    volume: volumeScore,
    technical: technicalScore,
    components: {
      trendAlignment,
      aboveVWAP,
      rsiConfirm,
      volumeConfirm,
      supportResistance,
    },
    lastUpdated: Date.now(),
  };
}
