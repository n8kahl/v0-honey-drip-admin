import { Trade } from '../../types';
import { HDTagTradeType } from './HDTagTradeType';
import { HDConfluenceDetailPanel } from './HDConfluenceDetailPanel';
import { HDMicroChart } from './HDMicroChart';
import { HDCard } from './HDCard';
import { HDButton } from './HDButton';
import { formatPrice } from '../../lib/utils';

interface HDLoadedTradeCardProps {
  trade: Trade;
  onEnter: () => void;
  onDiscard: () => void;
  underlyingPrice?: number;
  underlyingChange?: number;
  confluence?: {
    loading: boolean;
    error?: string;
    trend?: any;
    volatility?: any;
    liquidity?: any;
  };
}

export function HDLoadedTradeCard({ trade, onEnter, onDiscard, underlyingPrice, underlyingChange, confluence }: HDLoadedTradeCardProps) {
  return (
    <div className="space-y-4">
      {/* Micro Chart at the top - shows underlying ticker price action */}
      <HDMicroChart
        ticker={trade.ticker}
        currentPrice={underlyingPrice || trade.contract.mid}
        dailyChange={underlyingChange || 0}
        marketStatus="open"
      />
      
      {/* Contract Details Card */}
      <HDCard>
        <div className="space-y-3">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[var(--text-high)] font-semibold">
                {trade.ticker}
              </h2>
              <HDTagTradeType type={trade.tradeType} />
            </div>
            <div className="text-[var(--text-muted)] text-xs mb-2">
              {trade.contract.strike}{trade.contract.type} • {trade.contract.expiry} • {trade.contract.daysToExpiry}DTE
            </div>
          </div>

          {/* Price Details */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-3">
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">Mid</div>
              <div className="text-[var(--text-high)] tabular-nums font-medium">
                ${formatPrice(trade.contract.mid)}
              </div>
            </div>
            <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-3">
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">Target</div>
              <div className="text-[var(--accent-positive)] tabular-nums font-medium">
                {trade.targetPrice ? `$${formatPrice(trade.targetPrice)}` : '—'}
              </div>
            </div>
            <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-3">
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">Stop</div>
              <div className="text-[var(--accent-negative)] tabular-nums font-medium">
                {trade.stopLoss ? `$${formatPrice(trade.stopLoss)}` : '—'}
              </div>
            </div>
          </div>

          {/* Confluence Detail Panel */}
          {confluence && (
            <HDConfluenceDetailPanel
              ticker={trade.ticker}
              direction={trade.contract.type === 'C' ? 'call' : 'put'}
              loading={confluence.loading}
              error={confluence.error}
              trend={confluence.trend}
              volatility={confluence.volatility}
              liquidity={confluence.liquidity}
            />
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <HDButton
              variant="primary"
              onClick={onEnter}
              className="flex-1"
            >
              Enter Trade
            </HDButton>
            <HDButton
              variant="secondary"
              onClick={onDiscard}
              className="flex-1"
            >
              Discard
            </HDButton>
          </div>
        </div>
      </HDCard>
    </div>
  );
}
