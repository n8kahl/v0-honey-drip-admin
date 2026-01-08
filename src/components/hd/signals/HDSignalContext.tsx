import { cn } from "../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Shield,
  Target,
  BarChart3,
  Gauge,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import type { CompositeSignal } from "../../../lib/composite/CompositeSignal";
import { formatOpportunityType } from "../../../lib/composite/CompositeSignal";
import { HDFlowAlignmentBadge } from "./HDFlowAlignmentBadge";

interface HDSignalContextProps {
  signal: CompositeSignal;
  compact?: boolean;
  className?: string;
}

/**
 * Unified Signal Context Panel - Phase 6
 *
 * Replaces fragmented FlowDashboard + Confluence panels with ONE cohesive view:
 * 1. Signal header (type, direction, score)
 * 2. ALL confluence factors (not just top 3)
 * 3. Flow alignment with recommendation
 * 4. Context boosts breakdown
 * 5. Confidence score
 */
export function HDSignalContext({ signal, compact = false, className }: HDSignalContextProps) {
  const [expanded, setExpanded] = useState(!compact);

  // Get direction styling
  const directionStyle =
    signal.direction === "LONG"
      ? { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" }
      : { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };

  // Get all confluence factors (use allConfluenceFactors if available, fallback to confluence)
  const allFactors = signal.allConfluenceFactors || signal.confluence || {};
  const factorEntries = Object.entries(allFactors).sort(([, a], [, b]) => b - a);

  // Context boosts
  const boosts = signal.contextBoosts;
  const hasBoosts = boosts && (boosts.iv !== 0 || boosts.gamma !== 0 || boosts.flowAlignment !== 0);

  // Flow summary
  const flow = signal.flowSummary;

  // Data confidence
  const confidence = signal.dataConfidence;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-[var(--surface-1)] border-[var(--border-hairline)]",
          className
        )}
      >
        {/* Direction indicator */}
        <div
          className={cn(
            "w-1 h-6 rounded-full",
            signal.direction === "LONG" ? "bg-emerald-400" : "bg-red-400"
          )}
        />

        {/* Type & Score */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-[var(--text-high)] truncate">
            {formatOpportunityType(signal.opportunityType)}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <span className={directionStyle.color}>{signal.direction}</span>
            <span>Score: {signal.recommendedStyleScore.toFixed(0)}</span>
          </div>
        </div>

        {/* Flow alignment dot */}
        {flow && (
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              flow.alignment === "ALIGNED" && "bg-emerald-400",
              flow.alignment === "OPPOSED" && "bg-red-400",
              flow.alignment === "NEUTRAL" && "bg-amber-400"
            )}
            title={`Flow ${flow.alignment.toLowerCase()}`}
          />
        )}

        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 hover:bg-[var(--surface-2)] rounded"
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-[var(--surface-1)] border-[var(--border-hairline)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
              directionStyle.bg,
              directionStyle.border,
              directionStyle.color,
              "border"
            )}
          >
            {signal.direction === "LONG" ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {signal.direction}
          </div>
          <div className="text-sm font-medium text-[var(--text-high)]">
            {formatOpportunityType(signal.opportunityType)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {confidence !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
                confidence >= 70
                  ? "bg-emerald-500/10 text-emerald-400"
                  : confidence >= 40
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
              )}
            >
              <Shield className="w-3 h-3" />
              {confidence.toFixed(0)}%
            </div>
          )}
          <div className="text-lg font-bold text-[var(--text-high)]">
            {signal.recommendedStyleScore.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Flow Alignment - Most Important */}
      {flow && (
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <HDFlowAlignmentBadge
            signalDirection={signal.direction}
            flowSentiment={flow.sentiment}
            recommendation={flow.recommendation}
            institutionalScore={flow.institutionalScore}
          />
          {/* Flow details */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-muted)]">
            <span>
              <Zap className="w-3 h-3 inline mr-0.5" />
              {flow.sweepCount} sweeps
            </span>
            <span>
              <BarChart3 className="w-3 h-3 inline mr-0.5" />
              {flow.blockCount} blocks
            </span>
            <span>
              <Activity className="w-3 h-3 inline mr-0.5" />
              {flow.buyPressure.toFixed(0)}% buy
            </span>
            {flow.totalPremium > 0 && (
              <span className="font-mono">${(flow.totalPremium / 1000000).toFixed(1)}M</span>
            )}
          </div>
        </div>
      )}

      {/* All Confluence Factors */}
      <div className="p-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-1.5 mb-2">
          <Target className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Confluence Factors
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">({factorEntries.length})</span>
        </div>

        <div className="space-y-1.5">
          {factorEntries.map(([name, score]) => (
            <FactorBar key={name} name={formatFactorName(name)} score={score} />
          ))}
        </div>
      </div>

      {/* Context Boosts */}
      {hasBoosts && (
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Gauge className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Context Modifiers
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {boosts.iv !== 0 && <BoostChip label="IV" value={boosts.iv} />}
            {boosts.gamma !== 0 && <BoostChip label="Gamma" value={boosts.gamma} />}
            {boosts.flowAlignment !== 0 && <BoostChip label="Flow" value={boosts.flowAlignment} />}
            {boosts.regime !== 0 && <BoostChip label="Regime" value={boosts.regime} />}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: Format factor name for display
function formatFactorName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Helper: Factor bar component
function FactorBar({ name, score }: { name: string; score: number }) {
  const getScoreColor = () => {
    if (score >= 80) return "bg-emerald-400";
    if (score >= 60) return "bg-amber-400";
    return "bg-red-400";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 text-[10px] text-[var(--text-muted)] truncate">{name}</div>
      <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getScoreColor())}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <div className="w-8 text-right text-[10px] font-mono text-[var(--text-high)]">
        {score.toFixed(0)}
      </div>
    </div>
  );
}

// Helper: Boost chip component
function BoostChip({ label, value }: { label: string; value: number }) {
  const isPositive = value > 0;
  const displayValue = `${isPositive ? "+" : ""}${(value * 100).toFixed(0)}%`;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border",
        isPositive
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/20"
      )}
    >
      {isPositive ? (
        <TrendingUp className="w-2.5 h-2.5" />
      ) : (
        <TrendingDown className="w-2.5 h-2.5" />
      )}
      <span>{label}</span>
      <span className="font-mono">{displayValue}</span>
    </div>
  );
}

export default HDSignalContext;
