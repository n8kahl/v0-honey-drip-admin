import { Trade } from '../../types';
import { HDTagTradeType } from '../common/HDTagTradeType';
import { formatPercent, cn } from '../../lib/utils';
import { X } from 'lucide-react';

interface HDRowTradeProps {
  trade: Trade;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export function HDRowTrade({ trade, active, onClick, onRemove }: HDRowTradeProps) {
  const isPositive = (trade.movePercent || 0) >= 0;
  const isLoaded = trade.state === 'LOADED';
  
  return (
    <div
      className={cn(
        'w-full flex items-start justify-between p-3 transition-colors border-b border-[var(--border-hairline)] last:border-b-0 group',
        active 
          ? 'bg-[var(--brand-primary)]/10 border-l-2 border-l-[var(--brand-primary)]' 
          : 'hover:bg-[var(--surface-1)]'
      )}
    >
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            'font-medium',
            active ? 'text-[var(--text-high)]' : 'text-[var(--text-high)]'
          )}>
            {trade.ticker}
          </span>
          <HDTagTradeType type={trade.tradeType} />
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {trade.contract.strike}{trade.contract.type} • {trade.contract.expiry}
        </div>
      </button>
      
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-end gap-1">
          {isLoaded ? (
            <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30">
              📋 Loaded
            </span>
          ) : trade.movePercent !== undefined ? (
            <>
              <span
                className={cn(
                  'text-sm tabular-nums font-medium',
                  isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                )}
              >
                {formatPercent(trade.movePercent)}
              </span>
              <span className={cn(
                'px-2 py-0.5 rounded text-[9px] uppercase tracking-wide',
                isPositive 
                  ? 'bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border border-[var(--accent-positive)]/30'
                  : 'bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] border border-[var(--accent-negative)]/30'
              )}>
                ✓ Active
              </span>
            </>
          ) : null}
        </div>

        {/* Remove button - only show for loaded trades */}
        {onRemove && isLoaded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all flex-shrink-0"
            title="Remove loaded trade"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
