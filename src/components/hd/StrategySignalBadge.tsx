/**
 * Strategy Signal Badge
 * 
 * Visual indicator showing strategy setup/ready signals for a symbol
 * - Yellow (50-79%): Setup forming
 * - Green (80%+): Ready to trade
 * - Pulse animation for new signals
 * - Tooltip with strategy names
 */

import { useState } from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, Sparkles } from 'lucide-react';
import type { SymbolSignals } from '../../hooks/useStrategyScanner';

interface StrategySignalBadgeProps {
  symbolSignals: SymbolSignals | undefined;
  compact?: boolean; // Smaller version for mobile
  className?: string;
}

export function StrategySignalBadge({ symbolSignals, compact = false, className }: StrategySignalBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!symbolSignals || symbolSignals.signals.length === 0) {
    return null;
  }

  const { setupCount, readyCount, latestConfidence, signals, lastUpdate } = symbolSignals;
  
  // Check if signal is new (within last 5 minutes)
  const isNew = Date.now() - lastUpdate < 5 * 60 * 1000;
  
  // Determine badge color based on highest confidence
  const isReady = latestConfidence >= 80;
  const isSetup = latestConfidence >= 50 && latestConfidence < 80;

  if (!isReady && !isSetup) {
    return null;
  }

  const badgeColor = isReady
    ? 'bg-green-500/20 text-green-600 border-green-500/40'
    : 'bg-yellow-500/20 text-yellow-600 border-yellow-500/40';

  const icon = isReady ? Sparkles : TrendingUp;
  const Icon = icon;

  const totalCount = setupCount + readyCount;
  const label = isReady ? 'READY' : 'SETUP';

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
          'font-medium uppercase tracking-wide'
        )}
      >
        <Icon className={cn(compact ? 'w-2.5 h-2.5' : 'w-3 h-3')} />
        {!compact && <span>{label}</span>}
        <span className="tabular-nums">{Math.round(latestConfidence)}%</span>
        {totalCount > 1 && (
          <span className="opacity-70">({totalCount})</span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={cn(
            'absolute z-50 w-64 p-2 rounded-lg shadow-lg border',
            'bg-[var(--surface-1)] border-[var(--border-hairline)]',
            'bottom-full mb-1 left-0'
          )}
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-xs font-medium text-[var(--text-high)] mb-1.5">
            Strategy Signals
          </div>
          <div className="space-y-1">
            {signals.slice(0, 5).map((signal) => (
              <div
                key={signal.id}
                className="flex items-start justify-between gap-2 text-[10px]"
              >
                <span className="text-[var(--text-mid)] truncate">
                  {signal.strategy_name || signal.strategy_slug || 'Unknown'}
                </span>
                <span
                  className={cn(
                    'tabular-nums font-medium shrink-0',
                    (signal.confidence || 0) >= 80
                      ? 'text-green-600'
                      : 'text-yellow-600'
                  )}
                >
                  {Math.round(signal.confidence || 0)}%
                </span>
              </div>
            ))}
            {signals.length > 5 && (
              <div className="text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-hairline)]">
                +{signals.length - 5} more...
              </div>
            )}
          </div>
          <div className="text-[9px] text-[var(--text-muted)] mt-1.5 pt-1.5 border-t border-[var(--border-hairline)]">
            {isNew ? '🔥 New' : 'Active'} • Updated {formatTimeAgo(lastUpdate)}
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
