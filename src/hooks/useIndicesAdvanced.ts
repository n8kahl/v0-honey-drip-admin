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

    // Initial fetch via REST
    const initialFetch = async () => {
      try {
        const data = await fetchIndexQuote(symbol);
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

    // Subscribe to WebSocket for real-time updates
    const handle = streamingManager.subscribe(
      symbol,
      ['quotes'],
      (data) => {
        if (!mounted) return;
        
        console.log(`[useStreamingIndex] Received ${symbol} quote:`, data);
        
        setQuote({
          symbol,
          value: data.price || data.last || 0,
          change: data.change || 0,
          changePercent: data.changePercent || 0,
          timestamp: data.timestamp || Date.now(),
          asOf: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
        });
        setDataSource('websocket');
        setLastUpdateTime(Date.now());
        setError(null);
      }
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
