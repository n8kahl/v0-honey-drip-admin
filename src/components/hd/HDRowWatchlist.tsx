import { Ticker } from '../../types';
import { formatPrice, cn } from '../../lib/utils';
import { X, Wifi, Zap } from 'lucide-react';
import { useSymbolData } from '../../stores/marketDataStore';
import { HDStrategyBadge } from './HDStrategyBadge';
import { useUIStore } from '../../stores';

interface HDRowWatchlistProps {
  ticker: Ticker;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export function HDRowWatchlist({ ticker, active, onClick, onRemove }: HDRowWatchlistProps) {
  // Get all data from marketDataStore (single source of truth)
  const symbolData = useSymbolData(ticker.symbol);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const scrollChartToBar = useUIStore((state) => state.scrollChartToBar);
  const setMainCockpitSymbol = useUIStore((state) => state.setMainCockpitSymbol);
  
  const currentPrice = ticker.last;
  const lastUpdated = symbolData?.lastUpdated || 0;
  const strategySignals = symbolData?.strategySignals || [];
  const indicators = symbolData?.indicators;
  const confluence = symbolData?.confluence;
  
  // Filter active signals
  const activeSignals = strategySignals.filter(s => s.status === 'ACTIVE');
  const activeSignalCount = activeSignals.length;
  
  // Determine signal bias (bullish vs bearish)
  const signalBias = activeSignals.length > 0
    ? (activeSignals[0].payload as any)?.side || 'neutral'
    : 'neutral';
  
  // Handle badge click - navigate to chart at signal bar
  const handleBadgeClick = (signal: any) => {
    console.log('[v0] Strategy badge clicked:', signal);
    
    // First, select this ticker if not already active
    if (!active) {
      onClick?.();
    }
    
    // Switch to live tab to show chart
    setActiveTab('live');
    
    // Scroll chart to the bar where signal triggered
    if (signal.barTimeKey) {
      // Small delay to ensure chart is rendered
      setTimeout(() => {
        scrollChartToBar(signal.barTimeKey);
      }, 100);
    } else {
      console.warn('[v0] Signal missing barTimeKey, cannot scroll chart');
    }
  };
  
  // Staleness check: stale if lastUpdated > 10s ago
  const isStale = lastUpdated ? (Date.now() - lastUpdated > 10000) : true;

  // Defensive: fallback for missing price
  const priceDisplay = typeof currentPrice === 'number' && !isNaN(currentPrice)
    ? formatPrice(currentPrice)
    : <span className="text-[var(--text-muted)] italic">N/A</span>;

  // Loading skeleton
  if (!ticker || !ticker.symbol) {
    return (
      <div className="w-full flex items-center justify-between p-3 border-b border-[var(--border-hairline)] animate-pulse">
        <div className="h-4 w-16 bg-[var(--surface-2)] rounded" />
        <div className="h-4 w-10 bg-[var(--surface-2)] rounded" />
      </div>
    );
  }

  const getLastUpdatedText = () => {
    if (!lastUpdated) return null;
    const secondsAgo = Math.floor((Date.now() - lastUpdated) / 1000);
    if (secondsAgo < 5) return 'Live';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo}m ago`;
  };
  
  const lastUpdatedText = getLastUpdatedText();
  
  // Determine pulse animation class based on signal bias
  const pulseClass = activeSignalCount > 0
    ? signalBias === 'LONG' || signalBias === 'bullish'
      ? 'animate-pulse-green'
      : signalBias === 'SHORT' || signalBias === 'bearish'
      ? 'animate-pulse-red'
      : ''
    : '';
  
  return (
    <div
      className={cn(
        'w-full flex items-center justify-between p-3 border-b border-[var(--border-hairline)] group min-h-[48px]',
        'hover:bg-[var(--surface-1)] transition-all duration-150 ease-out touch-manipulation',
        active && 'bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)] shadow-sm',
        isStale && 'opacity-60',
        pulseClass
      )}
      data-testid={`watchlist-item-${ticker.symbol}`}
    >
      <button
        onClick={() => {
          setMainCockpitSymbol(ticker.symbol);
          onClick?.(); // Still call onClick if provided (for legacy compatibility)
        }}
        className="flex-1 flex items-center justify-between text-left"
        disabled={isStale}
        title={isStale ? 'Data is stale' : undefined}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-high)] font-medium">{ticker.symbol}</span>
            
            {/* Strategy signal badges */}
            {activeSignals.length > 0 && (
              <div className="flex items-center gap-1">
                {activeSignals.slice(0, 3).map((signal) => (
                  <HDStrategyBadge
                    key={signal.id}
                    signal={signal}
                    onClick={() => handleBadgeClick(signal)}
                    size="sm"
                  />
                ))}
                {activeSignals.length > 3 && (
                  <span className="text-[9px] text-[var(--text-faint)] ml-0.5">
                    +{activeSignals.length - 3}
                  </span>
                )}
              </div>
            )}
            
            {confluence && confluence.overall > 70 && (
              <span title={`Confluence: ${confluence.overall}`}>
                <Zap className="w-3 h-3 text-yellow-500" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Wifi className="w-2.5 h-2.5 text-green-500" />
            {lastUpdatedText}
            {isStale && <span className="ml-1 text-red-500">stale</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[var(--text-high)] font-mono text-sm">{priceDisplay}</span>
          {indicators?.ema9 && (
            <span className={cn(
              "text-[10px] font-mono",
              currentPrice > indicators.ema9 ? "text-green-500" : "text-red-500"
            )}>
              EMA9: {indicators.ema9.toFixed(2)}
            </span>
          )}
        </div>
      </button>
      
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all touch-manipulation active:scale-95"
          title="Remove from watchlist"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

