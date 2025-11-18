/**
 * Pattern detection helpers for strategy evaluation.
 * Captures complex patterns like patient candles, ORB, consolidation, etc.
 */

export interface Bar {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Detect if a bar is a "patient candle" - small body relative to ATR.
 * Patient candle = consolidation before breakout.
 * 
 * @param bar Current bar
 * @param atr Average True Range
 * @param threshold Body must be <= threshold * ATR (default 0.3)
 */
export function isPatientCandle(bar: Bar, atr: number, threshold: number = 0.3): boolean {
  if (!bar || !atr || atr <= 0) return false;
  const body = Math.abs(bar.close - bar.open);
  return body <= atr * threshold;
}

/**
 * Compute Opening Range Breakout levels from bars at market open.
 * 
 * @param bars All bars (sorted chronologically)
 * @param marketOpenTime Unix timestamp of market open (9:30 ET)
 * @param windowMinutes How many minutes after open define the range (default 15)
 */
export function computeORBLevels(
  bars: Bar[],
  marketOpenTime: number,
  windowMinutes: number = 15
): { orbHigh: number; orbLow: number; orbBars: Bar[] } {
  if (!bars || bars.length === 0) {
    return { orbHigh: 0, orbLow: 0, orbBars: [] };
  }

  const windowEnd = marketOpenTime + windowMinutes * 60;
  const orbBars = bars.filter(b => b.time >= marketOpenTime && b.time < windowEnd);

  if (orbBars.length === 0) {
    return { orbHigh: 0, orbLow: 0, orbBars: [] };
  }

  const orbHigh = Math.max(...orbBars.map(b => b.high));
  const orbLow = Math.min(...orbBars.map(b => b.low));

  return { orbHigh, orbLow, orbBars };
}

/**
 * Get market open time (9:30 ET) for a given date.
 * 
 * @param timestamp Unix timestamp for any time on the trading day
 * @param timezone Timezone (default "America/New_York")
 */
export function getMarketOpenTime(timestamp: number, timezone: string = 'America/New_York'): number {
  const date = new Date(timestamp * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  const marketOpenET = new Date(`${year}-${month}-${day}T09:30:00-05:00`);
  return Math.floor(marketOpenET.getTime() / 1000);
}

/**
 * Compute minutes since market open.
 * 
 * @param timestamp Current bar time (Unix seconds)
 * @param timezone Timezone (default "America/New_York")
 */
export function getMinutesSinceOpen(timestamp: number, timezone: string = 'America/New_York'): number {
  const marketOpen = getMarketOpenTime(timestamp, timezone);
  return Math.floor((timestamp - marketOpen) / 60);
}

/**
 * Compute swing high/low from recent bars.
 * 
 * @param bars Recent bars (already sliced)
 */
export function computeSwingLevels(bars: Bar[]): { swingHigh: number; swingLow: number } {
  if (!bars || bars.length === 0) {
    return { swingHigh: 0, swingLow: 0 };
  }

  const swingHigh = Math.max(...bars.map(b => b.high));
  const swingLow = Math.min(...bars.map(b => b.low));

  return { swingHigh, swingLow };
}

/**
 * Compute Fibonacci retracement levels.
 * 
 * @param swingHigh Recent high
 * @param swingLow Recent low
 */
export function computeFibLevels(swingHigh: number, swingLow: number) {
  const range = swingHigh - swingLow;
  return {
    fib236: swingHigh - range * 0.236,
    fib382: swingHigh - range * 0.382,
    fib500: swingHigh - range * 0.5,
    fib618: swingHigh - range * 0.618,
    fib786: swingHigh - range * 0.786,
  };
}

/**
 * Detect if price is near a Fibonacci level.
 * 
 * @param price Current price
 * @param fibLevel Fibonacci level
 * @param tolerance Percent tolerance (default 0.5%)
 */
export function isNearFibLevel(price: number, fibLevel: number, tolerance: number = 0.005): boolean {
  return Math.abs(price - fibLevel) / price < tolerance;
}

/**
 * Compute consolidation range from recent bars.
 * 
 * @param bars Recent bars (e.g., last 20)
 */
export function computeConsolidationRange(bars: Bar[]): { high: number; low: number; range: number } {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0, range: 0 };
  }

  const high = Math.max(...bars.map(b => b.high));
  const low = Math.min(...bars.map(b => b.low));
  const range = high - low;

  return { high, low, range };
}

/**
 * Detect volume spike.
 * 
 * @param currentVolume Current bar volume
 * @param avgVolume Average volume (e.g., last 10 bars)
 * @param threshold Multiplier (default 1.5x)
 */
export function isVolumeSpike(currentVolume: number, avgVolume: number, threshold: number = 1.5): boolean {
  return currentVolume > avgVolume * threshold;
}

/**
 * Detect if bars represent consolidation (tight range).
 * 
 * @param bars Recent bars
 * @param atr Average True Range
 * @param threshold Range must be <= threshold * ATR (default 2.0)
 */
export function isConsolidation(bars: Bar[], atr: number, threshold: number = 2.0): boolean {
  if (!bars || bars.length === 0 || !atr || atr <= 0) return false;
  
  const { range } = computeConsolidationRange(bars);
  return range <= atr * threshold;
}

/**
 * Detect breakout from consolidation.
 * 
 * @param currentBar Current bar
 * @param consolidationHigh High of consolidation range
 * @param consolidationLow Low of consolidation range
 */
export function isBreakout(currentBar: Bar, consolidationHigh: number, consolidationLow: number): {
  bullish: boolean;
  bearish: boolean;
} {
  return {
    bullish: currentBar.close > consolidationHigh,
    bearish: currentBar.close < consolidationLow,
  };
}

/**
 * Compute average volume from recent bars.
 * 
 * @param bars Recent bars
 */
export function computeAvgVolume(bars: Bar[]): number {
  if (!bars || bars.length === 0) return 0;
  const sum = bars.reduce((acc, b) => acc + b.volume, 0);
  return sum / bars.length;
}
