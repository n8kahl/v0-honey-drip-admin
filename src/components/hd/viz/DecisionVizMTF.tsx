/**
 * DecisionVizMTF - Mode C: MTF Ladder
 *
 * Compact multi-timeframe ladder showing trend/strength/ATR/RSI per timeframe.
 * Useful when candle data is sparse but indicator data exists.
 */

import React, { useMemo } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "../../../lib/utils";
import { fmtPrice } from "../../../ui/semantics";
import type { Candle, Indicators, MTFTrend, Timeframe } from "../../../stores/marketDataStore";

// ============================================================================
// Types
// ============================================================================

interface DecisionVizMTFProps {
  mtfTrend: Record<Timeframe, MTFTrend>;
  indicators: Indicators;
  candles: Candle[];
}

interface TimeframeRow {
  tf: Timeframe;
  label: string;
  trend: MTFTrend;
  strength: "Strong" | "Moderate" | "Weak";
  atr?: number;
  rsi?: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate trend strength based on alignment with other timeframes
 */
function calculateStrength(
  tf: Timeframe,
  mtfTrend: Record<Timeframe, MTFTrend>
): "Strong" | "Moderate" | "Weak" {
  const timeframes: Timeframe[] = ["1m", "5m", "15m", "60m", "1D"];
  const currentTrend = mtfTrend[tf];

  if (currentTrend === "neutral") return "Weak";

  // Count how many other timeframes align
  let alignedCount = 0;
  for (const otherTf of timeframes) {
    if (otherTf !== tf && mtfTrend[otherTf] === currentTrend) {
      alignedCount++;
    }
  }

  if (alignedCount >= 3) return "Strong";
  if (alignedCount >= 1) return "Moderate";
  return "Weak";
}

/**
 * Get trend icon component
 */
function TrendIcon({ trend }: { trend: MTFTrend }) {
  switch (trend) {
    case "bull":
      return <ArrowUp className="w-3 h-3" />;
    case "bear":
      return <ArrowDown className="w-3 h-3" />;
    default:
      return <Minus className="w-3 h-3" />;
  }
}

/**
 * Get trend styling
 */
function getTrendStyle(trend: MTFTrend): string {
  switch (trend) {
    case "bull":
      return "text-[var(--accent-positive)]";
    case "bear":
      return "text-[var(--accent-negative)]";
    default:
      return "text-[var(--text-muted)]";
  }
}

/**
 * Get trend label
 */
function getTrendLabel(trend: MTFTrend): string {
  switch (trend) {
    case "bull":
      return "Bull";
    case "bear":
      return "Bear";
    default:
      return "Flat";
  }
}

/**
 * Get strength styling
 */
function getStrengthStyle(strength: "Strong" | "Moderate" | "Weak"): string {
  switch (strength) {
    case "Strong":
      return "text-[var(--accent-positive)]";
    case "Moderate":
      return "text-[var(--brand-primary)]";
    default:
      return "text-[var(--text-faint)]";
  }
}

/**
 * Get RSI styling (overbought/oversold highlighting)
 */
function getRsiStyle(rsi: number | undefined): string {
  if (rsi === undefined) return "text-[var(--text-muted)]";
  if (rsi >= 70) return "text-[var(--accent-negative)]"; // Overbought
  if (rsi <= 30) return "text-[var(--accent-positive)]"; // Oversold
  return "text-[var(--text-muted)]";
}

// ============================================================================
// Component
// ============================================================================

export function DecisionVizMTF({
  mtfTrend,
  indicators,
  candles,
}: DecisionVizMTFProps) {
  // Build rows for display
  const rows = useMemo((): TimeframeRow[] => {
    const timeframes: { tf: Timeframe; label: string }[] = [
      { tf: "1m", label: "1m" },
      { tf: "5m", label: "5m" },
      { tf: "15m", label: "15m" },
      { tf: "60m", label: "1h" },
    ];

    return timeframes.map(({ tf, label }) => ({
      tf,
      label,
      trend: mtfTrend[tf] || "neutral",
      strength: calculateStrength(tf, mtfTrend),
      // We only have single-timeframe indicators from primary TF
      // In a full implementation, each TF would have its own ATR/RSI
      atr: tf === "1m" ? indicators.atr14 : undefined,
      rsi: tf === "1m" ? indicators.rsi14 : undefined,
    }));
  }, [mtfTrend, indicators]);

  // Calculate overall alignment
  const alignment = useMemo(() => {
    const trends = Object.values(mtfTrend);
    const bullCount = trends.filter((t) => t === "bull").length;
    const bearCount = trends.filter((t) => t === "bear").length;

    if (bullCount >= 4)
      return { label: "Strong Bullish Alignment", style: "text-[var(--accent-positive)]" };
    if (bearCount >= 4)
      return { label: "Strong Bearish Alignment", style: "text-[var(--accent-negative)]" };
    if (bullCount >= 3)
      return { label: "Bullish Bias", style: "text-[var(--accent-positive)]" };
    if (bearCount >= 3)
      return { label: "Bearish Bias", style: "text-[var(--accent-negative)]" };
    return { label: "Mixed/Choppy", style: "text-[var(--data-stale)]" };
  }, [mtfTrend]);

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
          Multi-Timeframe Analysis
        </span>
        <span className={cn("text-[10px] font-medium", alignment.style)}>
          {alignment.label}
        </span>
      </div>

      {/* Table */}
      <div className="border border-[var(--border-hairline)] rounded overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-5 gap-1 px-2 py-1.5 bg-[var(--surface-2)] text-[9px] text-[var(--text-faint)] uppercase tracking-wide font-medium">
          <div>TF</div>
          <div>Trend</div>
          <div>Strength</div>
          <div>ATR</div>
          <div>RSI</div>
        </div>

        {/* Data Rows */}
        {rows.map((row) => (
          <div
            key={row.tf}
            className="grid grid-cols-5 gap-1 px-2 py-1.5 border-t border-[var(--border-hairline)] text-[10px]"
          >
            {/* Timeframe */}
            <div className="text-[var(--text-high)] font-medium">{row.label}</div>

            {/* Trend */}
            <div className={cn("flex items-center gap-1", getTrendStyle(row.trend))}>
              <TrendIcon trend={row.trend} />
              <span>{getTrendLabel(row.trend)}</span>
            </div>

            {/* Strength */}
            <div className={getStrengthStyle(row.strength)}>{row.strength}</div>

            {/* ATR */}
            <div className="text-[var(--text-muted)] tabular-nums">
              {row.atr ? fmtPrice(row.atr) : "—"}
            </div>

            {/* RSI */}
            <div className={cn("tabular-nums", getRsiStyle(row.rsi))}>
              {row.rsi !== undefined ? row.rsi.toFixed(0) : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="text-[9px] text-[var(--text-faint)] italic">
        ATR/RSI shown for primary timeframe only
      </div>
    </div>
  );
}

export default DecisionVizMTF;
