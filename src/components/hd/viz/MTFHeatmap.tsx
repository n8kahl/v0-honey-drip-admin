/**
 * MTFHeatmap.tsx
 *
 * A compact "Heatmap Bar" showing trend alignment across multiple timeframes.
 * Replaces the old disjointed arrow indicators.
 *
 * Visual:
 * [ 1W ] [ 1D ] [ 4H ] [ 1H ] [ 15m ] [ 5m ] [ 1m ]
 *   RED    RED   GRAY   GREEN  GREEN  GREEN  GREEN
 *
 * Features:
 * - Fractal ordering (Higher TF -> Lower TF)
 * - Color validation (Red/Green/Gray)
 * - Tooltip summary
 */

import React from "react";
import { cn } from "../../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";

// ============================================================================
// Types
// ============================================================================

export type TrendState = "bull" | "bear" | "neutral";

export interface MTFState {
  tf: string;
  trend: TrendState;
  label?: string; // Optional override for display (e.g. "1D")
}

interface MTFHeatmapProps {
  timeframes: MTFState[];
  className?: string;
  orientation?: "horizontal" | "vertical";
}

// ============================================================================
// Component
// ============================================================================

export function MTFHeatmap({ timeframes, className, orientation = "horizontal" }: MTFHeatmapProps) {
  const getColor = (trend: TrendState) => {
    switch (trend) {
      case "bull":
        return "bg-[var(--accent-positive)] shadow-[0_0_10px_-3px_var(--accent-positive)]";
      case "bear":
        return "bg-[var(--accent-negative)] shadow-[0_0_10px_-3px_var(--accent-negative)]";
      default:
        return "bg-[var(--surface-3)]";
    }
  };

  const getTextColor = (trend: TrendState) => {
    switch (trend) {
      case "bull":
        return "text-[var(--accent-positive)]";
      case "bear":
        return "text-[var(--accent-negative)]";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  // Sort ensures we display consistent High -> Low order if needed
  // specific order: 1W, 1D, 4H, 1H, 15m, 5m, 1m
  const sortOrder = ["1W", "1D", "4H", "60m", "1H", "15m", "5m", "1m"];

  const sortedTimeframes = [...timeframes].sort((a, b) => {
    const idxA = sortOrder.indexOf(a.tf);
    const idxB = sortOrder.indexOf(b.tf);
    // If not found in sortOrder, put at end
    const safeA = idxA === -1 ? 999 : idxA;
    const safeB = idxB === -1 ? 999 : idxB;
    return safeA - safeB;
  });

  return (
    <div
      className={cn(
        "flex gap-1",
        orientation === "vertical" ? "flex-col w-full" : "flex-row w-full",
        className
      )}
    >
      {sortedTimeframes.map((item) => (
        <TooltipProvider key={item.tf} delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative group flex items-center justify-center rounded overflow-hidden transition-all hover:scale-105 active:scale-95 cursor-default border border-transparent hover:border-[var(--border-strong)]",
                  orientation === "vertical" ? "h-6 sm:h-8 w-full" : "h-6 sm:h-8 flex-1"
                )}
              >
                {/* Background Color Block */}
                <div
                  className={cn(
                    "absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity",
                    getColor(item.trend)
                  )}
                />

                {/* Indicator Line (Solid) */}
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 opacity-60",
                    getColor(item.trend).split(" ")[0] // Get just the bg class
                  )}
                />

                {/* Text Label */}
                <span
                  className={cn(
                    "relative z-10 text-[10px] font-bold font-mono uppercase tracking-wider",
                    getTextColor(item.trend)
                  )}
                >
                  {item.label || item.tf}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side={orientation === "vertical" ? "left" : "top"}>
              <div className="text-xs">
                <span className="font-bold">{item.label || item.tf}</span>:{" "}
                {item.trend.toUpperCase()} Trend
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
