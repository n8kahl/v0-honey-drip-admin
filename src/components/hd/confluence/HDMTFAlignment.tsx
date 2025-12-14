/**
 * HDMTFAlignment.tsx - Multi-timeframe trend alignment display
 *
 * Shows 4 arrows (1m, 5m, 15m, 60m) with:
 * - Green up arrow for bullish
 * - Red down arrow for bearish
 * - Gray dash for neutral
 * - Alignment count (e.g., "3/4 aligned")
 */

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import type { MTFData } from "../../../hooks/useSymbolConfluence";

// ============================================================================
// Types
// ============================================================================

interface HDMTFAlignmentProps {
  mtf: MTFData[];
  aligned: number;
  total: number;
  compact?: boolean;
  showLabels?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function HDMTFAlignment({
  mtf,
  aligned,
  total,
  compact = false,
  showLabels = true,
  className,
}: HDMTFAlignmentProps) {
  // Determine if predominantly bullish or bearish
  const upCount = mtf.filter((t) => t.direction === "up").length;
  const downCount = mtf.filter((t) => t.direction === "down").length;
  const dominantDirection =
    upCount > downCount ? "bullish" : downCount > upCount ? "bearish" : "mixed";

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-0.5", className)}>
              {mtf.map((tf) => (
                <TrendArrow key={tf.timeframe} direction={tf.direction} size="sm" />
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="space-y-1">
              <p className="font-medium">
                MTF Alignment: {aligned}/{total}
              </p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {mtf.map((tf) => (
                  <div key={tf.timeframe} className="flex items-center gap-1">
                    <span className="text-[var(--text-muted)]">{tf.label}</span>
                    <TrendArrow direction={tf.direction} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full version
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
          MTF Alignment
        </span>
        <span
          className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded",
            aligned >= 3 &&
              dominantDirection === "bullish" &&
              "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]",
            aligned >= 3 &&
              dominantDirection === "bearish" &&
              "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]",
            aligned < 3 && "bg-[var(--surface-2)] text-[var(--text-muted)]"
          )}
        >
          {aligned}/{total} aligned
        </span>
      </div>

      {/* Arrows grid */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--surface-1)]">
        {mtf.map((tf) => (
          <div key={tf.timeframe} className="flex flex-col items-center gap-0.5">
            <TrendArrow direction={tf.direction} size="md" />
            {showLabels && (
              <span className="text-[9px] text-[var(--text-faint)] uppercase">{tf.label}</span>
            )}
          </div>
        ))}
      </div>

      {/* Status indicator */}
      {aligned >= 3 && (
        <div
          className={cn(
            "text-[10px] font-medium text-center py-0.5 rounded",
            dominantDirection === "bullish" &&
              "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]",
            dominantDirection === "bearish" &&
              "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]"
          )}
        >
          {dominantDirection === "bullish" ? "BULLISH BIAS" : "BEARISH BIAS"}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Trend Arrow Component
// ============================================================================

interface TrendArrowProps {
  direction: "up" | "down" | "neutral";
  size?: "sm" | "md" | "lg";
  showCheck?: boolean;
}

export function TrendArrow({ direction, size = "md", showCheck = false }: TrendArrowProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const containerSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const colorClasses = {
    up: "text-[var(--accent-positive)] bg-[var(--accent-positive)]/10",
    down: "text-[var(--accent-negative)] bg-[var(--accent-negative)]/10",
    neutral: "text-[var(--text-faint)] bg-[var(--surface-2)]",
  };

  const IconComponent = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full",
        containerSizes[size],
        colorClasses[direction]
      )}
    >
      <IconComponent className={sizeClasses[size]} />
    </div>
  );
}

// ============================================================================
// Inline Compact Version (for row summary)
// ============================================================================

interface HDMTFInlineProps {
  mtf: MTFData[];
  aligned: number;
  total: number;
  className?: string;
}

export function HDMTFInline({ mtf, aligned, total, className }: HDMTFInlineProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1", className)}>
            <div className="flex items-center gap-0.5">
              {mtf.map((tf) => {
                const colorClass =
                  tf.direction === "up"
                    ? "text-[var(--accent-positive)]"
                    : tf.direction === "down"
                      ? "text-[var(--accent-negative)]"
                      : "text-[var(--text-faint)]";

                return (
                  <span key={tf.timeframe} className={cn("text-xs font-mono", colorClass)}>
                    {tf.direction === "up" ? "↑" : tf.direction === "down" ? "↓" : "−"}
                  </span>
                );
              })}
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-medium">
              {aligned}/{total}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            <p className="font-medium mb-1">Multi-Timeframe Trends</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {mtf.map((tf) => (
                <div key={tf.timeframe} className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">{tf.label}:</span>
                  <span
                    className={cn(
                      tf.direction === "up" && "text-[var(--accent-positive)]",
                      tf.direction === "down" && "text-[var(--accent-negative)]",
                      tf.direction === "neutral" && "text-[var(--text-faint)]"
                    )}
                  >
                    {tf.direction === "up"
                      ? "Bullish"
                      : tf.direction === "down"
                        ? "Bearish"
                        : "Neutral"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default HDMTFAlignment;
