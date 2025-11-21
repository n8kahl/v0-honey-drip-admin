import { Trade, TradeState, Contract } from '../../types';
import { HDTagTradeType } from './HDTagTradeType';
import { formatPrice, formatPercent, formatTime, cn } from '../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface HDPanelFocusedTradeProps {
  trade?: Trade;
  ticker?: string;
  state: TradeState;
  className?: string;
}

export function HDPanelFocusedTrade({ trade, ticker, state, className }: HDPanelFocusedTradeProps) {
  if (state === 'WATCHING' || !trade) {
    return (
      <div className={cn('p-6 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]', className)}>
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)]">
            {ticker ? `Select a contract to load an idea for ${ticker}` : 'Select a ticker from the watchlist to start'}
          </p>
        </div>
      </div>
    );
  }
  
  const isPositive = (trade.movePercent || 0) >= 0;
  
  return (
    <div className={cn('p-6 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-[var(--text-high)] text-xl">
              {trade.ticker}
            </h2>
            <HDTagTradeType type={trade.tradeType} />
          </div>
          <div className="text-[var(--text-muted)] text-sm">
            {trade.contract.strike}{trade.contract.type} • {trade.contract.expiry} • {trade.contract.daysToExpiry}DTE
          </div>
        </div>
        
        {state === 'ENTERED' && trade.movePercent !== undefined && (
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="w-5 h-5 text-[var(--accent-positive)]" />
            ) : (
              <TrendingDown className="w-5 h-5 text-[var(--accent-negative)]" />
            )}
            <span
              className={cn(
                'text-xl tabular-nums',
                isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
              )}
            >
              {formatPercent(trade.movePercent)}
            </span>
          </div>
        )}
      </div>
      
      {/* Price Grid */}
      <div className="grid grid-cols-4 gap-4">
        {state !== 'WATCHING' && trade.entryPrice && (
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Entry</div>
            <div className="text-[var(--text-high)] tabular-nums">
              ${formatPrice(trade.entryPrice)}
            </div>
          </div>
        )}
        
        {trade.currentPrice && (
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Current</div>
            <div className="text-[var(--text-high)] tabular-nums">
              ${formatPrice(trade.currentPrice)}
            </div>
          </div>
        )}
        
        {trade.targetPrice && (
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Target</div>
            <div className="text-[var(--accent-positive)] tabular-nums">
              ${formatPrice(trade.targetPrice)}
            </div>
          </div>
        )}
        
        {trade.stopLoss && (
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Stop Loss</div>
            <div className="text-[var(--accent-negative)] tabular-nums">
              ${formatPrice(trade.stopLoss)}
            </div>
          </div>
        )}
      </div>
      
      {/* Contract Details */}
      <div className="pt-4 border-t border-[var(--border-hairline)]">
        <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
          Contract Details
        </div>
        
        {/* Pricing */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Mid</div>
            <div className="text-[var(--text-high)] tabular-nums">
              ${formatPrice(trade.contract.mid)}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Bid</div>
            <div className="text-[var(--text-high)] tabular-nums">
              ${formatPrice(trade.contract.bid)}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Ask</div>
            <div className="text-[var(--text-high)] tabular-nums">
              ${formatPrice(trade.contract.ask)}
            </div>
          </div>
        </div>
        
        {/* Greeks */}
        {(trade.contract.delta || trade.contract.gamma || trade.contract.theta || trade.contract.vega) && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            {trade.contract.delta !== undefined && (
              <div>
                <div className="text-[var(--text-muted)] text-xs mb-1">Delta</div>
                <div className="text-[var(--text-high)] tabular-nums">
                  {trade.contract.delta.toFixed(3)}
                </div>
              </div>
            )}
            {trade.contract.gamma !== undefined && (
              <div>
                <div className="text-[var(--text-muted)] text-xs mb-1">Gamma</div>
                <div className="text-[var(--text-high)] tabular-nums">
                  {trade.contract.gamma.toFixed(3)}
                </div>
              </div>
            )}
            {trade.contract.theta !== undefined && (
              <div>
                <div className="text-[var(--text-muted)] text-xs mb-1">Theta</div>
                <div className="text-[var(--text-high)] tabular-nums">
                  {trade.contract.theta.toFixed(3)}
                </div>
              </div>
            )}
            {trade.contract.vega !== undefined && (
              <div>
                <div className="text-[var(--text-muted)] text-xs mb-1">Vega</div>
                <div className="text-[var(--text-high)] tabular-nums">
                  {trade.contract.vega.toFixed(3)}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Volume & OI */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Volume</div>
            <div className="text-[var(--text-high)] tabular-nums">
              {trade.contract.volume.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs mb-1">Open Interest</div>
            <div className="text-[var(--text-high)] tabular-nums">
              {trade.contract.openInterest.toLocaleString()}
            </div>
          </div>
          {trade.contract.iv !== undefined && (
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">IV</div>
              <div className="text-[var(--text-high)] tabular-nums">
                {trade.contract.iv.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Activity Timeline */}
      {trade.updates && trade.updates.length > 0 ? (
        <div className="pt-4 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Activity
          </h3>
          <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
            {trade.updates
              .slice()
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map(update => {
                const updateLabel = {
                  'enter': 'Entered position',
                  'exit': 'Exited position',
                  'light-trim': 'Light trim',
                  'heavy-trim': 'Heavy trim',
                  'add': 'Added',
                  'move-sl': 'Moved SL',
                  'update': 'Update'
                }[update.type];
                
                const displayText = update.message || updateLabel;
                const priceText = ` at $${formatPrice(update.price)}`;
                
                return (
                  <li key={update.id} className="flex justify-between gap-2">
                    <span>
                      {formatTime(update.timestamp)} – {displayText}{priceText}
                    </span>
                    {update.pnlPercent != null && (
                      <span className={cn(
                        'tabular-nums',
                        update.pnlPercent >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                      )}>
                        {update.pnlPercent >= 0 ? '+' : ''}{update.pnlPercent.toFixed(1)}%
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ) : (
        trade.updates && (
          <div className="pt-4 border-t border-[var(--border-hairline)]">
            <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
              Activity
            </h3>
            <p className="text-xs text-[var(--text-muted)]">No activity yet.</p>
          </div>
        )
      )}
    </div>
  );
}
