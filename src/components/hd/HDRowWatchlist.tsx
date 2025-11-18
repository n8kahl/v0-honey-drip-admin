import { Ticker } from '../../types';
import { formatPrice, formatPercent, cn } from '../../lib/utils';
import { X, Wifi, AlertCircle } from 'lucide-react';
import { useStreamingQuote } from '../../hooks/useOptionsAdvanced';
import { StrategySignalBadge } from './StrategySignalBadge';
import type { SymbolSignals } from '../../hooks/useStrategyScanner';

interface HDRowWatchlistProps {
  ticker: Ticker;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  asOf?: number; // Timestamp of last update
  source?: 'websocket' | 'rest'; // Data source indicator
  signals?: SymbolSignals; // Strategy signals for this symbol
}

export function HDRowWatchlist({ ticker, active, onClick, onRemove, asOf: propAsOf, source: propSource, signals }: HDRowWatchlistProps) {
  // Use ticker data directly (already updated by App.tsx from useQuotes)
  // Note: Trade flow removed - it requires option contract IDs, not underlying tickers
  
  const currentPrice = ticker.last;
  const asOf = propAsOf ?? Date.now();
  const source = propSource ?? 'rest';
  // Staleness check: stale if asOf > 5s ago
  const isStale = asOf ? (Date.now() - asOf > 5000) : true;

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

  const getAsOfText = () => {
    if (!asOf) return null;
    const secondsAgo = Math.floor((Date.now() - asOf) / 1000);
    if (secondsAgo < 5) return 'now';
    if (secondsAgo < 60) return `${secondsAgo}s`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo}m`;
  };
  
  const asOfText = getAsOfText();
  
  return (
    <div
      className={cn(
        'w-full flex items-center justify-between p-3 border-b border-[var(--border-hairline)] group',
        'hover:bg-[var(--surface-1)] transition-colors',
        active && 'bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)]',
        isStale && 'opacity-60'
      )}
      data-testid={`watchlist-item-${ticker.symbol}`}
    >
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between text-left"
        disabled={isStale}
        title={isStale ? 'Quote is stale' : undefined}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-high)] font-medium">{ticker.symbol}</span>
            <StrategySignalBadge symbolSignals={signals} compact />
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Wifi className={cn(
              "w-2.5 h-2.5",
              source === 'websocket' ? "text-green-500" : "text-yellow-500"
            )} />
            {asOfText}
            {isStale && <span className="ml-1 text-red-500">stale</span>}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[var(--text-high)] font-mono text-sm">{priceDisplay}</span>
        </div>
      </button>
      
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-2 w-6 h-6 flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all"
          title="Remove from watchlist"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

