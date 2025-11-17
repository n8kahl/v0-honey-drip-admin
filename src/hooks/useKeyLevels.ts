import { useEffect, useState, useCallback } from 'react';
import { Bar } from '../lib/indicators';
import { KeyLevels } from '../lib/riskEngine/types';
import { computeKeyLevelsFromBars } from '../lib/riskEngine/computeKeyLevels';
import { getOptionBars, getIndexBars, getStockBars, MassiveError } from '../lib/massive/proxy';

const INDEX_TICKERS = new Set(['SPX', 'NDX', 'VIX', 'RUT']);

const formatIsoDate = (date: Date) => date.toISOString().split('T')[0];

/**
 * Hook to fetch historical bars for a ticker and compute key technical levels
 * 
 * Used to populate ORB, VWAP, Bollinger Bands, daily/weekly/monthly pivots
 * for risk calculation and chart display.
 */
export function useKeyLevels(
  ticker: string,
  options?: {
    timeframe?: '1' | '5' | '15' | '60';
    lookbackDays?: number;
    orbWindow?: number;
    enabled?: boolean;
  }
) {
  const {
    timeframe = '5',
    lookbackDays = 5,
    orbWindow = 5,
    enabled = true,
  } = options || {};

  const [keyLevels, setKeyLevels] = useState<KeyLevels | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBars = useCallback(async () => {
    if (!enabled || !ticker) {
      setKeyLevels(null);
      setBars([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isOption = ticker.startsWith('O:');
      const isIndex = ticker.startsWith('I:') || INDEX_TICKERS.has(ticker);
      const symbolParam = isIndex ? (ticker.startsWith('I:') ? ticker : `I:${ticker}`) : ticker;
      const multiplier = Number(timeframe) || 1;
      const timespan = 'minute';
      
      const toDate = formatIsoDate(new Date());
      const fromDate = formatIsoDate(
        new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
      );

      const limit = Math.min(5000, Math.ceil((lookbackDays * 24 * 60) / multiplier) + 50);
      
      const fetcher = isOption ? getOptionBars : isIndex ? getIndexBars : getStockBars;
      const response = await fetcher(symbolParam, multiplier, timespan, fromDate, toDate, limit);

      const results = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response)
        ? response
        : [];

      if (!Array.isArray(results) || results.length === 0) {
        console.warn(`[useKeyLevels] No bars returned for ${ticker}`);
        setKeyLevels(null);
        setBars([]);
        return;
      }

      const parsed: Bar[] = results.map((r: any) => ({
        time: Math.floor(r.t / 1000),
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: r.v,
        vwap: r.vw,
      }));

      setBars(parsed);

      // Compute key levels from bars
      const computed = computeKeyLevelsFromBars(parsed, orbWindow);
      setKeyLevels(computed);

      console.log(`[useKeyLevels] Computed levels for ${ticker}:`, computed);
    } catch (err: any) {
      const msg = err instanceof MassiveError ? err.message : String(err);
      console.error(`[useKeyLevels] Failed to fetch bars for ${ticker}:`, err);
      setError(msg);
      setKeyLevels(null);
      setBars([]);
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe, lookbackDays, orbWindow, enabled]);

  useEffect(() => {
    fetchBars();
  }, [fetchBars]);

  return { keyLevels, bars, loading, error };
}
