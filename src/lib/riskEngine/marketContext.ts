import { Bar } from './types';
import { gatherMacroContext, MacroContext } from '../massive/indices-advanced';

export interface MarketContext {
  status: 'open' | 'closed' | 'pre' | 'post';
  sessionStart?: Date;
  sessionEnd?: Date;
  premarketHigh?: number;
  premarketLow?: number;
  orbHigh?: number;
  orbLow?: number;
  prevDayHigh?: number;
  prevDayLow?: number;
  prevDayClose?: number;
  weeklyHigh?: number;
  weeklyLow?: number;
  monthlyHigh?: number;
  monthlyLow?: number;
  quarterlyHigh?: number;
  quarterlyLow?: number;
  yearlyHigh?: number;
  yearlyLow?: number;
  vwap?: number;
  vwapUpperBand?: number;
  vwapLowerBand?: number;
  vwapStdDev?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
  bollingerMiddle?: number;
  calculatedAt: number;
}

export interface EnhancedMarketContext extends MarketContext {
  macro?: MacroContext;
}

/**
 * Get market status and session boundaries
 */
export function getMarketStatus(now: Date = new Date()): {
  status: 'open' | 'closed' | 'pre' | 'post';
  sessionStart: Date;
  sessionEnd: Date;
} {
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  // Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: 'closed',
      sessionStart: new Date(now),
      sessionEnd: new Date(now),
    };
  }

  // Regular hours: 9:30 AM - 4:00 PM ET
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM
  const preMarketStart = 4 * 60; // 4:00 AM
  const postMarketEnd = 20 * 60; // 8:00 PM

  let status: 'open' | 'closed' | 'pre' | 'post';
  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    status = 'open';
  } else if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
    status = 'pre';
  } else if (timeInMinutes >= marketClose && timeInMinutes < postMarketEnd) {
    status = 'post';
  } else {
    status = 'closed';
  }

  const sessionStart = new Date(now);
  sessionStart.setHours(9, 30, 0, 0);

  const sessionEnd = new Date(now);
  sessionEnd.setHours(16, 0, 0, 0);

  return { status, sessionStart, sessionEnd };
}

/**
 * Calculate premarket high/low from bars
 */
export function calculatePremarketLevels(bars: Bar[]): {
  high: number;
  low: number;
} {
  if (bars.length === 0) {
    return { high: 0, low: 0 };
  }

  let high = bars[0].high;
  let low = bars[0].low;

  for (const bar of bars) {
    if (bar.high > high) high = bar.high;
    if (bar.low < low) low = bar.low;
  }

  return { high, low };
}

/**
 * Calculate Opening Range Breakout (ORB) levels
 * @param bars 1-minute bars
 * @param orbMinutes Number of minutes after open (default 15)
 */
export function calculateORB(
  bars: Bar[],
  orbMinutes: number = 15
): { high: number; low: number } {
  if (bars.length === 0) {
    return { high: 0, low: 0 };
  }

  // Take first N minutes of bars
  const orbBars = bars.slice(0, Math.min(orbMinutes, bars.length));

  let high = orbBars[0].high;
  let low = orbBars[0].low;

  for (const bar of orbBars) {
    if (bar.high > high) high = bar.high;
    if (bar.low < low) low = bar.low;
  }

  return { high, low };
}

/**
 * Calculate prior period high/low
 */
export function calculatePriorPeriodHL(bars: Bar[]): {
  high: number;
  low: number;
  close: number;
} {
  if (bars.length === 0) {
    return { high: 0, low: 0, close: 0 };
  }

  let high = bars[0].high;
  let low = bars[0].low;
  const close = bars[bars.length - 1].close;

  for (const bar of bars) {
    if (bar.high > high) high = bar.high;
    if (bar.low < low) low = bar.low;
  }

  return { high, low, close };
}

/**
 * Calculate VWAP and bands
 */
export function calculateVWAPWithBands(bars: Bar[]): {
  vwap: number;
  upperBand: number;
  lowerBand: number;
  stdDev: number;
} {
  if (bars.length === 0) {
    return { vwap: 0, upperBand: 0, lowerBand: 0, stdDev: 0 };
  }

  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (const bar of bars) {
    const typical = (bar.high + bar.low + bar.close) / 3;
    cumulativePV += typical * bar.volume;
    cumulativeVolume += bar.volume;
  }

  const vwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : bars[bars.length - 1].close;

  // Calculate standard deviation
  let sumSquaredDiff = 0;
  for (const bar of bars) {
    const typical = (bar.high + bar.low + bar.close) / 3;
    const diff = typical - vwap;
    sumSquaredDiff += diff * diff * bar.volume;
  }

  const variance = cumulativeVolume > 0 ? sumSquaredDiff / cumulativeVolume : 0;
  const stdDev = Math.sqrt(variance);

  return {
    vwap,
    upperBand: vwap + stdDev,
    lowerBand: vwap - stdDev,
    stdDev,
  };
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  bars: Bar[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number; lower: number; middle: number } {
  if (bars.length < period) {
    const lastClose = bars[bars.length - 1]?.close || 0;
    return { upper: lastClose, lower: lastClose, middle: lastClose };
  }

  // Calculate SMA
  const closes = bars.slice(-period).map((b) => b.close);
  const sma = closes.reduce((a, b) => a + b, 0) / period;

  // Calculate standard deviation
  const variance = closes.reduce((sum, close) => sum + Math.pow(close - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    middle: sma,
    upper: sma + stdDev * stdDevMultiplier,
    lower: sma - stdDev * stdDevMultiplier,
  };
}

/**
 * Gather enhanced market context with macro data
 */
export async function gatherEnhancedMarketContext(bars: Bar[]): Promise<EnhancedMarketContext> {
  const marketStatus = getMarketStatus();
  const premarketLevels = calculatePremarketLevels(bars);
  const orbLevels = calculateORB(bars, 15);
  const vwapData = calculateVWAPWithBands(bars);
  const bollingerBands = calculateBollingerBands(bars);

  const macroPromise = gatherMacroContext().catch((err) => {
    console.error('[gatherEnhancedMarketContext] Failed to gather macro:', err);
    return null;
  });

  const [macro] = await Promise.all([macroPromise]);

  const context: EnhancedMarketContext = {
    status: marketStatus.status,
    sessionStart: marketStatus.sessionStart,
    sessionEnd: marketStatus.sessionEnd,
    premarketHigh: premarketLevels.high,
    premarketLow: premarketLevels.low,
    orbHigh: orbLevels.high,
    orbLow: orbLevels.low,
    vwap: vwapData.vwap,
    vwapUpperBand: vwapData.upperBand,
    vwapLowerBand: vwapData.lowerBand,
    vwapStdDev: vwapData.stdDev,
    bollingerUpper: bollingerBands.upper,
    bollingerLower: bollingerBands.lower,
    bollingerMiddle: bollingerBands.middle,
    calculatedAt: Date.now(),
    macro: macro || undefined,
  };

  return context;
}
