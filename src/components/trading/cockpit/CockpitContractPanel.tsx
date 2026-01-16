/**
 * CockpitContractPanel V3 - Focused on unique data only
 *
 * REWORKED: Header now handles basic contract info (strike, type, DTE, Greeks)
 * This panel only shows:
 * - Volume/OI (trading activity)
 * - Liquidity rating + thresholds
 * - Contract picker button
 * - Last quote time
 *
 * Kept compact to fit in the smaller right column space
 */

import React, { useMemo, useState, useCallback } from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Ticker, Contract, TradeState } from "../../../types";
import type { ContractRecommendation } from "../../../hooks/useContractRecommendation";
import { getLiquidityGrade } from "../../../lib/market/contractQuality";
import {
  BarChart2,
  Clock,
  AlertCircle,
  CheckCircle,
  MinusCircle,
  Settings2,
  Users,
  TrendingUp,
} from "lucide-react";
import { ContractPicker, ContractPickerTrigger } from "./ContractPicker";

interface CockpitContractPanelProps {
  symbol: string;
  trade?: Trade | null;
  contract?: Contract | null;
  activeTicker?: Ticker | null;
  underlyingPrice?: number | null;
  underlyingChange?: number | null;
  lastQuoteTime?: Date | null;
  className?: string;
  tradeState?: TradeState;
  onContractSelect?: (contract: Contract) => void;
  recommendation?: ContractRecommendation | null;
}

export function CockpitContractPanel({
  symbol,
  trade,
  contract,
  activeTicker,
  underlyingPrice,
  lastQuoteTime,
  className,
  tradeState,
  onContractSelect,
  recommendation,
}: CockpitContractPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const effectiveContract = contract ?? trade?.contract ?? null;
  const effectiveState = tradeState ?? trade?.state;
  const canChangeContract =
    !effectiveState || effectiveState === "WATCHING" || effectiveState === "LOADED";
  const isEntered = effectiveState === "ENTERED" || effectiveState === "EXITED";

  const handleContractSelected = useCallback(
    (newContract: Contract) => {
      if (onContractSelect && canChangeContract) {
        onContractSelect(newContract);
      }
      setPickerOpen(false);
    },
    [onContractSelect, canChangeContract]
  );

  const effectiveUnderlyingPrice = underlyingPrice ?? activeTicker?.last ?? null;

  // Calculate liquidity metrics (Volume, OI, rating)
  const liquidityMetrics = useMemo(() => {
    if (!effectiveContract) return null;

    const bid = effectiveContract.bid ?? 0;
    const ask = effectiveContract.ask ?? 0;
    const mid = effectiveContract.mid ?? (bid + ask) / 2;
    const hasValidPricing = mid > 0.01 || bid > 0 || ask > 0;
    const spreadPct = hasValidPricing && mid > 0.01 ? ((ask - bid) / mid) * 100 : null;

    const volume = effectiveContract.volume ?? 0;
    const openInterest = effectiveContract.openInterest ?? 0;

    const spreadDecimal = spreadPct !== null ? spreadPct / 100 : 1;
    const grade = getLiquidityGrade(spreadDecimal);
    const rating: "good" | "fair" | "poor" =
      spreadPct === null ? "poor" : grade === "A" ? "good" : grade === "B" ? "fair" : "poor";

    return {
      volume,
      openInterest,
      rating,
      spreadPct,
    };
  }, [effectiveContract]);

  const formattedQuoteTime = lastQuoteTime
    ? lastQuoteTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  return (
    <div
      className={cn("h-full flex flex-col p-3 overflow-hidden", className)}
      data-testid="cockpit-contract-panel"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-high)]">Activity</span>
        </div>
        <div className="flex items-center gap-2">
          {liquidityMetrics && <LiquidityBadge rating={liquidityMetrics.rating} />}
          {onContractSelect && (
            <ContractPickerTrigger
              onClick={() => setPickerOpen(true)}
              disabled={isEntered}
              disabledReason={isEntered ? "Can't change contract after entry" : undefined}
              label={effectiveContract ? "Change" : "Select"}
              size="sm"
              variant="ghost"
              className="h-6 px-2"
            />
          )}
        </div>
      </div>

      {/* No Contract State */}
      {!effectiveContract && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="flex flex-col items-center gap-2">
            <Settings2 className="w-8 h-8 text-[var(--text-faint)]" />
            <span className="text-sm text-[var(--text-faint)]">No contract selected</span>
            {onContractSelect && (
              <ContractPickerTrigger
                onClick={() => setPickerOpen(true)}
                label="Select Contract"
                size="sm"
                variant="default"
              />
            )}
          </div>
        </div>
      )}

      {/* Contract Activity Info */}
      {effectiveContract && liquidityMetrics && (
        <div className="flex-1 flex flex-col gap-3">
          {/* Volume & OI Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3 h-3 text-[var(--brand-primary)]" />
                <span className="text-[10px] text-[var(--text-faint)] uppercase">Volume</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-[var(--text-high)]">
                {liquidityMetrics.volume > 0 ? liquidityMetrics.volume.toLocaleString() : "--"}
              </div>
            </div>
            <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3 h-3 text-[var(--brand-primary)]" />
                <span className="text-[10px] text-[var(--text-faint)] uppercase">
                  Open Interest
                </span>
              </div>
              <div className="text-lg font-bold tabular-nums text-[var(--text-high)]">
                {liquidityMetrics.openInterest.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Vol/OI Ratio - trader's signal */}
          {liquidityMetrics.volume > 0 && liquidityMetrics.openInterest > 0 && (
            <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-faint)] uppercase">Vol/OI Ratio</span>
                <VolOIRatio volume={liquidityMetrics.volume} oi={liquidityMetrics.openInterest} />
              </div>
            </div>
          )}

          {/* Spread Warning (if poor) */}
          {liquidityMetrics.spreadPct !== null && liquidityMetrics.spreadPct > 3 && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="text-xs text-amber-400">
                  Wide spread ({liquidityMetrics.spreadPct.toFixed(1)}%) - use limit orders
                </div>
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quote Time Footer */}
          <div className="flex items-center justify-end gap-1.5 text-xs text-[var(--text-faint)] pt-2 border-t border-[var(--border-hairline)]">
            <Clock className="w-3 h-3" />
            <span className="tabular-nums">{formattedQuoteTime}</span>
          </div>
        </div>
      )}

      {/* Contract Picker Modal */}
      {onContractSelect && (
        <ContractPicker
          symbol={symbol}
          currentPrice={effectiveUnderlyingPrice ?? 0}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={handleContractSelected}
          recommendation={recommendation}
          currentContract={effectiveContract}
          disabled={isEntered}
          disabledReason={isEntered ? "Can't change contract after entry" : undefined}
        />
      )}
    </div>
  );
}

// ============================================================================
// Liquidity Badge
// ============================================================================

function LiquidityBadge({ rating }: { rating: "good" | "fair" | "poor" }) {
  const config = {
    good: {
      label: "Good",
      icon: CheckCircle,
      className:
        "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border-[var(--accent-positive)]/30",
    },
    fair: {
      label: "Fair",
      icon: MinusCircle,
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    poor: {
      label: "Poor",
      icon: AlertCircle,
      className:
        "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] border-[var(--accent-negative)]/30",
    },
  };

  const { label, icon: Icon, className } = config[rating];

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium",
        className
      )}
      title={`Liquidity: ${label}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

// ============================================================================
// Vol/OI Ratio Indicator
// ============================================================================

function VolOIRatio({ volume, oi }: { volume: number; oi: number }) {
  const ratio = volume / oi;
  const isUnusual = ratio > 1; // Volume exceeds OI - unusual activity
  const isHigh = ratio > 0.5;

  return (
    <div
      className={cn(
        "text-sm font-bold tabular-nums",
        isUnusual
          ? "text-[var(--accent-positive)]"
          : isHigh
            ? "text-amber-400"
            : "text-[var(--text-high)]"
      )}
      title={
        isUnusual
          ? "Unusual activity: Volume exceeds Open Interest"
          : isHigh
            ? "High activity relative to OI"
            : "Normal trading activity"
      }
    >
      {ratio.toFixed(2)}x
      {isUnusual && (
        <span className="text-[9px] ml-1 font-normal text-[var(--accent-positive)]">Unusual</span>
      )}
    </div>
  );
}

export default CockpitContractPanel;
