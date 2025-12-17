/**
 * DecisionVizRange - Mode B: Range + ATR Gauge
 *
 * Horizontal range bars showing price context.
 * Shows day's range, VWAP position, and ATR usage gauge.
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import { fmtPrice } from "../../../ui/semantics";
import { atrWilder } from "../../../lib/indicators";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type { Candle, Indicators } from "../../../stores/marketDataStore";

// ============================================================================
// Types
// ============================================================================

interface DecisionVizRangeProps {
  candles: Candle[];
  dailyCandles?: Candle[];  // Daily candles for proper ATR(14) calculation
  keyLevels: KeyLevels | null;
  indicators: Indicators;
  currentPrice: number;
}

// ============================================================================
// Component
// ============================================================================

export function DecisionVizRange({
  candles,
  dailyCandles,
  keyLevels,
  indicators,
  currentPrice,
}: DecisionVizRangeProps) {
  // Calculate day's range from candles or key levels
  const { dayLow, dayHigh, rangeWidth } = useMemo(() => {
    // Try key levels first
    let low = keyLevels?.priorDayLow;
    let high = keyLevels?.priorDayHigh;

    // Fall back to candle data
    if (!low || !high) {
      if (candles.length > 0) {
        const lows = candles.map((c) => c.low);
        const highs = candles.map((c) => c.high);
        low = low ?? Math.min(...lows);
        high = high ?? Math.max(...highs);
      }
    }

    const finalLow = low ?? 0;
    const finalHigh = high ?? 0;

    return {
      dayLow: finalLow,
      dayHigh: finalHigh,
      rangeWidth: finalHigh - finalLow,
    };
  }, [candles, keyLevels]);

  // Calculate positions as percentages
  const { currentPct, vwapPct } = useMemo(() => {
    if (rangeWidth === 0) {
      return { currentPct: 50, vwapPct: null };
    }

    const currPct = ((currentPrice - dayLow) / rangeWidth) * 100;
    const vwap = keyLevels?.vwap;
    const vPct = vwap ? ((vwap - dayLow) / rangeWidth) * 100 : null;

    return {
      currentPct: Math.max(0, Math.min(100, currPct)),
      vwapPct: vPct ? Math.max(0, Math.min(100, vPct)) : null,
    };
  }, [currentPrice, dayLow, rangeWidth, keyLevels?.vwap]);

  // Calculate proper Daily ATR(14) from daily candles
  // This gives us the actual average daily range over the past 14 days
  const dailyAtr = useMemo(() => {
    if (!dailyCandles || dailyCandles.length < 15) return 0;

    const highs = dailyCandles.map((c) => c.high);
    const lows = dailyCandles.map((c) => c.low);
    const closes = dailyCandles.map((c) => c.close);

    const atr14Array = atrWilder(highs, lows, closes, 14);
    return atr14Array[atr14Array.length - 1] || 0;
  }, [dailyCandles]);

  // Use daily ATR if available, otherwise fall back to indicators.atr14
  // Note: indicators.atr14 may be from intraday bars if daily bars aren't loaded
  const atr = dailyAtr || indicators.atr14 || 0;
  const atrMultiple = useMemo(() => {
    if (atr === 0) return 0;
    return rangeWidth / atr;
  }, [rangeWidth, atr]);

  const atrRemaining = useMemo(() => {
    return Math.max(0, atr - rangeWidth);
  }, [atr, rangeWidth]);

  const atrUsedPct = useMemo(() => {
    if (atr === 0) return 0;
    return Math.min(100, (rangeWidth / atr) * 100);
  }, [rangeWidth, atr]);

  // Position in range label
  const positionLabel = useMemo(() => {
    if (currentPct > 66) return "Near High";
    if (currentPct < 33) return "Near Low";
    return "Mid Range";
  }, [currentPct]);

  // No data state
  if (dayLow === 0 && dayHigh === 0) {
    return (
      <div className="h-[80px] flex items-center justify-center">
        <span className="text-xs text-[var(--text-faint)]">
          Insufficient data for range display
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Day Range Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--text-muted)]">Day Range</span>
          <span className="text-[var(--text-faint)]">{positionLabel}</span>
        </div>

        {/* Range Bar Container */}
        <div className="relative h-6 bg-[var(--surface-2)] rounded-full overflow-hidden">
          {/* Range Fill */}
          <div
            className="absolute inset-y-0 left-0 bg-[var(--surface-3)] rounded-full"
            style={{ width: "100%" }}
          />

          {/* VWAP Marker */}
          {vwapPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[var(--brand-primary)]"
              style={{ left: `${vwapPct}%` }}
              title={`VWAP: ${fmtPrice(keyLevels?.vwap)}`}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-[var(--brand-primary)] whitespace-nowrap">
                VWAP
              </div>
            </div>
          )}

          {/* Current Price Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left: `calc(${currentPct}% - 6px)` }}
          >
            {/* Pulse ring */}
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-[var(--brand-primary)] opacity-30 animate-pulse" />
            {/* Dot */}
            <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)] border-2 border-[var(--surface-1)]" />
          </div>
        </div>

        {/* Range Labels */}
        <div className="flex justify-between text-[10px] tabular-nums">
          <span className="text-[var(--accent-negative)]">
            {fmtPrice(dayLow)}
          </span>
          <span className="text-[var(--brand-primary)]">
            {fmtPrice(currentPrice)}
          </span>
          <span className="text-[var(--accent-positive)]">
            {fmtPrice(dayHigh)}
          </span>
        </div>
      </div>

      {/* Session ATR Gauge */}
      {atr > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-muted)]">Expected Range</span>
            <span className="text-[var(--text-high)] tabular-nums">
              {atrUsedPct < 100
                ? `${fmtPrice(atrRemaining)} room (${Math.round(atrUsedPct)}% used)`
                : `${atrMultiple.toFixed(1)}× typical range`}
            </span>
          </div>

          {/* ATR Bar */}
          <div className="relative h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            {/* Used portion - cap at 100% for display */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                atrUsedPct > 100
                  ? "bg-[var(--accent-negative)]"
                  : atrUsedPct > 80
                  ? "bg-[var(--data-stale)]"
                  : "bg-[var(--accent-positive)]"
              )}
              style={{ width: `${Math.min(100, atrUsedPct)}%` }}
            />
          </div>

          {/* ATR Scale */}
          <div className="flex justify-between text-[9px] text-[var(--text-faint)]">
            <span>0%</span>
            <span>50%</span>
            <span>100% ({fmtPrice(atr)})</span>
          </div>
        </div>
      )}

      {/* ATR source indicator */}
      {atr > 0 && dailyAtr === 0 && (
        <div className="text-[9px] text-[var(--text-faint)] italic">
          ATR from intraday bars (daily bars unavailable)
        </div>
      )}

      {/* No ATR available at all */}
      {atr === 0 && (
        <div className="text-[10px] text-[var(--text-faint)] italic">
          {dailyCandles && dailyCandles.length > 0
            ? `Need more daily data (${dailyCandles.length}/15 days)`
            : "Loading ATR..."}
        </div>
      )}
    </div>
  );
}

export default DecisionVizRange;
