// Technical Indicators API for OPTIONS ADVANCED
// Fetches pre-computed indicators from Massive.com

import { massiveClient } from './client';

export interface IndicatorRequest {
  ema?: number[]; // Periods for EMA
  sma?: number[]; // Periods for SMA
  rsi?: number[]; // Periods for RSI
  atr?: number[]; // Periods for ATR
  macd?: { fast: number; slow: number; signal: number }[];
  bollinger?: { length: number; stddev: number }[];
}

export interface IndicatorResponse {
  timestamp: number;
  ema?: Record<number, number[]>;
  sma?: Record<number, number[]>;
  rsi?: Record<number, number[]>;
  atr?: Record<number, number[]>;
  macd?: Array<{ fast: number; slow: number; signal: number; macd: number[]; signal_line: number[]; histogram: number[] }>;
  bollinger?: Array<{ length: number; stddev: number; upper: number[]; middle: number[]; lower: number[] }>;
}

/**
 * Fetch technical indicators for a symbol
 */
export async function fetchIndicators(
  symbol: string,
  indicators: IndicatorRequest,
  timeframe: '1' | '5' | '15' | '60' = '1',
  lookback: number = 200
): Promise<IndicatorResponse> {
  console.log(`[IndicatorsAPI] Fetching indicators for ${symbol}: ${JSON.stringify(indicators)}`);
  
  // For now, calculate indicators client-side from aggregates
  // TODO: Use Massive.com's pre-computed indicator endpoints when available
  
  const response: IndicatorResponse = {
    timestamp: Date.now(),
  };
  
  // Fetch historical aggregates
  const bars = await massiveClient.getAggregates(symbol, timeframe, lookback);
  
  if (bars.length === 0) {
    return response;
  }
  
  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  
  // Calculate EMAs
  if (indicators.ema) {
    response.ema = {};
    for (const period of indicators.ema) {
      response.ema[period] = calculateEMA(closes, period);
    }
  }
  
  // Calculate SMAs
  if (indicators.sma) {
    response.sma = {};
    for (const period of indicators.sma) {
      response.sma[period] = calculateSMA(closes, period);
    }
  }
  
  // Calculate RSI
  if (indicators.rsi) {
    response.rsi = {};
    for (const period of indicators.rsi) {
      response.rsi[period] = calculateRSI(closes, period);
    }
  }
  
  // Calculate ATR
  if (indicators.atr) {
    response.atr = {};
    for (const period of indicators.atr) {
      response.atr[period] = calculateATR(highs, lows, closes, period);
    }
  }
  
  // Calculate Bollinger Bands
  if (indicators.bollinger) {
    response.bollinger = [];
    for (const config of indicators.bollinger) {
      const { length, stddev } = config;
      const sma = calculateSMA(closes, length);
      const std = calculateStdDev(closes, length);
      
      const upper = sma.map((s, i) => s + stddev * std[i]);
      const lower = sma.map((s, i) => s - stddev * std[i]);
      
      response.bollinger.push({
        length,
        stddev,
        upper,
        middle: sma,
        lower,
      });
    }
  }
  
  return response;
}

// Helper indicator calculations
function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  
  // Calculate EMA for rest of data
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
    result.push(ema);
  }
  
  return result;
}

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  
  return result;
}

function calculateRSI(data: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(NaN);
      continue;
    }
    
    let gains = 0;
    let losses = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      const change = data[j] - data[j - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  
  return result;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const result: number[] = [];
  const trueRanges: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }
  
  // Calculate ATR as SMA of true ranges
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  
  return result;
}

function calculateStdDev(data: number[], period: number): number[] {
  const result: number[] = [];
  const sma = calculateSMA(data, period);
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const mean = sma[i];
      const squaredDiffs = data.slice(i - period + 1, i + 1).map(x => Math.pow(x - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      result.push(Math.sqrt(variance));
    }
  }
  
  return result;
}
