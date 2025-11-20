import React from 'react';
import { Trade } from '../../types';
import { HDTagTradeType } from '../hd/HDTagTradeType';
import { formatPercent, formatPrice, cn } from '../../lib/utils';
import { focusRing } from '../../lib/a11y';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';

export interface TradeCardProps {
  trade: Trade;
  onClick?: () => void;
  variant?: 'compact' | 'detailed';
  isUpdating?: boolean;
  className?: string;
  showChevron?: boolean; // Show right arrow hint on mobile
}

/**
 * Shared TradeCard component used by both mobile and desktop layouts.
 *
 * - compact: Minimal info (mobile-optimized, 44px+ touch target)
 * - detailed: Additional info like entry/current prices (desktop)
 *
 * Mobile-first improvements:
 * - 44px minimum touch target height (WCAG 2.5 Level AAA)
 * - Larger padding for easy tapping
 * - Visual feedback on active/hover
 * - Right chevron hint on mobile
 * - Text truncation for long values
 */
export function TradeCard({
  trade,
  onClick,
  variant = 'compact',
  isUpdating = false,
  className,
  showChevron = false,
}: TradeCardProps) {
  const isPositive = (trade.movePercent || 0) >= 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left transition-all duration-200 rounded-lg border active:scale-95',
        focusRing,
        // Min height 44px for mobile touch target accessibility
        variant === 'compact' && 'p-4 bg-[var(--surface-1)] hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)] min-h-[44px] flex flex-col justify-center',
        variant === 'detailed' && 'p-4 bg-[var(--surface-1)] hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)]',
        // Border colors based on P&L
        isPositive ? 'border-[var(--accent-positive)]/30' : 'border-[var(--accent-negative)]/30',
        // Highlight border and background when trade just updated
        isUpdating && isPositive && 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]',
        isUpdating && !isPositive && 'bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]',
        className
      )}
      aria-label={`${trade.ticker} ${trade.contract.strike}${trade.contract.type} - ${formatPercent(trade.movePercent || 0)}`}
    >
      {/* Header: Ticker, Type, P&L % */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'font-medium truncate',
              variant === 'compact' && 'text-sm',
              variant === 'detailed' && 'text-base'
            )}>
              {trade.ticker}
            </span>
            <HDTagTradeType type={trade.tradeType} />
          </div>
          <div className={cn(
            'text-[var(--text-muted)] truncate',
            variant === 'compact' && 'text-xs',
            variant === 'detailed' && 'text-sm'
          )}>
            {trade.contract.daysToExpiry}DTE {trade.contract.strike}{trade.contract.type}
          </div>
        </div>

        {/* Right side: P&L % and status + optional chevron */}
        <div className="text-right flex items-center gap-2 flex-shrink-0">
          <div>
            {trade.movePercent !== undefined && (
              <>
                <div className={cn(
                  'flex items-center gap-1 font-medium mb-1 justify-end',
                  isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]',
                  variant === 'compact' && 'text-sm',
                  variant === 'detailed' && 'text-base'
                )}>
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="w-3 h-3 flex-shrink-0" />
                  )}
                  {formatPercent(trade.movePercent)}
                </div>
                <span className={cn(
                  'rounded inline-block uppercase tracking-wide font-medium whitespace-nowrap',
                  variant === 'compact' && 'px-2 py-0.5 text-[9px]',
                  variant === 'detailed' && 'px-2.5 py-1 text-[10px]',
                  isPositive
                    ? 'bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]'
                    : 'bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]'
                )}>
                  ✓ Active
                </span>
              </>
            )}
          </div>

          {/* Mobile chevron hint */}
          {showChevron && (
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Footer: Entry & Current prices (only in detailed variant) */}
      {variant === 'detailed' && (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-hairline)] mt-2">
          <span>Entry: ${formatPrice(trade.entryPrice || 0)}</span>
          <span>Current: ${formatPrice(trade.currentPrice || 0)}</span>
        </div>
      )}

      {/* Compact variant: Show entry/current in single line */}
      {variant === 'compact' && (
        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-[var(--border-hairline)]">
          <span className="text-[var(--text-muted)] truncate">
            Entry: ${formatPrice(trade.entryPrice || 0)}
          </span>
          <span className="text-[var(--text-muted)] truncate text-right">
            Current: ${formatPrice(trade.currentPrice || 0)}
          </span>
        </div>
      )}
    </button>
  );
}
