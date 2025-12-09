/**
 * HDEntryChecklist - Pre-entry confirmation checklist for options day traders
 *
 * Compact status bar showing condition chips with pass/warn/fail states.
 * Full details available behind a toggle.
 *
 * Conditions checked:
 * - Trend alignment across timeframes
 * - VWAP position (above/below)
 * - Volume confirmation
 * - RSI not overbought/oversold
 * - IV percentile status
 * - Time decay (DTE)
 * - Contract liquidity
 */

import { useState } from "react";
import { cn } from "../../../lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { StatusChip, type StatusChipStatus } from "../common/StatusChip";
import { useMarketDataStore } from "../../../stores/marketDataStore";
import type { Contract } from "../../../types";

interface ChecklistItem {
  id: string;
  label: string;
  shortLabel: string;
  status: StatusChipStatus;
  detail?: string;
}

interface HDEntryChecklistProps {
  ticker: string;
  direction: "call" | "put";
  contract?: Contract;
  className?: string;
  compact?: boolean;
  defaultExpanded?: boolean;
}

export function HDEntryChecklist({
  ticker,
  direction,
  contract,
  className,
  compact = false,
  defaultExpanded = false,
}: HDEntryChecklistProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Get market data from store
  const symbolData = useMarketDataStore((state) => state.symbols[ticker]);
  const confluence = symbolData?.confluence;
  const indicators = symbolData?.indicators;

  // Build checklist items
  const items: ChecklistItem[] = [];

  // Common derived data
  const primaryTimeframe = symbolData?.primaryTimeframe;
  const candles = primaryTimeframe ? (symbolData?.candles[primaryTimeframe] ?? []) : [];
  const lastCandle = candles[candles.length - 1];

  const recentVolumes = candles.slice(-20).map((c) => c.volume);
  const avgVolume =
    recentVolumes.length > 0
      ? recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length
      : undefined;

  // 1. Trend Alignment
  const trendScore = confluence?.trend ?? 50;
  const isBullishTrend = trendScore >= 60;
  const isBearishTrend = trendScore <= 40;
  const trendAligned = direction === "call" ? isBullishTrend : isBearishTrend;

  items.push({
    id: "trend",
    label: "Trend Alignment",
    shortLabel: "Trend",
    status: trendAligned ? "pass" : !isBullishTrend && !isBearishTrend ? "warn" : "fail",
    detail: `MTF ${trendAligned ? "aligned" : "not aligned"} (${trendScore.toFixed(0)}%)`,
  });

  // 2. VWAP Position
  const vwap = indicators?.vwap;
  const currentPrice = symbolData?.price ?? 0;

  if (vwap && currentPrice > 0) {
    const aboveVwap = currentPrice > vwap;
    const vwapAligned = direction === "call" ? aboveVwap : !aboveVwap;
    const vwapDistance = (Math.abs(currentPrice - vwap) / currentPrice) * 100;

    items.push({
      id: "vwap",
      label: "VWAP Position",
      shortLabel: "VWAP",
      status: vwapAligned ? "pass" : vwapDistance < 0.5 ? "warn" : "fail",
      detail: `${aboveVwap ? "Above" : "Below"} VWAP (${vwapDistance.toFixed(1)}%)`,
    });
  }

  // 3. Volume Confirmation
  const volumeScore = confluence?.volume ?? 50;
  const relVol = avgVolume && lastCandle ? lastCandle.volume / avgVolume : 1;

  items.push({
    id: "volume",
    label: "Volume",
    shortLabel: "Vol",
    status: volumeScore >= 60 ? "pass" : volumeScore >= 40 ? "warn" : "fail",
    detail: `${relVol.toFixed(1)}x avg vol`,
  });

  // 4. RSI Check
  const rsi = indicators?.rsi14 ?? 50;
  const isOverbought = rsi > 70;
  const isOversold = rsi < 30;
  const rsiBad = direction === "call" ? isOverbought : isOversold;

  items.push({
    id: "rsi",
    label: "RSI Status",
    shortLabel: "RSI",
    status: rsiBad ? "fail" : isOverbought || isOversold ? "warn" : "pass",
    detail: `RSI ${rsi.toFixed(0)}${isOverbought ? " OB" : isOversold ? " OS" : ""}`,
  });

  // 5. IV Percentile
  const ivPercentile = confluence?.volatility ?? 50;
  const ivElevated = ivPercentile > 70;
  const ivCheap = ivPercentile < 30;

  items.push({
    id: "iv",
    label: "IV Percentile",
    shortLabel: "IV",
    status: ivElevated ? "warn" : ivCheap ? "pass" : "neutral",
    detail: `IV ${ivPercentile.toFixed(0)}%${ivElevated ? " rich" : ivCheap ? " cheap" : ""}`,
  });

  // 6. DTE/Time Decay
  const dte = contract?.daysToExpiry ?? 0;
  const dteWarning = dte === 0 || (dte === 1 && new Date().getHours() >= 14);

  items.push({
    id: "dte",
    label: "Time Decay",
    shortLabel: "DTE",
    status: dteWarning ? "warn" : dte <= 3 ? "neutral" : "pass",
    detail: dte === 0 ? "0DTE rapid decay" : `${dte}DTE`,
  });

  // 7. Liquidity
  const volume = contract?.volume ?? 0;
  const openInterest = contract?.openInterest ?? 0;
  const spreadPct =
    contract && contract.mid > 0 ? ((contract.ask - contract.bid) / contract.mid) * 100 : 0;
  const hasGoodLiquidity = volume > 100 && openInterest > 500 && spreadPct < 3;
  const hasOkLiquidity = volume > 50 || openInterest > 100;

  items.push({
    id: "liquidity",
    label: "Liquidity",
    shortLabel: "Liq",
    status: hasGoodLiquidity ? "pass" : hasOkLiquidity ? "warn" : "fail",
    detail: `Spread ${spreadPct.toFixed(1)}%`,
  });

  // Calculate counts
  const passCount = items.filter((i) => i.status === "pass").length;
  const failCount = items.filter((i) => i.status === "fail").length;

  // Mobile/compact: just counts
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-xs", className)}>
        <span className="text-[var(--text-muted)]">{passCount}/{items.length}</span>
        <span className={passCount >= 5 ? "text-[var(--accent-positive)]" : failCount >= 2 ? "text-[var(--accent-negative)]" : "text-[var(--text-muted)]"}>
          {passCount >= 5 ? "Ready" : failCount >= 2 ? "Caution" : "Review"}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header: count + chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-[var(--text-muted)]">
          {passCount}/{items.length}
        </span>

        {/* Condition chips */}
        {items.map((item) => (
          <StatusChip
            key={item.id}
            label={item.shortLabel}
            status={item.status}
            size="xs"
          />
        ))}

        {/* Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        >
          {expanded ? "Less" : "Details"}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-1 pt-1 border-t border-[var(--border-hairline)] animate-fade-in-up">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="text-[var(--text-muted)]">{item.label}</span>
              <span className={cn(
                item.status === "pass" && "text-[var(--accent-positive)]",
                item.status === "warn" && "text-yellow-500",
                item.status === "fail" && "text-[var(--accent-negative)]",
                item.status === "neutral" && "text-[var(--text-muted)]"
              )}>
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
