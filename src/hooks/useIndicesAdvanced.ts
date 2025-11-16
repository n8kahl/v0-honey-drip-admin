import { useState, useEffect } from 'react';
import { gatherMacroContext, MacroContext, fetchIndexQuote, IndexQuote } from '../lib/massive/indices-advanced';
import { streamingManager } from '../lib/massive/streaming-manager';

/**
 * Hook for streaming index quotes with WebSocket
 */
export function useStreamingIndex(symbol: string): {
  quote: IndexQuote | null;
  isLoading: boolean;
  error: string | null;
  dataSource: 'websocket' | 'rest';
  isStale: boolean;
} {
  const [quote, setQuote] = useState<IndexQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'websocket' | 'rest'>('rest');
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  useEffect(() => {
    console.log(`[useStreamingIndex] Subscribing to ${symbol}`);
    let mounted = true;
    const massiveSymbol = symbol.startsWith('I:') ? symbol : `I:${symbol}`;

    const initialFetch = async () => {
      try {
        const data = await fetchIndexQuote(massiveSymbol);
        if (mounted) {
          setQuote(data);
          setIsLoading(false);
          setLastUpdateTime(Date.now());
          setDataSource('rest');
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch index quote');
          setIsLoading(false);
        }
      }
    };

    initialFetch();

    const handle = streamingManager.subscribe(
      massiveSymbol,
      ['quotes'],
      (update) => {
        if (!mounted) return;

        const payload = (update as any)?.data ?? update;
        console.log(`[useStreamingIndex] Received ${massiveSymbol} quote:`, payload);

        const nextQuote: IndexQuote = {
          symbol: payload?.symbol || symbol,
          value: payload?.value ?? payload?.last ?? payload?.price ?? 0,
          change: payload?.change ?? 0,
          changePercent: payload?.changePercent ?? payload?.change_percent ?? 0,
          timestamp: payload?.timestamp ?? payload?.t ?? Date.now(),
          asOf: new Date(payload?.timestamp ?? payload?.t ?? Date.now()).toLocaleTimeString(),
        };

        setQuote(nextQuote);
        setDataSource('websocket');
        setLastUpdateTime(Date.now());
        setError(null);
      },
      { isIndex: true }
    );

    return () => {
      mounted = false;
      streamingManager.unsubscribe(handle);
    };
  }, [symbol]);

  // Check if data is stale (>5s for WS, >6s for REST)
  const isStale = dataSource === 'websocket' 
    ? Date.now() - lastUpdateTime > 5000
    : Date.now() - lastUpdateTime > 6000;

  return { quote, isLoading, error, dataSource, isStale };
}

/**
 * Hook for macro context with auto-refresh
 */
export function useMacroContext(refreshInterval: number = 30000): {
  macro: MacroContext | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [macro, setMacro] = useState<MacroContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      console.log('[useMacroContext] Gathering macro context');
      const data = await gatherMacroContext();
      setMacro(data);
      setError(null);
    } catch (err) {
      console.error('[useMacroContext] Failed to gather macro context:', err);
      setError(err instanceof Error ? err.message : 'Failed to gather macro context');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { macro, isLoading, error, refresh };
}
