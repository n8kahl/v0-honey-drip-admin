/**
 * SmartContextStrip - Real-time institutional context display
 *
 * Displays live Flow Bias, Signal Score, and Direction from the
 * composite_signals database. Replaces mock ConfluenceBar.
 *
 * States:
 * - Loading: "Calculating..." with pulse animation
 * - No Signal: "Scanning..." (no active signals)
 * - Active Signal: Shows Flow Bias, Score, Direction, Opportunity Type
 */

import React from "react";
import { useSymbolContext } from "../../../hooks/useSymbolContext";
import { cn } from "../../../lib/utils";
import { Activity, TrendingUp, TrendingDown, Minus, Zap, Target, RefreshCw } from "lucide-react";

interface SmartContextStripProps {
  symbol: string;
  className?: string;
  /** Compact mode for mobile */
  compact?: boolean;
}

/**
 * Flow Bias Pill - Shows bullish/bearish/neutral with color coding
 */
function FlowBiasPill({ bias, score }: { bias: string | null; score: number | null }) {
  const biasLabel = bias ? bias.charAt(0).toUpperCase() + bias.slice(1) : "Neutral";

  const getBiasColor = () => {
    if (bias === "bullish") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (bias === "bearish") return "bg-red-500/20 text-red-400 border-red-500/30";
    return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const getBiasIcon = () => {
    if (bias === "bullish") return <TrendingUp className="w-3 h-3" />;
    if (bias === "bearish") return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium",
        getBiasColor()
      )}
    >
      {getBiasIcon()}
      <span>Flow: {biasLabel}</span>
      {score !== null && <span className="opacity-70">({score.toFixed(0)})</span>}
    </div>
  );
}

/**
 * Signal Score Pill - Shows composite base score with color gradient
 */
function SignalScorePill({ score, direction }: { score: number; direction: string | null }) {
  const getScoreColor = () => {
    if (score >= 85) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; // Gold for high scores
    if (score >= 70) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (score >= 50) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium",
        getScoreColor()
      )}
    >
      <Target className="w-3 h-3" />
      <span>Score: {score.toFixed(0)}</span>
      {direction && (
        <span
          className={cn("font-bold", direction === "LONG" ? "text-emerald-400" : "text-red-400")}
        >
          {direction}
        </span>
      )}
    </div>
  );
}

/**
 * Opportunity Type Pill - Shows the detected opportunity pattern
 */
function OpportunityPill({ type }: { type: string }) {
  // Format: "breakout_bullish" -> "Breakout Bullish"
  const formatted = type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium bg-purple-500/20 text-purple-400 border-purple-500/30">
      <Zap className="w-3 h-3" />
      <span>{formatted}</span>
    </div>
  );
}

/**
 * Sweep Count Badge - Shows unusual activity indicator
 */
function SweepBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
      <Activity className="w-3 h-3" />
      <span>{count} sweeps</span>
    </div>
  );
}

export function SmartContextStrip({ symbol, className, compact = false }: SmartContextStripProps) {
  const { flowBias, flowScore, sweepCount, baseScore, direction, opportunityType, loading, error } =
    useSymbolContext(symbol);

  // Loading state
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]",
          className
        )}
      >
        <RefreshCw className="w-3.5 h-3.5 text-[var(--text-muted)] animate-spin" />
        <span className="text-xs text-[var(--text-muted)] animate-pulse">Calculating...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]",
          className
        )}
      >
        <span className="text-xs text-red-400">Error loading context</span>
      </div>
    );
  }

  // No active signal state
  if (!baseScore && !flowBias) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]",
          className
        )}
      >
        <Activity className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">Scanning for signals...</span>
        <span className="text-[10px] text-[var(--text-faint)]">(No active signals)</span>
      </div>
    );
  }

  // Active signal state - show real data
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]",
        compact ? "flex-wrap" : "",
        className
      )}
    >
      <span className="text-xs text-[var(--text-muted)] mr-1">Context:</span>

      {/* Flow Bias */}
      <FlowBiasPill bias={flowBias} score={flowScore} />

      {/* Signal Score (if we have one) */}
      {baseScore !== null && <SignalScorePill score={baseScore} direction={direction} />}

      {/* Opportunity Type (if we have one) */}
      {opportunityType && !compact && <OpportunityPill type={opportunityType} />}

      {/* Sweep Count (unusual activity) */}
      {sweepCount !== null && sweepCount > 0 && <SweepBadge count={sweepCount} />}
    </div>
  );
}

export default SmartContextStrip;
