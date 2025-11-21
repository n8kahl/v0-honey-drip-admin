/**
 * Composite Signal Badge
 *
 * Visual indicator showing composite trade signals for a symbol
 * - Displays signal count and highest score
 * - Shows signal details in tooltip
 * - Pulse animation for recent signals
 * - Color-coded by recommended style (scalp/day/swing)
 */

import { useState } from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, Target, Sparkles } from 'lucide-react';
import type { CompositeSignal } from '../../lib/composite/CompositeSignal';

interface CompositeSignalBadgeProps {
  symbol: string;
  signals: CompositeSignal[]; // Active signals for this symbol
  compact?: boolean; // Smaller version for mobile
  className?: string;
}

export function CompositeSignalBadge({
  symbol,
  signals,
  compact = false,
  className
}: CompositeSignalBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Filter for ACTIVE signals only
  const activeSignals = signals.filter(s => s.status === 'ACTIVE');

  if (activeSignals.length === 0) {
    return null;
  }

  // Get highest scoring signal
  const topSignal = activeSignals.reduce((prev, current) =>
    current.baseScore > prev.baseScore ? current : prev
  );

  // Check if signal is new (within last 5 minutes)
  const isNew = Date.now() - topSignal.createdAt.getTime() < 5 * 60 * 1000;

  // Color-code by recommended style
  const styleColors = {
    scalp: 'bg-purple-500/20 text-purple-600 border-purple-500/40',
    day_trade: 'bg-blue-500/20 text-blue-600 border-blue-500/40',
    swing: 'bg-green-500/20 text-green-600 border-green-500/40',
  };

  const badgeColor = styleColors[topSignal.recommendedStyle];

  // Icon by style
  const styleIcons = {
    scalp: Sparkles,
    day_trade: TrendingUp,
    swing: Target,
  };

  const Icon = styleIcons[topSignal.recommendedStyle];

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge */}
      <div
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded-full border',
          badgeColor,
          isNew && 'animate-pulse',
          compact ? 'text-[9px]' : 'text-[10px]',
          'font-medium uppercase tracking-wide cursor-default'
        )}
      >
        <Icon className={cn(compact ? 'w-2.5 h-2.5' : 'w-3 h-3')} />
        {!compact && (
          <span className="uppercase">{topSignal.recommendedStyle.replace('_', ' ')}</span>
        )}
        <span className="tabular-nums">{Math.round(topSignal.baseScore)}</span>
        {activeSignals.length > 1 && (
          <span className="opacity-70">({activeSignals.length})</span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={cn(
            'absolute z-50 w-72 p-3 rounded-lg shadow-lg border',
            'bg-[var(--surface-1)] border-[var(--border-hairline)]',
            'bottom-full mb-1 left-0'
          )}
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-xs font-medium text-[var(--text-high)] mb-2">
            {symbol} • {activeSignals.length} Active Signal{activeSignals.length > 1 ? 's' : ''}
          </div>

          <div className="space-y-2">
            {activeSignals.slice(0, 3).map((signal) => (
              <div
                key={signal.id}
                className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]"
              >
                {/* Header: Type + Direction */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-[var(--text-high)]">
                    {signal.opportunityType.replace('_', ' ')} • {signal.direction}
                  </span>
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    styleColors[signal.recommendedStyle]
                  )}>
                    {signal.recommendedStyle.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-2 gap-1 text-[9px] mb-1.5">
                  <div className="text-[var(--text-muted)]">
                    Base: <span className="text-[var(--text-high)] font-medium">{Math.round(signal.baseScore)}</span>
                  </div>
                  <div className="text-[var(--text-muted)]">
                    Style: <span className="text-[var(--text-high)] font-medium">{Math.round(signal.recommendedStyleScore)}</span>
                  </div>
                  <div className="text-[var(--text-muted)]">
                    R/R: <span className="text-[var(--text-high)] font-medium">{signal.riskReward.toFixed(1)}</span>
                  </div>
                  <div className="text-[var(--text-muted)]">
                    Entry: <span className="text-[var(--text-high)] font-medium">${signal.entryPrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* Top confluence factors */}
                <div className="text-[9px] text-[var(--text-muted)]">
                  {Object.entries(signal.confluence)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 3)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="truncate">{key.replace(/_/g, ' ')}</span>
                        <span className="ml-2">{Math.round(value as number)}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {activeSignals.length > 3 && (
              <div className="text-[10px] text-[var(--text-muted)] text-center pt-1 border-t border-[var(--border-hairline)]">
                +{activeSignals.length - 3} more signal{activeSignals.length - 3 > 1 ? 's' : ''}...
              </div>
            )}
          </div>

          <div className="text-[9px] text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-hairline)]">
            {isNew ? '🔥 New' : 'Active'} • {formatTimeAgo(topSignal.createdAt.getTime())}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
  if (secondsAgo < 60) return 'just now';
  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  return `${hoursAgo}h ago`;
}
