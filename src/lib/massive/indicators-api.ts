// Technical Indicators API for OPTIONS ADVANCED
// Fetches pre-computed indicators from Massive.com

import { massive } from ".";
import { calculateEMA as centralEMA } from "../indicators";

const INDEX_TICKERS = ["SPX", "NDX", "VIX", "RUT"];
const INDICATOR_CACHE_TTL = 60_000; // 60 seconds
const FAILURE_COOLDOWN = 300_000; // 5 minutes cooldown for failed fetches

// Cache: symbol+indicator_key -> { data, timestamp }
const indicatorCache = new Map<string, { data: IndicatorResponse; timestamp: number }>();
// Track failed fetches to prevent infinite retries
const failedFetches = new Map<string, number>();

// Helper to generate cache key
function getCacheKey(symbol: string, indicators: IndicatorRequest): string {
  const indicatorStr = JSON.stringify(indicators);
  return `${symbol}:${indicatorStr}`;
}

// Helper to check if cache entry is expired
function isCacheExpired(timestamp: number): boolean {
  return Date.now() - timestamp > INDICATOR_CACHE_TTL;
}

// Cleanup expired cache entries periodically
setInterval(() => {
  for (const [key, value] of indicatorCache.entries()) {
    if (isCacheExpired(value.timestamp)) {
      indicatorCache.delete(key);
    }
  }
}, INDICATOR_CACHE_TTL);

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
  macd?: Array<{
    fast: number;
    slow: number;
    signal: number;
    macd: number[];
    signal_line: number[];
    histogram: number[];
  }>;
  bollinger?: Array<{
    length: number;
    stddev: number;
    upper: number[];
    middle: number[];
    lower: number[];
  }>;
}

/**
 * Fetch technical indicators for a symbol
 * Uses 60-second TTL cache to avoid duplicate REST calls
 */
export async function fetchIndicators(
  symbol: string,
  indicators: IndicatorRequest,
  timeframe: "1" | "5" | "15" | "60" = "1",
  lookback: number = 200
): Promise<IndicatorResponse> {
  const cacheKey = getCacheKey(symbol, indicators);

  // Check cache first
  const cached = indicatorCache.get(cacheKey);
  if (cached && !isCacheExpired(cached.timestamp)) {
    console.log(`[IndicatorsAPI] ✅ Cache hit for ${cacheKey}`);
    return cached.data;
  }

  // Check if this fetch recently failed - use cooldown
  const lastFailure = failedFetches.get(cacheKey);
  if (lastFailure && Date.now() - lastFailure < FAILURE_COOLDOWN) {
    console.warn(`[IndicatorsAPI] ⏰ Cooldown active for ${cacheKey}, returning cached/empty`);
    return cached?.data || { timestamp: Date.now() };
  }

  console.log(
    `[IndicatorsAPI] 🔄 Fetching indicators for ${symbol}: ${JSON.stringify(indicators)}`
  );

  const response: IndicatorResponse = {
    timestamp: Date.now(),
  };

  try {
    // Determine if symbol is an index
    const isIndex = symbol.startsWith("I:") || INDEX_TICKERS.includes(symbol);
    const aggSymbol = isIndex ? (symbol.startsWith("I:") ? symbol : `I:${symbol}`) : symbol;

    // Fetch aggregates
    const bars = await massive.getAggregates(aggSymbol, timeframe, lookback);

    if (bars.length === 0) {
      console.warn(`[IndicatorsAPI] No bars returned for ${symbol}`);
      indicatorCache.set(cacheKey, { data: response, timestamp: Date.now() });
      return response;
    }

    // Extract price data
    const closes = bars.map((b) => b.c);
    const highs = bars.map((b) => b.h);
    const lows = bars.map((b) => b.l);

    // Calculate requested indicators
    if (indicators.ema) {
      response.ema = {};
      for (const period of indicators.ema) {
        response.ema[period] = centralEMA(closes, period);
      }
    }

    if (indicators.sma) {
      response.sma = {};
      for (const period of indicators.sma) {
        response.sma[period] = calculateSMA(closes, period);
      }
    }

    if (indicators.rsi) {
      response.rsi = {};
      for (const period of indicators.rsi) {
        response.rsi[period] = calculateRSI(closes, period);
      }
    }

    if (indicators.atr) {
      response.atr = {};
      for (const period of indicators.atr) {
        response.atr[period] = calculateATR(highs, lows, closes, period);
      }
    }

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

    // Cache the successful response
    indicatorCache.set(cacheKey, { data: response, timestamp: Date.now() });
    // Clear any failure tracking
    failedFetches.delete(cacheKey);

    console.log(`[IndicatorsAPI] ✅ Successfully fetched and cached indicators for ${symbol}`);
    return response;
  } catch (error) {
    console.error(`[IndicatorsAPI] ❌ Failed to fetch indicators for ${symbol}:`, error);
    // Track the failure
    failedFetches.set(cacheKey, Date.now());
    // Return cached data if available, otherwise empty response
    return cached?.data || response;
  }
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
      const squaredDiffs = data.slice(i - period + 1, i + 1).map((x) => Math.pow(x - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      result.push(Math.sqrt(variance));
    }
  }

  return result;
}
