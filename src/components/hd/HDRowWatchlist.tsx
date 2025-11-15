import { Ticker } from '../../types';
import { formatPrice, formatPercent, cn } from '../../lib/utils';
import { X, Wifi, AlertCircle } from 'lucide-react';
import { useStreamingQuote } from '../../hooks/useOptionsAdvanced';

interface HDRowWatchlistProps {
  ticker: Ticker;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  asOf?: number; // Timestamp of last update
  source?: 'websocket' | 'rest'; // Data source indicator
}

export function HDRowWatchlist({ ticker, active, onClick, onRemove, asOf: propAsOf, source: propSource }: HDRowWatchlistProps) {
  const { quote, asOf: hookAsOf, source: hookSource, isStale } = useStreamingQuote(ticker.symbol);
  
  const currentPrice = quote?.price ?? ticker.last;
  const changePercent = quote?.changePercent ?? ticker.changePercent;
  const asOf = hookAsOf ?? propAsOf;
  const source = hookSource ?? propSource;
  
  const isPositive = changePercent >= 0;
  
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
        active && 'bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)]'
      )}
    >
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[var(--text-high)] font-medium">{ticker.symbol}</span>
          {asOfText && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <Wifi className={cn(
                "w-2.5 h-2.5",
                source === 'websocket' ? "text-green-500" : "text-yellow-500"
              )} />
              <span>{asOfText}</span>
              {isStale && (
                <AlertCircle className="w-2.5 h-2.5 text-orange-500" title="Data may be stale" />
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[var(--text-high)] tabular-nums">
            ${formatPrice(currentPrice)}
          </span>
          <span
            className={cn(
              'tabular-nums min-w-[60px] text-right',
              isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
            )}
          >
            {formatPercent(changePercent)}
          </span>
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
