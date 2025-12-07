import { useState } from 'react';
import { Trade, TradeUpdate, Challenge } from '../../../types';
import { formatPrice, formatPercent, formatDate, formatTime, cn } from '../../../lib/utils';
import { HDTagTradeType } from '../common/HDTagTradeType';
import { HDEditablePrice } from '../common/HDEditablePrice';
import { ChevronDown, Share2, Clock, DollarSign, TrendingUp, TrendingDown, Edit2, Plus, X, Tag } from 'lucide-react';

interface HDTradeRowExpandedProps {
  trade: Trade;
  challenges?: Challenge[];
  onShare?: (trade: Trade) => void;
  onEditPrice?: (trade: Trade, updateId: string, newPrice: number) => void;
  onEditTradePrice?: (tradeId: string, field: 'entryPrice' | 'exitPrice', newPrice: number) => Promise<void>;
  onLinkChallenge?: (tradeId: string, challengeId: string) => Promise<void>;
  onUnlinkChallenge?: (tradeId: string, challengeId: string) => Promise<void>;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * Expandable trade row for the Review tab
 * Shows trade summary when collapsed, full timeline when expanded
 */
export function HDTradeRowExpanded({
  trade,
  challenges = [],
  onShare,
  onEditPrice,
  onEditTradePrice,
  onLinkChallenge,
  onUnlinkChallenge,
  isExpanded = false,
  onToggleExpand,
}: HDTradeRowExpandedProps) {
  const isProfit = (trade.movePercent || 0) >= 0;
  const [showChallengeSelector, setShowChallengeSelector] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState<string | null>(null);

  // Get challenge names for display
  const tradeChallengNames = trade.challenges
    .map(cId => challenges.find(c => c.id === cId)?.name)
    .filter(Boolean);

  // Sort updates by timestamp
  const sortedUpdates = [...(trade.updates || [])].sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeA - timeB;
  });

  // Calculate duration
  const duration = trade.entryTime && trade.exitTime
    ? formatDuration(trade.entryTime, trade.exitTime)
    : null;

  const getUpdateIcon = (type: TradeUpdate['type']) => {
    switch (type) {
      case 'enter':
        return <DollarSign className="w-3.5 h-3.5" />;
      case 'exit':
        return isProfit
          ? <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-positive)]" />
          : <TrendingDown className="w-3.5 h-3.5 text-[var(--accent-negative)]" />;
      case 'trim':
        return <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-positive)]" />;
      case 'update-sl':
      case 'trail-stop':
        return <TrendingDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const getUpdateLabel = (type: TradeUpdate['type']) => {
    switch (type) {
      case 'enter': return 'Entry';
      case 'exit': return 'Exit';
      case 'trim': return 'Trim';
      case 'update': return 'Update';
      case 'update-sl': return 'SL Update';
      case 'trail-stop': return 'Trail Stop';
      case 'add': return 'Add';
      default: return type;
    }
  };

  const getUpdateColor = (type: TradeUpdate['type']) => {
    switch (type) {
      case 'enter': return 'text-[var(--brand-primary)]';
      case 'exit': return isProfit ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]';
      case 'trim': return 'text-[var(--accent-positive)]';
      case 'update-sl':
      case 'trail-stop': return 'text-[var(--text-muted)]';
      default: return 'text-[var(--text-med)]';
    }
  };

  return (
    <div className="border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
      {/* Main Row - Always visible */}
      <div
        onClick={onToggleExpand}
        className="w-full grid grid-cols-[auto_1fr_1.5fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-4 hover:bg-[var(--surface-1)] transition-colors text-left items-center cursor-pointer"
      >
        {/* Expand/Share icon indicator */}
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "w-4 h-4 text-[var(--text-muted)] transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>

        <div className="text-[var(--text-high)] font-medium">
          {trade.ticker}
        </div>
        <div className="text-[var(--text-muted)] text-sm">
          {trade.contract.strike}{trade.contract.type} {trade.contract.expiry}
        </div>
        <div>
          <HDTagTradeType type={trade.tradeType} />
        </div>
        <div className="text-[var(--text-high)] tabular-nums">
          ${formatPrice(trade.entryPrice || 0)}
        </div>
        <div className="text-[var(--text-high)] tabular-nums">
          ${formatPrice(trade.exitPrice || 0)}
        </div>
        <div
          className={cn(
            'tabular-nums font-medium',
            isProfit ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
          )}
        >
          {formatPercent(trade.movePercent || 0)}
        </div>
        <div className="text-[var(--text-muted)] text-sm">
          {trade.exitTime ? formatDate(trade.exitTime) : '--'}
        </div>
        <div className="text-[var(--text-muted)] text-sm">
          {trade.exitTime ? formatTime(trade.exitTime) : '--'}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 bg-[var(--surface-1)] border-t border-[var(--border-hairline)]">
          {/* Actions Row */}
          <div className="flex items-center justify-between py-3 border-b border-[var(--border-hairline)]">
            <div className="flex items-center gap-4">
              {/* Duration */}
              {duration && (
                <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Duration: {duration}</span>
                </div>
              )}
            </div>

            {/* Share Button */}
            {onShare && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(trade);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] text-sm hover:opacity-90 transition-opacity"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            )}
          </div>

          {/* Challenge Management Section */}
          {challenges.length > 0 && (onLinkChallenge || onUnlinkChallenge) && (
            <div className="py-3 border-b border-[var(--border-hairline)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[var(--text-muted)] text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Challenges
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChallengeSelector(!showChallengeSelector);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>

              {/* Currently linked challenges */}
              <div className="flex flex-wrap gap-1.5">
                {trade.challenges.length === 0 ? (
                  <span className="text-[var(--text-muted)] text-xs">No challenges linked</span>
                ) : (
                  trade.challenges.map((cId) => {
                    const challenge = challenges.find(c => c.id === cId);
                    if (!challenge) return null;
                    return (
                      <div
                        key={cId}
                        className="group flex items-center gap-1 px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-med)] text-micro uppercase tracking-wide border border-[var(--border-hairline)]"
                      >
                        <span>{challenge.name}</span>
                        {onUnlinkChallenge && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setChallengeLoading(cId);
                              try {
                                await onUnlinkChallenge(trade.id, cId);
                              } finally {
                                setChallengeLoading(null);
                              }
                            }}
                            disabled={challengeLoading === cId}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--accent-negative)]/20 text-[var(--text-muted)] hover:text-[var(--accent-negative)] transition-all"
                            title="Remove challenge"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Challenge selector dropdown */}
              {showChallengeSelector && onLinkChallenge && (
                <div className="mt-2 p-2 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
                  <div className="text-[var(--text-muted)] text-xs mb-2">Select challenge to add:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {challenges
                      .filter(c => !trade.challenges.includes(c.id))
                      .map((challenge) => (
                        <button
                          key={challenge.id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setChallengeLoading(challenge.id);
                            try {
                              await onLinkChallenge(trade.id, challenge.id);
                              setShowChallengeSelector(false);
                            } finally {
                              setChallengeLoading(null);
                            }
                          }}
                          disabled={challengeLoading === challenge.id}
                          className="px-2 py-1 rounded text-xs bg-[var(--surface-1)] text-[var(--text-med)] border border-[var(--border-hairline)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors disabled:opacity-50"
                        >
                          {challengeLoading === challenge.id ? '...' : challenge.name}
                        </button>
                      ))}
                    {challenges.filter(c => !trade.challenges.includes(c.id)).length === 0 && (
                      <span className="text-[var(--text-muted)] text-xs">All challenges already linked</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="pt-4">
            <h4 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
              Trade Timeline
            </h4>

            {sortedUpdates.length === 0 ? (
              <div className="text-[var(--text-muted)] text-sm py-4 text-center">
                No alerts recorded for this trade
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line connecting updates */}
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-[var(--border-hairline)]" />

                <div className="space-y-3">
                  {sortedUpdates.map((update, idx) => {
                    const isLast = idx === sortedUpdates.length - 1;
                    return (
                      <div
                        key={update.id || idx}
                        className="relative flex items-start gap-3 pl-0"
                      >
                        {/* Timeline dot */}
                        <div className={cn(
                          "relative z-10 w-6 h-6 rounded-full flex items-center justify-center",
                          update.type === 'enter' && "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]",
                          update.type === 'exit' && (isProfit
                            ? "bg-[var(--accent-positive)]/20"
                            : "bg-[var(--accent-negative)]/20"),
                          update.type === 'trim' && "bg-[var(--accent-positive)]/20",
                          !['enter', 'exit', 'trim'].includes(update.type) && "bg-[var(--surface-2)]"
                        )}>
                          {getUpdateIcon(update.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-medium text-sm",
                                getUpdateColor(update.type)
                              )}>
                                {getUpdateLabel(update.type)}
                              </span>
                              <span className="text-[var(--text-muted)] text-xs">
                                {update.timestamp
                                  ? `${formatDate(update.timestamp)} ${formatTime(update.timestamp)}`
                                  : '--'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[var(--text-high)] tabular-nums text-sm">
                                ${formatPrice(update.price || 0)}
                              </span>
                              {update.pnlPercent !== undefined && (
                                <span className={cn(
                                  "text-xs tabular-nums",
                                  (update.pnlPercent || 0) >= 0
                                    ? "text-[var(--accent-positive)]"
                                    : "text-[var(--accent-negative)]"
                                )}>
                                  ({formatPercent(update.pnlPercent)})
                                </span>
                              )}
                              {onEditPrice && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // For now just log - will implement modal in Phase 3
                                    console.log('[HDTradeRowExpanded] Edit price clicked', update);
                                  }}
                                  className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors"
                                  title="Edit price"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {update.message && (
                            <p className="text-[var(--text-muted)] text-xs mt-1">
                              {update.message}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Trade Summary Stats */}
          <div className="mt-4 pt-4 border-t border-[var(--border-hairline)] grid grid-cols-4 gap-4">
            <div>
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">Entry Price</div>
              {onEditTradePrice ? (
                <HDEditablePrice
                  value={trade.entryPrice || 0}
                  onSave={async (newPrice) => {
                    await onEditTradePrice(trade.id, 'entryPrice', newPrice);
                  }}
                  className="text-[var(--text-high)]"
                />
              ) : (
                <div className="text-[var(--text-high)] tabular-nums">${formatPrice(trade.entryPrice || 0)}</div>
              )}
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">Exit Price</div>
              {onEditTradePrice ? (
                <HDEditablePrice
                  value={trade.exitPrice || 0}
                  onSave={async (newPrice) => {
                    await onEditTradePrice(trade.id, 'exitPrice', newPrice);
                  }}
                  className="text-[var(--text-high)]"
                />
              ) : (
                <div className="text-[var(--text-high)] tabular-nums">${formatPrice(trade.exitPrice || 0)}</div>
              )}
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">Target</div>
              <div className="text-[var(--accent-positive)] tabular-nums">
                {trade.targetPrice ? `$${formatPrice(trade.targetPrice)}` : '--'}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">Stop Loss</div>
              <div className="text-[var(--accent-negative)] tabular-nums">
                {trade.stopLoss ? `$${formatPrice(trade.stopLoss)}` : '--'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format duration between two dates
 */
function formatDuration(start: Date | string, end: Date | string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) {
    if (minutes === 0) return 'Less than 1 minute';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  }

  if (minutes === 0) {
    if (hours === 1) return '1 hour';
    return `${hours} hours`;
  }

  if (hours === 1) {
    return minutes === 1 ? '1h 1m' : `1h ${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}
