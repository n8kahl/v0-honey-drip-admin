import { Bar } from './types';

/**
 * Calculate Average True Range (ATR)
 * @param bars Array of OHLC bars
 * @param period ATR period (default 14)
 * @returns Current ATR value
 */
export function calculateATR(bars: Bar[], period: number = 14): number {
  if (bars.length < period + 1) {
    return 0;
  }

  const trueRanges: number[] = [];
  
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  // Calculate initial ATR (SMA of first period)
  let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
  
  // Calculate subsequent ATR using smoothing
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  
  return atr;
}

/**
 * Calculate VWAP and bands
 * @param bars Array of OHLC bars for current session
 * @returns VWAP, upper band, lower band
 */
export function calculateVWAP(bars: Bar[]): {
  vwap: number;
  upperBand: number;
  lowerBand: number;
} {
  if (bars.length === 0) {
    return { vwap: 0, upperBand: 0, lowerBand: 0 };
  }

  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;
  let cumulativeTPVSquared = 0;

  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    const tpv = typicalPrice * bar.volume;
    
    cumulativeTPV += tpv;
    cumulativeVolume += bar.volume;
    cumulativeTPVSquared += typicalPrice * typicalPrice * bar.volume;
  }

  const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
  
  // Calculate standard deviation
  const variance = (cumulativeTPVSquared / cumulativeVolume) - (vwap * vwap);
  const stdDev = Math.sqrt(Math.max(0, variance));
  
  return {
    vwap,
    upperBand: vwap + stdDev,
    lowerBand: vwap - stdDev,
  };
}

/**
 * Calculate Bollinger Bands
 * @param bars Array of OHLC bars
 * @param period Period for SMA (default 20)
 * @param stdDevMultiplier Standard deviation multiplier (default 2)
 * @returns Middle band (SMA), upper band, lower band
 */
export function calculateBollingerBands(
  bars: Bar[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  middle: number;
  upper: number;
  lower: number;
} {
  if (bars.length < period) {
    return { middle: 0, upper: 0, lower: 0 };
  }

  const closes = bars.slice(-period).map(b => b.close);
  const sma = closes.reduce((sum, close) => sum + close, 0) / period;
  
  const squaredDiffs = closes.map(close => Math.pow(close - sma, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    middle: sma,
    upper: sma + (stdDev * stdDevMultiplier),
    lower: sma - (stdDev * stdDevMultiplier),
  };
}

/**
 * Calculate Opening Range Breakout levels
 * @param bars Array of OHLC bars for the session
 * @param orbMinutes Number of minutes for ORB calculation (e.g., 15 for 15-min ORB)
 * @returns ORB high and low
 */
export function calculateORB(bars: Bar[], orbMinutes: number = 15): {
  high: number;
  low: number;
} {
  if (bars.length === 0) {
    return { high: 0, low: 0 };
  }

  // Assuming 1-minute bars, take first N bars for ORB
  const orbBars = bars.slice(0, orbMinutes);
  
  const high = Math.max(...orbBars.map(b => b.high));
  const low = Math.min(...orbBars.map(b => b.low));
  
  return { high, low };
}

/**
 * Calculate pre-market high/low
 * @param bars Array of OHLC bars from pre-market session
 * @returns Pre-market high and low
 */
export function calculatePreMarketLevels(bars: Bar[]): {
  high: number;
  low: number;
} {
  if (bars.length === 0) {
    return { high: 0, low: 0 };
  }

  const high = Math.max(...bars.map(b => b.high));
  const low = Math.min(...bars.map(b => b.low));
  
  return { high, low };
}
