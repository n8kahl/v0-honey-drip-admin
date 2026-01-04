/**
 * DecisionVizMTF - Mode C: MTF Ladder
 *
 * Compact multi-timeframe ladder showing trend/strength/ATR/RSI per timeframe.
 * Useful when candle data is sparse but indicator data exists.
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import { fmtPrice } from "../../../ui/semantics";
import type { Candle, Indicators, MTFTrend, Timeframe } from "../../../stores/marketDataStore";
import { MTFHeatmap, type MTFState, type TrendState } from "./MTFHeatmap";

// ============================================================================
// Types
// ============================================================================

interface DecisionVizMTFProps {
  mtfTrend: Record<Timeframe, MTFTrend>;
  indicators: Indicators;
  candles: Candle[];
}

// ============================================================================
// Component
// ============================================================================

export function DecisionVizMTF({ mtfTrend, indicators, candles }: DecisionVizMTFProps) {
  // Build timeframes for Heatmap
  const timeframes = useMemo((): MTFState[] => {
    // Standard set of timeframes to display
    // Note: We map 60m to 1H for display
    const targets: { key: Timeframe; label: string }[] = [
      { key: "1m", label: "1m" },
      { key: "5m", label: "5m" },
      { key: "15m", label: "15m" },
      { key: "60m", label: "1H" },
      { key: "1D", label: "1D" }, // Include daily even if sometimes missing
    ];

    return targets.map(({ key, label }) => {
      const rawTrend = mtfTrend[key];
      // Map 'neutral' | 'bull' | 'bear' -> 'neutral' | 'bull' | 'bear'
      // effectively same string, but strictly typed
      const trend: TrendState =
        rawTrend === "bull" ? "bull" : rawTrend === "bear" ? "bear" : "neutral";

      return { tf: key, trend, label };
    });
  }, [mtfTrend]);

  // Calculate overall alignment summary
  const alignment = useMemo(() => {
    const trends = Object.values(mtfTrend);
    const bullCount = trends.filter((t) => t === "bull").length;
    const bearCount = trends.filter((t) => t === "bear").length;

    if (bullCount >= 3)
      return { label: "Bullish Alignment", style: "text-[var(--accent-positive)]" };
    if (bearCount >= 3)
      return { label: "Bearish Alignment", style: "text-[var(--accent-negative)]" };
    return { label: "Mixed / Choppy", style: "text-[var(--text-muted)]" };
  }, [mtfTrend]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
          Fractal Trend
        </span>
        <span className={cn("text-[10px] font-medium", alignment.style)}>{alignment.label}</span>
      </div>

      {/* Heatmap Visualization */}
      <div className="flex-1 flex flex-col justify-center">
        <MTFHeatmap timeframes={timeframes} orientation="vertical" className="gap-2" />
      </div>

      {/* Footer / Legend */}
      <div className="flex items-center justify-between text-[9px] text-[var(--text-faint)] px-1">
        <span>Low TF</span>
        <span>High TF</span>
      </div>
    </div>
  );
}

export default DecisionVizMTF;
