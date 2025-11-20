/**
 * useGreeksMonitoring.ts - React Hook for Greeks Monitoring
 *
 * Automatically starts/stops Greeks monitoring based on active trades.
 * Updates marketDataStore with real-time Greeks.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTradeStore } from '../stores/tradeStore';
import { useMarketDataStore } from '../stores/marketDataStore';
import { greeksMonitorService } from '../services/greeksMonitorService';

interface UseGreeksMonitoringOptions {
  enabled?: boolean;
  pollInterval?: number; // milliseconds, default 10000 (10s)
}

export function useGreeksMonitoring(options: UseGreeksMonitoringOptions = {}) {
  const { enabled = true, pollInterval = 10000 } = options;
  const activeTrades = useTradeStore(state => state.activeTrades);
  const updateGreeks = useMarketDataStore(state => state.updateGreeks);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  const startMonitoring = useCallback(async () => {
    if (isMonitoringRef.current || activeTrades.length === 0 || !enabled) {
      return;
    }

    console.log('[useGreeksMonitoring] Starting Greeks monitoring for', activeTrades.length, 'trades');
    isMonitoringRef.current = true;

    // Immediate first fetch
    await fetchGreeksForAllTrades();

    // Then start interval
    intervalRef.current = setInterval(async () => {
      await fetchGreeksForAllTrades();
    }, pollInterval);
  }, [activeTrades, enabled, pollInterval]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isMonitoringRef.current = false;
    console.log('[useGreeksMonitoring] Stopped Greeks monitoring');
  }, []);

  const fetchGreeksForAllTrades = useCallback(async () => {
    for (const trade of activeTrades) {
      try {
        // Fetch Greeks from greeksMonitorService
        const snapshot = await (greeksMonitorService as any).fetchGreeks(trade);

        if (snapshot) {
          // Update marketDataStore with Greeks
          updateGreeks(trade.ticker, {
            delta: snapshot.greeks.delta,
            gamma: snapshot.greeks.gamma,
            theta: snapshot.greeks.theta,
            vega: snapshot.greeks.vega,
            rho: snapshot.greeks.rho,
            iv: snapshot.greeks.impliedVolatility,
            lastUpdated: snapshot.greeks.timestamp,
            contractTicker: snapshot.symbol,
            strike: snapshot.strike,
            expiry: snapshot.expiry,
            type: snapshot.type,
            isFresh: true,
            source: 'massive',
          });
        }
      } catch (error) {
        console.error(`[useGreeksMonitoring] Failed to fetch Greeks for ${trade.ticker}:`, error);
      }
    }
  }, [activeTrades, updateGreeks]);

  // Start monitoring when active trades exist
  useEffect(() => {
    if (enabled && activeTrades.length > 0) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [activeTrades.length, enabled, startMonitoring, stopMonitoring]);

  return {
    isMonitoring: isMonitoringRef.current,
    refresh: fetchGreeksForAllTrades,
    start: startMonitoring,
    stop: stopMonitoring,
  };
}
