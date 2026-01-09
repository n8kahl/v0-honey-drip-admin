/**
 * HDMobileSparklinePreview - Mobile-optimized sparkline card with real market data
 *
 * Displays a compact card with:
 * - Symbol and contract info
 * - Current price and change
 * - Real-time sparkline from marketDataStore candles
 */

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "../../../lib/utils";
import { useCandles, type Candle } from "../../../stores/marketDataStore";

interface HDMobileSparklinePreviewProps {
  ticker: string;
  currentPrice: number;
  change?: number;
  contract?: string;
  bars?: number;
  onTap?: () => void;
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

export function HDMobileSparklinePreview({
  ticker,
  currentPrice,
  change = 0,
  contract = "",
  bars = 25,
  onTap,
  className,
}: HDMobileSparklinePreviewProps) {
  // Get real candle data from store
  const candles1m = useCandles(ticker, "1m");
  const candles5m = useCandles(ticker, "5m");

  const data = useMemo(() => {
    // Prefer 1m candles, fallback to 5m
    const rawCandles = candles1m?.length > 0 ? candles1m : candles5m;
    if (!rawCandles || rawCandles.length === 0) return [];
    const recentCandles = rawCandles.slice(-bars);
    return transformCandlesToData(recentCandles);
  }, [candles1m, candles5m, bars]);

  // Calculate trend from real data
  const isUptrend = useMemo(() => {
    if (data.length < 2) return change >= 0;
    return data[data.length - 1].value >= data[0].value;
  }, [data, change]);

  // Get CSS variable colors
  const positiveColor =
    getComputedStyle(document.documentElement).getPropertyValue("--accent-positive").trim() ||
    "#16A34A";
  const negativeColor =
    getComputedStyle(document.documentElement).getPropertyValue("--accent-negative").trim() ||
    "#EF4444";
  const strokeColor = isUptrend ? positiveColor : negativeColor;

  const hasData = data.length >= 2;

  return (
    <div
      onClick={onTap}
      className={cn(
        "bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4 active:bg-[var(--surface-3)] transition-colors",
        className
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[var(--text-high)] font-medium mb-1">{ticker}</h3>
          {contract && <div className="text-[var(--text-muted)] text-xs">{contract}</div>}
        </div>
        <div className="text-right">
          <div className="text-[var(--text-high)] tabular-nums font-medium">
            ${currentPrice.toFixed(2)}
          </div>
          <div
            className={cn(
              "text-xs tabular-nums",
              change >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Sparkline Chart */}
      <div style={{ height: "60px", width: "100%" }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient
                  id={`mobileSparklineGradient-${ticker}`}
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
                strokeWidth={2}
                fill={`url(#mobileSparklineGradient-${ticker})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          // Loading skeleton
          <div className="w-full h-full bg-[var(--surface-3)] rounded animate-pulse" />
        )}
      </div>
    </div>
  );
}
