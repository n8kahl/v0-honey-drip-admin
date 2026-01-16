/**
 * CockpitHeader V2 - Unified header with Greeks, contract info, and freshness
 *
 * Layout: STATE | SYMBOL+PRICE | CONTRACT INFO | GREEKS+SPREAD | FRESHNESS
 *
 * Single source of truth for:
 * - Symbol + underlying price
 * - Contract strike/expiry/DTE
 * - Greeks (Delta, Theta, IV)
 * - Bid/Ask/Mid/Spread
 * - Data freshness indicator
 */

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Ticker, Contract } from "../../../types";
import type { CockpitViewState } from "./CockpitLayout";
import { fmtDTE, fmtPrice } from "../../../ui/semantics";
import { Clock, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap, Activity } from "lucide-react";

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

// State badge configuration with colors from design spec
const STATE_BADGES: Record<CockpitViewState, { label: string; className: string; color: string }> =
  {
    watch: {
      label: "WATCH",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      color: "#3B82F6",
    },
    plan: {
      label: "PLAN",
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      color: "#F59E0B",
    },
    loaded: {
      label: "LOADED",
      className:
        "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border-[var(--brand-primary)]/30",
      color: "var(--brand-primary)",
    },
    entered: {
      label: "MANAGE",
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      color: "#10B981",
    },
    exited: {
      label: "REVIEW",
      className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      color: "#6B7280",
    },
    expired: {
      label: "EXPIRED",
      className: "bg-red-500/20 text-red-400 border-red-500/30",
      color: "#EF4444",
    },
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
  // Live indicator pulse state
  const [pulseVisible, setPulseVisible] = useState(true);

  // Pulse animation for live indicator
  useEffect(() => {
    if (isStale) return;
    const interval = setInterval(() => {
      setPulseVisible((v) => !v);
    }, 1000);
    return () => clearInterval(interval);
  }, [isStale]);

  // Derive underlying price from activeTicker if not provided
  const effectiveUnderlyingPrice = underlyingPrice ?? activeTicker?.last ?? null;
  const effectiveUnderlyingChange = underlyingChange ?? activeTicker?.changePercent ?? null;

  // Derive contract pricing from contract or trade.contract
  const effectiveContract = contract ?? trade?.contract;
  const effectiveBid = contractBid ?? effectiveContract?.bid ?? null;
  const effectiveAsk = contractAsk ?? effectiveContract?.ask ?? null;
  const effectiveMid = contractMid ?? effectiveContract?.mid ?? null;

  // Contract info with Greeks
  const contractInfo = useMemo(() => {
    if (!effectiveContract) return null;
    const dte = fmtDTE(effectiveContract.daysToExpiry);

    // Calculate spread percentage
    const mid = effectiveMid ?? effectiveContract.mid ?? 0;
    const bid = effectiveBid ?? effectiveContract.bid ?? 0;
    const ask = effectiveAsk ?? effectiveContract.ask ?? 0;
    const spreadPct = mid > 0.01 ? ((ask - bid) / mid) * 100 : null;

    return {
      strike: effectiveContract.strike,
      type: effectiveContract.type,
      expiry: effectiveContract.expiry,
      dte: dte.text,
      dteClass: dte.className,
      daysToExpiry: effectiveContract.daysToExpiry,
      // Greeks
      delta: effectiveContract.delta,
      theta: effectiveContract.theta,
      gamma: effectiveContract.gamma,
      vega: effectiveContract.vega,
      iv: effectiveContract.iv,
      // Pricing
      bid,
      ask,
      mid,
      spreadPct,
    };
  }, [effectiveContract, effectiveBid, effectiveAsk, effectiveMid]);

  // State badge config
  const stateBadge = STATE_BADGES[viewState];

  // Format timestamp with seconds since update
  const { formattedTime, secondsAgo } = useMemo(() => {
    if (!lastUpdateTime) return { formattedTime: "--:--", secondsAgo: null };
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdateTime.getTime()) / 1000);
    return {
      formattedTime: lastUpdateTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      secondsAgo: diff,
    };
  }, [lastUpdateTime]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        "border-b border-[var(--border-hairline)]",
        "bg-[var(--surface-1)]/95 backdrop-blur-sm",
        className
      )}
      data-testid="cockpit-header-content"
    >
      {/* Section 1: State Badge */}
      <div className="flex-shrink-0">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded border",
            stateBadge.className
          )}
          data-testid="state-badge"
        >
          {stateBadge.label}
        </span>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-[var(--border-hairline)] flex-shrink-0" />

      {/* Section 2: Symbol + Price */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base font-bold text-[var(--text-high)] truncate">{symbol}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold tabular-nums text-[var(--text-high)]">
            {effectiveUnderlyingPrice !== null ? `$${effectiveUnderlyingPrice.toFixed(2)}` : "--"}
          </span>
          {effectiveUnderlyingChange !== null && (
            <span
              className={cn(
                "text-xs tabular-nums font-semibold flex items-center gap-0.5",
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
      <div className="h-8 w-px bg-[var(--border-hairline)] flex-shrink-0 hidden sm:block" />

      {/* Section 3: Contract Info */}
      {contractInfo && (
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          {/* Strike + Type + DTE */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-[var(--brand-primary)]">
              ${contractInfo.strike}
              {contractInfo.type}
            </span>
            <span
              className={cn("text-xs font-medium px-1.5 py-0.5 rounded", contractInfo.dteClass)}
            >
              {contractInfo.dte}
            </span>
          </div>

          {/* Mid Price + Bid/Ask */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--text-muted)]">Mid:</span>
            <span className="text-sm font-semibold tabular-nums text-[var(--text-high)]">
              ${contractInfo.mid.toFixed(2)}
            </span>
            <span className="text-[10px] text-[var(--text-faint)] tabular-nums hidden md:inline">
              ({contractInfo.bid.toFixed(2)}/{contractInfo.ask.toFixed(2)})
            </span>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="h-8 w-px bg-[var(--border-hairline)] flex-shrink-0 hidden md:block" />

      {/* Section 4: Greeks + Spread */}
      {contractInfo && (
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          {/* Delta */}
          {contractInfo.delta !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-faint)]">Δ</span>
              <span className="text-xs font-semibold tabular-nums text-[var(--text-high)]">
                {contractInfo.delta.toFixed(2)}
              </span>
            </div>
          )}

          {/* Theta */}
          {contractInfo.theta !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-faint)]">Θ</span>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  contractInfo.theta < 0
                    ? "text-[var(--accent-negative)]"
                    : "text-[var(--text-high)]"
                )}
              >
                {contractInfo.theta.toFixed(2)}
              </span>
            </div>
          )}

          {/* IV */}
          {contractInfo.iv !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-faint)]">IV</span>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  contractInfo.iv * 100 > 50 ? "text-amber-400" : "text-[var(--text-high)]"
                )}
              >
                {(contractInfo.iv * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {/* Spread */}
          {contractInfo.spreadPct !== null && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-faint)]">Sprd</span>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  contractInfo.spreadPct < 1
                    ? "text-[var(--accent-positive)]"
                    : contractInfo.spreadPct < 3
                      ? "text-amber-400"
                      : "text-[var(--accent-negative)]"
                )}
              >
                {contractInfo.spreadPct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Section 5: Freshness Indicator */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isStale ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400">STALE</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
            <div
              className={cn(
                "w-2 h-2 rounded-full bg-emerald-500 transition-opacity duration-500",
                pulseVisible ? "opacity-100" : "opacity-40"
              )}
            />
            <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
            {secondsAgo !== null && secondsAgo < 60 && (
              <span className="text-[10px] text-emerald-400/70 tabular-nums">{secondsAgo}s</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CockpitHeader;
