/**
 * HDKeyLevelChart - Mini candlestick chart with key levels overlay
 *
 * Visual trading chart showing:
 * - Last 5-7 days of price action
 * - Key levels as horizontal lines
 * - Current price marker
 * - Familiar TradingView-style presentation
 */

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';
import type { KeyLevel } from '../../../hooks/useOffHoursData';
import { cn } from '../../../lib/utils';

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
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
      crosshair: {
        mode: 0, // Normal crosshair
        vertLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          labelBackgroundColor: '#3b82f6',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          labelBackgroundColor: '#3b82f6',
        },
      },
    });

    chartRef.current = chart;

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Set candlestick data if available
    if (bars.length > 0) {
      candlestickSeries.setData(
        bars.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }))
      );
    }

    // Add horizontal price lines for each level
    // Filter to near-term levels (within ±3%)
    const nearTermLevels = levels.filter((level) => {
      const percentAway = Math.abs((level.price - currentPrice) / currentPrice) * 100;
      return percentAway <= 3;
    });

    nearTermLevels.forEach((level) => {
      let color = '#a1a1aa';
      let lineStyle = LineStyle.Solid;

      switch (level.type) {
        case 'resistance':
          color = '#ef4444'; // Red
          break;
        case 'support':
          color = '#22c55e'; // Green
          break;
        case 'pivot':
        case 'vwap':
          color = '#eab308'; // Yellow
          lineStyle = LineStyle.Dashed;
          break;
        case 'gap':
          color = '#a855f7'; // Purple
          break;
      }

      candlestickSeries.createPriceLine({
        price: level.price,
        color,
        lineWidth: 1,
        lineStyle,
        axisLabelVisible: true,
        title: level.label,
      });
    });

    // Add current price line (bold white)
    candlestickSeries.createPriceLine({
      price: currentPrice,
      color: '#ffffff',
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

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [levels, currentPrice, bars, height]);

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
          <div className="w-3 h-0.5 bg-white" />
          <span className="text-[var(--text-muted)]">Current Price</span>
        </span>
      </div>
    </div>
  );
}
