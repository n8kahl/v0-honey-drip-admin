/**
 * Example: Integrating Strategy Library with DesktopLiveCockpit
 * 
 * This example shows how to wire up the strategy scanner with alert behaviors
 * in the main trading interface.
 */

import { useState, useCallback } from 'react';
import { useStrategyScanner } from '../hooks/useStrategyScanner';
import type { StrategyDefinition } from '../types/strategy';
import type { EnrichedStrategySignal } from '../hooks/useStrategyScanner';

// Example integration in DesktopLiveCockpit or main App component
export function ExampleStrategyIntegration() {
  // State for flashing watchlist rows
  const [flashingSymbols, setFlashingSymbols] = useState<Set<string>>(new Set());
  
  // Your existing state (watchlist, channels, etc.)
  const watchlist = []; // your watchlist
  const channels = []; // your Discord channels
  
  // Flash watchlist callback
  const handleFlashWatchlist = useCallback((symbol: string, durationMs = 3000) => {
    console.log(`[App] 🎨 Flashing watchlist for ${symbol}`);
    
    setFlashingSymbols(prev => {
      const next = new Set(prev);
      next.add(symbol);
      return next;
    });
    
    setTimeout(() => {
      setFlashingSymbols(prev => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
    }, durationMs);
  }, []);
  
  // Show now playing callback
  const handleShowNowPlaying = useCallback((
    symbol: string,
    signal: EnrichedStrategySignal,
    strategy: StrategyDefinition
  ) => {
    console.log(`[App] 📺 Auto-opening now playing for ${symbol} from ${strategy.name}`);
    
    // Example: Set active ticker and open modal
    // setActiveTicker({ symbol });
    // setTradeState('WATCHING');
    // setShowNowPlaying(true);
    
    // Or show toast notification
    // toast.success(`Strategy Signal: ${strategy.name}`, {
    //   description: `${symbol} @ ${signal.confidence}% confidence`,
    // });
  }, []);
  
  // Open trade planner callback
  const handleOpenTradePlanner = useCallback((
    symbol: string,
    signal: EnrichedStrategySignal,
    strategy: StrategyDefinition
  ) => {
    console.log(`[App] 📊 Opening trade planner for ${symbol}`);
    
    // Example: Open trade planner with pre-filled data
    // openTradePlanner({
    //   symbol,
    //   confidence: signal.confidence,
    //   strategyName: strategy.name,
    //   suggestedEntry: signal.payload?.price,
    // });
  }, []);
  
  // Initialize strategy scanner
  const {
    signalsBySymbol,
    strategies,
    loading,
    scanning,
    error,
    triggerScan,
    dismissSignal,
  } = useStrategyScanner({
    symbols: watchlist.map((t: any) => t.symbol),
    enabled: true,
    scanInterval: 60000, // 1 minute
    
    // Wire up alert behavior callbacks
    onFlashWatchlist: handleFlashWatchlist,
    onShowNowPlaying: handleShowNowPlaying,
    onOpenTradePlanner: handleOpenTradePlanner,
    discordChannels: channels, // Array of { id, name, webhookUrl }
  });
  
  // Render watchlist with flashing and signal badges
  return (
    <div>
      {/* Strategy stats header (optional) */}
      <div className="mb-4 p-3 bg-surface-2 rounded">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-text-mid">Active Strategies:</span>
            <span className="ml-2 text-sm font-medium text-text-high">
              {strategies.length}
            </span>
          </div>
          <div>
            <span className="text-sm text-text-mid">Signals Today:</span>
            <span className="ml-2 text-sm font-medium text-text-high">
              {Array.from(signalsBySymbol.values()).reduce((sum, s) => sum + s.signals.length, 0)}
            </span>
          </div>
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="text-xs px-2 py-1 rounded bg-brand-primary text-white disabled:opacity-50"
          >
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>
      
      {/* Watchlist with strategy signals */}
      <div className="space-y-2">
        {watchlist.map((ticker: any) => {
          const signals = signalsBySymbol.get(ticker.symbol);
          const isFlashing = flashingSymbols.has(ticker.symbol);
          
          return (
            <div
              key={ticker.symbol}
              className={cn(
                "watchlist-row p-3 rounded",
                isFlashing && "animate-flash-pulse"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{ticker.symbol}</span>
                
                {/* Strategy signal badge */}
                {signals && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-mid">
                      {signals.setupCount > 0 && `${signals.setupCount} setup`}
                      {signals.readyCount > 0 && ` ${signals.readyCount} ready`}
                    </span>
                    <div
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        signals.latestConfidence >= 80
                          ? "bg-green-500/20 text-green-600"
                          : "bg-yellow-500/20 text-yellow-600"
                      )}
                    >
                      {Math.round(signals.latestConfidence)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// CSS for flash animation (add to your global CSS or Tailwind config)
/*
@keyframes flash-pulse {
  0%, 100% { background-color: var(--surface-1); }
  25% { background-color: rgba(251, 191, 36, 0.3); }
  50% { background-color: var(--surface-1); }
  75% { background-color: rgba(251, 191, 36, 0.3); }
}

.animate-flash-pulse {
  animation: flash-pulse 3s ease-in-out;
}
*/
