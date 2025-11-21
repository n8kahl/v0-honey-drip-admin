/**
 * Candle Aggregation Utilities
 *
 * Pure functions for candle data aggregation and transformation:
 * - Roll up 1m bars into higher timeframes
 * - Parse Massive.com aggregate messages
 * - Detect timeframe from timestamps
 */

import type { Candle, Timeframe } from '../../stores/marketDataStore';

/** Massive.com aggregate bar message format */
export interface MassiveAggregateMessage {
  ev: 'AM';  // Aggregate Minute
  sym: string;
  v: number;  // volume
  av: number; // accumulated volume
  op: number; // open
  vw: number; // VWAP
  o: number;  // open
  c: number;  // close
  h: number;  // high
  l: number;  // low
  a: number;  // average/vwap
  s: number;  // start timestamp (ms)
  e: number;  // end timestamp (ms)
  n: number;  // number of trades
}

/**
 * Roll up 1m bars into higher timeframes (5m, 15m, 60m)
 * @param bars1m - Array of 1-minute candles
 * @param targetTF - Target timeframe to aggregate to
 * @returns Array of aggregated candles
 */
export function rollupBars(bars1m: Candle[], targetTF: Timeframe): Candle[] {
  if (bars1m.length === 0) return [];

  const minutesPerBar = targetTF === '5m' ? 5 : targetTF === '15m' ? 15 : targetTF === '60m' ? 60 : 1;
  if (minutesPerBar === 1) return bars1m;

  const rolled: Candle[] = [];
  let currentBar: Candle | null = null;

  for (const bar of bars1m) {
    const barTime = bar.time || bar.timestamp || 0;
    const barMinute = Math.floor(barTime / 60000) * 60000;
    const bucketStart = Math.floor(barMinute / (minutesPerBar * 60000)) * (minutesPerBar * 60000);

    if (!currentBar || (currentBar.time !== bucketStart)) {
      // Start new bucket
      if (currentBar) rolled.push(currentBar);
      currentBar = {
        time: bucketStart,
        timestamp: bucketStart,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        vwap: bar.vwap,
        trades: bar.trades || 0,
      };
    } else {
      // Update existing bucket
      currentBar.high = Math.max(currentBar.high, bar.high);
      currentBar.low = Math.min(currentBar.low, bar.low);
      currentBar.close = bar.close;
      currentBar.volume += bar.volume;
      if (bar.trades) currentBar.trades = (currentBar.trades || 0) + bar.trades;
      // VWAP: weighted average (simplified)
      if (bar.vwap && currentBar.vwap) {
        currentBar.vwap = (currentBar.vwap + bar.vwap) / 2;
      } else if (bar.vwap) {
        currentBar.vwap = bar.vwap;
      }
    }
  }

  if (currentBar) rolled.push(currentBar);
  return rolled;
}

/**
 * Map Massive aggregate bar message to our Candle format
 * @param msg - Massive.com aggregate message
 * @param timeframe - Timeframe of the candle
 * @returns Normalized candle object
 */
export function parseAggregateBar(msg: MassiveAggregateMessage, timeframe: Timeframe): Candle {
  return {
    time: msg.s,
    timestamp: msg.s,
    open: msg.o,
    high: msg.h,
    low: msg.l,
    close: msg.c,
    volume: msg.v,
    vwap: msg.vw || msg.a,
    trades: msg.n,
  };
}

/**
 * Determine timeframe from timestamp difference
 * @param startMs - Start timestamp in milliseconds
 * @param endMs - End timestamp in milliseconds
 * @returns Detected timeframe
 */
export function detectTimeframe(startMs: number, endMs: number): Timeframe {
  const diffMs = endMs - startMs;
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin <= 1) return '1m';
  if (diffMin <= 5) return '5m';
  if (diffMin <= 15) return '15m';
  if (diffMin <= 60) return '60m';
  return '1D';
}
