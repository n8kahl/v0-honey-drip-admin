/**
 * HDConfluenceBar - Horizontal Always-Visible Confluence Display
 *
 * Design Spec V2 Implementation:
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ ┌────┐                                                                     │
 * │ │ 68 │  MTF      VWAP       RSI       Level      Flow      Regime   ●LIVE │
 * │ │    │  ●●○○     ▲ Above    ◐ 45      ✓ 0.1%     📈 Bull   Trending  1s   │
 * │ │CONF│  2/4      +0.17%     Neutral   ORB High   Strong    ▲ Bias        │
 * │ └────┘                                                          [Expand ▼]│
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Visual Elements:
 * - Score Ring: Animated on change, color-coded
 * - MTF Dots: ● = aligned, ○ = not aligned
 * - VWAP Arrow: ▲ above, ▼ below, ↔ at VWAP
 * - RSI Gauge: Half-circle visual
 * - Level Check: ✓ near level, ✗ far from level
 * - Flow Icon: 📈 bullish, 📉 bearish, ↔ neutral
 * - Regime Badge: Trending/Ranging/Volatile
 * - Live Pulse: Green pulsing dot
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Activity,
  Target,
  BarChart3,
  Zap,
} from "lucide-react";
import {
  useSymbolConfluence,
  type MTFData,
  type FactorData,
} from "../../../hooks/useSymbolConfluence";
import { useFlowContext } from "../../../hooks/useFlowContext";
import type { KeyLevels } from "../../../lib/riskEngine/types";

// ============================================================================
// Types
// ============================================================================

export interface HDConfluenceBarProps {
  /** Symbol to display confluence for */
  symbol: string;
  /** Key levels for proximity calculation */
  keyLevels?: KeyLevels | null;
  /** Current underlying price */
  currentPrice?: number | null;
  /** Alert threshold - highlight if score drops below */
  alertThreshold?: number;
  /** Show expand button for full details */
  expandable?: boolean;
  /** Callback when expanded */
  onExpand?: () => void;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  if (score >= 30) return "text-[var(--text-muted)]";
  return "text-red-400";
}

function getScoreRingColor(score: number): string {
  if (score >= 70) return "#10B981"; // emerald-500
  if (score >= 50) return "#F59E0B"; // amber-500
  if (score >= 30) return "#6B7280"; // gray-500
  return "#EF4444"; // red-500
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 50) return "bg-amber-500/10 border-amber-500/30";
  if (score >= 30) return "bg-gray-500/10 border-gray-500/30";
  return "bg-red-500/10 border-red-500/30";
}

// ============================================================================
// Sub-Components
// ============================================================================

/** Score Ring with animation */
function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreRingColor(score);

  return (
    <div
      className={cn("relative flex-shrink-0", `w-[${size}px] h-[${size}px]`)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="4"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Score number */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-lg font-bold tabular-nums leading-none", getScoreColor(score))}>
          {score.toFixed(0)}
        </span>
        <span className="text-[8px] text-[var(--text-faint)] uppercase tracking-wide">CONF</span>
      </div>
    </div>
  );
}

/** MTF Alignment Dots */
function MTFDots({ mtfData, aligned }: { mtfData: MTFData[]; aligned: number }) {
  const total = mtfData.length || 4;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        {mtfData.slice(0, 4).map((tf, i) => (
          <div
            key={tf.timeframe}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors duration-300",
              tf.direction === "up"
                ? "bg-emerald-500"
                : tf.direction === "down"
                  ? "bg-red-500"
                  : "bg-gray-500"
            )}
            title={`${tf.label}: ${tf.direction}`}
          />
        ))}
      </div>
      <span className="text-[9px] text-[var(--text-muted)]">
        {aligned}/{total} align
      </span>
    </div>
  );
}

/** VWAP Position Indicator */
function VWAPIndicator({ vwapDistance }: { vwapDistance: number | null }) {
  if (vwapDistance === null) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Minus className="w-4 h-4 text-[var(--text-muted)]" />
        <span className="text-[9px] text-[var(--text-muted)]">VWAP N/A</span>
      </div>
    );
  }

  const isAbove = vwapDistance > 0;
  const isNear = Math.abs(vwapDistance) < 0.1;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={cn("flex items-center gap-0.5", isAbove ? "text-emerald-400" : "text-red-400")}
      >
        {isAbove ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span className="text-xs font-semibold tabular-nums">
          {isAbove ? "+" : ""}
          {vwapDistance.toFixed(2)}%
        </span>
      </div>
      <span className="text-[9px] text-[var(--text-muted)]">
        {isNear ? "At VWAP" : isAbove ? "Above" : "Below"}
      </span>
    </div>
  );
}

/** RSI Gauge */
function RSIGauge({ rsi }: { rsi: number | null }) {
  if (rsi === null) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-8 h-4 bg-[var(--surface-2)] rounded" />
        <span className="text-[9px] text-[var(--text-muted)]">RSI N/A</span>
      </div>
    );
  }

  const getColor = () => {
    if (rsi >= 70) return "text-red-400 bg-red-500/20";
    if (rsi <= 30) return "text-emerald-400 bg-emerald-500/20";
    return "text-[var(--text-high)] bg-[var(--surface-2)]";
  };

  const getLabel = () => {
    if (rsi >= 70) return "Overbought";
    if (rsi <= 30) return "Oversold";
    return "Neutral";
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn("px-2 py-0.5 rounded text-xs font-semibold tabular-nums", getColor())}>
        {rsi.toFixed(0)}
      </div>
      <span className="text-[9px] text-[var(--text-muted)]">{getLabel()}</span>
    </div>
  );
}

/** Key Level Proximity */
function LevelIndicator({
  keyLevels,
  currentPrice,
}: {
  keyLevels?: KeyLevels | null;
  currentPrice?: number | null;
}) {
  const nearestLevel = useMemo(() => {
    if (!keyLevels || !currentPrice) return null;

    const levels = [
      { name: "VWAP", price: keyLevels.vwap },
      { name: "ORB Hi", price: keyLevels.orbHigh },
      { name: "ORB Lo", price: keyLevels.orbLow },
      { name: "PDH", price: keyLevels.priorDayHigh },
      { name: "PDL", price: keyLevels.priorDayLow },
    ].filter((l) => l.price);

    if (levels.length === 0) return null;

    return levels
      .map((l) => ({
        ...l,
        distance: Math.abs(((currentPrice - l.price!) / l.price!) * 100),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
  }, [keyLevels, currentPrice]);

  if (!nearestLevel) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Target className="w-4 h-4 text-[var(--text-muted)]" />
        <span className="text-[9px] text-[var(--text-muted)]">No levels</span>
      </div>
    );
  }

  const isNear = nearestLevel.distance < 0.5;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={cn(
          "flex items-center gap-0.5",
          isNear ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]"
        )}
      >
        {isNear ? "✓" : "○"}
        <span className="text-xs font-semibold tabular-nums">
          {nearestLevel.distance.toFixed(1)}%
        </span>
      </div>
      <span className="text-[9px] text-[var(--text-muted)]">{nearestLevel.name}</span>
    </div>
  );
}

/** Flow Indicator */
function FlowIndicator({ symbol }: { symbol: string }) {
  const flowContext = useFlowContext(symbol);

  const getBias = () => {
    if (flowContext.primarySentiment === "BULLISH")
      return { icon: TrendingUp, color: "text-emerald-400", label: "Bullish" };
    if (flowContext.primarySentiment === "BEARISH")
      return { icon: TrendingDown, color: "text-red-400", label: "Bearish" };
    return { icon: Minus, color: "text-[var(--text-muted)]", label: "Neutral" };
  };

  const bias = getBias();
  const Icon = bias.icon;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className={cn("w-4 h-4", bias.color)} />
      <span className="text-[9px] text-[var(--text-muted)]">{bias.label}</span>
    </div>
  );
}

/** Regime Badge */
function RegimeBadge({ factors }: { factors: FactorData[] }) {
  // Determine regime from factors
  const regime = useMemo(() => {
    // Look for trend factor
    const trendFactor = factors.find((f) => f.name.toLowerCase().includes("trend"));
    if (trendFactor) {
      if (trendFactor.status === "strong")
        return { label: "Trending", color: "bg-emerald-500/20 text-emerald-400" };
      if (trendFactor.status === "weak")
        return { label: "Ranging", color: "bg-amber-500/20 text-amber-400" };
    }
    return { label: "Mixed", color: "bg-gray-500/20 text-gray-400" };
  }, [factors]);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", regime.color)}>
        {regime.label}
      </span>
      <span className="text-[9px] text-[var(--text-faint)]">Regime</span>
    </div>
  );
}

/** Live Pulse Indicator */
function LivePulse({ isLive = true }: { isLive?: boolean }) {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setPulse((p) => !p), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
      <div
        className={cn(
          "w-2 h-2 rounded-full bg-emerald-500 transition-opacity duration-500",
          pulse ? "opacity-100" : "opacity-40"
        )}
      />
      <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HDConfluenceBar({
  symbol,
  keyLevels,
  currentPrice,
  alertThreshold = 40,
  expandable = false,
  onExpand,
  className,
}: HDConfluenceBarProps) {
  const confluence = useSymbolConfluence(symbol);

  // Loading state
  if (!confluence) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-3 bg-[var(--surface-1)]",
          className
        )}
      >
        <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] animate-pulse" />
        <span className="text-xs text-[var(--text-muted)]">Loading confluence...</span>
      </div>
    );
  }

  const score = confluence.overallScore;
  const mtfData = confluence.mtf || [];
  const mtfAligned = confluence.mtfAligned || 0;
  const factors = confluence.factors || [];

  // Extract specific factors for display
  const rsiFactor = factors.find((f) => f.name.toLowerCase().includes("rsi"));
  const rsiValue = rsiFactor ? parseFloat(rsiFactor.displayValue) : null;

  // VWAP distance (from key levels)
  const vwapDistance = useMemo(() => {
    if (!keyLevels?.vwap || !currentPrice) return null;
    return ((currentPrice - keyLevels.vwap) / keyLevels.vwap) * 100;
  }, [keyLevels?.vwap, currentPrice]);

  const isLowScore = score < alertThreshold;

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-2 rounded-lg border transition-all duration-300",
        isLowScore
          ? "bg-red-500/5 border-red-500/30"
          : "bg-[var(--surface-1)] border-[var(--border-hairline)]",
        className
      )}
      data-testid="confluence-bar"
    >
      {/* Score Ring */}
      <ScoreRing score={score} size={48} />

      {/* Divider */}
      <div className="h-10 w-px bg-[var(--border-hairline)]" />

      {/* MTF Dots */}
      <div className="hidden sm:block">
        <MTFDots mtfData={mtfData} aligned={mtfAligned} />
      </div>

      {/* Divider */}
      <div className="hidden sm:block h-10 w-px bg-[var(--border-hairline)]" />

      {/* VWAP */}
      <div className="hidden md:block">
        <VWAPIndicator vwapDistance={vwapDistance} />
      </div>

      {/* RSI */}
      <div className="hidden md:block">
        <RSIGauge rsi={rsiValue} />
      </div>

      {/* Level */}
      <div className="hidden lg:block">
        <LevelIndicator keyLevels={keyLevels} currentPrice={currentPrice} />
      </div>

      {/* Flow */}
      <div className="hidden lg:block">
        <FlowIndicator symbol={symbol} />
      </div>

      {/* Regime */}
      <div className="hidden xl:block">
        <RegimeBadge factors={factors} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live Pulse */}
      <LivePulse isLive />

      {/* Expand Button */}
      {expandable && onExpand && (
        <button
          onClick={onExpand}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          <span className="text-[10px] font-medium">Expand</span>
        </button>
      )}
    </div>
  );
}

export default HDConfluenceBar;
