import { Trade } from '../types';
import { MobileWatermark } from './MobileWatermark';
import { TradeCard } from './trades/TradeCard';
import { EmptyState } from './ui/EmptyState';
import { Wallet } from 'lucide-react';

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
          <div className="space-y-2">
            {activeTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                variant="compact"
                isUpdating={updatedTradeIds.has(trade.id)}
                onClick={() => onTradeClick?.(trade)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeTrades.length === 0 && (
        <div className="flex-1">
          <EmptyState
            icon={Wallet}
            title="No Active Trades"
            description="Enter a trade from the Watch tab to see it here."
            minHeight="min-h-[50vh]"
          />
        </div>
      )}
    </div>
  );
}
