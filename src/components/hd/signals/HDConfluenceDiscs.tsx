/**
 * HDConfluenceDiscs - Visual confluence factor indicators
 * Displays colored discs (green/yellow/red) for each confluence factor
 * Shows at-a-glance trade health based on real-time market conditions
 */

import { cn } from "../../../lib/utils";
import type { TradeConfluence, ConfluenceFactor } from "../../../types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";

interface HDConfluenceDiscsProps {
  confluence: TradeConfluence;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  showScore?: boolean;
  className?: string;
}

// Factor display configuration
const FACTOR_CONFIG: Record<
  keyof TradeConfluence["factors"],
  { label: string; shortLabel: string; icon: string }
> = {
  ivPercentile: { label: "IV Percentile", shortLabel: "IV", icon: "📊" },
  mtfAlignment: { label: "Multi-Timeframe", shortLabel: "MTF", icon: "📈" },
  flowPressure: { label: "Flow Pressure", shortLabel: "Flow", icon: "🌊" },
  gammaExposure: { label: "Gamma Exposure", shortLabel: "GEX", icon: "⚡" },
  regime: { label: "Market Regime", shortLabel: "Reg", icon: "🎯" },
  vwapPosition: { label: "VWAP Position", shortLabel: "VWAP", icon: "📏" },
  volumeProfile: { label: "Volume Profile", shortLabel: "Vol", icon: "📶" },
};

// Get disc color based on factor status
function getDiscColor(status: ConfluenceFactor["status"]): string {
  switch (status) {
    case "bullish":
      return "bg-[var(--accent-positive)]";
    case "bearish":
      return "bg-[var(--accent-negative)]";
    case "neutral":
      return "bg-[var(--text-muted)]";
  }
}

// Get disc border color for better visibility
function getDiscBorder(status: ConfluenceFactor["status"]): string {
  switch (status) {
    case "bullish":
      return "ring-[var(--accent-positive)]/30";
    case "bearish":
      return "ring-[var(--accent-negative)]/30";
    case "neutral":
      return "ring-[var(--text-muted)]/30";
  }
}

// Get overall score color
function getScoreColor(score: number): string {
  if (score >= 70) return "text-[var(--accent-positive)]";
  if (score >= 50) return "text-[var(--text-high)]";
  if (score >= 30) return "text-yellow-500";
  return "text-[var(--accent-negative)]";
}

// Single disc component
function ConfluenceDisc({
  factor,
  config,
  size,
  showLabel,
}: {
  factor: ConfluenceFactor;
  config: (typeof FACTOR_CONFIG)[keyof typeof FACTOR_CONFIG];
  size: "sm" | "md" | "lg";
  showLabel: boolean;
}) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <div
              className={cn(
                "rounded-full ring-2",
                sizeClasses[size],
                getDiscColor(factor.status),
                getDiscBorder(factor.status)
              )}
              aria-label={`${config.label}: ${factor.status}`}
            />
            {showLabel && (
              <span className="text-[10px] text-[var(--text-muted)]">{config.shortLabel}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="text-xs">
            <div className="font-medium">{config.label}</div>
            <div className="text-[var(--text-muted)]">{factor.label}</div>
            {factor.weight !== undefined && (
              <div className="text-[var(--text-faint)]">
                Weight: {(factor.weight * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function HDConfluenceDiscs({
  confluence,
  size = "md",
  showLabels = false,
  showScore = true,
  className,
}: HDConfluenceDiscsProps) {
  // Get all available factors
  const factorEntries = Object.entries(confluence.factors).filter(
    ([_, factor]) => factor !== undefined
  ) as [keyof TradeConfluence["factors"], ConfluenceFactor][];

  if (factorEntries.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Overall score */}
      {showScore && (
        <div className={cn("text-xs font-semibold tabular-nums", getScoreColor(confluence.score))}>
          {confluence.score.toFixed(0)}
        </div>
      )}

      {/* Factor discs */}
      <div className="flex items-center gap-1.5">
        {factorEntries.map(([key, factor]) => (
          <ConfluenceDisc
            key={key}
            factor={factor}
            config={FACTOR_CONFIG[key]}
            size={size}
            showLabel={showLabels}
          />
        ))}
      </div>

      {/* Stale indicator */}
      {confluence.isStale && (
        <span className="text-[10px] text-yellow-500" title="Data may be stale">
          ⚠️
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for use in tight spaces like trade rows
 */
export function HDConfluenceDiscsCompact({
  confluence,
  className,
}: {
  confluence: TradeConfluence;
  className?: string;
}) {
  return (
    <HDConfluenceDiscs
      confluence={confluence}
      size="sm"
      showLabels={false}
      showScore={true}
      className={className}
    />
  );
}

/**
 * Expanded version for trade details panel
 */
export function HDConfluenceDiscsExpanded({
  confluence,
  className,
}: {
  confluence: TradeConfluence;
  className?: string;
}) {
  return (
    <HDConfluenceDiscs
      confluence={confluence}
      size="lg"
      showLabels={true}
      showScore={true}
      className={className}
    />
  );
}
