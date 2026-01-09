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
  const orbBars = bars.filter((b) => b.time >= marketOpenTime && b.time < windowEnd);

  if (orbBars.length === 0) {
    return { orbHigh: 0, orbLow: 0, orbBars: [] };
  }

  const orbHigh = Math.max(...orbBars.map((b) => b.high));
  const orbLow = Math.min(...orbBars.map((b) => b.low));

  return { orbHigh, orbLow, orbBars };
}

/**
 * Get market open time (9:30 ET) for a given date.
 *
 * @param timestamp Unix timestamp for any time on the trading day
 * @param timezone Timezone (default "America/New_York")
 */
export function getMarketOpenTime(
  timestamp: number,
  timezone: string = "America/New_York"
): number {
  const date = new Date(timestamp * 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  const marketOpenET = new Date(`${year}-${month}-${day}T09:30:00-05:00`);
  return Math.floor(marketOpenET.getTime() / 1000);
}

/**
 * Compute minutes since market open.
 *
 * @param timestamp Current bar time (Unix seconds)
 * @param timezone Timezone (default "America/New_York")
 */
export function getMinutesSinceOpen(
  timestamp: number,
  timezone: string = "America/New_York"
): number {
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

  const swingHigh = Math.max(...bars.map((b) => b.high));
  const swingLow = Math.min(...bars.map((b) => b.low));

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
export function isNearFibLevel(
  price: number,
  fibLevel: number,
  tolerance: number = 0.005
): boolean {
  return Math.abs(price - fibLevel) / price < tolerance;
}

/**
 * Compute consolidation range from recent bars.
 *
 * @param bars Recent bars (e.g., last 20)
 */
export function computeConsolidationRange(bars: Bar[]): {
  high: number;
  low: number;
  range: number;
} {
  if (!bars || bars.length === 0) {
    return { high: 0, low: 0, range: 0 };
  }

  const high = Math.max(...bars.map((b) => b.high));
  const low = Math.min(...bars.map((b) => b.low));
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
export function isVolumeSpike(
  currentVolume: number,
  avgVolume: number,
  threshold: number = 1.5
): boolean {
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
export function isBreakout(
  currentBar: Bar,
  consolidationHigh: number,
  consolidationLow: number
): {
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

/**
 * Calculate Relative Volume (RVOL) - current volume vs average
 * RVOL > 1.0 = above average, RVOL = 2.0 = 200% of average
 *
 * @param currentVolume Current bar/period volume
 * @param historicalBars Historical bars for baseline (typically 20 days)
 * @param samePeriod If true, only compare same time-of-day bars
 */
export function calculateRelativeVolume(
  currentVolume: number,
  historicalBars: Bar[],
  currentBarTime?: number,
  samePeriod: boolean = false
): number {
  if (!currentVolume || !historicalBars || historicalBars.length === 0) return 1.0;

  let avgVolume: number = 0;

  if (samePeriod && currentBarTime) {
    // Compare same time period (e.g., this 5m bar vs previous days' 5m bars at same time)
    // Converts timestamps to "minutes from midnight" to find matches
    const getMinutesFromMidnight = (ts: number): number => {
      const d = new Date(ts * 1000);
      return d.getHours() * 60 + d.getMinutes();
    };

    const targetMinutes = getMinutesFromMidnight(currentBarTime);

    // Filter bars that are within 2 minutes of the target time
    // This handles slight drift but ensures we compare apple-to-apples (e.g. 9:30 vs 9:30)
    const sameTimeBars = historicalBars.filter((b) => {
      // Don't include the current bar itself if it's in the list
      if (Math.abs(b.time - currentBarTime) < 60) return false;

      const m = getMinutesFromMidnight(b.time);
      return Math.abs(m - targetMinutes) <= 2;
    });

    if (sameTimeBars.length >= 3) {
      avgVolume = computeAvgVolume(sameTimeBars);
      // Debug log if needed
      // console.log(`[RVOL] Found ${sameTimeBars.length} matching bars for time ${targetMinutes}, avg: ${avgVolume}`);
    }
  }

  // Fallback to simple SMA if not enough same-period data
  if (avgVolume === 0) {
    avgVolume = computeAvgVolume(historicalBars);
  }

  if (avgVolume === 0) return 1.0;
  return currentVolume / avgVolume;
}

/**
 * RSI calculation helper
 *
 * @param bars Recent bars (needs at least period + 1 bars)
 * @param period RSI period (default 14)
 */
export function calculateRSI(bars: Bar[], period: number = 14): number | null {
  if (!bars || bars.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    changes.push(bars[i].close - bars[i - 1].close);
  }

  const recentChanges = changes.slice(-period);
  const gains = recentChanges.filter((c) => c > 0);
  const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Detect RSI divergence between price and RSI
 * Bullish divergence: Price makes lower low, RSI makes higher low (reversal signal)
 * Bearish divergence: Price makes higher high, RSI makes lower high (reversal signal)
 *
 * @param bars Price bars (needs at least 30+ for good detection)
 * @param rsiPeriod RSI calculation period (default 14)
 * @param lookback How many bars to look back for swing points (default 10)
 */
export function detectRSIDivergence(
  bars: Bar[],
  rsiPeriod: number = 14,
  lookback: number = 10
): { type: "bullish" | "bearish" | "none"; confidence: number } {
  if (!bars || bars.length < rsiPeriod + lookback + 5) {
    return { type: "none", confidence: 0 };
  }

  // Calculate RSI for all bars
  const rsiValues: number[] = [];
  for (let i = rsiPeriod; i < bars.length; i++) {
    const slice = bars.slice(i - rsiPeriod - 1, i + 1);
    const rsi = calculateRSI(slice, rsiPeriod);
    rsiValues.push(rsi ?? 50);
  }

  // Find recent swing lows/highs in price and RSI
  const recentBars = bars.slice(-lookback);
  const recentRSI = rsiValues.slice(-lookback);

  // Find lowest price and its RSI in lookback period
  let priceLowest = Infinity;
  let priceLowestIdx = 0;
  let priceHighest = -Infinity;
  let priceHighestIdx = 0;

  for (let i = 0; i < recentBars.length; i++) {
    if (recentBars[i].low < priceLowest) {
      priceLowest = recentBars[i].low;
      priceLowestIdx = i;
    }
    if (recentBars[i].high > priceHighest) {
      priceHighest = recentBars[i].high;
      priceHighestIdx = i;
    }
  }

  // Find previous swing low/high before recent
  const preLookbackBars = bars.slice(-lookback * 2, -lookback);
  const preLookbackRSI = rsiValues.slice(-lookback * 2, -lookback);

  if (preLookbackBars.length === 0) {
    return { type: "none", confidence: 0 };
  }

  let prevPriceLowest = Infinity;
  let prevPriceLowestIdx = 0;
  let prevPriceHighest = -Infinity;
  let prevPriceHighestIdx = 0;

  for (let i = 0; i < preLookbackBars.length; i++) {
    if (preLookbackBars[i].low < prevPriceLowest) {
      prevPriceLowest = preLookbackBars[i].low;
      prevPriceLowestIdx = i;
    }
    if (preLookbackBars[i].high > prevPriceHighest) {
      prevPriceHighest = preLookbackBars[i].high;
      prevPriceHighestIdx = i;
    }
  }

  // Bullish divergence: Price lower low, RSI higher low
  const priceLowerLow = priceLowest < prevPriceLowest;
  const rsiHigherLow = recentRSI[priceLowestIdx] > preLookbackRSI[prevPriceLowestIdx];

  if (priceLowerLow && rsiHigherLow) {
    const confidence = Math.min(
      100,
      Math.abs(recentRSI[priceLowestIdx] - preLookbackRSI[prevPriceLowestIdx]) * 2
    );
    return { type: "bullish", confidence };
  }

  // Bearish divergence: Price higher high, RSI lower high
  const priceHigherHigh = priceHighest > prevPriceHighest;
  const rsiLowerHigh = recentRSI[priceHighestIdx] < preLookbackRSI[prevPriceHighestIdx];

  if (priceHigherHigh && rsiLowerHigh) {
    const confidence = Math.min(
      100,
      Math.abs(recentRSI[priceHighestIdx] - preLookbackRSI[prevPriceHighestIdx]) * 2
    );
    return { type: "bearish", confidence };
  }

  return { type: "none", confidence: 0 };
}

/**
 * Detect multi-timeframe divergence between two timeframes
 * Used to confirm trend or spot reversals
 *
 * @param lowerTFBars Lower timeframe bars (e.g., 5m)
 * @param higherTFBars Higher timeframe bars (e.g., 15m)
 * @param rsiPeriod RSI period
 */
export function detectMultiTimeframeDivergence(
  lowerTFBars: Bar[],
  higherTFBars: Bar[],
  rsiPeriod: number = 14
): {
  lower: { type: "bullish" | "bearish" | "none"; confidence: number };
  higher: { type: "bullish" | "bearish" | "none"; confidence: number };
  aligned: boolean;
  strength: "strong" | "moderate" | "weak";
} {
  const lowerDiv = detectRSIDivergence(lowerTFBars, rsiPeriod);
  const higherDiv = detectRSIDivergence(higherTFBars, rsiPeriod);

  // Check if both timeframes show same divergence type
  const aligned = lowerDiv.type !== "none" && lowerDiv.type === higherDiv.type;

  let strength: "strong" | "moderate" | "weak" = "weak";
  if (aligned) {
    const avgConfidence = (lowerDiv.confidence + higherDiv.confidence) / 2;
    if (avgConfidence > 70) strength = "strong";
    else if (avgConfidence > 40) strength = "moderate";
  }

  return {
    lower: lowerDiv,
    higher: higherDiv,
    aligned,
    strength,
  };
}

/**
 * Detect price/volume divergence
 * Bullish: Price falling, volume declining (weak sellers)
 * Bearish: Price rising, volume declining (weak buyers)
 *
 * @param bars Recent bars (needs at least 10)
 */
export function detectPriceVolumeDivergence(bars: Bar[]): {
  type: "bullish" | "bearish" | "none";
  confidence: number;
} {
  if (!bars || bars.length < 10) {
    return { type: "none", confidence: 0 };
  }

  const recentBars = bars.slice(-10);
  const firstHalf = recentBars.slice(0, 5);
  const secondHalf = recentBars.slice(5);

  const firstAvgPrice = firstHalf.reduce((sum, b) => sum + b.close, 0) / 5;
  const secondAvgPrice = secondHalf.reduce((sum, b) => sum + b.close, 0) / 5;

  const firstAvgVolume = computeAvgVolume(firstHalf);
  const secondAvgVolume = computeAvgVolume(secondHalf);

  const priceChange = ((secondAvgPrice - firstAvgPrice) / firstAvgPrice) * 100;
  const volumeChange = ((secondAvgVolume - firstAvgVolume) / firstAvgVolume) * 100;

  // Bullish divergence: Price down, volume down (weak selling)
  if (priceChange < -1 && volumeChange < -10) {
    return { type: "bullish", confidence: Math.min(100, Math.abs(volumeChange)) };
  }

  // Bearish divergence: Price up, volume down (weak buying)
  if (priceChange > 1 && volumeChange < -10) {
    return { type: "bearish", confidence: Math.min(100, Math.abs(volumeChange)) };
  }

  return { type: "none", confidence: 0 };
}

/**
 * Detect multi-timeframe divergence from RSI snapshots
 * Simplified version that works with pre-calculated RSI values across timeframes
 *
 * @param mtfRsiData Map of timeframe to RSI and price data
 * @returns aligned: true if RSI is aligned across timeframes (all oversold or all overbought)
 */
export function detectMTFDivergenceFromRSI(
  mtfRsiData: Record<string, { rsi: number; price: number }>
): { aligned: boolean; direction: "bullish" | "bearish" | null } {
  const timeframes = Object.keys(mtfRsiData);

  if (timeframes.length < 2) {
    return { aligned: false, direction: null };
  }

  const rsiValues = timeframes.map((tf) => mtfRsiData[tf].rsi);
  const avgRSI = rsiValues.reduce((sum, rsi) => sum + rsi, 0) / rsiValues.length;

  // Check if all RSI values are in same zone
  const allOversold = rsiValues.every((rsi) => rsi < 35); // All oversold
  const allOverbought = rsiValues.every((rsi) => rsi > 65); // All overbought

  if (allOversold) {
    return { aligned: true, direction: "bullish" };
  }

  if (allOverbought) {
    return { aligned: true, direction: "bearish" };
  }

  // Check for general alignment (all RSI values within 15 points of average)
  const isAligned = rsiValues.every((rsi) => Math.abs(rsi - avgRSI) < 15);

  if (isAligned) {
    if (avgRSI < 40) return { aligned: true, direction: "bullish" };
    if (avgRSI > 60) return { aligned: true, direction: "bearish" };
  }

  return { aligned: false, direction: null };
}
