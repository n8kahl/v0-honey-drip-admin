/**
 * Compute key technical levels from OHLC bar data
 */

import { Bar } from "../indicators";
import { KeyLevels } from "./types";
import { calculateVWAP, calculateBollingerBands } from "../indicators";

/**
 * Get the Eastern Time hour and minute from a Unix timestamp
 */
function getETTime(timestamp: number): { hour: number; minute: number; dateStr: string } {
  const date = new Date(timestamp * 1000);
  const etStr = date.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
  // Format: "MM/DD/YYYY, HH:MM:SS" or similar depending on locale
  const timePart = etStr.split(", ")[1];
  const [hour, minute] = timePart.split(":").map(Number);
  const datePart = etStr.split(", ")[0];
  const [m, d, y] = datePart.split("/").map(Number);
  const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { hour, minute, dateStr };
}

/**
 * Compute ORB (Open Range Breakout) levels
 * Default orbMinutes=15 as requested by user
 */
function computeORB(bars: Bar[], orbMinutes: number = 15): { high: number; low: number } {
  if (!bars || bars.length === 0) return { high: 0, low: 0 };

  // Find the first bar of the regular session (9:30 AM ET)
  let startIndex = -1;
  for (let i = 0; i < bars.length; i++) {
    const { hour, minute } = getETTime(bars[i].time);
    if (hour === 9 && minute >= 30) {
      startIndex = i;
      break;
    } else if (hour > 9) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) return { high: 0, low: 0 };

  const startTimestamp = bars[startIndex].time;
  const endTimestamp = startTimestamp + orbMinutes * 60;

  let high = -Infinity;
  let low = Infinity;
  let found = false;

  for (let i = startIndex; i < bars.length; i++) {
    if (bars[i].time >= endTimestamp) break;
    high = Math.max(high, bars[i].high);
    low = Math.min(low, bars[i].low);
    found = true;
  }

  return {
    high: found ? high : 0,
    low: found ? low : 0,
  };
}

/**
 * Extract prior day high/low from historical bars
 */
function extractPriorDayLevels(bars: Bar[]): { high: number; low: number; close: number } {
  if (!bars || bars.length === 0) return { high: 0, low: 0, close: 0 };

  // Get current session's date
  const lastBar = bars[bars.length - 1];
  const { dateStr: lastDate } = getETTime(lastBar.time);

  // Find the latest date before lastDate
  let priorDate = "";
  for (let i = bars.length - 1; i >= 0; i--) {
    const { dateStr: d } = getETTime(bars[i].time);
    if (d < lastDate) {
      priorDate = d;
      break;
    }
  }

  if (!priorDate) return { high: 0, low: 0, close: 0 };

  let high = -Infinity;
  let low = Infinity;
  let close = 0;
  let found = false;

  for (const bar of bars) {
    const { dateStr, hour, minute } = getETTime(bar.time);
    if (dateStr === priorDate) {
      // Regular hours 9:30-16:00
      const totalMinutes = hour * 60 + minute;
      if (totalMinutes >= 570 && totalMinutes <= 960) {
        high = Math.max(high, bar.high);
        low = Math.min(low, bar.low);
        close = bar.close;
        found = true;
      }
    }
  }

  return {
    high: found ? high : 0,
    low: found ? low : 0,
    close: found ? close : 0,
  };
}

/**
 * Extract premarket high/low (4:00 AM - 9:30 AM ET)
 */
function extractPreMarketLevels(bars: Bar[]): { high: number; low: number } {
  if (!bars || bars.length === 0) return { high: 0, low: 0 };

  const lastBar = bars[bars.length - 1];
  const { dateStr: lastDate } = getETTime(lastBar.time);

  let high = -Infinity;
  let low = Infinity;
  let found = false;

  for (const bar of bars) {
    const { dateStr, hour, minute } = getETTime(bar.time);
    if (dateStr === lastDate) {
      const totalMinutes = hour * 60 + minute;
      // 4:00 AM = 240, 9:30 AM = 570
      if (totalMinutes >= 240 && totalMinutes < 570) {
        high = Math.max(high, bar.high);
        low = Math.min(low, bar.low);
        found = true;
      }
    }
  }

  return {
    high: found ? high : 0,
    low: found ? low : 0,
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
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

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
export function computeKeyLevelsFromBars(bars: Bar[], orbWindow: number = 5): KeyLevels {
  const now = new Date();

  if (!bars || bars.length === 0) {
    console.warn("[computeKeyLevels] No bars provided, returning zero levels");
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
    const orb = computeORB(bars, orbWindow === 5 ? 15 : orbWindow); // Default to 15m if default 5 provided
    const priorDay = extractPriorDayLevels(bars);
    const preMarket = extractPreMarketLevels(bars);

    // VWAP and Bollinger Bands
    const vwapValues = calculateVWAP(bars);
    const closes = bars.map((b) => b.close);
    const bollingerData = calculateBollingerBands(closes, 20, 2);

    // Get latest values
    const vwapLatest = vwapValues[vwapValues.length - 1] || 0;

    // Calculate 1.0 and 2.0 SD bands for VWAP
    // (Simplified SD calculation using ATR as proxy if full volume/variance not available)
    const lastBar = bars[bars.length - 1];
    const typicalRange = lastBar.high - lastBar.low;
    const vwapUpperBand = vwapLatest + typicalRange * 0.5;
    const vwapLowerBand = vwapLatest - typicalRange * 0.5;

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
      priorDayClose: priorDay.close,
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
      dailyPivot: (priorDay.high + priorDay.low + priorDay.close) / 3,
    };

    console.log("[computeKeyLevels] Computed levels:", keyLevels);
    return keyLevels;
  } catch (err) {
    console.error("[computeKeyLevels] Error computing key levels:", err);
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
