/**
 * Compute key technical levels from OHLC bar data
 */

import { Bar } from '../indicators';
import { KeyLevels } from './types';
import { calculateVWAP, calculateBollingerBands } from '../indicators';

/**
 * Compute ORB (Open Range Breakout) levels from morning bars (typically first 1-5 minutes)
 */
function computeORB(bars: Bar[], orbWindow: number = 5): { high: number; low: number } {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0 };
  }

  // Get only bars from market open
  // Assuming bars start from earliest in the lookback window
  // We want the first N bars that represent the opening range
  const orbBars = bars.slice(0, Math.min(orbWindow, bars.length));

  let high = -Infinity;
  let low = Infinity;

  for (const bar of orbBars) {
    high = Math.max(high, bar.high);
    low = Math.min(low, bar.low);
  }

  return {
    high: isFinite(high) ? high : 0,
    low: isFinite(low) ? low : 0,
  };
}

/**
 * Extract prior day high/low from historical bars
 * Assumes bars span at least 2 trading days
 */
function extractPriorDayLevels(bars: Bar[], currentDate: Date): { high: number; low: number } {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0 };
  }

  // Find bars from previous trading day
  const todayStart = new Date(currentDate);
  todayStart.setHours(0, 0, 0, 0);
  
  let priorDayHigh = -Infinity;
  let priorDayLow = Infinity;

  for (const bar of bars) {
    const barDate = new Date(bar.time * 1000);
    barDate.setHours(0, 0, 0, 0);

    // If bar is from previous day
    if (barDate < todayStart) {
      priorDayHigh = Math.max(priorDayHigh, bar.high);
      priorDayLow = Math.min(priorDayLow, bar.low);
    }
  }

  return {
    high: isFinite(priorDayHigh) ? priorDayHigh : 0,
    low: isFinite(priorDayLow) ? priorDayLow : 0,
  };
}

/**
 * Extract premarket high/low (typically 4 AM - 9:30 AM ET)
 */
function extractPremMarketLevels(bars: Bar[]): { high: number; low: number } {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0 };
  }

  const premktBars = bars.filter(bar => {
    const date = new Date(bar.time * 1000);
    const hour = date.getHours();
    // Premarket: 4 AM to 9 AM (before 9:30 market open)
    return hour >= 4 && hour < 9;
  });

  if (premktBars.length === 0) {
    return { high: 0, low: 0 };
  }

  let high = -Infinity;
  let low = Infinity;

  for (const bar of premktBars) {
    high = Math.max(high, bar.high);
    low = Math.min(low, bar.low);
  }

  return {
    high: isFinite(high) ? high : 0,
    low: isFinite(low) ? low : 0,
  };
}

/**
 * Extract weekly high/low from bars spanning multiple weeks
 */
function extractWeeklyLevels(bars: Bar[]): { high: number; low: number } {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0 };
  }

  // Group bars by week and find the most recent week's levels
  const weekMap = new Map<number, { high: number; low: number }>();

  for (const bar of bars) {
    const date = new Date(bar.time * 1000);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Sunday
    const weekKey = weekStart.getTime();

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { high: bar.high, low: bar.low });
    } else {
      const week = weekMap.get(weekKey)!;
      week.high = Math.max(week.high, bar.high);
      week.low = Math.min(week.low, bar.low);
    }
  }

  // Get most recent complete week
  const weeks = Array.from(weekMap.entries()).sort((a, b) => b[0] - a[0]);
  if (weeks.length === 0) {
    return { high: 0, low: 0 };
  }

  const mostRecentWeek = weeks[0][1];
  return {
    high: mostRecentWeek.high,
    low: mostRecentWeek.low,
  };
}

/**
 * Extract monthly high/low from bars spanning multiple months
 */
function extractMonthlyLevels(bars: Bar[]): { high: number; low: number } {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0 };
  }

  const monthMap = new Map<string, { high: number; low: number }>();

  for (const bar of bars) {
    const date = new Date(bar.time * 1000);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { high: bar.high, low: bar.low });
    } else {
      const month = monthMap.get(monthKey)!;
      month.high = Math.max(month.high, bar.high);
      month.low = Math.min(month.low, bar.low);
    }
  }

  // Get most recent complete month
  const months = Array.from(monthMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  if (months.length === 0) {
    return { high: 0, low: 0 };
  }

  const mostRecentMonth = months[0][1];
  return {
    high: mostRecentMonth.high,
    low: mostRecentMonth.low,
  };
}

/**
 * Extract quarterly high/low from bars spanning multiple quarters
 */
function extractQuarterlyLevels(bars: Bar[]): { high: number; low: number } {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0 };
  }

  const quarterMap = new Map<string, { high: number; low: number }>();

  for (const bar of bars) {
    const date = new Date(bar.time * 1000);
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const quarterKey = `${date.getFullYear()}-Q${quarter}`;

    if (!quarterMap.has(quarterKey)) {
      quarterMap.set(quarterKey, { high: bar.high, low: bar.low });
    } else {
      const q = quarterMap.get(quarterKey)!;
      q.high = Math.max(q.high, bar.high);
      q.low = Math.min(q.low, bar.low);
    }
  }

  // Get most recent complete quarter
  const quarters = Array.from(quarterMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  if (quarters.length === 0) {
    return { high: 0, low: 0 };
  }

  const mostRecentQuarter = quarters[0][1];
  return {
    high: mostRecentQuarter.high,
    low: mostRecentQuarter.low,
  };
}

/**
 * Extract yearly high/low from bars spanning multiple years
 */
function extractYearlyLevels(bars: Bar[]): { high: number; low: number } {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0 };
  }

  const yearMap = new Map<number, { high: number; low: number }>();

  for (const bar of bars) {
    const date = new Date(bar.time * 1000);
    const year = date.getFullYear();

    if (!yearMap.has(year)) {
      yearMap.set(year, { high: bar.high, low: bar.low });
    } else {
      const y = yearMap.get(year)!;
      y.high = Math.max(y.high, bar.high);
      y.low = Math.min(y.low, bar.low);
    }
  }

  // Get most recent complete year
  const years = Array.from(yearMap.entries()).sort((a, b) => b[0] - a[0]);
  if (years.length === 0) {
    return { high: 0, low: 0 };
  }

  const mostRecentYear = years[0][1];
  return {
    high: mostRecentYear.high,
    low: mostRecentYear.low,
  };
}

/**
 * Main function to compute all key levels from bar data
 * 
 * @param bars Array of OHLC bars with volumes
 * @param orbWindow Number of bars to use for ORB calculation (typically 5 for 1-min bars = first 5 minutes)
 * @returns KeyLevels object with all calculated levels
 */
export function computeKeyLevelsFromBars(
  bars: Bar[],
  orbWindow: number = 5
): KeyLevels {
  const now = new Date();

  if (!bars || bars.length === 0) {
    console.warn('[computeKeyLevels] No bars provided, returning zero levels');
    return {
      preMarketHigh: 0,
      preMarketLow: 0,
      orbHigh: 0,
      orbLow: 0,
      priorDayHigh: 0,
      priorDayLow: 0,
      vwap: 0,
      vwapUpperBand: 0,
      vwapLowerBand: 0,
      bollingerUpper: 0,
      bollingerLower: 0,
      weeklyHigh: 0,
      weeklyLow: 0,
      monthlyHigh: 0,
      monthlyLow: 0,
      quarterlyHigh: 0,
      quarterlyLow: 0,
      yearlyHigh: 0,
      yearlyLow: 0,
    };
  }

  try {
    // Compute all levels
    const orb = computeORB(bars, orbWindow);
    const priorDay = extractPriorDayLevels(bars, now);
    const preMarket = extractPremMarketLevels(bars);
    
    // VWAP and Bollinger Bands
    const vwapValues = calculateVWAP(bars);
    const closes = bars.map(b => b.close);
    const bollingerData = calculateBollingerBands(closes, 20, 2);
    
    // Get latest values
    const vwapLatest = vwapValues[vwapValues.length - 1] || 0;
    const vwapUpperBand = 0; // VWAP bands would need separate calculation
    const vwapLowerBand = 0;
    const bollingerUpper = bollingerData.upper[bollingerData.upper.length - 1] || 0;
    const bollingerLower = bollingerData.lower[bollingerData.lower.length - 1] || 0;
    
    // Longer timeframe levels
    const weekly = extractWeeklyLevels(bars);
    const monthly = extractMonthlyLevels(bars);
    const quarterly = extractQuarterlyLevels(bars);
    const yearly = extractYearlyLevels(bars);

    const keyLevels: KeyLevels = {
      preMarketHigh: preMarket.high,
      preMarketLow: preMarket.low,
      orbHigh: orb.high,
      orbLow: orb.low,
      priorDayHigh: priorDay.high,
      priorDayLow: priorDay.low,
      vwap: vwapLatest,
      vwapUpperBand,
      vwapLowerBand,
      bollingerUpper,
      bollingerLower,
      weeklyHigh: weekly.high,
      weeklyLow: weekly.low,
      monthlyHigh: monthly.high,
      monthlyLow: monthly.low,
      quarterlyHigh: quarterly.high,
      quarterlyLow: quarterly.low,
      yearlyHigh: yearly.high,
      yearlyLow: yearly.low,
    };

    console.log('[computeKeyLevels] Computed levels:', keyLevels);
    return keyLevels;
  } catch (err) {
    console.error('[computeKeyLevels] Error computing key levels:', err);
    // Return safe zeros on error
    return {
      preMarketHigh: 0,
      preMarketLow: 0,
      orbHigh: 0,
      orbLow: 0,
      priorDayHigh: 0,
      priorDayLow: 0,
      vwap: 0,
      vwapUpperBand: 0,
      vwapLowerBand: 0,
      bollingerUpper: 0,
      bollingerLower: 0,
      weeklyHigh: 0,
      weeklyLow: 0,
      monthlyHigh: 0,
      monthlyLow: 0,
      quarterlyHigh: 0,
      quarterlyLow: 0,
      yearlyHigh: 0,
      yearlyLow: 0,
    };
  }
}
