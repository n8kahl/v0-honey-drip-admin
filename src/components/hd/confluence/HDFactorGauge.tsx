/**
 * HDFactorGauge.tsx - Individual factor display with mini progress bar
 *
 * Shows a single confluence factor with:
 * - Label (RVOL, Flow, RSI, etc.)
 * - Current value
 * - Threshold needed
 * - Mini progress bar
 * - Color-coded status (strong/good/building/weak/missing)
 */

import { cn } from "../../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import type { FactorData, FactorStatus } from "../../../hooks/useSymbolConfluence";

// ============================================================================
// Types
// ============================================================================

interface HDFactorGaugeProps {
  factor: FactorData;
  compact?: boolean;
  showThreshold?: boolean;
  className?: string;
}

// ============================================================================
// Status Colors
// ============================================================================

const STATUS_COLORS: Record<FactorStatus, { bar: string; text: string; bg: string }> = {
  strong: {
    bar: "bg-[var(--accent-positive)]",
    text: "text-[var(--accent-positive)]",
    bg: "bg-[var(--accent-positive)]/10",
  },
  good: {
    bar: "bg-emerald-400",
    text: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  building: {
    bar: "bg-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  weak: {
    bar: "bg-orange-400",
    text: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  missing: {
    bar: "bg-[var(--text-faint)]",
    text: "text-[var(--text-faint)]",
    bg: "bg-[var(--surface-2)]",
  },
};

// ============================================================================
// Component
// ============================================================================

export function HDFactorGauge({
  factor,
  compact = false,
  showThreshold = true,
  className,
}: HDFactorGaugeProps) {
  const colors = STATUS_COLORS[factor.status];
  const progressWidth = Math.min(100, Math.max(0, factor.percentComplete));

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex flex-col gap-0.5", className)}>
              {/* Label + Value */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">
                  {factor.label}
                </span>
                <span className={cn("text-[10px] font-mono tabular-nums", colors.text)}>
                  {factor.displayValue}
                </span>
              </div>

              {/* Mini progress bar */}
              <div className="h-1 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", colors.bar)}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{factor.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{factor.tooltip}</p>
              <div className="flex items-center justify-between text-xs">
                <span>Value: {factor.displayValue}</span>
                <span>Threshold: {factor.threshold}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>Progress: {progressWidth.toFixed(0)}%</span>
                <span className={colors.text}>
                  {factor.status.charAt(0).toUpperCase() + factor.status.slice(1)}
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full version
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex flex-col gap-1 p-2 rounded-lg", colors.bg, className)}>
            {/* Label */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                {factor.label}
              </span>
              {factor.direction && (
                <span
                  className={cn(
                    "text-[9px] font-medium uppercase px-1 py-0.5 rounded",
                    factor.direction === "bullish" &&
                      "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]",
                    factor.direction === "bearish" &&
                      "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]",
                    factor.direction === "neutral" &&
                      "bg-[var(--surface-2)] text-[var(--text-muted)]"
                  )}
                >
                  {factor.direction === "bullish"
                    ? "BULL"
                    : factor.direction === "bearish"
                      ? "BEAR"
                      : "NEUT"}
                </span>
              )}
            </div>

            {/* Value */}
            <div
              className={cn("text-lg font-bold font-mono tabular-nums leading-none", colors.text)}
            >
              {factor.displayValue}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  colors.bar
                )}
                style={{ width: `${progressWidth}%` }}
              />
            </div>

            {/* Threshold (optional) */}
            {showThreshold && (
              <div className="flex items-center justify-between text-[9px] text-[var(--text-faint)]">
                <span>need {factor.threshold}</span>
                <span className={colors.text}>
                  {factor.status === "strong"
                    ? "READY"
                    : factor.status === "good"
                      ? "CLOSE"
                      : factor.status === "building"
                        ? "BUILDING"
                        : factor.status === "weak"
                          ? "WEAK"
                          : "MISSING"}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{factor.label}</p>
            <p className="text-xs text-[var(--text-muted)]">{factor.tooltip}</p>
            <div className="text-xs">
              <span>Weight: {(factor.weight * 100).toFixed(0)}% of total score</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Mini Chip Version (for compact row view)
// ============================================================================

interface HDFactorChipProps {
  factor: FactorData;
  className?: string;
}

export function HDFactorChip({ factor, className }: HDFactorChipProps) {
  const colors = STATUS_COLORS[factor.status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
              colors.bg,
              className
            )}
          >
            <span className="text-[var(--text-muted)] uppercase">{factor.label}</span>
            <span className={cn("font-mono tabular-nums", colors.text)}>{factor.displayValue}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            <p>{factor.tooltip}</p>
            <p className="mt-1">
              Progress: {factor.percentComplete.toFixed(0)}% | Threshold: {factor.threshold}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default HDFactorGauge;
