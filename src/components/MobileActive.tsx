import { Trade } from '../types';
import { HDTagTradeType } from './hd/HDTagTradeType';
import { HDConfluenceDetailPanel } from './hd/HDConfluenceDetailPanel';
import { formatPercent, formatPrice, cn } from '../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { MobileWatermark } from './MobileWatermark';

interface MobileActiveProps {
  trades: Trade[];
  updatedTradeIds?: Set<string>;
  onTradeClick?: (trade: Trade) => void;
}

export function MobileActive({ trades, updatedTradeIds = new Set(), onTradeClick }: MobileActiveProps) {
  // Only show ENTERED trades on this tab (EXITED trades are removed)
  const activeTrades = trades.filter(t => t.state === 'ENTERED');
  
  return (
    <div className="flex flex-col bg-[var(--surface-2)] relative">
      {/* Watermark - visible on all screens */}
      <MobileWatermark />
      
      {/* Page Title */}
      <div className="p-4 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] relative z-10">
        <h1 className="text-[var(--text-high)] text-lg font-medium">Active Trades</h1>
        <p className="text-[var(--text-muted)] text-xs mt-1">Tap any trade to manage it</p>
      </div>

      {/* Active Trades Section */}
      {activeTrades.length > 0 && (
        <div className="p-4">            
          <div className="space-y-2">{activeTrades.map((trade) => {
            const isPositive = (trade.movePercent || 0) >= 0;
            const isUpdating = updatedTradeIds.has(trade.id);
            
            return (
              <button
                key={trade.id}
                onClick={() => onTradeClick?.(trade)}
                className={cn(
                  'w-full p-3 bg-[var(--surface-1)] border rounded-lg text-left hover:bg-[var(--surface-2)] transition-all duration-300',
                  isPositive ? 'border-[var(--accent-positive)]/30' : 'border-[var(--accent-negative)]/30',
                  isUpdating && isPositive && 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]',
                  isUpdating && !isPositive && 'bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[var(--text-high)] font-medium text-sm">{trade.ticker}</span>
                      <HDTagTradeType type={trade.tradeType} />
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {trade.contract.daysToExpiry}DTE {trade.contract.strike}{trade.contract.type}
                    </div>
                  </div>
                  <div className="text-right">
                    {trade.movePercent !== undefined && (
                      <>
                        <div className={cn(
                          'flex items-center gap-1 font-medium text-sm mb-1',
                          isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                        )}>
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {formatPercent(trade.movePercent)}
                        </div>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[9px] uppercase tracking-wide inline-block',
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
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">
                    Entry: ${formatPrice(trade.entryPrice || 0)}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    Current: ${formatPrice(trade.currentPrice || 0)}
                  </span>
                </div>
              </button>
            );
          })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeTrades.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <p className="text-[var(--text-high)] text-lg mb-2">No Trades Currently Active</p>
            <p className="text-[var(--text-muted)] text-sm">
              Enter trades from the Watch tab to see them here
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
