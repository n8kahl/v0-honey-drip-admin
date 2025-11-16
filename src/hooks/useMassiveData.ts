import { useState, useEffect, useCallback, useRef } from 'react';
import { massiveClient, hasApiKey, type MassiveQuote, type MassiveOptionsChain } from '../lib/massive/client';
import { MassiveError } from '../lib/massive/proxy';
import { createTransport } from '../lib/massive/transport-policy';
import type { Contract } from '../types';

export function useMassiveData() {
  const fetchOptionsChain = async (symbol: string, expiry?: string): Promise<Contract[]> => {
    console.log(`[v0] Fetching real options chain for ${symbol}`);
    
    try {
      const data = await massiveClient.getOptionsChain(symbol, expiry);
      console.log(`[v0] Received options chain data:`, data);
      
      const contracts: Contract[] = data.results.map((opt: any) => ({
        id: opt.ticker || `${symbol}-${opt.strike}-${opt.expiration}`,
        strike: parseFloat(opt.strike),
        expiry: opt.expiration_date || opt.expiration,
        expiryDate: new Date(opt.expiration_date || opt.expiration),
        daysToExpiry: opt.days_to_expiration || Math.ceil((new Date(opt.expiration_date || opt.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        type: opt.contract_type === 'call' ? 'C' as const : 'P' as const,
        mid: (opt.bid + opt.ask) / 2 || opt.last_quote?.midpoint || 0,
        bid: opt.bid || opt.last_quote?.bid || 0,
        ask: opt.ask || opt.last_quote?.ask || 0,
        volume: opt.day_volume || 0,
        openInterest: opt.open_interest || 0,
        delta: opt.greeks?.delta,
        gamma: opt.greeks?.gamma,
        theta: opt.greeks?.theta,
        vega: opt.greeks?.vega,
        iv: opt.implied_volatility,
      }));
      
      console.log(`[v0] Transformed contracts:`, contracts.length, 'contracts');
      return contracts;
    } catch (error: any) {
      console.error('[v0] Failed to fetch options chain:', error);
      throw error;
    }
  };

  return {
    fetchOptionsChain,
  };
}

export function useQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Map<string, MassiveQuote & { asOf: number; source: 'websocket' | 'rest' }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (symbols.length === 0) {
      setLoading(false);
      return;
    }

    console.log('[useQuotes] Starting streaming for symbols:', symbols);

    const unsubscribes: Array<() => void> = [];

    symbols.forEach(symbol => {
      const isIndex = symbol.startsWith('I:') || ['SPX', 'NDX', 'VIX', 'RUT'].includes(symbol);
      
      const unsubscribe = createTransport(
        symbol,
        (data, source, timestamp) => {
          console.log(`[useQuotes] Received ${source} update for ${symbol}:`, data);
          
          setQuotes(prev => {
            const next = new Map(prev);
            const quote: MassiveQuote & { asOf: number; source: 'websocket' | 'rest' } = {
              symbol: data.symbol || symbol,
              last: data.last || data.value || data.price || 0,
              change: data.change || 0,
              changePercent: data.changePercent || data.change_percent || 0,
              volume: data.volume || 0,
              timestamp,
              asOf: timestamp,
              source,
            };
            next.set(symbol, quote);
            return next;
          });
          
          setError(null);
        },
        { isIndex, pollInterval: 3000 }
      );

      unsubscribes.push(unsubscribe);
    });

    setLoading(false);

    return () => {
      console.log('[useQuotes] Cleaning up transports for symbols:', symbols);
      unsubscribes.forEach(unsub => unsub());
    };
  }, [symbols.join(',')]);

  return { quotes, loading, error };
}

export function useOptionsChain(symbol: string | null, expiry?: string) {
  const [optionsChain, setOptionsChain] = useState<MassiveOptionsChain & { asOf?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rateLimitedRef = useRef(false);

  const fetchOptionsChain = useCallback(async () => {
    if (!symbol) return;

    try {
      setLoading(true);
      console.log('[useOptionsChain] Fetching options chain snapshot for', symbol);
      const data = await massiveClient.getOptionsChain(symbol, expiry);
      setOptionsChain({
        ...data,
        asOf: Date.now(),
      });
      setError(null);
      rateLimitedRef.current = false;
    } catch (err: any) {
      if (err instanceof MassiveError && err.code === 'RATE_LIMIT') {
        setError('Rate limited by Massive — pausing refresh');
        rateLimitedRef.current = true;
      } else {
        setError(err.message || 'Failed to fetch options chain');
      }
      console.error('[useOptionsChain] Failed to fetch options chain:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, expiry]);

  useEffect(() => {
    if (!symbol) return;

    // Fetch immediately
    fetchOptionsChain();

    // Refresh every 3 seconds while panel is open
    const refreshInterval = setInterval(() => {
      if (rateLimitedRef.current) {
        console.warn('[useOptionsChain] Skipping refresh while rate limited');
        return;
      }
      console.log('[useOptionsChain] Auto-refreshing options chain for', symbol);
      fetchOptionsChain();
    }, 3000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [fetchOptionsChain, symbol]);

  return { optionsChain, loading, error, refetch: fetchOptionsChain };
}

export function useActiveTradePnL(contractTicker: string | null, entryPrice: number) {
  const [currentPrice, setCurrentPrice] = useState(entryPrice);
  const [pnlPercent, setPnlPercent] = useState(0);
  const [asOf, setAsOf] = useState(Date.now());
  const [source, setSource] = useState<'websocket' | 'rest'>('rest');

  useEffect(() => {
    if (!contractTicker) return;

    console.log('[useActiveTradePnL] Starting PnL tracking for contract:', contractTicker);

    const unsubscribe = createTransport(
      contractTicker,
      (data, transportSource, timestamp) => {
        const price = data.last || data.mid || ((data.bid || 0) + (data.ask || 0)) / 2;
        
        if (price > 0) {
          setCurrentPrice(price);
          setAsOf(timestamp);
          setSource(transportSource);
          
          // Calculate PnL percentage
          const pnl = ((price - entryPrice) / entryPrice) * 100;
          setPnlPercent(pnl);
          
          console.log(`[useActiveTradePnL] ${transportSource} update for ${contractTicker}: $${price.toFixed(2)} (${pnl > 0 ? '+' : ''}${pnl.toFixed(1)}%)`);
        }
      },
      { isOption: true, pollInterval: 3000 }
    );

    return unsubscribe;
  }, [contractTicker, entryPrice]);

  return { currentPrice, pnlPercent, asOf, source };
}

// Hook for checking API connection status
export function useMarketDataConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [hasApiKeyAvailable, setHasApiKeyAvailable] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const hasKey = await hasApiKey();
      if (cancelled) return;
      setHasApiKeyAvailable(hasKey);
      setIsConnected(massiveClient.isConnected());
      setLastError(massiveClient.getLastError());
    };

    refresh();
    const interval = setInterval(() => {
      refresh();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { isConnected, hasApiKey: hasApiKeyAvailable, lastError };
}

export function useMassiveClient() {
  return massiveClient;
}
