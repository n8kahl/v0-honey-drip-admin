/**
 * Technical indicator calculations for streaming chart data
 */

export interface IndicatorConfig {
  ema?: { periods: number[] }; // e.g., [8, 21, 50, 200]
  vwap?: { enabled: boolean; bands?: boolean };
  bollinger?: { period: number; stdDev: number }; // e.g., 20, 2
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  
  // Initialize with SMA for first period
  let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      result.push(ema);
    } else {
      ema = (data[i] - ema) * multiplier + ema;
      result.push(ema);
    }
  }
  
  return result;
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 */
export function calculateVWAP(bars: Bar[]): number[] {
  const result: number[] = [];
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;
  
  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativeTPV += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
    
    result.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice);
  }
  
  return result;
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  closes: number[],
  period: number,
  stdDev: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      middle.push(NaN);
      lower.push(NaN);
      continue;
    }
    
    const slice = closes.slice(i - period + 1, i + 1);
    const sma = slice.reduce((sum, val) => sum + val, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    middle.push(sma);
    upper.push(sma + stdDev * std);
    lower.push(sma - stdDev * std);
  }
  
  return { upper, middle, lower };
}

/**
 * Downsample data for performance optimization
 * Keeps every nth bar when chart updates are slow
 */
export function downsampleBars(bars: Bar[], targetCount: number): Bar[] {
  if (bars.length <= targetCount) return bars;
  
  const step = Math.ceil(bars.length / targetCount);
  const result: Bar[] = [];
  
  for (let i = 0; i < bars.length; i += step) {
    result.push(bars[i]);
  }
  
  // Always include the last bar
  if (result[result.length - 1] !== bars[bars.length - 1]) {
    result.push(bars[bars.length - 1]);
  }
  
  return result;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev: number | undefined;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (prev === undefined) prev = v;
    else prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsiWilder(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function atrWilder(
  high: number[],
  low: number[],
  close: number[],
  period = 14
): number[] {
  const n = close.length;
  const tr: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const prevClose = i > 0 ? close[i - 1] : close[i];
    tr[i] = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - prevClose),
      Math.abs(low[i] - prevClose)
    );
  }
  const out: number[] = new Array(n).fill(NaN);
  if (n <= period) return out;
  let atr = tr.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out[period - 1] = atr;
  for (let i = period; i < n; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    out[i] = atr;
  }
  return out;
}

export function vwapSession(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
  isSessionOpen: boolean[]
): number[] {
  const out: number[] = new Array(close.length).fill(NaN);
  let pvSum = 0;
  let vSum = 0;
  for (let i = 0; i < close.length; i++) {
    if (isSessionOpen[i]) {
      pvSum = 0;
      vSum = 0;
    }
    const typical = (high[i] + low[i] + close[i]) / 3;
    pvSum += typical * volume[i];
    vSum += volume[i];
    out[i] = vSum > 0 ? pvSum / vSum : NaN;
  }
  return out;
}
