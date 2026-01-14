/**
 * CockpitConfluencePanel - Rich, always-visible confluence display
 *
 * Shows in a compact, visual form:
 * A) Confluence Score + Breakdown (big score, factor rows)
 * B) Multi-Timeframe Trend Alignment (1m, 5m, 15m, 60m grid)
 * C) Key Levels Proximity (VWAP, ORB, PDH/PDL pills)
 * D) Flow Pulse (Massive flow indicator)
 * E) Gamma/OI Walls (if computed)
 *
 * All sections always visible - no collapsing.
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Activity,
  Target,
  BarChart3,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  useSymbolConfluence,
  type FactorData,
  type MTFData,
} from "../../../hooks/useSymbolConfluence";
import { useFlowContext, getSentimentBgColor } from "../../../hooks/useFlowContext";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type { SymbolFeatures } from "../../../lib/strategy/engine";
import { FlowPulse } from "../../hd/terminal/FlowPulse";

interface CockpitConfluencePanelProps {
  symbol: string;
  keyLevels?: KeyLevels | null;
  flow?: SymbolFeatures["flow"];
  currentPrice?: number | null;
  gammaWalls?: { callWall?: number; putWall?: number } | null;
  className?: string;
}

export function CockpitConfluencePanel({
  symbol,
  keyLevels,
  flow,
  currentPrice,
  gammaWalls,
  className,
}: CockpitConfluencePanelProps) {
  // Get confluence data
  const confluence = useSymbolConfluence(symbol);
  const flowContext = useFlowContext(symbol);

  // Derive flow data from prop or flowContext
  const effectiveFlow = flow ?? {
    flowScore: flowContext.institutionalScore,
    flowBias:
      flowContext.primarySentiment === "BULLISH"
        ? "bullish"
        : flowContext.primarySentiment === "BEARISH"
          ? "bearish"
          : "neutral",
    buyPressure: 50 + flowContext.primaryStrength / 2,
    sweepCount: flowContext.sweepCount,
    putCallRatio: flowContext.putCallRatio,
    aggressiveness: "NORMAL" as const,
  };

  return (
    <div
      className={cn("h-full flex flex-col p-2 overflow-hidden", className)}
      data-testid="cockpit-confluence-panel"
    >
      {/* Top Row: Score + MTF Grid */}
      <div className="flex gap-2 flex-shrink-0">
        {/* Confluence Score */}
        <ConfluenceScoreSection confluence={confluence} />

        {/* MTF Grid */}
        <MTFGridSection mtf={confluence?.mtf} />
      </div>

      {/* Middle: Key Levels + Flow */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 mt-2">
        {/* Key Levels Proximity */}
        <KeyLevelsSection keyLevels={keyLevels} currentPrice={currentPrice} />

        {/* Flow Pulse */}
        <div className="flex-shrink-0">
          <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-1">
            Flow Pulse
          </div>
          {effectiveFlow ? (
            <FlowPulse flow={effectiveFlow} compact showLabels={false} />
          ) : (
            <div className="text-xs text-[var(--text-faint)] text-center py-2">
              Flow unavailable
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Gamma Walls (if available) */}
      <GammaWallsSection gammaWalls={gammaWalls} currentPrice={currentPrice} />
    </div>
  );
}

// ============================================================================
// Confluence Score Section
// ============================================================================

function ConfluenceScoreSection({
  confluence,
}: {
  confluence: ReturnType<typeof useSymbolConfluence>;
}) {
  const score = confluence?.overallScore ?? 0;
  const isReady = confluence?.isReady ?? false;
  const factors = confluence?.factors ?? [];

  // Top 4 factors by contribution
  const topFactors = useMemo(() => {
    return [...factors]
      .filter((f) => f.status !== "missing")
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 4);
  }, [factors]);

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Big Score */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "text-3xl font-bold tabular-nums",
            score >= 75
              ? "text-[var(--accent-positive)]"
              : score >= 50
                ? "text-[var(--accent-warning)]"
                : "text-[var(--text-muted)]"
          )}
        >
          {score.toFixed(0)}
        </div>
        <div className="text-[10px] text-[var(--text-faint)]">
          <div>/ 100</div>
          {isReady && <div className="text-[var(--accent-positive)] font-medium">READY</div>}
        </div>
      </div>

      {/* Factor Pills */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {topFactors.map((factor) => (
          <FactorPill key={factor.name} factor={factor} />
        ))}
      </div>
    </div>
  );
}

function FactorPill({ factor }: { factor: FactorData }) {
  const statusColors: Record<string, string> = {
    strong:
      "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border-[var(--accent-positive)]/30",
    good: "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border-[var(--brand-primary)]/30",
    building:
      "bg-[var(--accent-warning)]/20 text-[var(--accent-warning)] border-[var(--accent-warning)]/30",
    weak: "bg-[var(--surface-3)] text-[var(--text-muted)] border-[var(--border-hairline)]",
    missing: "bg-[var(--surface-2)] text-[var(--text-faint)] border-[var(--border-hairline)]",
  };

  return (
    <div
      className={cn(
        "px-1.5 py-0.5 rounded border text-[9px] font-medium",
        statusColors[factor.status]
      )}
      title={factor.tooltip}
    >
      <span className="opacity-70">{factor.label}</span>{" "}
      <span className="font-semibold">{factor.displayValue}</span>
    </div>
  );
}

// ============================================================================
// MTF Grid Section
// ============================================================================

function MTFGridSection({ mtf }: { mtf?: MTFData[] }) {
  const timeframes = mtf ?? [
    { timeframe: "1m", direction: "neutral" as const, label: "1m" },
    { timeframe: "5m", direction: "neutral" as const, label: "5m" },
    { timeframe: "15m", direction: "neutral" as const, label: "15m" },
    { timeframe: "60m", direction: "neutral" as const, label: "1h" },
  ];

  return (
    <div className="flex-shrink-0 w-28">
      <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-1">
        MTF Trend
      </div>
      <div className="grid grid-cols-2 gap-1">
        {timeframes.map((tf) => (
          <MTFCell key={tf.timeframe} data={tf} />
        ))}
      </div>
    </div>
  );
}

function MTFCell({ data }: { data: MTFData }) {
  const getDirectionStyle = (dir: "up" | "down" | "neutral") => {
    switch (dir) {
      case "up":
        return {
          icon: <ArrowUp className="w-3 h-3" />,
          className: "text-[var(--accent-positive)] bg-[var(--accent-positive)]/10",
        };
      case "down":
        return {
          icon: <ArrowDown className="w-3 h-3" />,
          className: "text-[var(--accent-negative)] bg-[var(--accent-negative)]/10",
        };
      default:
        return {
          icon: <ArrowRight className="w-3 h-3" />,
          className: "text-[var(--text-muted)] bg-[var(--surface-2)]",
        };
    }
  };

  const style = getDirectionStyle(data.direction);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-1 rounded text-[10px]",
        style.className
      )}
    >
      {style.icon}
      <span className="font-medium">{data.label}</span>
    </div>
  );
}

// ============================================================================
// Key Levels Section
// ============================================================================

interface KeyLevelsSectionProps {
  keyLevels?: KeyLevels | null;
  currentPrice?: number | null;
}

function KeyLevelsSection({ keyLevels, currentPrice }: KeyLevelsSectionProps) {
  // Build level pills with distance from current price
  const levelPills = useMemo(() => {
    if (!keyLevels || !currentPrice) return [];

    const levels: { label: string; price: number; type: "support" | "resistance" | "neutral" }[] =
      [];

    if (keyLevels.vwap) levels.push({ label: "VWAP", price: keyLevels.vwap, type: "neutral" });
    if (keyLevels.orbHigh)
      levels.push({ label: "ORH", price: keyLevels.orbHigh, type: "resistance" });
    if (keyLevels.orbLow) levels.push({ label: "ORL", price: keyLevels.orbLow, type: "support" });
    if (keyLevels.priorDayHigh)
      levels.push({ label: "PDH", price: keyLevels.priorDayHigh, type: "resistance" });
    if (keyLevels.priorDayLow)
      levels.push({ label: "PDL", price: keyLevels.priorDayLow, type: "support" });
    if (keyLevels.priorMonthHigh)
      levels.push({ label: "PMH", price: keyLevels.priorMonthHigh, type: "resistance" });
    if (keyLevels.priorMonthLow)
      levels.push({ label: "PML", price: keyLevels.priorMonthLow, type: "support" });

    // Calculate distance and sort by proximity
    return levels
      .map((l) => ({
        ...l,
        distance: ((currentPrice - l.price) / l.price) * 100,
        absDistance: Math.abs(((currentPrice - l.price) / l.price) * 100),
      }))
      .sort((a, b) => a.absDistance - b.absDistance)
      .slice(0, 4); // Show top 4 nearest
  }, [keyLevels, currentPrice]);

  if (levelPills.length === 0) {
    return (
      <div className="flex-shrink-0">
        <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-1">
          Key Levels
        </div>
        <div className="text-xs text-[var(--text-faint)] text-center py-1">No levels available</div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0">
      <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-1">
        Key Levels
      </div>
      <div className="flex flex-wrap gap-1">
        {levelPills.map((level, idx) => (
          <div
            key={level.label}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border",
              idx < 2 && "ring-1 ring-[var(--brand-primary)]/30", // Highlight nearest 2
              level.type === "support"
                ? "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30 text-[var(--accent-positive)]"
                : level.type === "resistance"
                  ? "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30 text-[var(--accent-negative)]"
                  : "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]"
            )}
          >
            <span className="font-medium">{level.label}</span>
            <span className="opacity-70 tabular-nums">
              {level.distance >= 0 ? "+" : ""}
              {level.distance.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Gamma Walls Section
// ============================================================================

interface GammaWallsSectionProps {
  gammaWalls?: { callWall?: number; putWall?: number } | null;
  currentPrice?: number | null;
}

function GammaWallsSection({ gammaWalls, currentPrice }: GammaWallsSectionProps) {
  const hasWalls = gammaWalls && (gammaWalls.callWall || gammaWalls.putWall);

  if (!hasWalls) {
    return (
      <div className="flex-shrink-0 mt-2 pt-2 border-t border-[var(--border-hairline)]">
        <div className="flex items-center justify-between">
          <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">
            Gamma Walls
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">Not available</div>
        </div>
      </div>
    );
  }

  const callDist =
    gammaWalls.callWall && currentPrice
      ? ((gammaWalls.callWall - currentPrice) / currentPrice) * 100
      : null;
  const putDist =
    gammaWalls.putWall && currentPrice
      ? ((gammaWalls.putWall - currentPrice) / currentPrice) * 100
      : null;

  return (
    <div className="flex-shrink-0 mt-2 pt-2 border-t border-[var(--border-hairline)]">
      <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-1">
        Gamma Walls
      </div>
      <div className="flex gap-3">
        {gammaWalls.callWall && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <TrendingUp className="w-3 h-3 text-[var(--accent-positive)]" />
            <span className="text-[var(--text-muted)]">Call:</span>
            <span className="text-[var(--text-high)] font-medium tabular-nums">
              ${gammaWalls.callWall.toFixed(0)}
            </span>
            {callDist !== null && (
              <span className="text-[var(--text-faint)] tabular-nums">
                (+{callDist.toFixed(1)}%)
              </span>
            )}
          </div>
        )}
        {gammaWalls.putWall && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <TrendingDown className="w-3 h-3 text-[var(--accent-negative)]" />
            <span className="text-[var(--text-muted)]">Put:</span>
            <span className="text-[var(--text-high)] font-medium tabular-nums">
              ${gammaWalls.putWall.toFixed(0)}
            </span>
            {putDist !== null && (
              <span className="text-[var(--text-faint)] tabular-nums">({putDist.toFixed(1)}%)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CockpitConfluencePanel;
