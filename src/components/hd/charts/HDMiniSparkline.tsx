/**
 * HDMiniSparkline - Compact real-time sparkline for watchlist rows
 *
 * Features:
 * - Ultra-compact (28-32px height)
 * - Real-time updates from marketDataStore candles
 * - Green/red color based on trend direction
 * - Smooth SVG path with gradient fill
 * - Animates on initial load
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { useCandles, type Candle } from "../../../stores/marketDataStore";
import { cn } from "../../../lib/utils";

interface HDMiniSparklineProps {
  symbol: string;
  height?: number;
  barCount?: number;
  className?: string;
}

export function HDMiniSparkline({
  symbol,
  height = 28,
  barCount = 50,
  className,
}: HDMiniSparklineProps) {
  const candles = useCandles(symbol, "1m");
  const pathRef = useRef<SVGPathElement>(null);
  const [isAnimating, setIsAnimating] = useState(true);

  // Get last N candles
  const data = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    return candles.slice(-barCount);
  }, [candles, barCount]);

  // Calculate trend (first vs last close)
  const isUptrend = useMemo(() => {
    if (data.length < 2) return true;
    return data[data.length - 1].close >= data[0].close;
  }, [data]);

  // Calculate SVG dimensions and path
  const { path, areaPath, viewBox } = useMemo(() => {
    if (data.length < 2) {
      return { path: "", areaPath: "", viewBox: "0 0 100 28" };
    }

    const width = 100;
    const h = height;
    const padding = 2;

    // Find min/max for scaling
    const closes = data.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    // Scale functions
    const scaleX = (i: number) => (i / (data.length - 1)) * (width - padding * 2) + padding;
    const scaleY = (price: number) => {
      const normalized = (price - min) / range;
      return h - padding - normalized * (h - padding * 2);
    };

    // Build path
    const points = data.map((c, i) => ({
      x: scaleX(i),
      y: scaleY(c.close),
    }));

    // Line path
    const linePath = points.reduce((acc, point, i) => {
      return i === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
    }, "");

    // Area path (for gradient fill)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${h - padding} L ${points[0].x} ${h - padding} Z`;

    return {
      path: linePath,
      areaPath,
      viewBox: `0 0 ${width} ${h}`,
    };
  }, [data, height]);

  // Animate on mount
  useEffect(() => {
    if (pathRef.current && isAnimating) {
      const length = pathRef.current.getTotalLength();
      pathRef.current.style.strokeDasharray = `${length}`;
      pathRef.current.style.strokeDashoffset = `${length}`;

      // Trigger animation
      requestAnimationFrame(() => {
        if (pathRef.current) {
          pathRef.current.style.transition = "stroke-dashoffset 0.6s ease-out";
          pathRef.current.style.strokeDashoffset = "0";
        }
      });

      // Clear animation state after completion
      const timer = setTimeout(() => setIsAnimating(false), 700);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  // Colors based on trend
  const strokeColor = isUptrend ? "var(--accent-positive)" : "var(--accent-negative)";
  const fillId = `sparkline-gradient-${symbol}-${isUptrend ? "up" : "down"}`;

  // Empty state
  if (data.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-[10px] text-[var(--text-faint)]",
          className
        )}
        style={{ height }}
      >
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)} style={{ height }}>
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#${fillId})`}
          className={cn(
            "transition-opacity duration-300",
            isAnimating ? "opacity-0" : "opacity-100"
          )}
        />

        {/* Line path */}
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current price dot */}
        {!isAnimating && data.length > 0 && (
          <circle
            cx={100 - 2}
            cy={
              height -
              2 -
              ((data[data.length - 1].close - Math.min(...data.map((c) => c.close))) /
                (Math.max(...data.map((c) => c.close)) - Math.min(...data.map((c) => c.close)) ||
                  1)) *
                (height - 4)
            }
            r="2"
            fill={strokeColor}
            className="animate-pulse"
          />
        )}
      </svg>
    </div>
  );
}

/**
 * HDMiniSparklineSkeleton - Loading placeholder for sparkline
 */
export function HDMiniSparklineSkeleton({
  height = 28,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("bg-[var(--surface-2)] rounded animate-pulse", className)}
      style={{ height }}
    />
  );
}
