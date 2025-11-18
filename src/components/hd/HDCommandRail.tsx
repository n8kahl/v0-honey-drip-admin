import { useMarketStore, useTradeStore, useSettingsStore } from '../../stores';
import { HDRowWatchlist } from './HDRowWatchlist';
import { Ticker } from '../../types';
import { Plus, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HDCommandRailProps {
  onTickerClick?: (ticker: Ticker) => void;
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  activeTicker?: string;
}

export function HDCommandRail({
  onTickerClick,
  onAddTicker,
  onRemoveTicker,
  activeTicker,
}: HDCommandRailProps) {
  const watchlist = useMarketStore((state) => state.watchlist);
  const activeTrades = useTradeStore((state) => state.activeTrades);
  const challenges = useSettingsStore((state) => state.challenges);

  // Calculate challenge progress
  const activeChallenges = challenges.filter((c) => c.isActive);
  
  return (
    <div className="w-full lg:w-80 border-r border-[var(--border-hairline)] flex flex-col h-full bg-[var(--surface-1)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-hairline)] flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--text-high)]">Command Center</h2>
        <button
          onClick={onAddTicker}
          className="p-1.5 rounded hover:bg-[var(--surface-3)] transition-colors"
          title="Add ticker to watchlist"
        >
          <Plus className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Active Trades Count */}
        {activeTrades.length > 0 && (
          <div className="p-3 bg-[var(--brand-primary)]/10 border-b border-[var(--border-hairline)]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand-primary)]" />
              <span className="text-sm font-medium text-[var(--text-high)]">
                {activeTrades.length} Active Trade{activeTrades.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Watchlist */}
        <div className="divide-y divide-[var(--border-hairline)]">
          {watchlist.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[var(--text-muted)] mb-3">No tickers in watchlist</p>
              <button
                onClick={onAddTicker}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-[var(--bg-base)] text-sm font-medium hover:bg-[var(--brand-primary)]/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Ticker
              </button>
            </div>
          ) : (
            watchlist.map((ticker) => (
              <HDRowWatchlist
                key={ticker.id}
                ticker={ticker}
                active={activeTicker === ticker.symbol}
                onClick={() => onTickerClick?.(ticker)}
                onRemove={() => onRemoveTicker?.(ticker)}
              />
            ))
          )}
        </div>

        {/* Challenges Section */}
        {activeChallenges.length > 0 && (
          <div className="mt-4 px-3 pb-3">
            <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Challenges
            </h3>
            <div className="space-y-2">
              {activeChallenges.map((challenge) => {
                const completedTrades = activeTrades.filter(
                  (t) => t.challenges.includes(challenge.id) && t.state === 'EXITED'
                ).length;
                const totalTrades = 10; // Default target, can be enhanced later
                const progress = totalTrades > 0 ? (completedTrades / totalTrades) * 100 : 0;

                return (
                  <div
                    key={challenge.id}
                    className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[var(--text-high)] truncate">
                        {challenge.name}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-2">
                        {completedTrades}/{totalTrades}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-300 rounded-full',
                          progress >= 100
                            ? 'bg-[var(--accent-positive)]'
                            : 'bg-[var(--brand-primary)]'
                        )}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
