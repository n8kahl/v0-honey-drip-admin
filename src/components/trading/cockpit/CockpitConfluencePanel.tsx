/**
 * CockpitConfluencePanel V3 - Always-visible 48px horizontal confluence bar
 *
 * REWORKED: Now ALWAYS shows a compact horizontal bar that fits in 48px
 * The full confluence details are available via hover/expand or separate modal
 *
 * Layout (48px height):
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ [Score] │ [MTF: ●●●●] │ [VWAP ↑] │ [RSI 62] │ [PDH -0.3%] │ [🔴 Live] │
 * └────────────────────────────────────────────────────────────────────────┘
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import { ArrowUp, ArrowDown, ArrowRight, Activity } from "lucide-react";
import { useSymbolConfluence, type MTFData } from "../../../hooks/useSymbolConfluence";
import type { KeyLevels } from "../../../lib/riskEngine/types";

interface CockpitConfluencePanelProps {
  symbol: string;
  keyLevels?: KeyLevels | null;
  currentPrice?: number | null;
  /** Compact mode is now always used - kept for API compatibility */
  compact?: boolean;
  className?: string;
}

export function CockpitConfluencePanel({
  symbol,
  keyLevels,
  currentPrice,
  className,
}: CockpitConfluencePanelProps) {
  const confluence = useSymbolConfluence(symbol);

  const score = confluence?.overallScore ?? 0;
  const isReady = confluence?.isReady ?? false;
  const mtf = confluence?.mtf ?? [];

  // Find nearest key level
  const nearestLevel = useMemo(() => {
    if (!keyLevels || !currentPrice) return null;

    const levels = [
      { label: "VWAP", price: keyLevels.vwap },
      { label: "ORH", price: keyLevels.orbHigh },
      { label: "ORL", price: keyLevels.orbLow },
      { label: "PDH", price: keyLevels.priorDayHigh },
      { label: "PDL", price: keyLevels.priorDayLow },
    ].filter((l) => l.price != null);

    if (levels.length === 0) return null;

    const sorted = levels
      .map((l) => ({
        ...l,
        distance: ((currentPrice - l.price!) / l.price!) * 100,
        absDistance: Math.abs(((currentPrice - l.price!) / l.price!) * 100),
      }))
      .sort((a, b) => a.absDistance - b.absDistance);

    return sorted[0];
  }, [keyLevels, currentPrice]);

  // VWAP position (above/below)
  const vwapPosition = useMemo(() => {
    if (!keyLevels?.vwap || !currentPrice) return "neutral";
    return currentPrice > keyLevels.vwap ? "above" : "below";
  }, [keyLevels?.vwap, currentPrice]);

  // RSI value from factors
  const rsiValue = useMemo(() => {
    const rsiFactor = confluence?.factors?.find((f) => f.name === "rsi");
    if (!rsiFactor) return null;
    const match = rsiFactor.displayValue?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }, [confluence?.factors]);

  return (
    <div
      className={cn("h-full flex items-center gap-3 px-3", "text-[11px]", className)}
      data-testid="cockpit-confluence-panel"
    >
      {/* Score Badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
            score >= 75
              ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] ring-2 ring-[var(--accent-positive)]/30"
              : score >= 50
                ? "bg-[var(--accent-warning)]/20 text-[var(--accent-warning)]"
                : "bg-[var(--surface-3)] text-[var(--text-muted)]"
          )}
        >
          {score.toFixed(0)}
        </div>
        {isReady && (
          <span className="text-[9px] font-bold text-[var(--accent-positive)] uppercase">
            Ready
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[var(--border-hairline)]" />

      {/* MTF Dots */}
      <div className="flex items-center gap-1 flex-shrink-0" title="Multi-Timeframe Trend">
        <span className="text-[var(--text-faint)] mr-0.5">MTF:</span>
        {(mtf.length > 0 ? mtf : defaultMTF).map((tf) => (
          <MTFDot key={tf.timeframe} data={tf} />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[var(--border-hairline)]" />

      {/* VWAP Position */}
      <div
        className={cn(
          "flex items-center gap-1 flex-shrink-0",
          vwapPosition === "above"
            ? "text-[var(--accent-positive)]"
            : vwapPosition === "below"
              ? "text-[var(--accent-negative)]"
              : "text-[var(--text-muted)]"
        )}
        title="Price vs VWAP"
      >
        <span className="text-[var(--text-faint)]">VWAP</span>
        {vwapPosition === "above" ? (
          <ArrowUp className="w-3.5 h-3.5" />
        ) : vwapPosition === "below" ? (
          <ArrowDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowRight className="w-3.5 h-3.5" />
        )}
      </div>

      {/* RSI */}
      {rsiValue !== null && (
        <>
          <div className="w-px h-6 bg-[var(--border-hairline)]" />
          <div
            className={cn(
              "flex items-center gap-1 flex-shrink-0",
              rsiValue >= 70
                ? "text-[var(--accent-negative)]"
                : rsiValue <= 30
                  ? "text-[var(--accent-positive)]"
                  : "text-[var(--text-muted)]"
            )}
            title={`RSI: ${rsiValue >= 70 ? "Overbought" : rsiValue <= 30 ? "Oversold" : "Neutral"}`}
          >
            <span className="text-[var(--text-faint)]">RSI</span>
            <span className="font-medium tabular-nums">{rsiValue}</span>
          </div>
        </>
      )}

      {/* Nearest Level */}
      {nearestLevel && (
        <>
          <div className="w-px h-6 bg-[var(--border-hairline)]" />
          <div
            className="flex items-center gap-1 flex-shrink-0"
            title={`Nearest level: ${nearestLevel.label}`}
          >
            <span className="text-[var(--text-faint)]">{nearestLevel.label}</span>
            <span
              className={cn(
                "font-medium tabular-nums",
                nearestLevel.distance >= 0
                  ? "text-[var(--accent-positive)]"
                  : "text-[var(--accent-negative)]"
              )}
            >
              {nearestLevel.distance >= 0 ? "+" : ""}
              {nearestLevel.distance.toFixed(1)}%
            </span>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live Indicator */}
      <div className="flex items-center gap-1.5 text-[var(--text-faint)] flex-shrink-0">
        <Activity className="w-3.5 h-3.5 text-[var(--accent-positive)] animate-pulse" />
        <span className="text-[10px]">Live</span>
      </div>
    </div>
  );
}

// Default MTF data when none available
const defaultMTF: MTFData[] = [
  {
    timeframe: "1m",
    direction: "neutral" as const,
    label: "1m",
    lastBarAt: null,
    isStale: false,
    noData: true,
  },
  {
    timeframe: "5m",
    direction: "neutral" as const,
    label: "5m",
    lastBarAt: null,
    isStale: false,
    noData: true,
  },
  {
    timeframe: "15m",
    direction: "neutral" as const,
    label: "15m",
    lastBarAt: null,
    isStale: false,
    noData: true,
  },
  {
    timeframe: "60m",
    direction: "neutral" as const,
    label: "1h",
    lastBarAt: null,
    isStale: false,
    noData: true,
  },
];

// MTF Dot component
function MTFDot({ data }: { data: MTFData }) {
  const colors: Record<string, string> = {
    up: "bg-[var(--accent-positive)]",
    down: "bg-[var(--accent-negative)]",
    neutral: "bg-[var(--text-muted)]",
  };

  return (
    <div
      className={cn("w-2.5 h-2.5 rounded-full", colors[data.direction] || colors.neutral)}
      title={`${data.label}: ${data.direction}`}
    />
  );
}

export default CockpitConfluencePanel;
