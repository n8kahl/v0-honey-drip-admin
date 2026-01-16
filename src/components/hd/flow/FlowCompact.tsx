/**
 * FlowCompact - Compact Flow Display for Right Panel
 *
 * Shows institutional flow data in a condensed format:
 * - Sentiment badge with direction arrow
 * - Key metrics: Sweeps | Blocks | Inst. Score
 * - Flow levels: Call Wall | Put Wall
 *
 * Used in CockpitRightPanel for PLAN, LOADED, and ENTERED states.
 */

import React from "react";
import { cn } from "../../../lib/utils";
import { TrendingUp, TrendingDown, Minus, Activity, Zap, Target } from "lucide-react";
import type { FlowContextState } from "../../../hooks/useFlowContext";
import type { KeyLevels } from "../../../lib/riskEngine/types";

interface FlowCompactProps {
  symbol: string;
  flowContext: FlowContextState | null;
  keyLevels?: KeyLevels | null;
  className?: string;
}

export function FlowCompact({ symbol, flowContext, keyLevels, className }: FlowCompactProps) {
  const sentiment = flowContext?.primarySentiment ?? "NEUTRAL";
  const strength = flowContext?.primaryStrength ?? 0;
  const sweeps = flowContext?.sweepCount ?? 0;
  const blocks = flowContext?.blockCount ?? 0;
  const instScore = flowContext?.institutionalScore ?? 0;
  const isLoading = flowContext?.isLoading ?? false;
  const isStale = flowContext?.isStale ?? false;

  // Flow levels from keyLevels
  const callWall = keyLevels?.optionsFlow?.callWall;
  const putWall = keyLevels?.optionsFlow?.putWall;
  const maxPain = keyLevels?.optionsFlow?.maxPain;

  // Sentiment config
  const sentimentConfig = {
    BULLISH: {
      icon: TrendingUp,
      color: "text-[var(--accent-positive)]",
      bg: "bg-[var(--accent-positive)]/10",
      border: "border-[var(--accent-positive)]/30",
    },
    BEARISH: {
      icon: TrendingDown,
      color: "text-[var(--accent-negative)]",
      bg: "bg-[var(--accent-negative)]/10",
      border: "border-[var(--accent-negative)]/30",
    },
    NEUTRAL: {
      icon: Minus,
      color: "text-[var(--text-muted)]",
      bg: "bg-[var(--surface-2)]",
      border: "border-[var(--border-hairline)]",
    },
  };

  const config = sentimentConfig[sentiment];
  const Icon = config.icon;

  // No data state
  if (!flowContext && !keyLevels?.optionsFlow) {
    return (
      <div
        className={cn(
          "p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-[var(--text-faint)]" />
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Flow</span>
        </div>
        <div className="text-xs text-[var(--text-faint)] text-center py-2">
          No flow data available
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]",
        className
      )}
    >
      {/* Header with Sentiment Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Flow</span>
        </div>

        {/* Sentiment Badge */}
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold",
            config.bg,
            config.border,
            config.color
          )}
        >
          <Icon className="w-3 h-3" />
          {sentiment}
          {strength > 0 && <span className="opacity-70">({strength}%)</span>}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <MetricBox
          label="Sweeps"
          value={sweeps}
          icon={<Zap className="w-3 h-3 text-amber-400" />}
          highlight={sweeps > 5}
        />
        <MetricBox
          label="Blocks"
          value={blocks}
          icon={<Target className="w-3 h-3 text-blue-400" />}
          highlight={blocks > 3}
        />
        <MetricBox label="Score" value={instScore} suffix="%" highlight={instScore > 70} />
      </div>

      {/* Flow Levels */}
      {(callWall || putWall || maxPain) && (
        <div className="pt-2 border-t border-[var(--border-hairline)]">
          <div className="grid grid-cols-3 gap-2 text-center">
            {callWall && (
              <div>
                <div className="text-[9px] text-[var(--text-faint)] uppercase">Call Wall</div>
                <div className="text-xs font-bold text-[var(--accent-positive)]">
                  ${callWall.toFixed(0)}
                </div>
              </div>
            )}
            {putWall && (
              <div>
                <div className="text-[9px] text-[var(--text-faint)] uppercase">Put Wall</div>
                <div className="text-xs font-bold text-[var(--accent-negative)]">
                  ${putWall.toFixed(0)}
                </div>
              </div>
            )}
            {maxPain && (
              <div>
                <div className="text-[9px] text-[var(--text-faint)] uppercase">Max Pain</div>
                <div className="text-xs font-bold text-[var(--text-muted)]">
                  ${maxPain.toFixed(0)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stale Indicator */}
      {isStale && (
        <div className="mt-2 text-[9px] text-amber-400 text-center">Data may be stale</div>
      )}
    </div>
  );
}

// Metric Box Sub-component
function MetricBox({
  label,
  value,
  suffix = "",
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-1.5 rounded text-center",
        highlight ? "bg-[var(--brand-primary)]/10" : "bg-[var(--surface-1)]"
      )}
    >
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <span className="text-[9px] text-[var(--text-faint)] uppercase">{label}</span>
      </div>
      <div
        className={cn(
          "text-sm font-bold tabular-nums",
          highlight ? "text-[var(--brand-primary)]" : "text-[var(--text-high)]"
        )}
      >
        {value}
        {suffix}
      </div>
    </div>
  );
}

export default FlowCompact;
