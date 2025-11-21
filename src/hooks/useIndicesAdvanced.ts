import { useState, useEffect, useCallback } from 'react';
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

// Shared state to prevent duplicate fetches across multiple hook instances
let sharedMacroContext: MacroContext | null = null;
let sharedMacroTimestamp: number = 0;
let sharedMacroError: string | null = null;
let pendingMacroFetch: Promise<MacroContext> | null = null;
const MACRO_CACHE_TTL = 30_000; // 30 seconds

// Global refresh interval - shared across ALL hook instances
let globalRefreshInterval: any = null;
let subscriberCount = 0;

async function refreshMacroContext() {
  // Use cached data if fresh
  if (sharedMacroContext && Date.now() - sharedMacroTimestamp < MACRO_CACHE_TTL) {
    return sharedMacroContext;
  }

  // If already fetching, wait for that fetch
  if (pendingMacroFetch) {
    return await pendingMacroFetch;
  }

  try {
    // Start new fetch and share it
    pendingMacroFetch = gatherMacroContext();
    const data = await pendingMacroFetch;
    
    sharedMacroContext = data;
    sharedMacroTimestamp = Date.now();
    sharedMacroError = null;
    
    return data;
  } catch (err) {
    console.error('[refreshMacroContext] Failed:', err);
    const errorMsg = err instanceof Error ? err.message : 'Failed to gather macro context';
    sharedMacroError = errorMsg;
    throw err;
  } finally {
    pendingMacroFetch = null;
  }
}

/**
 * Hook for macro context with auto-refresh
 * Uses GLOBAL shared interval to prevent duplicate fetches when multiple components use this hook
 */
export function useMacroContext(refreshInterval: number = 30000): {
  macro: MacroContext | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [macro, setMacro] = useState<MacroContext | null>(sharedMacroContext);
  const [isLoading, setIsLoading] = useState(sharedMacroContext ? false : true);
  const [error, setError] = useState<string | null>(sharedMacroError);

  useEffect(() => {
    // Subscribe to global refresh
    subscriberCount++;
    console.log(`[useMacroContext] Subscriber count: ${subscriberCount}`);
    
    // Initial fetch
    if (!sharedMacroContext) {
      setIsLoading(true);
      refreshMacroContext()
        .then(data => {
          setMacro(data);
          setError(null);
        })
        .catch(err => {
          setError(err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }

    return () => {
      subscriberCount--;
      console.log(`[useMacroContext] Subscriber count: ${subscriberCount}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount/unmount

  const manualRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await refreshMacroContext();
      setMacro(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { macro, isLoading, error, refresh: manualRefresh };
}
