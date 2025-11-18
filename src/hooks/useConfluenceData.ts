import { useState, useEffect, useRef } from 'react';
import { Trade, TradeState } from '../types';
import {
  MassiveTrendMetrics,
  MassiveVolatilityMetrics,
  MassiveLiquidityMetrics,
  fetchTrendMetrics,
  fetchVolatilityMetrics,
  fetchLiquidityMetrics,
} from '../services/massiveClient';

export interface ConfluenceData {
  loading: boolean;
  error?: string;
  trend?: MassiveTrendMetrics;
  volatility?: MassiveVolatilityMetrics;
  liquidity?: MassiveLiquidityMetrics;
}

export function useConfluenceData(
  trade: Trade | null,
  tradeState: TradeState | null
): ConfluenceData {
  const [data, setData] = useState<ConfluenceData>({ loading: false });
  const lastTradeIdRef = useRef<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('[v0] useConfluenceData: useEffect triggered with', {
      hasTrade: Boolean(trade),
      tradeState,
      ticker: trade?.ticker,
      contractId: trade?.contract?.id,
    });

    // Clear any pending fetch timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    // Only fetch for LOADED or ENTERED trades
    if (!trade || !tradeState || (tradeState !== 'LOADED' && tradeState !== 'ENTERED')) {
      console.log('[v0] useConfluenceData: Skipping fetch - invalid state or no trade');
      setData({ loading: false });
      lastTradeIdRef.current = null;
      return;
    }

    // Check if this is the same trade we already fetched
    const tradeKey = `${trade.id}-${trade.contract.expiry}-${trade.contract.strike}-${trade.contract.type}`;
    if (lastTradeIdRef.current === tradeKey) {
      // Already have data for this exact trade/contract
      return;
    }

    // Debounce: wait 1000ms before fetching to avoid rapid API calls
    fetchTimeoutRef.current = setTimeout(() => {
      fetchConfluenceData(trade, tradeKey);
    }, 1000);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [trade?.id, trade?.contract.expiry, trade?.contract.strike, trade?.contract.type, tradeState]);

  const fetchConfluenceData = async (trade: Trade, tradeKey: string) => {
    console.log('[v0] useConfluenceData: Starting fetch for', {
      ticker: trade.ticker,
      contractId: trade.contract.id,
      expiry: trade.contract.expiry,
      strike: trade.contract.strike,
      type: trade.contract.type,
    });

    setData({ loading: true });
    lastTradeIdRef.current = tradeKey;

    try {
      // Fetch all three metrics concurrently
      const [trend, volatility, liquidity] = await Promise.all([
        fetchTrendMetrics(trade.ticker),
        fetchVolatilityMetrics(trade.contract.id),
        fetchLiquidityMetrics(
          trade.ticker,
          trade.contract.expiry,
          trade.contract.strike,
          trade.contract.type,
          {
            bid: trade.contract.bid,
            ask: trade.contract.ask,
            volume: trade.contract.volume,
            openInterest: trade.contract.openInterest,
          }
        ),
      ]);

      console.log('[v0] useConfluenceData: Fetched metrics', { trend, volatility, liquidity });

      setData({
        loading: false,
        trend,
        volatility,
        liquidity,
      });
    } catch (error) {
      console.error('[v0] useConfluenceData: Error fetching confluence', error);
      // Silently fail - the individual fetch functions already return fallback data
      setData({
        loading: false,
      });
    }
  };

  return data;
}
