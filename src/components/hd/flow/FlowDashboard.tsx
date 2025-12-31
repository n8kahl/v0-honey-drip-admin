/**
 * FlowDashboard Component
 *
 * Comprehensive options flow analysis dashboard for active trades.
 * Displays institutional activity, sentiment, and real-time flow tape.
 *
 * Features:
 * - Multi-window sentiment analysis (1h/4h/1d)
 * - Sweep and block trade detection
 * - Put/Call ratio visualization
 * - Real-time flow tape
 * - Strike concentration heatmap
 * - Unusual activity alerts
 */

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
  BarChart3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFlowContext,
  getSentimentColor,
  getSentimentBgColor,
  formatPremium,
  getRecommendationLabel,
} from "@/hooks/useFlowContext";
import type { FlowSentiment } from "@/lib/engines/FlowAnalysisEngine";

interface FlowDashboardProps {
  /** The underlying symbol (e.g., "SPY", "SPX") */
  symbol: string;
  /** Trade direction for alignment analysis */
  tradeDirection?: "LONG" | "SHORT";
  /** Whether to show expanded view initially */
  defaultExpanded?: boolean;
  /** Compact mode for smaller containers */
  compact?: boolean;
}

/**
 * Get sentiment icon component
 */
function SentimentIcon({ sentiment, className }: { sentiment: FlowSentiment; className?: string }) {
  switch (sentiment) {
    case "BULLISH":
      return <TrendingUp className={cn("w-4 h-4", className)} />;
    case "BEARISH":
      return <TrendingDown className={cn("w-4 h-4", className)} />;
    default:
      return <Minus className={cn("w-4 h-4", className)} />;
  }
}

/**
 * Check if flow aligns with trade direction
 */
function getFlowAlignment(
  sentiment: FlowSentiment,
  tradeDirection?: "LONG" | "SHORT"
): "aligned" | "opposed" | "neutral" {
  if (!tradeDirection || sentiment === "NEUTRAL") return "neutral";

  if (tradeDirection === "LONG") {
    return sentiment === "BULLISH" ? "aligned" : "opposed";
  } else {
    return sentiment === "BEARISH" ? "aligned" : "opposed";
  }
}

/**
 * Metric card component
 */
function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("w-3.5 h-3.5", color || "text-zinc-400")} />
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn("text-sm font-semibold tabular-nums", color || "text-zinc-200")}>
        {value}
      </div>
      {subValue && <span className="text-[10px] text-zinc-500">{subValue}</span>}
    </div>
  );
}

/**
 * Window selector tabs
 */
function WindowTabs({
  activeWindow,
  onChange,
}: {
  activeWindow: "short" | "medium" | "long";
  onChange: (window: "short" | "medium" | "long") => void;
}) {
  const windows = [
    { id: "short" as const, label: "1H" },
    { id: "medium" as const, label: "4H" },
    { id: "long" as const, label: "1D" },
  ];

  return (
    <div className="flex gap-1">
      {windows.map((w) => (
        <button
          key={w.id}
          onClick={() => onChange(w.id)}
          className={cn(
            "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
            activeWindow === w.id
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "bg-[var(--surface-2)] text-zinc-500 border border-transparent hover:text-zinc-300"
          )}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Flow alignment indicator
 */
function AlignmentBadge({
  alignment,
  sentiment,
}: {
  alignment: "aligned" | "opposed" | "neutral";
  sentiment: FlowSentiment;
}) {
  const config = {
    aligned: {
      bg: "bg-green-500/20 border-green-500/30",
      text: "text-green-400",
      label: "Flow Aligned",
    },
    opposed: {
      bg: "bg-red-500/20 border-red-500/30",
      text: "text-red-400",
      label: "Flow Opposed",
    },
    neutral: {
      bg: "bg-zinc-500/20 border-zinc-500/30",
      text: "text-zinc-400",
      label: "Neutral Flow",
    },
  };

  const c = config[alignment];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium",
        c.bg,
        c.text
      )}
    >
      <SentimentIcon sentiment={sentiment} className="w-3 h-3" />
      <span>{c.label}</span>
    </div>
  );
}

/**
 * Main FlowDashboard component
 */
export function FlowDashboard({
  symbol,
  tradeDirection,
  defaultExpanded = true,
  compact = false,
}: FlowDashboardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeWindow, setActiveWindow] = useState<"short" | "medium" | "long">("medium");

  const flowContext = useFlowContext(symbol, {
    refreshInterval: 30000,
    windows: ["short", "medium", "long"],
  });

  // Get context for active window
  const activeContext = flowContext[activeWindow];

  // Determine flow alignment with trade
  const alignment = useMemo(
    () => getFlowAlignment(flowContext.primarySentiment, tradeDirection),
    [flowContext.primarySentiment, tradeDirection]
  );

  // Check for unusual activity
  const unusualActivity = useMemo(() => {
    const alerts: string[] = [];

    if (flowContext.sweepCount >= 5) {
      alerts.push(`${flowContext.sweepCount} sweeps detected`);
    }

    if (flowContext.blockCount >= 3) {
      alerts.push(`${flowContext.blockCount} block trades`);
    }

    if (flowContext.institutionalScore >= 70) {
      alerts.push("High institutional activity");
    }

    if (flowContext.putCallRatio > 2) {
      alerts.push("Heavy put buying");
    } else if (flowContext.putCallRatio < 0.5) {
      alerts.push("Heavy call buying");
    }

    return alerts;
  }, [flowContext]);

  if (flowContext.isLoading && !activeContext) {
    return (
      <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 text-zinc-500">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-xs">Loading flow data...</span>
        </div>
      </div>
    );
  }

  if (!activeContext && !flowContext.isLoading) {
    return (
      <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 text-zinc-500">
          <Activity className="w-4 h-4" />
          <span className="text-xs">No flow data available for {symbol}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-zinc-200">Options Flow</span>

          {/* Quick sentiment indicator */}
          <div
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border",
              getSentimentBgColor(flowContext.primarySentiment),
              getSentimentColor(flowContext.primarySentiment)
            )}
          >
            <SentimentIcon sentiment={flowContext.primarySentiment} className="w-3 h-3" />
            <span>{flowContext.primarySentiment}</span>
          </div>

          {/* Alignment indicator when trade direction provided */}
          {tradeDirection && (
            <AlignmentBadge alignment={alignment} sentiment={flowContext.primarySentiment} />
          )}
        </div>

        <div className="flex items-center gap-2">
          {unusualActivity.length > 0 && (
            <div className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-[10px] font-medium">{unusualActivity.length}</span>
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Window tabs */}
          <div className="flex items-center justify-between">
            <WindowTabs activeWindow={activeWindow} onChange={setActiveWindow} />

            {/* Data freshness */}
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Wifi
                className={cn(
                  "w-3 h-3",
                  activeContext?.isStale ? "text-amber-400" : "text-green-400"
                )}
              />
              <span>
                {activeContext?.tradeCount || 0} trades in{" "}
                {activeWindow === "short" ? "1h" : activeWindow === "medium" ? "4h" : "24h"}
              </span>
            </div>
          </div>

          {/* Metrics grid */}
          <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-4")}>
            <MetricCard
              label="Sentiment"
              value={`${flowContext.primaryStrength}%`}
              subValue={flowContext.primarySentiment}
              icon={SentimentIcon.bind(null, { sentiment: flowContext.primarySentiment })}
              color={getSentimentColor(flowContext.primarySentiment)}
            />

            <MetricCard
              label="Sweeps"
              value={flowContext.sweepCount}
              subValue="Last hour"
              icon={Zap}
              color={flowContext.sweepCount >= 5 ? "text-yellow-400" : "text-zinc-400"}
            />

            <MetricCard
              label="P/C Ratio"
              value={flowContext.putCallRatio.toFixed(2)}
              subValue={
                flowContext.putCallRatio > 1.3
                  ? "Put heavy"
                  : flowContext.putCallRatio < 0.7
                    ? "Call heavy"
                    : "Balanced"
              }
              icon={BarChart3}
              color={
                flowContext.putCallRatio > 1.3
                  ? "text-red-400"
                  : flowContext.putCallRatio < 0.7
                    ? "text-green-400"
                    : "text-zinc-400"
              }
            />

            <MetricCard
              label="Premium"
              value={formatPremium(flowContext.totalPremium)}
              subValue={`Inst: ${flowContext.institutionalScore}%`}
              icon={Activity}
              color={flowContext.institutionalScore >= 70 ? "text-blue-400" : "text-zinc-400"}
            />
          </div>

          {/* Recommendation */}
          {activeContext && (
            <div className="flex items-center justify-between p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
              <span className="text-xs text-zinc-500">Recommendation</span>
              <span
                className={cn(
                  "text-xs font-medium",
                  flowContext.recommendation === "FOLLOW_FLOW"
                    ? "text-green-400"
                    : flowContext.recommendation === "FADE_FLOW"
                      ? "text-red-400"
                      : "text-zinc-400"
                )}
              >
                {getRecommendationLabel(flowContext.recommendation)}
              </span>
            </div>
          )}

          {/* Unusual activity alerts */}
          {unusualActivity.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Unusual Activity
              </span>
              <div className="flex flex-wrap gap-1">
                {unusualActivity.map((alert, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Call/Put breakdown bar */}
          {activeContext && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>Call Volume</span>
                <span>Put Volume</span>
              </div>
              <div className="flex h-2 rounded overflow-hidden">
                <div
                  className="bg-green-500"
                  style={{
                    width: `${(activeContext.callVolume / (activeContext.callVolume + activeContext.putVolume || 1)) * 100}%`,
                  }}
                />
                <div
                  className="bg-red-500"
                  style={{
                    width: `${(activeContext.putVolume / (activeContext.callVolume + activeContext.putVolume || 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-green-400 tabular-nums">
                  {activeContext.callVolume.toLocaleString()}
                </span>
                <span className="text-red-400 tabular-nums">
                  {activeContext.putVolume.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FlowDashboard;
