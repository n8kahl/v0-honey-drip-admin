import { useState } from "react";
import { Trade } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { HDContractQualityBadge } from "../dashboard/HDContractQualityBadge";
import { HDEconomicEventWarning } from "../dashboard/HDEconomicEventWarning";
import { HDTimeDecayWarning } from "../dashboard/HDTimeDecayWarning";
import { HDDynamicProfitTargets } from "../dashboard/HDDynamicProfitTargets";
import { HDSessionGuidance } from "../dashboard/HDSessionGuidance";
import { HDCard } from "../common/HDCard";
import { HDButton } from "../common/HDButton";
import { SmartGateList, areAllGatesPassing } from "../terminal";
import { formatPrice, cn } from "../../../lib/utils";
import type { ContractQualityConfig } from "../../../lib/scoring/ContractQualityScore";
import type { SymbolFeatures } from "../../../lib/strategy/engine";
import type { StrategySmartGates } from "../../../types/strategy";

interface HDLoadedTradeCardProps {
  trade: Trade;
  onEnter: () => void;
  onDiscard: () => void;
  underlyingPrice?: number;
  underlyingChange?: number;
  showActions?: boolean; // Whether to show Enter/Discard action buttons (default: true)
  features?: SymbolFeatures; // Live market features for gate evaluation
  gates?: StrategySmartGates; // Strategy gate requirements
  technicalTrigger?: boolean; // Whether technical price condition is met
}

export function HDLoadedTradeCard({
  trade,
  onEnter,
  onDiscard,
  underlyingPrice,
  underlyingChange,
  showActions = true,
  features,
  gates,
  technicalTrigger,
}: HDLoadedTradeCardProps) {
  // Override state for bypassing gate check
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(false);

  // Evaluate all gates
  const allGatesPassing = areAllGatesPassing(gates, features, technicalTrigger);
  const canEnter = allGatesPassing || isOverrideEnabled;

  // Build quality config based on trade type
  const qualityConfig: ContractQualityConfig = {
    tradeStyle:
      trade.tradeType === "Scalp" ? "scalp" : trade.tradeType === "Swing" ? "swing" : "day_trade",
    direction: trade.contract.type === "C" ? "call" : "put",
    isDebit: true, // Assume buying options
    underlyingPrice: underlyingPrice ?? 0,
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Contract Header (full width) */}
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

      {/* Row 2: Quality + Targets (2-column grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contract Quality Analysis */}
        <HDCard className="h-fit">
          <div className="text-[var(--text-high)] text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span>⭐</span>
            <span>Contract Quality</span>
          </div>
          <HDContractQualityBadge contract={trade.contract} config={qualityConfig} showDetails />
        </HDCard>

        {/* Dynamic Profit Targets */}
        <HDCard className="h-fit">
          <HDDynamicProfitTargets
            contract={trade.contract}
            entryPrice={trade.contract.mid}
            stopLoss={trade.stopLoss}
            tradeType={trade.tradeType}
          />
        </HDCard>
      </div>

      {/* Row 3: Smart Gates (full width) */}
      <HDCard>
        <SmartGateList gates={gates} features={features} technicalTrigger={technicalTrigger} />
      </HDCard>

      {/* Row 4: Session + Time (2-column grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Session Guidance + Economic Events */}
        <HDCard className="h-fit space-y-3">
          <HDSessionGuidance
            ticker={trade.ticker}
            direction={trade.contract.type === "C" ? "call" : "put"}
            contract={trade.contract}
            tradeType={trade.tradeType}
          />
          <HDEconomicEventWarning ticker={trade.ticker} />
        </HDCard>

        {/* Time Decay Warning */}
        <HDCard className="h-fit">
          <HDTimeDecayWarning contract={trade.contract} />
        </HDCard>
      </div>

      {/* Action Buttons - Only show when showActions is true */}
      {showActions && (
        <div className="space-y-2">
          <div className="flex gap-2.5">
            <HDButton
              variant={canEnter ? "primary" : "secondary"}
              onClick={onEnter}
              disabled={!canEnter}
              className={cn("flex-1", !canEnter && "opacity-50 cursor-not-allowed")}
            >
              {canEnter ? "Enter Trade" : "Conditions Not Met"}
            </HDButton>
            <HDButton variant="secondary" onClick={onDiscard} className="flex-1">
              Discard
            </HDButton>
          </div>

          {/* Override Link - Only show when gates are blocking */}
          {!allGatesPassing && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsOverrideEnabled(!isOverrideEnabled)}
                className={cn(
                  "text-xs transition-colors",
                  isOverrideEnabled
                    ? "text-amber-400 hover:text-amber-300"
                    : "text-muted-foreground hover:text-[var(--text-muted)]"
                )}
              >
                {isOverrideEnabled ? "✓ Override Enabled" : "Override Gates →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
