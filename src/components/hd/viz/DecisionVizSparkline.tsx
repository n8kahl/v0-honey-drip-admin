/**
 * DecisionVizSparkline - Mode A: Price Position Bar
 *
 * Simple, actionable visualization showing:
 * - Current price position within session range
 * - VWAP relationship (above/below)
 * - Session high/low context
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type { Candle } from "../../../stores/marketDataStore";

// ============================================================================
// Types
// ============================================================================

interface DecisionVizSparklineProps {
  candles: Candle[];
  keyLevels: KeyLevels | null;
  currentPrice: number;
}

// ============================================================================
// Component
// ============================================================================

export function DecisionVizSparkline({
  candles,
  keyLevels,
  currentPrice,
}: DecisionVizSparklineProps) {
  // Calculate session range from candles
  const { sessionLow, sessionHigh, vwap, vwapDiff, positionPercent } = useMemo(() => {
    if (candles.length === 0 || currentPrice === 0) {
      return {
        sessionLow: 0,
        sessionHigh: 0,
        vwap: keyLevels?.vwap || 0,
        vwapDiff: 0,
        positionPercent: 50,
      };
    }

    // Get session high/low from candles
    let low = Math.min(...candles.map((c) => c.low));
    let high = Math.max(...candles.map((c) => c.high));

    // Use key levels if available and extend range
    if (keyLevels?.priorDayLow && keyLevels.priorDayLow < low) {
      low = keyLevels.priorDayLow;
    }
    if (keyLevels?.priorDayHigh && keyLevels.priorDayHigh > high) {
      high = keyLevels.priorDayHigh;
    }

    const vwapValue = keyLevels?.vwap || 0;
    const range = high - low;

    // Calculate position as percentage (0-100)
    const position = range > 0 ? ((currentPrice - low) / range) * 100 : 50;

    // Calculate VWAP difference
    const vwapDiffPct = vwapValue > 0 ? ((currentPrice - vwapValue) / vwapValue) * 100 : 0;

    return {
      sessionLow: low,
      sessionHigh: high,
      vwap: vwapValue,
      vwapDiff: vwapDiffPct,
      positionPercent: Math.max(0, Math.min(100, position)),
    };
  }, [candles, keyLevels, currentPrice]);

  // VWAP position on the bar
  const vwapPositionPercent = useMemo(() => {
    if (!vwap || sessionHigh === sessionLow) return null;
    const range = sessionHigh - sessionLow;
    const pos = ((vwap - sessionLow) / range) * 100;
    return Math.max(0, Math.min(100, pos));
  }, [vwap, sessionLow, sessionHigh]);

  // No data state
  if (candles.length < 2 || currentPrice === 0) {
    return (
      <div className="h-full flex items-center justify-center p-3">
        <span className="text-xs text-[var(--text-faint)]">Loading price data...</span>
      </div>
    );
  }

  const isAboveVwap = vwap > 0 && currentPrice > vwap;
  const isBelowVwap = vwap > 0 && currentPrice < vwap;

  return (
    <div className="flex flex-col gap-3 p-2">
      {/* Title */}
      <div className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-wide">
        Price Position
      </div>

      {/* Range Bar */}
      <div className="relative">
        {/* Background Track */}
        <div className="h-3 rounded-full bg-[var(--surface-3)] relative overflow-visible">
          {/* VWAP Marker */}
          {vwapPositionPercent !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[var(--brand-primary)] z-10"
              style={{ left: `${vwapPositionPercent}%` }}
              title={`VWAP: $${vwap.toFixed(2)}`}
            />
          )}

          {/* Current Price Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[var(--brand-primary)] border-2 border-[var(--surface-1)] shadow-lg z-20 transition-all duration-300"
            style={{ left: `calc(${positionPercent}% - 8px)` }}
          />

          {/* Progress fill to show position */}
          <div
            className={cn(
              "absolute top-0 left-0 h-full rounded-full transition-all duration-300",
              isAboveVwap ? "bg-[var(--accent-positive)]/30" : "bg-[var(--accent-negative)]/30"
            )}
            style={{ width: `${positionPercent}%` }}
          />
        </div>

        {/* Range Labels */}
        <div className="flex justify-between mt-1.5 text-[10px] tabular-nums">
          <span className="text-[var(--accent-negative)]">${sessionLow.toFixed(2)}</span>
          <span className="text-[var(--text-high)] font-semibold">${currentPrice.toFixed(2)}</span>
          <span className="text-[var(--accent-positive)]">${sessionHigh.toFixed(2)}</span>
        </div>
      </div>

      {/* VWAP Context */}
      <div className="flex items-center justify-between text-[11px]">
        {vwap > 0 ? (
          <>
            <span className="text-[var(--text-muted)]">VWAP: ${vwap.toFixed(2)}</span>
            <span
              className={cn(
                "font-medium",
                isAboveVwap && "text-[var(--accent-positive)]",
                isBelowVwap && "text-[var(--accent-negative)]",
                !isAboveVwap && !isBelowVwap && "text-[var(--text-muted)]"
              )}
            >
              {isAboveVwap ? "↑" : isBelowVwap ? "↓" : "="} {Math.abs(vwapDiff).toFixed(2)}%{" "}
              {isAboveVwap ? "above" : isBelowVwap ? "below" : "at"} VWAP
            </span>
          </>
        ) : (
          <span className="text-[var(--text-faint)]">VWAP not available</span>
        )}
      </div>

      {/* Quick Context Badges */}
      <div className="flex flex-wrap gap-1.5">
        {/* Position in range */}
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-medium",
            positionPercent > 70 && "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]",
            positionPercent < 30 && "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]",
            positionPercent >= 30 &&
              positionPercent <= 70 &&
              "bg-[var(--surface-3)] text-[var(--text-muted)]"
          )}
        >
          {positionPercent > 70 ? "Near High" : positionPercent < 30 ? "Near Low" : "Mid-Range"}
        </span>

        {/* Key level context */}
        {keyLevels?.priorDayHigh && currentPrice > keyLevels.priorDayHigh && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]">
            Above PDH
          </span>
        )}
        {keyLevels?.priorDayLow && currentPrice < keyLevels.priorDayLow && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]">
            Below PDL
          </span>
        )}
        {keyLevels?.orbHigh && currentPrice > keyLevels.orbHigh && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]">
            ORB ↑
          </span>
        )}
        {keyLevels?.orbLow && currentPrice < keyLevels.orbLow && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]">
            ORB ↓
          </span>
        )}
      </div>
    </div>
  );
}

export default DecisionVizSparkline;
