import React from 'react';
import { Trade } from '../../types';
import { HDTagTradeType } from '../hd/HDTagTradeType';
import { formatPercent, formatPrice, cn } from '../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface TradeCardProps {
  trade: Trade;
  onClick?: () => void;
  variant?: 'compact' | 'detailed';
  isUpdating?: boolean;
  className?: string;
}

/**
 * Shared TradeCard component used by both mobile and desktop layouts.
 *
 * - compact: Minimal info (mobile-optimized)
 * - detailed: Additional info like entry/current prices (desktop)
 */
export function TradeCard({
  trade,
  onClick,
  variant = 'compact',
  isUpdating = false,
  className,
}: TradeCardProps) {
  const isPositive = (trade.movePercent || 0) >= 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left transition-all duration-300 rounded-lg border',
        variant === 'compact' && 'p-3 bg-[var(--surface-1)] hover:bg-[var(--surface-2)]',
        variant === 'detailed' && 'p-4 bg-[var(--surface-1)] hover:bg-[var(--surface-2)]',
        // Border colors based on P&L
        isPositive ? 'border-[var(--accent-positive)]/30' : 'border-[var(--accent-negative)]/30',
        // Highlight border and background when trade just updated
        isUpdating && isPositive && 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]',
        isUpdating && !isPositive && 'bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]',
        className
      )}
    >
      {/* Header: Ticker, Type, P&L % */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'font-medium',
              variant === 'compact' && 'text-sm',
              variant === 'detailed' && 'text-base'
            )}>
              {trade.ticker}
            </span>
            <HDTagTradeType type={trade.tradeType} />
          </div>
          <div className={cn(
            'text-[var(--text-muted)]',
            variant === 'compact' && 'text-xs',
            variant === 'detailed' && 'text-sm'
          )}>
            {trade.contract.daysToExpiry}DTE {trade.contract.strike}{trade.contract.type}
          </div>
        </div>

        {/* Right side: P&L % and status */}
        <div className="text-right">
          {trade.movePercent !== undefined && (
            <>
              <div className={cn(
                'flex items-center gap-1 font-medium mb-1',
                isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]',
                variant === 'compact' && 'text-sm',
                variant === 'detailed' && 'text-base'
              )}>
                {isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {formatPercent(trade.movePercent)}
              </div>
              <span className={cn(
                'rounded inline-block uppercase tracking-wide font-medium',
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
      </div>

      {/* Footer: Entry & Current prices (only in detailed variant) */}
      {variant === 'detailed' && (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-hairline)]">
          <span>Entry: ${formatPrice(trade.entryPrice || 0)}</span>
          <span>Current: ${formatPrice(trade.currentPrice || 0)}</span>
        </div>
      )}

      {/* Compact variant: Show entry/current in single line */}
      {variant === 'compact' && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">
            Entry: ${formatPrice(trade.entryPrice || 0)}
          </span>
          <span className="text-[var(--text-muted)]">
            Current: ${formatPrice(trade.currentPrice || 0)}
          </span>
        </div>
      )}
    </button>
  );
}
