import { Trade } from '../../../types';
import { formatPrice, formatPercent, cn } from '../../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface HDTradeShareCardProps {
  trade: Trade;
  includeWatermark?: boolean;
}

/**
 * Trade card optimized for screenshots and sharing
 * Clean design with all key metrics visible
 */
export function HDTradeShareCard({ trade, includeWatermark = true }: HDTradeShareCardProps) {
  const isPositive = (trade.movePercent || 0) >= 0;
  
  // Format timestamp in EST
  const now = new Date();
  const estDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(now);
  
  return (
    <div className="w-full max-w-[600px] bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-2)] rounded-2xl p-8 border-2 border-[var(--border-hairline)] shadow-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-[var(--text-high)]">
              {trade.ticker}
            </h1>
            <div className="px-3 py-1 rounded-full bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--text-med)]">
              {trade.tradeType}
            </div>
          </div>
          <div className="text-[var(--text-muted)]">
            ${trade.contract.strike}{trade.contract.type} • {trade.contract.expiry} • {trade.contract.daysToExpiry}DTE
          </div>
        </div>
        
        {/* P&L Badge */}
        {trade.movePercent !== undefined && (
          <div className={cn(
            'px-6 py-3 rounded-xl flex items-center gap-2',
            isPositive ? 'bg-[var(--accent-positive)]/10' : 'bg-[var(--accent-negative)]/10'
          )}>
            {isPositive ? (
              <TrendingUp className="w-6 h-6 text-[var(--accent-positive)]" />
            ) : (
              <TrendingDown className="w-6 h-6 text-[var(--accent-negative)]" />
            )}
            <span className={cn(
              'text-2xl font-bold tabular-nums',
              isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
            )}>
              {formatPercent(trade.movePercent)}
            </span>
          </div>
        )}
      </div>
      
      {/* Divider */}
      <div className="h-px bg-[var(--border-hairline)] my-6" />
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {trade.entryPrice && (
          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Entry</div>
            <div className="text-xl font-bold text-[var(--text-high)] tabular-nums">
              ${formatPrice(trade.entryPrice)}
            </div>
          </div>
        )}
        
        {trade.exitPrice && (
          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Exit</div>
            <div className="text-xl font-bold text-[var(--text-high)] tabular-nums">
              ${formatPrice(trade.exitPrice)}
            </div>
          </div>
        )}
        
        {trade.targetPrice && (
          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Target</div>
            <div className="text-xl font-bold text-[var(--accent-positive)] tabular-nums">
              ${formatPrice(trade.targetPrice)}
            </div>
          </div>
        )}
        
        {trade.stopLoss && (
          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Stop Loss</div>
            <div className="text-xl font-bold text-[var(--accent-negative)] tabular-nums">
              ${formatPrice(trade.stopLoss)}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Watermark */}
      {includeWatermark && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-hairline)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center">
              <span className="text-[var(--bg-base)] text-sm font-bold">HD</span>
            </div>
            <div>
              <div className="text-[var(--brand-primary)] font-medium">HoneyDrip</div>
              <div className="text-xs text-[var(--text-muted)]">honeydripnetwork.com</div>
            </div>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {estDate}
          </div>
        </div>
      )}
    </div>
  );
}
