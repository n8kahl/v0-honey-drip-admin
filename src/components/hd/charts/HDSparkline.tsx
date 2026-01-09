/**
 * HDSparkline - Compact sparkline chart using real market data
 *
 * Displays price trend from real candle data stored in marketDataStore.
 * Falls back to a skeleton if data is not yet available.
 */

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useCandles, type Candle } from "../../../stores/marketDataStore";
import { cn } from "../../../lib/utils";

interface HDSparklineProps {
  /** Symbol to display sparkline for */
  symbol: string;
  /** Number of bars to show (default: 30) */
  bars?: number;
  /** Chart height (default: 60px) */
  className?: string;
}

/**
 * Transform raw candles into chart data format
 */
function transformCandlesToData(candles: Candle[]) {
  return candles.map((candle) => ({
    value: candle.close,
  }));
}

export function HDSparkline({ symbol, bars = 30, className }: HDSparklineProps) {
  // Get real candle data from store - prefer 1m for more granularity
  const candles1m = useCandles(symbol, "1m");
  const candles5m = useCandles(symbol, "5m");

  const data = useMemo(() => {
    // Prefer 1m candles, fallback to 5m
    const rawCandles = candles1m?.length > 0 ? candles1m : candles5m;
    if (!rawCandles || rawCandles.length === 0) return [];
    const recentCandles = rawCandles.slice(-bars);
    return transformCandlesToData(recentCandles);
  }, [candles1m, candles5m, bars]);

  // Calculate trend from real data
  const isUptrend = useMemo(() => {
    if (data.length < 2) return true;
    return data[data.length - 1].value >= data[0].value;
  }, [data]);

  // Get CSS variable colors
  const positiveColor =
    getComputedStyle(document.documentElement).getPropertyValue("--accent-positive").trim() ||
    "#16A34A";
  const negativeColor =
    getComputedStyle(document.documentElement).getPropertyValue("--accent-negative").trim() ||
    "#EF4444";
  const strokeColor = isUptrend ? positiveColor : negativeColor;

  // Loading/empty state
  if (data.length < 2) {
    return (
      <div className={cn("relative animate-pulse", className)} style={{ height: "60px" }}>
        <div className="w-full h-full bg-[var(--surface-2)] rounded" />
      </div>
    );
  }

  return (
    <div className={`relative ${className || ""}`} style={{ height: "60px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient
              id={`sparklineGradient-${symbol}-${isUptrend ? "up" : "down"}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#sparklineGradient-${symbol}-${isUptrend ? "up" : "down"})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
