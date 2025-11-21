import { useTradeStore } from '../../stores';
import { Trade } from '../../types';
import { TrendingUp, TrendingDown, MoveUp, X, Scissors } from 'lucide-react';
import { cn, formatPrice, formatPercent } from '../../lib/utils';

interface HDActiveTradesPanelProps {
  onTradeClick?: (trade: Trade) => void;
  onTrimClick?: (trade: Trade) => void;
  onMoveSLClick?: (trade: Trade) => void;
  onExitClick?: (trade: Trade) => void;
}

export function HDActiveTradesPanel({
  onTradeClick,
  onTrimClick,
  onMoveSLClick,
  onExitClick,
}: HDActiveTradesPanelProps) {
  const activeTrades = useTradeStore((state) => state.activeTrades);
  const updatedTradeIds = useTradeStore((state) => state.updatedTradeIds);

  // Separate by state
  const enteredTrades = activeTrades.filter((t) => t.state === 'ENTERED');
  const loadedTrades = activeTrades.filter((t) => t.state === 'LOADED');

  if (activeTrades.length === 0) {
    return (
      <div className="w-full lg:w-[360px] border-l border-[var(--border-hairline)] flex flex-col bg-[var(--surface-1)]">
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <h2 className="text-sm font-medium text-[var(--text-high)]">Active Trades</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <TrendingUp className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No active trades</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Load a trade from the watchlist
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-[360px] border-l border-[var(--border-hairline)] flex flex-col bg-[var(--surface-1)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-hairline)] flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--text-high)]">
          Active Trades ({activeTrades.length})
        </h2>
      </div>

      {/* Scrollable Trade List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)]">
        {/* Entered Trades (Priority) */}
        {enteredTrades.map((trade) => {
          const isUpdated = updatedTradeIds.has(trade.id);
          const pnl = trade.currentPrice && trade.entryPrice
            ? (trade.currentPrice - trade.entryPrice) * 100 // Simplified, needs proper calculation
            : 0;
          const pnlPercent = trade.movePercent || 0;
          const isProfit = pnlPercent > 0;

          return (
            <div
              key={trade.id}
              className={cn(
                'p-3 hover:bg-[var(--surface-2)] transition-colors cursor-pointer',
                isUpdated && 'bg-[var(--brand-primary)]/10'
              )}
              onClick={() => onTradeClick?.(trade)}
            >
              {/* Header: Ticker + Contract */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-high)]">
                    {trade.ticker}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {trade.contract.strike}{trade.contract.type} {trade.contract.daysToExpiry}DTE
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]">
                  Entered
                </span>
              </div>

              {/* P&L */}
              <div className="mb-3">
                <div
                  className={cn(
                    'text-xl font-semibold',
                    isProfit ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                  )}
                >
                  {isProfit ? '+' : ''}${formatPrice(pnl)} ({isProfit ? '+' : ''}{formatPercent(pnlPercent)})
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Entry: ${formatPrice(trade.entryPrice || 0)} • Current: ${formatPrice(trade.currentPrice || 0)}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrimClick?.(trade);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-[var(--surface-3)] hover:bg-[var(--brand-primary)]/20 text-xs font-medium text-[var(--text-high)] transition-colors"
                  title="Trim position"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Trim
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSLClick?.(trade);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-[var(--surface-3)] hover:bg-[var(--brand-primary)]/20 text-xs font-medium text-[var(--text-high)] transition-colors"
                  title="Move stop loss"
                >
                  <MoveUp className="w-3.5 h-3.5" />
                  Move SL
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExitClick?.(trade);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-[var(--accent-negative)]/20 hover:bg-[var(--accent-negative)]/30 text-xs font-medium text-[var(--accent-negative)] transition-colors"
                  title="Exit position"
                >
                  <X className="w-3.5 h-3.5" />
                  Exit
                </button>
              </div>
            </div>
          );
        })}

        {/* Loaded Trades (Secondary) */}
        {loadedTrades.map((trade) => {
          const isUpdated = updatedTradeIds.has(trade.id);

          return (
            <div
              key={trade.id}
              className={cn(
                'p-3 hover:bg-[var(--surface-2)] transition-colors cursor-pointer',
                isUpdated && 'bg-[var(--brand-primary)]/10'
              )}
              onClick={() => onTradeClick?.(trade)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-high)]">
                    {trade.ticker}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {trade.contract.strike}{trade.contract.type} {trade.contract.daysToExpiry}DTE
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                  Loaded
                </span>
              </div>

              {/* Contract Details */}
              <div className="text-xs text-[var(--text-muted)]">
                Mid: ${formatPrice(trade.contract.mid)} • Target: {trade.tradeType}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
