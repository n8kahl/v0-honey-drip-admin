import { Trade, Challenge } from '../../../types';
import { formatPercent, formatDate, formatTime, cn } from '../../../lib/utils';
import { getTradesForChallenge } from '../../../lib/challengeHelpers';
import { TrendingUp, TrendingDown, Minus, Clock, X } from 'lucide-react';

interface HDPanelChallengeTradesProps {
  challenge: Challenge | null;
  allTrades: Trade[];
  onTradeClick: (trade: Trade) => void;
  onClose: () => void;
}

export function HDPanelChallengeTrades({
  challenge,
  allTrades,
  onTradeClick,
  onClose,
}: HDPanelChallengeTradesProps) {
  if (!challenge) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-[var(--text-muted)] text-sm text-center">
          Select a challenge to see its trades
        </p>
      </div>
    );
  }

  const { active, exited } = getTradesForChallenge(challenge.id, allTrades);
  const totalTrades = active.length + exited.length;

  if (totalTrades === 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
          <h3 className="text-[var(--text-high)] text-sm flex-1 truncate">
            {challenge.name}
          </h3>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        
        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-[var(--text-muted)] text-sm text-center">
            No trades have been entered for this challenge yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
        <div className="flex-1 min-w-0">
          <h3 className="text-[var(--text-high)] text-sm truncate">
            {challenge.name}
          </h3>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            {totalTrades} trade{totalTrades !== 1 ? 's' : ''}
            {active.length > 0 && ` · ${active.length} active`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--surface-2)] transition-colors flex-shrink-0 ml-2"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Trades list */}
      <div className="flex-1 overflow-y-auto">
        {/* Active trades section */}
        {active.length > 0 && (
          <div className="border-b border-[var(--border-hairline)]">
            <div className="px-4 py-2 bg-[var(--surface-2)]">
              <h4 className="text-[var(--text-med)] text-[10px] uppercase tracking-wide font-semibold">
                Active ({active.length})
              </h4>
            </div>
            <div>
              {active.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  onClick={() => onTradeClick(trade)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Exited trades section */}
        {exited.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-[var(--surface-2)]">
              <h4 className="text-[var(--text-med)] text-[10px] uppercase tracking-wide font-semibold">
                Exited ({exited.length})
              </h4>
            </div>
            <div>
              {exited.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  onClick={() => onTradeClick(trade)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TradeRow({ trade, onClick }: { trade: Trade; onClick: () => void }) {
  const pnl = trade.movePercent || 0;
  const isPositive = pnl > 0;
  const isNegative = pnl < 0;
  const isActive = trade.state === 'ENTERED';

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-hairline)] transition-colors text-left',
        'hover:bg-[var(--surface-1)] cursor-pointer'
      )}
    >
      {/* Ticker + Contract */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-high)] text-sm font-medium">
            {trade.ticker}
          </span>
          <span className="text-[var(--text-muted)] text-xs">
            {trade.contract.strike}
            {trade.contract.type}
          </span>
          <span className="text-[var(--text-muted)] text-xs">
            {trade.contract.expiry}
          </span>
        </div>
        
        {/* Entry time / duration */}
        <div className="flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)] text-xs">
            {trade.entryTime ? formatDate(trade.entryTime) : 'N/A'}
            {trade.entryTime && ' · '}
            {trade.entryTime && formatTime(trade.entryTime)}
          </span>
        </div>
      </div>

      {/* P&L */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isPositive && <TrendingUp className="w-4 h-4 text-[var(--accent-positive)]" />}
        {isNegative && <TrendingDown className="w-4 h-4 text-[var(--accent-negative)]" />}
        {!isPositive && !isNegative && <Minus className="w-4 h-4 text-[var(--text-muted)]" />}
        <span
          className={cn(
            'text-sm font-medium tabular-nums min-w-[60px] text-right',
            isPositive && 'text-[var(--accent-positive)]',
            isNegative && 'text-[var(--accent-negative)]',
            !isPositive && !isNegative && 'text-[var(--text-muted)]'
          )}
        >
          {formatPercent(pnl)}
        </span>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="w-2 h-2 rounded-full bg-[var(--accent-positive)] flex-shrink-0" />
      )}
    </button>
  );
}
