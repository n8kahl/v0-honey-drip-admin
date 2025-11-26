import { Trade } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { HDConfluenceDetailPanel } from "../dashboard/HDConfluenceDetailPanel";
import { HDEntryChecklist } from "../dashboard/HDEntryChecklist";
import { HDContractQualityBadge } from "../dashboard/HDContractQualityBadge";
import { HDEconomicEventWarning } from "../dashboard/HDEconomicEventWarning";
import { HDTimeDecayWarning } from "../dashboard/HDTimeDecayWarning";
import { HDDynamicProfitTargets } from "../dashboard/HDDynamicProfitTargets";
import { HDCard } from "../common/HDCard";
import { HDButton } from "../common/HDButton";
import { formatPrice } from "../../../lib/utils";
import type { ContractQualityConfig } from "../../../lib/scoring/ContractQualityScore";

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
  // Build quality config based on trade type
  const qualityConfig: ContractQualityConfig = {
    tradeStyle:
      trade.tradeType === "Scalp" ? "scalp" : trade.tradeType === "Swing" ? "swing" : "day_trade",
    direction: trade.contract.type === "C" ? "call" : "put",
    isDebit: true, // Assume buying options
    underlyingPrice: underlyingPrice ?? 0,
  };

  return (
    <div className="space-y-3">
      {/* Header - Contract Details */}
      <HDCard>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-[var(--text-high)] font-semibold text-lg">{trade.ticker}</h2>
              <HDTagTradeType type={trade.tradeType} />
              <HDContractQualityBadge contract={trade.contract} config={qualityConfig} compact />
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

      {/* Trade Plan with Dynamic Profit Targets */}
      <HDCard>
        <HDDynamicProfitTargets
          contract={trade.contract}
          entryPrice={trade.contract.mid}
          stopLoss={trade.stopLoss}
          tradeType={trade.tradeType}
        />
      </HDCard>

      {/* Contract Quality Analysis */}
      <HDCard>
        <div className="text-[var(--text-high)] text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <span>⭐</span>
          <span>Contract Quality</span>
        </div>
        <HDContractQualityBadge contract={trade.contract} config={qualityConfig} showDetails />
      </HDCard>

      {/* Entry Checklist - Critical pre-entry confirmation */}
      <HDCard>
        <HDEntryChecklist
          ticker={trade.ticker}
          direction={trade.contract.type === "C" ? "call" : "put"}
          contract={trade.contract}
        />
      </HDCard>

      {/* Time Decay Warning - DTE urgency and session timing */}
      <HDCard>
        <HDTimeDecayWarning contract={trade.contract} />
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

      {/* Economic Event Warning */}
      <HDEconomicEventWarning ticker={trade.ticker} />

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
