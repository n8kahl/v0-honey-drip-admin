/**
 * SelectedContractStrip - Displays currently selected/recommended contract
 *
 * Shows between Top4Grid and CompactChain:
 * - Contract info: Strike | Type | Expiry | DTE
 * - Key metrics: Mid | Delta | Spread | IV | Liquidity Grade
 * - Visual indicator for recommended vs manual selection
 * - "Revert to recommended" action if manually overridden
 * - Live data indicators showing source and freshness
 *
 * Updated Dec 2025: Now uses LoadedTradeLiveModel for live metrics
 */

import type { Contract } from "../../../types";
import type { LoadedTradeLiveModel } from "../../../hooks/useLoadedTradeLiveModel";
import { cn } from "../../../lib/utils";
import { Star, RotateCcw, TrendingUp, TrendingDown, Wifi, Clock, AlertTriangle } from "lucide-react";
import { formatAge } from "../../../lib/market/dataFreshness";

interface SelectedContractStripProps {
  contract: Contract | null;
  isRecommended?: boolean;
  onRevertToRecommended?: () => void;
  hasRecommendation?: boolean;
  className?: string;
  /** Optional live model for enhanced metrics */
  liveModel?: LoadedTradeLiveModel | null;
}

export function SelectedContractStrip({
  contract,
  isRecommended = false,
  onRevertToRecommended,
  hasRecommendation = false,
  className,
  liveModel,
}: SelectedContractStripProps) {
  if (!contract) {
    return (
      <div
        className={cn(
          "flex items-center justify-center px-4 py-3 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg",
          className
        )}
      >
        <p className="text-xs text-[var(--text-muted)]">Select a contract from the chain below</p>
      </div>
    );
  }

  // Use live model data when available, fallback to static contract
  const hasLiveData = liveModel && liveModel.option.source !== "none";

  // Effective mid: prefer live, fallback to contract snapshot
  const effectiveMid = hasLiveData
    ? liveModel.formatted.effectiveMid
    : `$${contract.mid.toFixed(2)}`;

  // Delta: prefer live Greeks, fallback to contract
  const delta = hasLiveData && liveModel.greeks.delta !== null
    ? liveModel.greeks.delta.toFixed(2)
    : contract.delta?.toFixed(2) ?? "—";

  // Spread: prefer live calculation, fallback to static
  const spreadPct = hasLiveData
    ? liveModel.formatted.spreadPct
    : contract.mid > 0
      ? `${(((contract.ask - contract.bid) / contract.mid) * 100).toFixed(1)}%`
      : "—";

  // Liquidity grade and slippage (only from live model)
  const liquidityGrade = hasLiveData ? liveModel.execution.liquidityGrade : null;
  const slippage = hasLiveData ? liveModel.formatted.slippage : null;

  // Data health
  const isStale = liveModel?.overallHealth === "stale";
  const isDegraded = liveModel?.overallHealth === "degraded";
  const dataSource = hasLiveData ? liveModel.option.source : "static";
  const dataAge = hasLiveData ? formatAge(Date.now() - liveModel.option.asOf) : null;

  const isCall = contract.type === "C";
  const ContractIcon = isCall ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-2.5 rounded-lg border transition-all",
        isRecommended
          ? "bg-amber-500/5 border-amber-500/30"
          : "bg-[var(--surface-1)] border-[var(--border-hairline)]",
        className
      )}
    >
      {/* Contract Identity */}
      <div className="flex items-center gap-2">
        {isRecommended && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
        <ContractIcon
          className={cn(
            "w-4 h-4",
            isCall ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        />
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold text-[var(--text-high)]">${contract.strike}</span>
          <span
            className={cn(
              "text-xs font-medium",
              isCall ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {isCall ? "Call" : "Put"}
          </span>
        </div>
      </div>

      {/* Expiry */}
      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
        <span>{contract.expiry}</span>
        <span className="text-[var(--text-faint)]">({contract.daysToExpiry ?? 0}D)</span>
      </div>

      {/* Metrics Chips */}
      <div className="flex-1 flex items-center gap-3 justify-center">
        {/* Mid Price with live indicator */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--text-faint)] uppercase">Mid</span>
          <span className={cn(
            "text-xs font-medium tabular-nums",
            isStale ? "text-red-400" : "text-[var(--text-high)]"
          )}>
            {effectiveMid}
          </span>
          {hasLiveData && (
            <Wifi className={cn(
              "w-3 h-3",
              dataSource === "websocket" ? "text-green-400" : "text-yellow-400"
            )} />
          )}
        </div>

        {/* Delta */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--text-faint)]">Δ</span>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {delta}
          </span>
        </div>

        {/* Spread */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--text-faint)] uppercase">Spread</span>
          <span
            className={cn(
              "text-xs tabular-nums",
              typeof spreadPct === "string" && parseFloat(spreadPct) > 3
                ? "text-[var(--accent-negative)]"
                : "text-[var(--text-muted)]"
            )}
          >
            {spreadPct}
          </span>
        </div>

        {/* Liquidity Grade (only when live) */}
        {liquidityGrade && (
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-semibold rounded",
                liquidityGrade === "A" && "bg-green-500/20 text-green-400",
                liquidityGrade === "B" && "bg-yellow-500/20 text-yellow-400",
                liquidityGrade === "C" && "bg-red-500/20 text-red-400"
              )}
            >
              {liquidityGrade}
            </span>
          </div>
        )}

        {/* Expected Slippage (only when live) */}
        {slippage && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-faint)] uppercase">Slip</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {slippage}
            </span>
          </div>
        )}

        {/* IV */}
        {contract.iv && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-faint)] uppercase">IV</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {(contract.iv * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {/* OI */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--text-faint)] uppercase">OI</span>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {contract.openInterest > 1000
              ? `${(contract.openInterest / 1000).toFixed(1)}k`
              : contract.openInterest.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Data Health + Selection Badge + Revert Action */}
      <div className="flex items-center gap-2">
        {/* Stale/Degraded Warning */}
        {isStale && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-400">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[9px] font-medium">STALE</span>
          </div>
        )}
        {isDegraded && !isStale && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
            <Clock className="w-3 h-3" />
            <span className="text-[9px] font-medium">DELAYED</span>
          </div>
        )}

        {/* Data Age (when live) */}
        {dataAge && !isStale && (
          <span className="text-[9px] text-[var(--text-faint)]">{dataAge}</span>
        )}

        {/* Static badge when no live data */}
        {!hasLiveData && (
          <span className="px-2 py-0.5 text-[9px] font-medium rounded bg-gray-500/20 text-gray-400">
            SNAPSHOT
          </span>
        )}

        {isRecommended ? (
          <span className="px-2 py-0.5 text-[9px] font-medium rounded bg-amber-500/20 text-amber-400">
            RECOMMENDED
          </span>
        ) : (
          <span className="px-2 py-0.5 text-[9px] font-medium rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
            MANUAL
          </span>
        )}

        {/* Revert to recommended button */}
        {!isRecommended && hasRecommendation && onRevertToRecommended && (
          <button
            onClick={onRevertToRecommended}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
            title="Revert to recommended contract"
          >
            <RotateCcw className="w-3 h-3" />
            Revert
          </button>
        )}
      </div>
    </div>
  );
}

export default SelectedContractStrip;
