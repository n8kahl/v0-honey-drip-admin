/**
 * Key Levels - Previous day/week high/low levels
 * Provides important support/resistance levels for trading decisions
 */

import type { Bar } from "../indicators";

export interface KeyLevel {
  price: number;
  type: "previous-day-high" | "previous-day-low" | "previous-week-high" | "previous-week-low";
  label: string;
  color: string;
  style: "dashed" | "solid";
}

/**
 * Calculate key levels from bars
 * Identifies previous day and previous week high/low
 */
export function calculateKeyLevels(bars: Bar[]): KeyLevel[] {
  if (bars.length === 0) return [];

  const levels: KeyLevel[] = [];

  // Group bars by date for daily levels
  const barsByDate = new Map<string, Bar[]>();
  for (const bar of bars) {
    const date = new Date(bar.time * 1000);
    const dateStr = date.toISOString().split("T")[0];

    if (!barsByDate.has(dateStr)) {
      barsByDate.set(dateStr, []);
    }
    barsByDate.get(dateStr)!.push(bar);
  }

  // Sort dates
  const sortedDates = Array.from(barsByDate.keys()).sort().reverse();

  // Get today's date
  const today = new Date().toISOString().split("T")[0];
  const todayBars = barsByDate.get(today) || [];

  // Identify unique dates (skip today if we're looking for previous day/week)
  const uniqueDates = sortedDates.filter((d) => d < today);

  if (uniqueDates.length > 0) {
    // Previous day high/low
    const prevDayBars = barsByDate.get(uniqueDates[0])!;
    const prevDayHigh = Math.max(...prevDayBars.map((b) => b.high));
    const prevDayLow = Math.min(...prevDayBars.map((b) => b.low));

    levels.push({
      price: prevDayHigh,
      type: "previous-day-high",
      label: `PDH: ${prevDayHigh.toFixed(2)}`,
      color: "#22c55e", // Green
      style: "dashed",
    });

    levels.push({
      price: prevDayLow,
      type: "previous-day-low",
      label: `PDL: ${prevDayLow.toFixed(2)}`,
      color: "#ef4444", // Red
      style: "dashed",
    });
  }

  // Previous week high/low (last 5 trading days)
  if (uniqueDates.length >= 5) {
    const prevWeekBars = uniqueDates.slice(0, 5).flatMap((date) => barsByDate.get(date) || []);

    if (prevWeekBars.length > 0) {
      const prevWeekHigh = Math.max(...prevWeekBars.map((b) => b.high));
      const prevWeekLow = Math.min(...prevWeekBars.map((b) => b.low));

      levels.push({
        price: prevWeekHigh,
        type: "previous-week-high",
        label: `PWH: ${prevWeekHigh.toFixed(2)}`,
        color: "#3b82f6", // Blue
        style: "dashed",
      });

      levels.push({
        price: prevWeekLow,
        type: "previous-week-low",
        label: `PWL: ${prevWeekLow.toFixed(2)}`,
        color: "#f97316", // Orange
        style: "dashed",
      });
    }
  }

  return levels;
}

/**
 * Filter levels to show only enabled types
 */
export function filterKeyLevels(levels: KeyLevel[], enabledTypes: Set<string>): KeyLevel[] {
  return levels.filter((level) => enabledTypes.has(level.type));
}

/**
 * Find nearest level to current price
 */
export function getNearestLevel(levels: KeyLevel[], currentPrice: number): KeyLevel | null {
  if (levels.length === 0) return null;

  return levels.reduce((nearest, level) => {
    const currentDist = Math.abs(level.price - currentPrice);
    const nearestDist = Math.abs(nearest.price - currentPrice);
    return currentDist < nearestDist ? level : nearest;
  });
}

/**
 * Get distance to nearest level as percentage
 */
export function getDistanceToNearestLevel(levels: KeyLevel[], currentPrice: number): number | null {
  const nearest = getNearestLevel(levels, currentPrice);
  if (!nearest) return null;

  const distance = Math.abs(nearest.price - currentPrice);
  const percentage = (distance / currentPrice) * 100;
  return percentage;
}
