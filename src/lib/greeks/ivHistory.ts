/**
 * ivHistory.ts - IV Rank & IV Percentile Tracking
 *
 * Tracks historical implied volatility to detect:
 * - IV crush (post-earnings, post-FOMC)
 * - IV rank/percentile (for optimal strategy selection)
 * - High IV (good for selling options)
 * - Low IV (good for buying options)
 */

export interface IVReading {
  timestamp: number;
  iv: number;
  source: 'massive' | 'tradier' | 'manual';
}

export interface IVStats {
  current: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  percentile: number; // 0-100, current IV relative to history
  rank: number; // 0-100, same as percentile
  isHigh: boolean; // Above 75th percentile
  isLow: boolean; // Below 25th percentile
}

// Store last 100 readings per symbol (can represent days, hours, or minutes depending on update frequency)
const MAX_HISTORY_SIZE = 100;
const MIN_HISTORY_FOR_STATS = 10;

// Map: symbol -> history of IV readings
const ivHistoryMap = new Map<string, IVReading[]>();

/**
 * Record a new IV reading for a symbol
 */
export function recordIV(symbol: string, iv: number, source: 'massive' | 'tradier' | 'manual' = 'massive'): void {
  if (!Number.isFinite(iv) || iv < 0) {
    console.warn(`[IVHistory] Invalid IV value for ${symbol}:`, iv);
    return;
  }

  const normalized = symbol.toUpperCase();
  const history = ivHistoryMap.get(normalized) || [];

  history.push({
    timestamp: Date.now(),
    iv,
    source,
  });

  // Keep only last MAX_HISTORY_SIZE readings
  if (history.length > MAX_HISTORY_SIZE) {
    history.shift();
  }

  ivHistoryMap.set(normalized, history);

  // Log occasionally for debugging
  if (history.length % 10 === 0) {
    console.log(`[IVHistory] ${normalized}: ${history.length} readings, latest IV: ${(iv * 100).toFixed(1)}%`);
  }
}

/**
 * Get IV statistics for a symbol
 */
export function getIVStats(symbol: string): IVStats | null {
  const normalized = symbol.toUpperCase();
  const history = ivHistoryMap.get(normalized);

  if (!history || history.length < MIN_HISTORY_FOR_STATS) {
    return null; // Not enough data
  }

  const ivValues = history.map(r => r.iv);
  const current = ivValues[ivValues.length - 1];

  // Calculate min, max, mean
  const min = Math.min(...ivValues);
  const max = Math.max(...ivValues);
  const sum = ivValues.reduce((a, b) => a + b, 0);
  const mean = sum / ivValues.length;

  // Calculate standard deviation
  const squaredDiffs = ivValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / ivValues.length;
  const stdDev = Math.sqrt(variance);

  // Calculate percentile (what % of history is below current IV)
  const sorted = [...ivValues].sort((a, b) => a - b);
  const rank = sorted.filter(v => v < current).length;
  const percentile = (rank / sorted.length) * 100;

  // Determine if high or low
  const isHigh = percentile >= 75;
  const isLow = percentile <= 25;

  return {
    current,
    min,
    max,
    mean,
    stdDev,
    percentile,
    rank: percentile,
    isHigh,
    isLow,
  };
}

/**
 * Get raw IV history for a symbol
 */
export function getIVHistory(symbol: string): IVReading[] {
  const normalized = symbol.toUpperCase();
  return ivHistoryMap.get(normalized) || [];
}

/**
 * Detect if IV has crushed (dropped significantly)
 * Returns { isCrush: boolean, dropPercent: number }
 */
export function detectIVCrush(symbol: string, lookbackWindow: number = 5): { isCrush: boolean; dropPercent: number } {
  const normalized = symbol.toUpperCase();
  const history = ivHistoryMap.get(normalized);

  if (!history || history.length < lookbackWindow + 1) {
    return { isCrush: false, dropPercent: 0 };
  }

  const recent = history.slice(-lookbackWindow - 1);
  const recentValues = recent.map(r => r.iv);

  // Compare current IV to average of previous N readings
  const current = recentValues[recentValues.length - 1];
  const previousAvg = recentValues.slice(0, -1).reduce((a, b) => a + b, 0) / lookbackWindow;

  const dropPercent = ((previousAvg - current) / previousAvg) * 100;

  // IV crush defined as >20% drop from recent average
  const isCrush = dropPercent > 20;

  if (isCrush) {
    console.log(`[IVHistory] 🔻 IV CRUSH detected for ${normalized}: ${dropPercent.toFixed(1)}% drop (${(previousAvg * 100).toFixed(1)}% → ${(current * 100).toFixed(1)}%)`);
  }

  return { isCrush, dropPercent };
}

/**
 * Detect if IV has spiked (increased significantly)
 * Returns { isSpike: boolean, risePercent: number }
 */
export function detectIVSpike(symbol: string, lookbackWindow: number = 5): { isSpike: boolean; risePercent: number } {
  const normalized = symbol.toUpperCase();
  const history = ivHistoryMap.get(normalized);

  if (!history || history.length < lookbackWindow + 1) {
    return { isSpike: false, risePercent: 0 };
  }

  const recent = history.slice(-lookbackWindow - 1);
  const recentValues = recent.map(r => r.iv);

  // Compare current IV to average of previous N readings
  const current = recentValues[recentValues.length - 1];
  const previousAvg = recentValues.slice(0, -1).reduce((a, b) => a + b, 0) / lookbackWindow;

  const risePercent = ((current - previousAvg) / previousAvg) * 100;

  // IV spike defined as >30% rise from recent average
  const isSpike = risePercent > 30;

  if (isSpike) {
    console.log(`[IVHistory] 📈 IV SPIKE detected for ${normalized}: ${risePercent.toFixed(1)}% rise (${(previousAvg * 100).toFixed(1)}% → ${(current * 100).toFixed(1)}%)`);
  }

  return { isSpike, risePercent };
}

/**
 * Clear IV history for a symbol (or all if no symbol specified)
 */
export function clearIVHistory(symbol?: string): void {
  if (symbol) {
    const normalized = symbol.toUpperCase();
    ivHistoryMap.delete(normalized);
    console.log(`[IVHistory] Cleared history for ${normalized}`);
  } else {
    ivHistoryMap.clear();
    console.log('[IVHistory] Cleared all IV history');
  }
}

/**
 * Get summary of all tracked symbols
 */
export function getTrackedSymbols(): Array<{ symbol: string; readingCount: number; latestIV: number }> {
  const symbols: Array<{ symbol: string; readingCount: number; latestIV: number }> = [];

  ivHistoryMap.forEach((history, symbol) => {
    if (history.length > 0) {
      const latest = history[history.length - 1];
      symbols.push({
        symbol,
        readingCount: history.length,
        latestIV: latest.iv,
      });
    }
  });

  return symbols.sort((a, b) => a.symbol.localeCompare(b.symbol));
}
