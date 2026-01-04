/**
 * HDKeyLevelChart - Mini candlestick chart with key levels overlay
 *
 * Visual trading chart showing:
 * - Last 5-7 days of price action
 * - Key levels as horizontal lines
 * - Current price marker
 * - Familiar TradingView-style presentation
 */

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle } from "lightweight-charts";
import type { KeyLevel } from "../../../hooks/useOffHoursData";
import { cn } from "../../../lib/utils";

interface HDKeyLevelChartProps {
  levels: KeyLevel[];
  currentPrice: number;
  bars?: Array<{
    time: string; // YYYY-MM-DD format
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  height?: number;
}

export function HDKeyLevelChart({
  levels,
  currentPrice,
  bars = [],
  height = 200,
}: HDKeyLevelChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    console.log("[HDKeyLevelChart] Rendering with:", {
      barsCount: bars?.length,
      levelsCount: levels.length,
      currentPrice,
      containerWidth: chartContainerRef.current?.clientWidth,
      containerHeight: chartContainerRef.current?.clientHeight,
      barsPreview: bars?.slice(0, 2),
    });

    if (!chartContainerRef.current) {
      console.warn("[HDKeyLevelChart] No container ref, aborting");
      return;
    }

    if (!chartContainerRef.current.clientWidth) {
      console.warn("[HDKeyLevelChart] Container has zero width, aborting");
      return;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "#0a0a0a" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
      },
      crosshair: {
        mode: 0, // Normal crosshair
        vertLine: {
          color: "rgba(255, 255, 255, 0.3)",
          labelBackgroundColor: "#3b82f6",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.3)",
          labelBackgroundColor: "#3b82f6",
        },
      },
    });

    chartRef.current = chart;

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Set candlestick data if available
    if (bars && bars.length > 0) {
      try {
        console.log("[HDKeyLevelChart] Raw bars before validation:", JSON.stringify(bars, null, 2));

        // Ensure data is sorted by time ascending and has valid values
        const validBars = bars
          .filter((bar) => {
            const isValid =
              bar &&
              bar.time &&
              typeof bar.time === "string" &&
              bar.time !== "1970-01-01" && // Filter out epoch zero dates
              bar.open > 0 &&
              bar.close > 0;
            if (!isValid) {
              console.warn("[HDKeyLevelChart] Filtering out invalid bar:", bar);
            }
            return isValid;
          })
          .sort((a, b) => {
            // Sort by time string (YYYY-MM-DD format sorts correctly as strings)
            return a.time.localeCompare(b.time);
          })
          .map((bar) => ({
            time: bar.time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          }));

        if (validBars.length > 0) {
          console.log(
            "[HDKeyLevelChart] Setting",
            validBars.length,
            "bars:",
            JSON.stringify(validBars, null, 2)
          );
          candlestickSeries.setData(validBars);
        } else {
          console.warn("[HDKeyLevelChart] All bars filtered out as invalid. Original bars:", bars);
        }
      } catch (error) {
        console.error("[HDKeyLevelChart] Failed to set candlestick data:", error);
      }
    }

    // Add horizontal price lines and zones for each level
    const displayLevels = levels.filter((level) => {
      const percentAway = Math.abs((level.price - currentPrice) / currentPrice) * 100;
      return percentAway <= 5; // Show levels within 5%
    });

    displayLevels.forEach((level) => {
      let color = "#a1a1aa";
      let lineStyle = LineStyle.Solid;
      let lineWidth = level.isConfluent ? 2 : 1;

      const type = level.type;

      // Color mapping
      if (type === "resistance" || type === "pdh" || type === "wh" || type === "mh")
        color = "#ef4444";
      else if (type === "support" || type === "pdl" || type === "wl" || type === "ml")
        color = "#22c55e";
      else if (type === "pivot") color = "#eab308";
      else if (type === "vwap") color = "#3b82f6";
      else if (type === "vwap-u" || type === "vwap-l") {
        color = "#3b82f6";
        lineStyle = LineStyle.Dashed;
      } else if (type === "orbH") {
        color = "#f97316";
        lineStyle = LineStyle.Dashed;
      } else if (type === "orbL") {
        color = "#f97316";
        lineStyle = LineStyle.Dashed;
      } else if (type === "pmh" || type === "pml") {
        color = "#6366f1";
        lineStyle = LineStyle.Dashed;
      } else if (
        type === "gex" ||
        type === "call-wall" ||
        type === "put-wall" ||
        type === "max-pain"
      ) {
        color = "#f472b6";
        lineWidth = 2;
      } else if (type === "order-block") color = "#facc15";
      else if (type === "fvg") color = "#fb923c";
      else if (type === "liquidity") color = "#22d3ee";
      else if (type === "swing-high" || type === "swing-low") {
        color = "#94a3b8";
        lineStyle = LineStyle.Dashed;
      } else if (type === "gap") color = "#a855f7";

      // Draw Zone if priceEnd exists (FVG, Order Block)
      if (level.priceEnd && Math.abs(level.priceEnd - level.price) > 0) {
        // Lightweight-charts doesn't have a native "Box" series in v4 for basic lines,
        // but we can simulate it with a very thick semi-transparent line or multiple lines if needed.
        // For now, we'll draw the boundaries and maybe a PriceLine for the center or main price.
        candlestickSeries.createPriceLine({
          price: level.price,
          color: `${color}80`,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${level.label} (Top)`,
        });
        candlestickSeries.createPriceLine({
          price: level.priceEnd,
          color: `${color}80`,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: `(Bottom)`,
        });
      } else {
        candlestickSeries.createPriceLine({
          price: level.price,
          color: level.isConfluent ? "#ffffff" : color, // Highlight confluence with white or bright glow
          lineWidth: lineWidth as any,
          lineStyle,
          axisLabelVisible: true,
          title: level.isConfluent ? `CONFLUENCE: ${level.label}` : level.label,
        });
      }
    });

    // Add current price line (bold white)
    candlestickSeries.createPriceLine({
      price: currentPrice,
      color: "#ffffff",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `Current $${currentPrice.toFixed(2)}`,
    });

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [levels, currentPrice, bars, height]);

  // Show fallback if no bars data
  if (!bars || bars.length === 0) {
    return (
      <div className="relative">
        <div
          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)] text-sm"
          style={{ height: `${height}px` }}
        >
          <div className="text-center">
            <p>No historical data available</p>
            <p className="text-xs mt-1">Chart requires at least 1 day of bars</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <span className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-red-400" />
          <span className="text-[var(--text-muted)]">Resistance</span>
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-green-400" />
          <span className="text-[var(--text-muted)]">Support</span>
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-yellow-400 border-dashed border-t" />
          <span className="text-[var(--text-muted)]">Pivot/VWAP</span>
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-purple-400" />
          <span className="text-[var(--text-muted)]">Gap</span>
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-pink-400" />
          <span className="text-[var(--text-muted)]">Options Wall</span>
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-yellow-600" />
          <span className="text-[var(--text-muted)]">SMC Zone</span>
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-white" />
          <span className="text-[var(--text-muted)]">Current</span>
        </span>
      </div>
    </div>
  );
}
