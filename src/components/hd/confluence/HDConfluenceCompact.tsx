/**
 * HDConfluenceCompact - Minimized Confluence Display for ENTERED State
 *
 * A compact confluence display optimized for trade management:
 * - Score ring with numeric value
 * - MTF alignment mini-strip
 * - "Score dropping" alert capability
 * - Max ~80px height
 *
 * Used when the trader is actively managing a position and needs to see
 * confluence health at a glance without taking up vertical space.
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { useSymbolConfluence, type MTFData } from "../../../hooks/useSymbolConfluence";

// ============================================================================
// Types
// ============================================================================

export interface HDConfluenceCompactProps {
  /** Symbol to display confluence for */
  symbol: string;
  /** Previous score for comparison (to detect drops) */
  previousScore?: number;
  /** Alert threshold - show warning if score drops below this */
  alertThreshold?: number;
  /** Callback when score drops significantly */
  onScoreDrop?: (currentScore: number, previousScore: number) => void;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get trend icon and color based on MTF direction
 */
function getTrendVisual(direction: "up" | "down" | "neutral") {
  switch (direction) {
    case "up":
      return {
        icon: <TrendingUp className="w-3 h-3" />,
        bg: "bg-[var(--accent-positive)]",
        text: "text-[var(--accent-positive)]",
      };
    case "down":
      return {
        icon: <TrendingDown className="w-3 h-3" />,
        bg: "bg-[var(--accent-negative)]",
        text: "text-[var(--accent-negative)]",
      };
    default:
      return {
        icon: <Minus className="w-3 h-3" />,
        bg: "bg-[var(--text-muted)]",
        text: "text-[var(--text-muted)]",
      };
  }
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 70) return "text-[var(--accent-positive)]";
  if (score >= 50) return "text-[var(--accent-warning)]";
  if (score >= 30) return "text-[var(--text-muted)]";
  return "text-[var(--accent-negative)]";
}

/**
 * Get score ring stroke color (for SVG)
 */
function getScoreRingColor(score: number): string {
  if (score >= 70) return "var(--accent-positive)";
  if (score >= 50) return "var(--accent-warning)";
  if (score >= 30) return "var(--text-muted)";
  return "var(--accent-negative)";
}

// ============================================================================
// Component
// ============================================================================

export function HDConfluenceCompact({
  symbol,
  previousScore,
  alertThreshold = 40,
  onScoreDrop,
  className,
}: HDConfluenceCompactProps) {
  // Get confluence data
  const confluence = useSymbolConfluence(symbol);

  // Detect score drops
  const scoreDrop = useMemo(() => {
    if (!confluence || previousScore === undefined) return null;
    const drop = previousScore - confluence.overallScore;
    if (drop > 10) {
      // Significant drop (>10 points)
      return { amount: drop, isSignificant: true };
    }
    if (drop > 5) {
      // Moderate drop
      return { amount: drop, isSignificant: false };
    }
    return null;
  }, [confluence?.overallScore, previousScore]);

  // Alert if score drops below threshold
  const showAlert = useMemo(() => {
    if (!confluence) return false;
    return confluence.overallScore < alertThreshold;
  }, [confluence?.overallScore, alertThreshold]);

  // Fire callback on significant drops
  React.useEffect(() => {
    if (scoreDrop?.isSignificant && previousScore !== undefined && confluence && onScoreDrop) {
      onScoreDrop(confluence.overallScore, previousScore);
    }
  }, [scoreDrop?.isSignificant, confluence?.overallScore, previousScore, onScoreDrop]);

  if (!confluence) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2", className)}>
        <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] animate-pulse" />
        <span className="text-xs text-[var(--text-muted)]">Loading...</span>
      </div>
    );
  }

  const score = confluence.overallScore;
  const mtfData = confluence.mtf || [];
  const mtfAligned = confluence.mtfAligned || 0;

  // Ring calculation (SVG)
  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (score / 100) * ringCircumference;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300",
        showAlert
          ? "bg-[var(--accent-negative)]/10 border border-[var(--accent-negative)]/30"
          : "bg-[var(--surface-1)]",
        className
      )}
      data-testid="confluence-compact"
    >
      {/* Score Ring */}
      <div className="relative flex-shrink-0">
        <svg width="36" height="36" className="-rotate-90">
          {/* Background ring */}
          <circle
            cx="18"
            cy="18"
            r={ringRadius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth="3"
          />
          {/* Progress ring */}
          <circle
            cx="18"
            cy="18"
            r={ringRadius}
            fill="none"
            stroke={getScoreRingColor(score)}
            strokeWidth="3"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringOffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-xs font-bold tabular-nums", getScoreColor(score))}>
            {score.toFixed(0)}
          </span>
        </div>
      </div>

      {/* MTF Strip */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <Activity className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[9px] text-[var(--text-muted)] uppercase">MTF</span>
          <span
            className={cn(
              "text-[9px] font-medium",
              mtfAligned >= 3 ? "text-[var(--accent-positive)]" : "text-[var(--text-muted)]"
            )}
          >
            {mtfAligned}/{mtfData.length}
          </span>
        </div>

        {/* Mini MTF heatmap */}
        <div className="flex gap-0.5">
          {mtfData.slice(0, 5).map((tf) => {
            const visual = getTrendVisual(tf.direction);
            return (
              <div
                key={tf.timeframe}
                className={cn(
                  "flex items-center justify-center w-6 h-5 rounded text-white text-[8px] font-medium",
                  visual.bg
                )}
                title={`${tf.label}: ${tf.direction}`}
              >
                {tf.label.slice(0, 2)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Alert / Drop Indicator */}
      {(showAlert || scoreDrop) && (
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
          {showAlert && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent-negative)]/20">
              <AlertTriangle className="w-3 h-3 text-[var(--accent-negative)] animate-pulse" />
              <span className="text-[9px] font-bold text-[var(--accent-negative)] uppercase">
                LOW
              </span>
            </div>
          )}
          {scoreDrop && !showAlert && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent-warning)]/20">
              <TrendingDown className="w-3 h-3 text-[var(--accent-warning)]" />
              <span className="text-[9px] font-medium text-[var(--accent-warning)]">
                -{scoreDrop.amount.toFixed(0)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HDConfluenceCompact;
