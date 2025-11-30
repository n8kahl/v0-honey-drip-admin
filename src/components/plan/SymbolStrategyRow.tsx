/**
 * SymbolStrategyRow
 *
 * Displays a single symbol with all its active/forming strategies.
 * Used in Session Mode (market hours) to show real-time strategy status.
 *
 * Example:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SPY $594.80 (+0.42%)                                               │
 * │  ├─ 🟢 breakout_bullish      A+  ACTIVE   Entry: 595.50 (0.12% away)│
 * │  ├─ 🟡 mean_reversion_long   B   FORMING  RSI: 38 (needs <35)       │
 * │  └─ ⚪ gamma_squeeze_bullish  -   WAITING  Price 0.8% from wall      │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import React, { useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { calculateGrade, getGradeClasses, type SetupGrade } from "../../hooks/useSetupGrading";
import { useSymbolData } from "../../stores/marketDataStore";

interface SymbolStrategyRowProps {
  symbol: string;
  signals: CompositeSignal[];
  onStrategyClick?: (signal: CompositeSignal) => void;
  className?: string;
}

type StrategyStatus = "ACTIVE" | "FORMING" | "WAITING" | "INVALIDATED" | "EXPIRED";

interface EnrichedStrategy {
  signal: CompositeSignal;
  status: StrategyStatus;
  grade: SetupGrade | null;
  gradeClasses: { text: string; bg: string; border: string };
  statusLabel: string;
  distanceToEntry: number | null;
  distancePercent: number | null;
}

/**
 * Get strategy status based on signal state
 */
function getStrategyStatus(signal: CompositeSignal, currentPrice: number): StrategyStatus {
  // Active signals that are currently valid
  if (signal.status === "ACTIVE") {
    return "ACTIVE";
  }

  // Expired signals
  if (signal.status === "EXPIRED") {
    return "EXPIRED";
  }

  // Check if signal is forming (close to trigger)
  if (signal.entryPrice && currentPrice) {
    const distancePercent = Math.abs((currentPrice - signal.entryPrice) / signal.entryPrice) * 100;

    // If within 0.5% of entry, it's forming
    if (distancePercent < 0.5) {
      return "FORMING";
    }
  }

  // Default to waiting
  return "WAITING";
}

/**
 * Get status display info
 */
function getStatusDisplay(status: StrategyStatus): {
  icon: string;
  color: string;
  label: string;
} {
  switch (status) {
    case "ACTIVE":
      return { icon: "🟢", color: "text-green-400", label: "ACTIVE" };
    case "FORMING":
      return { icon: "🟡", color: "text-yellow-400", label: "FORMING" };
    case "WAITING":
      return { icon: "⚪", color: "text-zinc-400", label: "WAITING" };
    case "INVALIDATED":
      return { icon: "🔴", color: "text-red-400", label: "INVALIDATED" };
    case "EXPIRED":
      return { icon: "⚫", color: "text-zinc-500", label: "EXPIRED" };
    default:
      return { icon: "⚪", color: "text-zinc-400", label: "-" };
  }
}

/**
 * Format opportunity type for display
 */
function formatOpportunityType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Bullish", "↑")
    .replace("Bearish", "↓")
    .replace("Long", "↑")
    .replace("Short", "↓");
}

export function SymbolStrategyRow({
  symbol,
  signals,
  onStrategyClick,
  className,
}: SymbolStrategyRowProps) {
  const [expanded, setExpanded] = useState(true);
  const symbolData = useSymbolData(symbol);

  // Get current price from symbolData candles or signal features
  const currentPrice = useMemo(() => {
    // Try to get from 1m candles (most recent)
    const candles = symbolData?.candles?.["1m"];
    if (candles && candles.length > 0) {
      return candles[candles.length - 1].close;
    }
    // Fallback to signal features
    const firstSignal = signals[0];
    if (firstSignal?.features?.close) return firstSignal.features.close;
    return 0;
  }, [symbolData, signals]);

  // Calculate change percent from candles or signal features
  const changePercent = useMemo(() => {
    const candles = symbolData?.candles?.["1m"];
    if (candles && candles.length > 1) {
      const first = candles[0].open;
      const last = candles[candles.length - 1].close;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    }
    return signals[0]?.features?.changePercent ?? 0;
  }, [symbolData, signals]);

  // Enrich signals with status and grading
  const enrichedStrategies: EnrichedStrategy[] = useMemo(() => {
    return signals
      .map((signal) => {
        const status = getStrategyStatus(signal, currentPrice);
        const grading = calculateGrade(
          signal.baseScore ?? 0,
          signal.recommendedStyleScore ?? 0,
          signal.riskReward ?? 0
        );

        const distanceToEntry =
          signal.entryPrice && currentPrice ? signal.entryPrice - currentPrice : null;

        const distancePercent =
          signal.entryPrice && currentPrice
            ? ((signal.entryPrice - currentPrice) / currentPrice) * 100
            : null;

        return {
          signal,
          status,
          grade: grading.tradeable ? grading.grade : null,
          gradeClasses: getGradeClasses(grading.grade),
          statusLabel: getStatusDisplay(status).label,
          distanceToEntry,
          distancePercent,
        };
      })
      .sort((a, b) => {
        // Sort by status priority: ACTIVE > FORMING > WAITING > others
        const statusOrder: Record<StrategyStatus, number> = {
          ACTIVE: 0,
          FORMING: 1,
          WAITING: 2,
          INVALIDATED: 3,
          EXPIRED: 4,
        };
        return statusOrder[a.status] - statusOrder[b.status];
      });
  }, [signals, currentPrice]);

  // Count active signals
  const activeCount = enrichedStrategies.filter((s) => s.status === "ACTIVE").length;

  if (signals.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b border-[var(--border-hairline)]",
        "bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors",
        className
      )}
    >
      {/* Symbol Header Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 lg:p-4 text-left"
      >
        <div className="flex items-center gap-3">
          {/* Expand/collapse icon */}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          )}

          {/* Symbol name */}
          <span className="font-semibold text-[var(--text-high)]">{symbol}</span>

          {/* Active count badge */}
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400">
              {activeCount} ACTIVE
            </span>
          )}
        </div>

        {/* Price info */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-[var(--text-high)]">
            ${currentPrice.toFixed(2)}
          </span>
          <span
            className={cn(
              "font-mono text-xs",
              changePercent >= 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {changePercent >= 0 ? (
              <TrendingUp className="inline w-3 h-3 mr-0.5" />
            ) : (
              <TrendingDown className="inline w-3 h-3 mr-0.5" />
            )}
            {changePercent >= 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </button>

      {/* Strategy List */}
      {expanded && (
        <div className="pb-3 lg:pb-4 pl-10 lg:pl-12 pr-3 lg:pr-4 space-y-1">
          {enrichedStrategies.map((strategy) => {
            const statusDisplay = getStatusDisplay(strategy.status);

            return (
              <button
                key={strategy.signal.id}
                onClick={() => onStrategyClick?.(strategy.signal)}
                disabled={strategy.status !== "ACTIVE"}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-[var(--radius)]",
                  "text-left text-sm transition-colors",
                  strategy.status === "ACTIVE"
                    ? "bg-green-500/10 hover:bg-green-500/20 cursor-pointer"
                    : strategy.status === "FORMING"
                      ? "bg-yellow-500/5 hover:bg-yellow-500/10 cursor-pointer"
                      : "bg-transparent opacity-60 cursor-default"
                )}
              >
                {/* Status icon */}
                <span className="text-xs">{statusDisplay.icon}</span>

                {/* Strategy type */}
                <span
                  className={cn(
                    "flex-1 font-mono text-xs",
                    strategy.status === "ACTIVE"
                      ? "text-[var(--text-high)]"
                      : "text-[var(--text-muted)]"
                  )}
                >
                  {formatOpportunityType(strategy.signal.opportunityType)}
                </span>

                {/* Grade */}
                {strategy.grade && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded",
                      strategy.gradeClasses.bg,
                      strategy.gradeClasses.text
                    )}
                  >
                    {strategy.grade}
                  </span>
                )}

                {/* Status label */}
                <span className={cn("text-[10px] font-medium uppercase", statusDisplay.color)}>
                  {strategy.statusLabel}
                </span>

                {/* Distance to entry */}
                {strategy.distancePercent !== null && strategy.status !== "ACTIVE" && (
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {strategy.distancePercent > 0 ? "+" : ""}
                    {strategy.distancePercent.toFixed(2)}% away
                  </span>
                )}

                {/* Entry price for active signals */}
                {strategy.status === "ACTIVE" && strategy.signal.entryPrice && (
                  <span className="text-[10px] text-green-400 font-mono">
                    Entry: ${strategy.signal.entryPrice.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}

          {enrichedStrategies.length === 0 && (
            <div className="text-xs text-[var(--text-muted)] italic py-2">
              No strategies detected for this symbol
            </div>
          )}
        </div>
      )}
    </div>
  );
}
