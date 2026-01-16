/**
 * HDRiskRewardHero - Prominent R:R Display for LOADED State
 *
 * A visually impressive risk/reward display showing:
 * - Large ratio number (e.g., "3.2:1")
 * - Visual bar showing risk vs reward proportions
 * - Entry/Stop/Target prices with labels
 * - Color-coded based on ratio quality
 *
 * Design Philosophy:
 * - The R:R ratio is the single most important number when loading a trade
 * - Should be immediately visible and understood at a glance
 * - Color progression: Red (<1.5) → Amber (1.5-2) → Green (2-3) → Gold (3+)
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import { TrendingUp, TrendingDown, Target, Shield, DollarSign } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface HDRiskRewardHeroProps {
  /** Entry price (option mid) */
  entryPrice: number;
  /** Stop loss price */
  stopPrice: number;
  /** Target price */
  targetPrice: number;
  /** Pre-calculated R:R ratio (optional, will calculate if not provided) */
  riskReward?: number;
  /** Delta for underlying price display */
  delta?: number;
  /** Underlying entry price (for reference) */
  underlyingEntry?: number;
  /** Underlying stop price */
  underlyingStop?: number;
  /** Underlying target price */
  underlyingTarget?: number;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get color scheme based on R:R quality
 */
function getRatioQuality(rr: number): {
  label: string;
  bgClass: string;
  textClass: string;
  barClass: string;
  ringClass: string;
} {
  if (rr >= 3) {
    return {
      label: "EXCELLENT",
      bgClass: "bg-amber-500/20",
      textClass: "text-amber-400",
      barClass: "bg-gradient-to-r from-amber-500 to-yellow-400",
      ringClass: "ring-amber-500/50",
    };
  }
  if (rr >= 2) {
    return {
      label: "GOOD",
      bgClass: "bg-[var(--accent-positive)]/20",
      textClass: "text-[var(--accent-positive)]",
      barClass: "bg-gradient-to-r from-emerald-500 to-green-400",
      ringClass: "ring-[var(--accent-positive)]/50",
    };
  }
  if (rr >= 1.5) {
    return {
      label: "FAIR",
      bgClass: "bg-[var(--accent-warning)]/20",
      textClass: "text-[var(--accent-warning)]",
      barClass: "bg-gradient-to-r from-amber-600 to-orange-400",
      ringClass: "ring-[var(--accent-warning)]/50",
    };
  }
  return {
    label: "POOR",
    bgClass: "bg-[var(--accent-negative)]/20",
    textClass: "text-[var(--accent-negative)]",
    barClass: "bg-gradient-to-r from-red-600 to-rose-400",
    ringClass: "ring-[var(--accent-negative)]/50",
  };
}

/**
 * Format price with appropriate precision
 */
function formatPrice(price: number): string {
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(2);
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(3);
}

// ============================================================================
// Component
// ============================================================================

export function HDRiskRewardHero({
  entryPrice,
  stopPrice,
  targetPrice,
  riskReward,
  delta,
  underlyingEntry,
  underlyingStop,
  underlyingTarget,
  compact = false,
  className,
}: HDRiskRewardHeroProps) {
  // Calculate R:R if not provided
  const calculatedRR = useMemo(() => {
    if (riskReward !== undefined) return riskReward;
    const risk = entryPrice - stopPrice;
    const reward = targetPrice - entryPrice;
    if (risk <= 0) return 0;
    return reward / risk;
  }, [riskReward, entryPrice, stopPrice, targetPrice]);

  // Get quality colors
  const quality = useMemo(() => getRatioQuality(calculatedRR), [calculatedRR]);

  // Calculate percentages for display
  const stopPercent = useMemo(() => {
    return ((entryPrice - stopPrice) / entryPrice) * 100;
  }, [entryPrice, stopPrice]);

  const targetPercent = useMemo(() => {
    return ((targetPrice - entryPrice) / entryPrice) * 100;
  }, [entryPrice, targetPrice]);

  // Bar widths for visual (risk is always shown, reward scaled relative to risk)
  const barRatio = useMemo(() => {
    const total = stopPercent + targetPercent;
    if (total <= 0) return { risk: 50, reward: 50 };
    return {
      risk: (stopPercent / total) * 100,
      reward: (targetPercent / total) * 100,
    };
  }, [stopPercent, targetPercent]);

  if (compact) {
    // Compact mode: single row with ratio and basic prices
    return (
      <div
        className={cn("flex items-center gap-3 px-3 py-2 rounded-lg", quality.bgClass, className)}
        data-testid="rr-hero-compact"
      >
        {/* Ratio */}
        <div className="flex items-baseline gap-1">
          <span className={cn("text-xl font-bold tabular-nums", quality.textClass)}>
            {calculatedRR.toFixed(1)}
          </span>
          <span className="text-sm text-[var(--text-muted)]">:1</span>
        </div>

        {/* Mini bar */}
        <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden flex">
          <div
            className="h-full bg-[var(--accent-negative)]"
            style={{ width: `${barRatio.risk}%` }}
          />
          <div
            className={cn("h-full", quality.barClass)}
            style={{ width: `${barRatio.reward}%` }}
          />
        </div>

        {/* Quality label */}
        <span className={cn("text-[10px] font-bold uppercase", quality.textClass)}>
          {quality.label}
        </span>
      </div>
    );
  }

  // Full mode: detailed display
  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        quality.bgClass,
        `border-${quality.textClass.replace("text-", "")}/30`,
        className
      )}
      data-testid="rr-hero"
    >
      {/* Header: Big Ratio Display */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-3">
          {/* Large ratio number */}
          <div
            className={cn("flex items-baseline", quality.ringClass, "ring-2 rounded-lg px-3 py-1")}
          >
            <span
              className={cn("text-3xl font-black tabular-nums tracking-tight", quality.textClass)}
            >
              {calculatedRR.toFixed(1)}
            </span>
            <span className="text-lg font-medium text-[var(--text-muted)] ml-1">:1</span>
          </div>

          {/* Quality badge */}
          <div className="flex flex-col">
            <span className={cn("text-sm font-bold uppercase tracking-wide", quality.textClass)}>
              {quality.label}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">Risk/Reward</span>
          </div>
        </div>

        {/* Delta indicator */}
        {delta !== undefined && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--surface-2)]">
            <span className="text-[10px] text-[var(--text-muted)]">Delta</span>
            <span className="text-sm font-mono tabular-nums text-[var(--text-high)]">
              {delta.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Visual Risk/Reward Bar */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-[var(--accent-negative)]" />
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Risk</span>
          <div className="flex-1 h-3 rounded-full bg-[var(--surface-2)] overflow-hidden relative">
            {/* Risk portion (left) */}
            <div
              className="absolute left-0 top-0 h-full bg-[var(--accent-negative)] rounded-l-full"
              style={{ width: `${barRatio.risk}%` }}
            />
            {/* Reward portion (right) */}
            <div
              className={cn("absolute top-0 h-full rounded-r-full", quality.barClass)}
              style={{ left: `${barRatio.risk}%`, width: `${barRatio.reward}%` }}
            />
            {/* Entry marker */}
            <div
              className="absolute top-0 w-0.5 h-full bg-white/80"
              style={{ left: `${barRatio.risk}%` }}
            />
          </div>
          <Target className={cn("w-3.5 h-3.5", quality.textClass)} />
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Reward</span>
        </div>

        {/* Percentage labels */}
        <div className="flex justify-between text-[10px] px-1">
          <span className="text-[var(--accent-negative)] font-medium">
            -{stopPercent.toFixed(1)}%
          </span>
          <span className="text-[var(--text-muted)]">Entry</span>
          <span className={cn("font-medium", quality.textClass)}>+{targetPercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Price Grid */}
      <div className="grid grid-cols-3 gap-px bg-[var(--border-hairline)]">
        {/* Stop */}
        <div className="flex flex-col items-center py-2 px-2 bg-[var(--surface-1)]">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown className="w-3 h-3 text-[var(--accent-negative)]" />
            <span className="text-[9px] text-[var(--accent-negative)] font-medium uppercase">
              Stop
            </span>
          </div>
          <span className="text-sm font-bold tabular-nums text-[var(--text-high)]">
            ${formatPrice(stopPrice)}
          </span>
          {underlyingStop && (
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
              @${formatPrice(underlyingStop)}
            </span>
          )}
        </div>

        {/* Entry */}
        <div className="flex flex-col items-center py-2 px-2 bg-[var(--surface-1)]">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="w-3 h-3 text-[var(--brand-primary)]" />
            <span className="text-[9px] text-[var(--brand-primary)] font-medium uppercase">
              Entry
            </span>
          </div>
          <span className="text-sm font-bold tabular-nums text-[var(--text-high)]">
            ${formatPrice(entryPrice)}
          </span>
          {underlyingEntry && (
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
              @${formatPrice(underlyingEntry)}
            </span>
          )}
        </div>

        {/* Target */}
        <div className="flex flex-col items-center py-2 px-2 bg-[var(--surface-1)]">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className={cn("w-3 h-3", quality.textClass)} />
            <span className={cn("text-[9px] font-medium uppercase", quality.textClass)}>
              Target
            </span>
          </div>
          <span className="text-sm font-bold tabular-nums text-[var(--text-high)]">
            ${formatPrice(targetPrice)}
          </span>
          {underlyingTarget && (
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
              @${formatPrice(underlyingTarget)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default HDRiskRewardHero;
