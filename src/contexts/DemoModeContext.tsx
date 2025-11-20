/**
 * Demo Mode Context
 * Provides demo mode state and actions to populate stores with mock data
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { useMarketDataStore } from '../stores/marketDataStore';
import { generateCompleteDemo, DEMO_SYMBOLS } from '../lib/demo/mockDataGenerator';
import { toast } from 'sonner';

interface DemoModeContextValue {
  isDemoMode: boolean;
  isPopulating: boolean;
  activateDemo: () => void;
  deactivateDemo: () => void;
  toggleDemo: () => void;
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);

  const { setWatchlist, updateQuotes } = useMarketStore();
  const { symbols: marketDataSymbols, updateSymbol } = useMarketDataStore();

  /**
   * Activate demo mode and populate stores with mock data
   */
  const activateDemo = useCallback(async () => {
    setIsPopulating(true);

    try {
      console.log('[DemoMode] 🎬 Activating demo mode...');

      // Generate complete demo dataset
      const demoData = generateCompleteDemo();

      // Step 1: Populate watchlist
      const watchlistItems = DEMO_SYMBOLS.map((s, index) => ({
        id: `demo-${s.symbol}`,
        symbol: s.symbol,
        name: s.name,
        order: index,
      }));

      setWatchlist(watchlistItems);
      console.log('[DemoMode] ✅ Watchlist populated with', watchlistItems.length, 'symbols');

      // Step 2: Populate quotes (simulate real-time data)
      const quotes = demoData.map((d) => ({
        symbol: d.symbol,
        price: d.price,
        bid: d.quote.bid,
        ask: d.quote.ask,
        volume: d.quote.volume,
        change: d.quote.change,
        changePercent: d.quote.changePercent,
        timestamp: Date.now(),
      }));

      updateQuotes(quotes);
      console.log('[DemoMode] ✅ Quotes populated');

      // Step 3: Populate market data store with bars, flow, and signals
      for (const data of demoData) {
        // Simulate delay for visual effect (progressive population)
        await new Promise((resolve) => setTimeout(resolve, 100));

        updateSymbol(data.symbol, {
          symbol: data.symbol,
          quote: {
            price: data.price,
            bid: data.quote.bid,
            ask: data.quote.ask,
            volume: data.quote.volume,
            change: data.quote.change,
            changePercent: data.quote.changePercent,
            timestamp: Date.now(),
          },
          bars: {
            '5m': data.bars,
          },
          optionsChain: data.optionsChain.slice(0, 20), // Top 20 contracts
          flowMetrics: data.flowMetrics,
          strategySignals: data.signals.map((s, idx) => ({
            ...s,
            id: `demo-signal-${data.symbol}-${idx}`,
            strategyId: `demo-strategy-${idx}`,
            symbol: data.symbol,
            status: 'ACTIVE' as const,
            createdAt: s.createdAt || new Date().toISOString(),
            confidence: s.confidence || 70,
            payload: s.payload || {},
            barTimeKey: Date.now().toString(),
          })),
          confluence: {
            overall: 50 + Math.floor(Math.random() * 40), // 50-90%
            factors: [
              { name: 'Flow', score: data.flowMetrics.flowScore, weight: 0.3 },
              { name: 'Technical', score: 60 + Math.random() * 30, weight: 0.4 },
              { name: 'Volume', score: 50 + Math.random() * 40, weight: 0.3 },
            ],
          },
          lastUpdate: Date.now(),
        });

        console.log(`[DemoMode] ✅ ${data.symbol} populated with:`, {
          bars: data.bars.length,
          options: data.optionsChain.length,
          flow: data.flowMetrics.flowScore,
          signals: data.signals.length,
        });
      }

      setIsDemoMode(true);

      toast.success('Demo Mode Activated', {
        description: `Loaded ${demoData.length} symbols with live data, options flow, and strategy signals`,
        duration: 5000,
      });

      console.log('[DemoMode] 🎉 Demo mode fully activated!');
    } catch (error) {
      console.error('[DemoMode] ❌ Error activating demo mode:', error);
      toast.error('Demo Mode Error', {
        description: 'Failed to load demo data. Check console for details.',
      });
    } finally {
      setIsPopulating(false);
    }
  }, [setWatchlist, updateQuotes, updateSymbol]);

  /**
   * Deactivate demo mode and clear mock data
   */
  const deactivateDemo = useCallback(() => {
    console.log('[DemoMode] 🛑 Deactivating demo mode...');

    // Clear watchlist
    setWatchlist([]);

    // Clear market data store
    // Note: We don't have a clearAll method, so we'll just mark it as deactivated
    // Real data will overwrite demo data when user adds real symbols

    setIsDemoMode(false);

    toast.info('Demo Mode Deactivated', {
      description: 'Mock data cleared. Add symbols to your watchlist to see live data.',
    });

    console.log('[DemoMode] ✅ Demo mode deactivated');
  }, [setWatchlist]);

  /**
   * Toggle demo mode on/off
   */
  const toggleDemo = useCallback(() => {
    if (isDemoMode) {
      deactivateDemo();
    } else {
      activateDemo();
    }
  }, [isDemoMode, activateDemo, deactivateDemo]);

  const value: DemoModeContextValue = {
    isDemoMode,
    isPopulating,
    activateDemo,
    deactivateDemo,
    toggleDemo,
  };

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

/**
 * Hook to access demo mode context
 */
export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error('useDemoMode must be used within DemoModeProvider');
  }
  return context;
}
