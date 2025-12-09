/**
 * DecisionVizSparkline - Mode A: Sparkline + Levels
 *
 * Mini sparkline chart (no heavyweight library) with key level overlays.
 * Shows price context at a glance with VWAP, PDH/PDL, ORH/ORL markers.
 */

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import { fmtPrice } from "../../../ui/semantics";
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

interface LevelLine {
  label: string;
  value: number;
  color: string;
  dashed?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CHART_WIDTH = 300;
const CHART_HEIGHT = 60;
const PADDING_LEFT = 10;
const PADDING_RIGHT = 80; // Space for labels
const PADDING_TOP = 5;
const PADDING_BOTTOM = 5;

const SPARKLINE_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const SPARKLINE_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

// Max candles to show (last N)
const MAX_CANDLES = 60;

// ============================================================================
// Component
// ============================================================================

export function DecisionVizSparkline({
  candles,
  keyLevels,
  currentPrice,
}: DecisionVizSparklineProps) {
  // Get last N candles for sparkline
  const sparklineData = useMemo(() => {
    const slice = candles.slice(-MAX_CANDLES);
    return slice.map((c) => c.close);
  }, [candles]);

  // Calculate price range
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (sparklineData.length === 0) {
      return { minPrice: 0, maxPrice: 0, priceRange: 0 };
    }

    let min = Math.min(...sparklineData);
    let max = Math.max(...sparklineData);

    // Include key levels in range calculation
    if (keyLevels) {
      const levels = [
        keyLevels.vwap,
        keyLevels.priorDayHigh,
        keyLevels.priorDayLow,
        keyLevels.orbHigh,
        keyLevels.orbLow,
      ].filter((v): v is number => v != null);

      if (levels.length > 0) {
        min = Math.min(min, ...levels);
        max = Math.max(max, ...levels);
      }
    }

    // Include current price
    if (currentPrice > 0) {
      min = Math.min(min, currentPrice);
      max = Math.max(max, currentPrice);
    }

    // Add 5% padding
    const range = max - min;
    const padding = range * 0.05;

    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      priceRange: range + padding * 2,
    };
  }, [sparklineData, keyLevels, currentPrice]);

  // Convert price to Y coordinate
  const priceToY = (price: number): number => {
    if (priceRange === 0) return CHART_HEIGHT / 2;
    const normalized = (price - minPrice) / priceRange;
    return CHART_HEIGHT - PADDING_BOTTOM - normalized * SPARKLINE_HEIGHT;
  };

  // Generate sparkline path
  const sparklinePath = useMemo(() => {
    if (sparklineData.length < 2) return "";

    const points = sparklineData.map((price, i) => {
      const x = PADDING_LEFT + (i / (sparklineData.length - 1)) * SPARKLINE_WIDTH;
      const y = priceToY(price);
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  }, [sparklineData, priceToY]);

  // Get key levels for display
  const levelLines = useMemo((): LevelLine[] => {
    const lines: LevelLine[] = [];

    if (keyLevels?.vwap) {
      lines.push({
        label: "VWAP",
        value: keyLevels.vwap,
        color: "var(--brand-primary)",
        dashed: true,
      });
    }

    if (keyLevels?.priorDayHigh) {
      lines.push({
        label: "PDH",
        value: keyLevels.priorDayHigh,
        color: "var(--accent-positive)",
        dashed: true,
      });
    }

    if (keyLevels?.priorDayLow) {
      lines.push({
        label: "PDL",
        value: keyLevels.priorDayLow,
        color: "var(--accent-negative)",
        dashed: true,
      });
    }

    if (keyLevels?.orbHigh) {
      lines.push({
        label: "ORH",
        value: keyLevels.orbHigh,
        color: "var(--accent-positive)",
      });
    }

    if (keyLevels?.orbLow) {
      lines.push({
        label: "ORL",
        value: keyLevels.orbLow,
        color: "var(--accent-negative)",
      });
    }

    return lines;
  }, [keyLevels]);

  // Current price dot position
  const currentPriceY = priceToY(currentPrice);
  const currentPriceX = PADDING_LEFT + SPARKLINE_WIDTH;

  // No data state
  if (sparklineData.length < 2) {
    return (
      <div className="h-[80px] flex items-center justify-center">
        <span className="text-xs text-[var(--text-faint)]">
          Insufficient data for sparkline
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Sparkline Chart */}
      <svg
        width="100%"
        height={CHART_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {/* Level Lines */}
        {levelLines.map((level) => {
          const y = priceToY(level.value);
          return (
            <g key={level.label}>
              <line
                x1={PADDING_LEFT}
                y1={y}
                x2={PADDING_LEFT + SPARKLINE_WIDTH}
                y2={y}
                stroke={level.color}
                strokeWidth={1}
                strokeDasharray={level.dashed ? "3,3" : undefined}
                opacity={0.5}
              />
              <text
                x={PADDING_LEFT + SPARKLINE_WIDTH + 4}
                y={y + 3}
                fill={level.color}
                fontSize={9}
                fontFamily="monospace"
              >
                {level.label} {level.value.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Sparkline Path */}
        <path
          d={sparklinePath}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current Price Dot */}
        {currentPrice > 0 && (
          <g>
            {/* Pulse ring */}
            <circle
              cx={currentPriceX}
              cy={currentPriceY}
              r={6}
              fill="var(--brand-primary)"
              opacity={0.2}
              className="animate-pulse"
            />
            {/* Inner dot */}
            <circle
              cx={currentPriceX}
              cy={currentPriceY}
              r={3}
              fill="var(--brand-primary)"
              className="transition-all duration-300"
            />
          </g>
        )}
      </svg>

      {/* Level Labels Row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] tabular-nums">
        {keyLevels?.priorDayHigh && (
          <span className="text-[var(--accent-positive)]">
            PDH: {fmtPrice(keyLevels.priorDayHigh)}
          </span>
        )}
        {keyLevels?.orbHigh && (
          <span className="text-[var(--accent-positive)]">
            ORH: {fmtPrice(keyLevels.orbHigh)}
          </span>
        )}
        {keyLevels?.vwap && (
          <span className="text-[var(--brand-primary)]">
            VWAP: {fmtPrice(keyLevels.vwap)}
          </span>
        )}
        {keyLevels?.priorDayLow && (
          <span className="text-[var(--accent-negative)]">
            PDL: {fmtPrice(keyLevels.priorDayLow)}
          </span>
        )}
        {keyLevels?.orbLow && (
          <span className="text-[var(--accent-negative)]">
            ORL: {fmtPrice(keyLevels.orbLow)}
          </span>
        )}
        {keyLevels?.preMarketHigh && (
          <span className="text-[var(--text-muted)]">
            PMH: {fmtPrice(keyLevels.preMarketHigh)}
          </span>
        )}
        {!keyLevels && (
          <span className="text-[var(--text-faint)] italic">
            Levels unavailable
          </span>
        )}
      </div>
    </div>
  );
}

export default DecisionVizSparkline;
