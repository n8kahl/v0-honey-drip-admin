/**
 * CockpitHeader - Dual pricing header with state badge and data freshness
 *
 * Always shows:
 * - Symbol / Trade State badge
 * - Underlying price (large, dominant)
 * - Contract price (bid/ask/mid summary)
 * - Change % for underlying
 * - Last data update time + stale indicator
 * - Next action hint
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Ticker, Contract } from "../../../types";
import type { CockpitViewState } from "./CockpitLayout";
import { fmtDTE, fmtPrice } from "../../../ui/semantics";
import { Clock, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";

interface CockpitHeaderProps {
  viewState: CockpitViewState;
  symbol: string;
  trade?: Trade | null;
  contract?: Contract | null;
  activeTicker?: Ticker | null;
  underlyingPrice?: number | null;
  underlyingChange?: number | null;
  contractBid?: number | null;
  contractAsk?: number | null;
  contractMid?: number | null;
  lastUpdateTime?: Date | null;
  isStale?: boolean;
  className?: string;
}

// State badge configuration
const STATE_BADGES: Record<CockpitViewState, { label: string; className: string }> = {
  watch: {
    label: "WATCH",
    className: "bg-[var(--surface-2)] text-[var(--text-muted)]",
  },
  plan: {
    label: "PLAN",
    className: "bg-[var(--accent-warning)]/20 text-[var(--accent-warning)]",
  },
  loaded: {
    label: "LOADED",
    className: "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]",
  },
  entered: {
    label: "MANAGE",
    className: "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]",
  },
  exited: {
    label: "REVIEW",
    className: "bg-[var(--text-muted)]/20 text-[var(--text-muted)]",
  },
  expired: {
    label: "EXPIRED",
    className: "bg-amber-500/20 text-amber-400",
  },
};

// Next action hints
const NEXT_ACTION_HINTS: Record<CockpitViewState, string> = {
  watch: "Select contract",
  plan: "Load plan →",
  loaded: "Enter trade →",
  entered: "Manage position",
  exited: "Review complete",
  expired: "Manual exit required",
};

export function CockpitHeader({
  viewState,
  symbol,
  trade,
  contract,
  activeTicker,
  underlyingPrice,
  underlyingChange,
  contractBid,
  contractAsk,
  contractMid,
  lastUpdateTime,
  isStale = false,
  className,
}: CockpitHeaderProps) {
  // Derive underlying price from activeTicker if not provided
  const effectiveUnderlyingPrice = underlyingPrice ?? activeTicker?.last ?? null;
  const effectiveUnderlyingChange = underlyingChange ?? activeTicker?.changePercent ?? null;

  // Derive contract pricing from contract or trade.contract
  const effectiveContract = contract ?? trade?.contract;
  const effectiveBid = contractBid ?? effectiveContract?.bid ?? null;
  const effectiveAsk = contractAsk ?? effectiveContract?.ask ?? null;
  const effectiveMid = contractMid ?? effectiveContract?.mid ?? null;

  // Contract description
  const contractDesc = useMemo(() => {
    if (!effectiveContract) return null;
    const dte = fmtDTE(effectiveContract.daysToExpiry);
    return {
      strike: effectiveContract.strike,
      type: effectiveContract.type,
      dte: dte.text,
      dteClass: dte.className,
    };
  }, [effectiveContract]);

  // State badge config
  const stateBadge = STATE_BADGES[viewState];
  const nextAction = NEXT_ACTION_HINTS[viewState];

  // Format timestamp
  const formattedTime = lastUpdateTime
    ? lastUpdateTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2.5",
        "border-b border-[var(--border-hairline)]",
        "bg-[var(--surface-1)]/95 backdrop-blur-sm",
        className
      )}
      data-testid="cockpit-header-content"
    >
      {/* Left: Symbol + State Badge */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded flex-shrink-0",
            stateBadge.className
          )}
          data-testid="state-badge"
        >
          {stateBadge.label}
        </span>
        <span className="text-lg font-semibold text-[var(--text-high)] truncate">{symbol}</span>
        {/* Contract strike/type badge */}
        {contractDesc && (
          <span className="hidden sm:flex items-center gap-1 text-sm text-[var(--text-muted)]">
            <span className="font-medium">
              ${contractDesc.strike}
              {contractDesc.type}
            </span>
            <span className={cn("text-xs", contractDesc.dteClass)}>{contractDesc.dte}</span>
          </span>
        )}
      </div>

      {/* Center: Dual Pricing */}
      <div className="flex items-center gap-6 flex-shrink-0">
        {/* Underlying Price (dominant) */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">
            Underlying
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums text-[var(--text-high)]">
              {effectiveUnderlyingPrice !== null ? `$${effectiveUnderlyingPrice.toFixed(2)}` : "--"}
            </span>
            {effectiveUnderlyingChange !== null && (
              <span
                className={cn(
                  "text-sm tabular-nums font-medium flex items-center gap-0.5",
                  effectiveUnderlyingChange >= 0
                    ? "text-[var(--accent-positive)]"
                    : "text-[var(--accent-negative)]"
                )}
              >
                {effectiveUnderlyingChange >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {effectiveUnderlyingChange >= 0 ? "+" : ""}
                {effectiveUnderlyingChange.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-[var(--border-hairline)]" />

        {/* Contract Price */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">
            Contract
          </span>
          {effectiveMid !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums text-[var(--brand-primary)]">
                ${effectiveMid.toFixed(2)}
              </span>
              <span className="text-xs text-[var(--text-muted)] tabular-nums hidden sm:inline">
                {effectiveBid !== null && effectiveAsk !== null
                  ? `(${effectiveBid.toFixed(2)}/${effectiveAsk.toFixed(2)})`
                  : ""}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-sm text-[var(--text-faint)]">
              <Minus className="w-3 h-3" />
              <span>No quote</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Time + Stale + Next Action */}
      <div className="flex items-center gap-4">
        {/* Last Update Time */}
        <div className="hidden md:flex items-center gap-1.5 text-[10px] text-[var(--text-faint)]">
          <Clock className="w-3 h-3" />
          <span className="tabular-nums">{formattedTime}</span>
          {isStale && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Stale
            </span>
          )}
        </div>

        {/* Next Action Hint */}
        <div
          className="hidden lg:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]"
          data-testid="next-action-cta"
        >
          {viewState === "entered" && <Zap className="w-3.5 h-3.5 text-[var(--accent-positive)]" />}
          {nextAction}
        </div>
      </div>
    </div>
  );
}

export default CockpitHeader;
