/**
 * CockpitContractPanel - Contract and liquidity information
 *
 * Shows:
 * - Underlying: price, change %, key level nearest
 * - Contract: strike, exp, type (C/P), DTE
 * - Quotes: bid/ask/mid, spread %, IV, OI, volume
 * - Liquidity rating badge (Good/Fair/Poor)
 * - Last quote time
 * - Select Contract button (opens ContractPicker)
 */

import React, { useMemo, useState, useCallback } from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Ticker, Contract, TradeState } from "../../../types";
import type { ContractRecommendation } from "../../../hooks/useContractRecommendation";
import { fmtDTE, formatExpirationShort } from "../../../ui/semantics";
import {
  BarChart2,
  Clock,
  DollarSign,
  Activity,
  AlertCircle,
  CheckCircle,
  MinusCircle,
  ListFilter,
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
  /** Trade state to determine if contract can be changed */
  tradeState?: TradeState;
  /** Callback when a new contract is selected */
  onContractSelect?: (contract: Contract) => void;
  /** Recommended contract to highlight in picker */
  recommendation?: ContractRecommendation | null;
}

export function CockpitContractPanel({
  symbol,
  trade,
  contract,
  activeTicker,
  underlyingPrice,
  underlyingChange,
  lastQuoteTime,
  className,
  tradeState,
  onContractSelect,
  recommendation,
}: CockpitContractPanelProps) {
  // Contract picker state
  const [pickerOpen, setPickerOpen] = useState(false);

  // Derive contract from trade if not provided
  const effectiveContract = contract ?? trade?.contract ?? null;

  // Determine effective trade state
  const effectiveState = tradeState ?? trade?.state;

  // Can change contract? Only in WATCHING, LOADED (pre-entry), or plan preview mode
  const canChangeContract =
    !effectiveState || effectiveState === "WATCHING" || effectiveState === "LOADED";
  const isEntered = effectiveState === "ENTERED" || effectiveState === "EXITED";

  // Handle contract selection from picker
  const handleContractSelected = useCallback(
    (newContract: Contract) => {
      if (onContractSelect && canChangeContract) {
        onContractSelect(newContract);
      }
      setPickerOpen(false);
    },
    [onContractSelect, canChangeContract]
  );

  // Derive underlying price
  const effectiveUnderlyingPrice = underlyingPrice ?? activeTicker?.last ?? null;
  const effectiveUnderlyingChange = underlyingChange ?? activeTicker?.changePercent ?? null;

  // Calculate liquidity metrics
  const liquidityMetrics = useMemo(() => {
    if (!effectiveContract) return null;

    const bid = effectiveContract.bid ?? 0;
    const ask = effectiveContract.ask ?? 0;
    const mid = effectiveContract.mid ?? (bid + ask) / 2;
    const spreadPct = mid > 0 ? ((ask - bid) / mid) * 100 : 0;
    const volume = effectiveContract.volume ?? 0;
    const openInterest = effectiveContract.openInterest ?? 0;
    const iv = effectiveContract.impliedVolatility ?? effectiveContract.iv ?? 0;

    // Liquidity rating
    let rating: "good" | "fair" | "poor" = "poor";
    if (spreadPct < 1 && volume > 100 && openInterest > 500) {
      rating = "good";
    } else if (spreadPct < 3 && volume > 50 && openInterest > 100) {
      rating = "fair";
    }

    return {
      bid,
      ask,
      mid,
      spreadPct,
      volume,
      openInterest,
      iv: iv * 100, // Convert to percentage
      rating,
    };
  }, [effectiveContract]);

  // Contract info
  const contractInfo = useMemo(() => {
    if (!effectiveContract) return null;
    const dte = fmtDTE(effectiveContract.daysToExpiry);
    return {
      strike: effectiveContract.strike,
      type: effectiveContract.type,
      expiry: effectiveContract.expiry,
      dte: dte.text,
      dteClass: dte.className,
      daysToExpiry: effectiveContract.daysToExpiry,
    };
  }, [effectiveContract]);

  // Format last quote time
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
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-high)]">
            Contract & Liquidity
          </span>
        </div>
        <div className="flex items-center gap-2">
          {liquidityMetrics && <LiquidityBadge rating={liquidityMetrics.rating} />}
          {/* Select Contract button */}
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
          <div className="text-sm text-[var(--text-faint)]">No contract selected</div>
        </div>
      )}

      {/* Contract Details */}
      {effectiveContract && contractInfo && liquidityMetrics && (
        <>
          {/* Contract Description Row */}
          <div className="flex items-center justify-between bg-[var(--surface-2)] rounded p-2 mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text-high)]">
                ${contractInfo.strike}
                {contractInfo.type}
              </span>
              <span className={cn("text-xs font-medium", contractInfo.dteClass)}>
                {contractInfo.dte}
              </span>
            </div>
            {contractInfo.expiry && (
              <span className="text-xs text-[var(--text-muted)]">
                Exp: {formatExpirationShort(contractInfo.expiry)}
              </span>
            )}
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2">
            {/* Bid */}
            <MetricCard
              label="Bid"
              value={`$${liquidityMetrics.bid.toFixed(2)}`}
              className="text-[var(--accent-positive)]"
            />
            {/* Ask */}
            <MetricCard
              label="Ask"
              value={`$${liquidityMetrics.ask.toFixed(2)}`}
              className="text-[var(--accent-negative)]"
            />
            {/* Mid */}
            <MetricCard
              label="Mid"
              value={`$${liquidityMetrics.mid.toFixed(2)}`}
              className="text-[var(--brand-primary)]"
              highlight
            />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
            {/* Spread */}
            <MetricCard
              label="Spread"
              value={`${liquidityMetrics.spreadPct.toFixed(2)}%`}
              className={cn(
                liquidityMetrics.spreadPct < 1
                  ? "text-[var(--accent-positive)]"
                  : liquidityMetrics.spreadPct < 3
                    ? "text-amber-400"
                    : "text-[var(--accent-negative)]"
              )}
            />
            {/* IV */}
            <MetricCard
              label="IV"
              value={`${liquidityMetrics.iv.toFixed(1)}%`}
              className={cn(
                liquidityMetrics.iv > 50
                  ? "text-amber-400"
                  : liquidityMetrics.iv > 30
                    ? "text-[var(--text-high)]"
                    : "text-blue-400"
              )}
            />
            {/* Volume */}
            <MetricCard
              label="Volume"
              value={liquidityMetrics.volume.toLocaleString()}
              className="text-[var(--text-high)]"
            />
            {/* OI */}
            <MetricCard
              label="Open Interest"
              value={liquidityMetrics.openInterest.toLocaleString()}
              className="text-[var(--text-high)]"
            />
          </div>

          {/* Underlying Context */}
          <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-faint)]">{symbol}</span>
              {effectiveUnderlyingPrice !== null && (
                <span className="text-[var(--text-high)] font-medium tabular-nums">
                  ${effectiveUnderlyingPrice.toFixed(2)}
                </span>
              )}
              {effectiveUnderlyingChange !== null && (
                <span
                  className={cn(
                    "tabular-nums",
                    effectiveUnderlyingChange >= 0
                      ? "text-[var(--accent-positive)]"
                      : "text-[var(--accent-negative)]"
                  )}
                >
                  {effectiveUnderlyingChange >= 0 ? "+" : ""}
                  {effectiveUnderlyingChange.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[var(--text-faint)]">
              <Clock className="w-3 h-3" />
              <span className="tabular-nums">{formattedQuoteTime}</span>
            </div>
          </div>
        </>
      )}

      {/* Contract Picker Modal/Sheet */}
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
// Metric Card
// ============================================================================

function MetricCard({
  label,
  value,
  className,
  highlight = false,
}: {
  label: string;
  value: string;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-2 rounded border",
        highlight
          ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30"
          : "bg-[var(--surface-2)] border-[var(--border-hairline)]"
      )}
    >
      <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums", className)}>{value}</div>
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

export default CockpitContractPanel;
