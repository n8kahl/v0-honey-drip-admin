import { useMarketStore, useTradeStore, useSettingsStore } from '../../../stores';
import { HDRowWatchlist } from '../cards/HDRowWatchlist';
import { HDMacroPanel } from '../dashboard/HDMacroPanel';
import { HDEnteredTradeCard } from '../cards/HDEnteredTradeCard';
import { Ticker, Trade } from '../../../types';
import { Plus } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface HDWatchlistRailProps {
  onTickerClick?: (ticker: Ticker) => void;
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  activeTicker?: string;
}

/**
 * SectionHeader - Yellow/black gradient header for rail sections
 */
function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="px-3 py-2 bg-gradient-to-r from-yellow-500/10 to-transparent border-l-2 border-yellow-500 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-yellow-500">
        {title}
      </h3>
      {onAdd && (
        <button
          onClick={onAdd}
          className="p-1 rounded hover:bg-yellow-500/20 transition-colors"
          title={`Add ${title.toLowerCase()}`}
        >
          <Plus className="w-3.5 h-3.5 text-yellow-500" />
        </button>
      )}
    </div>
  );
}

export function HDWatchlistRail({
  onTickerClick,
  onAddTicker,
  onRemoveTicker,
  activeTicker,
}: HDWatchlistRailProps) {
  const watchlist = useMarketStore((state) => state.watchlist);
  const activeTrades = useTradeStore((state) => state.activeTrades);
  const challenges = useSettingsStore((state) => state.challenges);

  // Filter trades by state
  const loadedTrades = activeTrades.filter((t) => t.state === 'LOADED');
  const enteredTrades = activeTrades.filter((t) => t.state === 'ENTERED');

  // Calculate challenge progress
  const activeChallenges = challenges.filter((c) => c.isActive);

  return (
    <div className="w-full lg:w-80 border-r border-[var(--border-hairline)] flex flex-col h-full bg-[var(--surface-1)]">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Macro Context Panel */}
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <HDMacroPanel />
        </div>

        {/* Watchlist Section */}
        <div>
          <SectionHeader title="Watchlist" onAdd={onAddTicker} />
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
        </div>

        {/* Loaded Trades Section */}
        {loadedTrades.length > 0 && (
          <div className="mt-4">
            <SectionHeader title="Loaded" />
            <div className="p-3 space-y-2">
              {loadedTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--text-high)]">
                      {trade.ticker}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {trade.contract.strike}{trade.contract.type}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {trade.contract.daysToExpiry}DTE
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Trades Section */}
        {enteredTrades.length > 0 && (
          <div className="mt-4">
            <SectionHeader title="Active" />
            <div className="p-3 space-y-3">
              {enteredTrades.map((trade) => (
                <HDEnteredTradeCard
                  key={trade.id}
                  trade={trade}
                  onTrim={() => {}}
                  onMoveSL={() => {}}
                  onExit={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Challenges Section */}
        <div className="mt-4">
          <SectionHeader
            title="Challenges"
            onAdd={() => console.log('[v0] Add challenge clicked - TODO: implement dialog')}
          />
          {activeChallenges.length > 0 ? (
            <div className="p-3 space-y-2">
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
          ) : (
            <div className="p-6 text-center">
              <p className="text-xs text-[var(--text-muted)]">No active challenges</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
