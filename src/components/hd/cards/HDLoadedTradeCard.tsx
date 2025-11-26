import { Trade } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { HDConfluenceDetailPanel } from "../dashboard/HDConfluenceDetailPanel";
import { HDCard } from "../common/HDCard";
import { HDButton } from "../common/HDButton";
import { formatPrice } from "../../../lib/utils";

interface HDLoadedTradeCardProps {
  trade: Trade;
  onEnter: () => void;
  onDiscard: () => void;
  underlyingPrice?: number;
  underlyingChange?: number;
  showActions?: boolean; // Whether to show Enter/Discard action buttons (default: true)
}

export function HDLoadedTradeCard({
  trade,
  onEnter,
  onDiscard,
  underlyingPrice,
  underlyingChange,
  showActions = true,
}: HDLoadedTradeCardProps) {
  return (
    <div className="space-y-3">
      {/* Header - Contract Details */}
      <HDCard>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-[var(--text-high)] font-semibold text-lg">{trade.ticker}</h2>
              <HDTagTradeType type={trade.tradeType} />
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              ${trade.contract.strike}
              {trade.contract.type} •{" "}
              {new Date(trade.contract.expiry).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              • {trade.contract.daysToExpiry}DTE
            </div>
          </div>
        </div>

        {/* Price Summary - Underlying + Contract */}
        <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-3">
          <div>
            <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
              Underlying
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[var(--text-high)] tabular-nums font-medium">
                ${underlyingPrice ? formatPrice(underlyingPrice) : "—"}
              </span>
              {underlyingChange !== undefined && (
                <span
                  className={`text-[11px] tabular-nums ${
                    underlyingChange >= 0
                      ? "text-[var(--accent-positive)]"
                      : "text-[var(--accent-negative)]"
                  }`}
                >
                  {underlyingChange >= 0 ? "+" : ""}
                  {underlyingChange.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
              Contract
            </div>
            <div className="text-[var(--text-high)] tabular-nums font-medium">
              ${formatPrice(trade.contract.mid)}
            </div>
          </div>
        </div>
      </HDCard>

      {/* Trade Plan */}
      <HDCard>
        <div className="text-[var(--text-high)] text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <span>📊</span>
          <span>Trade Plan</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-2.5 border border-[var(--border-hairline)]">
            <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
              Entry
            </div>
            <div className="text-[var(--text-high)] tabular-nums font-medium text-sm">
              ${formatPrice(trade.contract.mid)}
            </div>
          </div>
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-2.5 border border-[var(--accent-positive)]/20">
            <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
              Target
            </div>
            <div className="text-[var(--accent-positive)] tabular-nums font-medium text-sm">
              {trade.targetPrice ? `$${formatPrice(trade.targetPrice)}` : "—"}
            </div>
          </div>
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-2.5 border border-[var(--accent-negative)]/20">
            <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
              Stop
            </div>
            <div className="text-[var(--accent-negative)] tabular-nums font-medium text-sm">
              {trade.stopLoss ? `$${formatPrice(trade.stopLoss)}` : "—"}
            </div>
          </div>
        </div>
      </HDCard>

      {/* Market Analysis */}
      <HDCard>
        <div className="text-[var(--text-high)] text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <span>📈</span>
          <span>Market Analysis</span>
        </div>

        <HDConfluenceDetailPanel
          ticker={trade.ticker}
          direction={trade.contract.type === "C" ? "call" : "put"}
          contract={trade.contract}
        />
      </HDCard>

      {/* Action Buttons - Only show when showActions is true */}
      {showActions && (
        <div className="flex gap-2.5">
          <HDButton variant="primary" onClick={onEnter} className="flex-1">
            Enter Trade
          </HDButton>
          <HDButton variant="secondary" onClick={onDiscard} className="flex-1">
            Discard
          </HDButton>
        </div>
      )}
    </div>
  );
}
