/**
 * FlowIntelligencePanel - Actionable Institutional Flow Display
 *
 * Replaces the minimal "OPTIONS FLOW: 0" display with comprehensive
 * institutional flow intelligence that helps day traders with:
 * 1. Sentiment and conviction (are smart money bullish/bearish?)
 * 2. Flow levels for TP/SL (put wall, call wall, max pain)
 * 3. Activity metrics (sweeps, premium, institutional score)
 */

import { Activity, TrendingUp, TrendingDown, Minus, Target, Shield, Magnet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFlowContext,
  formatPremium,
  getSentimentColor,
  getSentimentBgColor,
} from "@/hooks/useFlowContext";
import { FlowPulse } from "./FlowPulse";
import { normalizeSymbolForAPI } from "@/lib/symbolUtils";

interface FlowIntelligencePanelProps {
  symbol: string;
  currentPrice: number;
  optionsFlow?: {
    gammaWall: number | null;
    callWall: number | null;
    putWall: number | null;
    maxPain: number | null;
  };
  compact?: boolean;
}

function formatDistance(current: number, target: number): string {
  // Guard against division by zero
  if (!current || current === 0) return "—";
  const pct = ((target - current) / current) * 100;
  // Guard against NaN/Infinity
  if (!isFinite(pct)) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function getDistanceColor(
  current: number,
  target: number,
  type: "resistance" | "support" | "neutral"
): string {
  // Guard against division by zero
  if (!current || current === 0) return "text-zinc-400";
  const pct = ((target - current) / current) * 100;
  // Guard against NaN/Infinity
  if (!isFinite(pct)) return "text-zinc-400";

  if (type === "resistance") {
    // Resistance above is green (room to run), below is red (already passed)
    return pct > 0 ? "text-emerald-400" : "text-red-400";
  }
  if (type === "support") {
    // Support below is green (has cushion), above is red (already broken)
    return pct < 0 ? "text-emerald-400" : "text-amber-400";
  }
  // Neutral - just show distance
  return Math.abs(pct) < 1 ? "text-amber-400" : "text-zinc-400";
}

export function FlowIntelligencePanel({
  symbol,
  currentPrice,
  optionsFlow,
  compact = false,
}: FlowIntelligencePanelProps) {
  const normalizedSymbol = normalizeSymbolForAPI(symbol);
  const {
    short: flowContext,
    primarySentiment,
    primaryStrength,
    sweepCount,
    blockCount,
    totalPremium,
    institutionalScore,
    isLoading,
  } = useFlowContext(normalizedSymbol, {
    refreshInterval: 30000,
    windows: ["short", "medium"],
  });

  // Build flow data for FlowPulse
  const flowData = flowContext
    ? {
        flowScore: institutionalScore,
        flowBias:
          primarySentiment === "BULLISH"
            ? ("bullish" as const)
            : primarySentiment === "BEARISH"
              ? ("bearish" as const)
              : ("neutral" as const),
        buyPressure:
          flowContext.totalVolume && flowContext.totalVolume > 0
            ? (flowContext.buyVolume / flowContext.totalVolume) * 100
            : 50,
        putCallRatio: flowContext.putCallVolumeRatio ?? 1,
        sweepCount: sweepCount,
        aggressiveness: flowContext.aggressiveness,
      }
    : undefined;

  // Check if we have any meaningful data
  const hasFlowData = flowContext && (sweepCount > 0 || blockCount > 0 || institutionalScore > 10);
  const hasLevels =
    optionsFlow && (optionsFlow.callWall || optionsFlow.putWall || optionsFlow.maxPain);

  // Sentiment badge styling
  const sentimentBadge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
        getSentimentBgColor(primarySentiment),
        getSentimentColor(primarySentiment)
      )}
    >
      {primarySentiment === "BULLISH" && <TrendingUp className="w-3 h-3" />}
      {primarySentiment === "BEARISH" && <TrendingDown className="w-3 h-3" />}
      {primarySentiment === "NEUTRAL" && <Minus className="w-3 h-3" />}
      {primarySentiment}
    </span>
  );

  if (compact) {
    // Compact mode: Single row with key info
    return (
      <div className="px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Flow
            </span>
            {sentimentBadge}
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            {sweepCount > 0 && (
              <span className="font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                {sweepCount} sweeps
              </span>
            )}
            {hasLevels && optionsFlow?.callWall && (
              <span className="text-emerald-400">CW ${optionsFlow.callWall.toFixed(0)}</span>
            )}
            {hasLevels && optionsFlow?.putWall && (
              <span className="text-red-400">PW ${optionsFlow.putWall.toFixed(0)}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
      {/* Header Row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-hairline)]/50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Institutional Flow
          </span>
        </div>
        {sentimentBadge}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-[var(--border-hairline)]/50">
        <div className="text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Premium</div>
          <div className="text-sm font-mono font-semibold text-[var(--text-primary)]">
            {totalPremium > 0 ? formatPremium(totalPremium) : "--"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Sweeps</div>
          <div
            className={cn(
              "text-sm font-mono font-semibold",
              sweepCount >= 5 ? "text-amber-400" : "text-[var(--text-primary)]"
            )}
          >
            {sweepCount}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Score</div>
          <div
            className={cn(
              "text-sm font-mono font-semibold",
              institutionalScore >= 70
                ? "text-emerald-400"
                : institutionalScore >= 50
                  ? "text-amber-400"
                  : "text-[var(--text-primary)]"
            )}
          >
            {institutionalScore.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Flow Levels Section */}
      {hasLevels && currentPrice > 0 ? (
        <div className="px-4 py-2 border-b border-[var(--border-hairline)]/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Flow Levels
            </span>
          </div>
          <div className="space-y-1.5">
            {optionsFlow?.callWall && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-[var(--text-secondary)]">Call Wall</span>
                  <span className="text-[9px] text-[var(--text-muted)]">(resistance)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                    ${optionsFlow.callWall.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      getDistanceColor(currentPrice, optionsFlow.callWall, "resistance")
                    )}
                  >
                    {formatDistance(currentPrice, optionsFlow.callWall)}
                  </span>
                </div>
              </div>
            )}
            {optionsFlow?.putWall && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs text-[var(--text-secondary)]">Put Wall</span>
                  <span className="text-[9px] text-[var(--text-muted)]">(support)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                    ${optionsFlow.putWall.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      getDistanceColor(currentPrice, optionsFlow.putWall, "support")
                    )}
                  >
                    {formatDistance(currentPrice, optionsFlow.putWall)}
                  </span>
                </div>
              </div>
            )}
            {optionsFlow?.maxPain && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-xs text-[var(--text-secondary)]">Max Pain</span>
                  <span className="text-[9px] text-[var(--text-muted)]">(magnet)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                    ${optionsFlow.maxPain.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      getDistanceColor(currentPrice, optionsFlow.maxPain, "neutral")
                    )}
                  >
                    {formatDistance(currentPrice, optionsFlow.maxPain)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 py-2 border-b border-[var(--border-hairline)]/50">
          <div className="flex items-center gap-1.5">
            <Target className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Flow Levels
            </span>
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1.5">
            No call/put wall data available for this symbol
          </div>
        </div>
      )}

      {/* Tug of War Visualization */}
      <div className="px-4 py-3">
        {flowData ? (
          <FlowPulse flow={flowData} compact showLabels={false} />
        ) : (
          <div className="text-center py-2">
            <span className="text-xs text-[var(--text-muted)]">
              {isLoading ? "Loading flow data..." : "No institutional flow detected"}
            </span>
          </div>
        )}
      </div>

      {/* No Data Warning */}
      {!hasFlowData && !isLoading && (
        <div className="px-4 pb-2">
          <div className="text-[10px] text-center text-[var(--text-muted)] bg-[var(--surface-2)] rounded py-1">
            Limited flow activity - monitor for sweeps/blocks
          </div>
        </div>
      )}
    </div>
  );
}

export default FlowIntelligencePanel;
