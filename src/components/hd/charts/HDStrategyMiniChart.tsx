/**
 * Strategy-Focused Mini Chart for Day Traders
 *
 * Purpose: Quick glance confirmation chart that shows:
 * - Minimal price action (last 2 hours, 5min candles)
 * - EMA 9/21 only (no clutter)
 * - Strategy entry markers with confidence levels
 * - Options flow overlay
 *
 * This complements TradingView by showing what TV doesn't:
 * - Your custom strategy signals
 * - Institutional options flow
 * - Real-time confluence scores
 */

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { cn } from '../../lib/utils';
import { Target, TrendingUp, AlertTriangle } from 'lucide-react';

interface StrategyMarker {
  time: number; // Unix timestamp
  price: number;
  strategyName: string;
  confidence: number; // 0-100
  side: 'long' | 'short';
  entry?: number;
  stop?: number;
  targets?: number[];
}

interface FlowBar {
  time: number;
  callVolume: number;
  putVolume: number;
  hasSweep: boolean;
  hasBlock: boolean;
}

interface MiniChartProps {
  symbol: string;
  bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  ema9: number[];
  ema21: number[];
  signals: StrategyMarker[];
  flow?: FlowBar[];
  className?: string;
}

export function HDStrategyMiniChart({ symbol, bars, ema9, ema21, signals, flow, className }: MiniChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [activeSignal, setActiveSignal] = useState<StrategyMarker | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart with minimal styling
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748b',
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#1e293b', style: 1 },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1, // Normal crosshair
        vertLine: {
          color: '#475569',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: '#475569',
          width: 1,
          style: 2,
        },
      },
    });

    chartRef.current = chart;

    // Add candlestick series (minimal styling)
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candleSeriesRef.current = candleSeries;

    // Set candlestick data
    const candleData = bars.map((bar) => ({
      time: bar.time as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));
    candleSeries.setData(candleData);

    // Add EMA 9 (faster line)
    const ema9Series = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1.5,
      title: 'EMA 9',
    });
    ema9Series.setData(
      bars.map((bar, idx) => ({
        time: bar.time as Time,
        value: ema9[idx] || bar.close,
      }))
    );

    // Add EMA 21 (slower line)
    const ema21Series = chart.addLineSeries({
      color: '#8b5cf6',
      lineWidth: 1.5,
      title: 'EMA 21',
    });
    ema21Series.setData(
      bars.map((bar, idx) => ({
        time: bar.time as Time,
        value: ema21[idx] || bar.close,
      }))
    );

    // Add strategy markers
    const markers = signals.map((signal) => ({
      time: signal.time as Time,
      position: (signal.side === 'long' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
      color: signal.confidence >= 80 ? '#22c55e' : signal.confidence >= 65 ? '#eab308' : '#94a3b8',
      shape: signal.confidence >= 80 ? ('arrowUp' as const) : ('circle' as const),
      text: `${signal.strategyName} ${signal.confidence}%`,
      size: signal.confidence >= 80 ? 2 : 1,
    }));

    candleSeries.setMarkers(markers);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Fit content
    chart.timeScale().fitContent();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [bars, ema9, ema21, signals]);

  // Find most recent active signal
  useEffect(() => {
    if (signals.length > 0) {
      const latest = signals[signals.length - 1];
      setActiveSignal(latest);
    }
  }, [signals]);

  return (
    <div className={cn('relative', className)}>
      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full" />

      {/* Active Signal Overlay */}
      {activeSignal && (
        <div className="absolute top-2 left-2 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-3 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            {activeSignal.side === 'long' ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />
            )}
            <div className="font-semibold text-sm text-zinc-100">{activeSignal.strategyName}</div>
            <div
              className={cn(
                'ml-auto px-2 py-0.5 rounded text-xs font-medium',
                activeSignal.confidence >= 80
                  ? 'bg-green-500/20 text-green-400'
                  : activeSignal.confidence >= 65
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-zinc-500/20 text-zinc-400'
              )}
            >
              {activeSignal.confidence}%
            </div>
          </div>

          {activeSignal.entry && activeSignal.stop && (
            <div className="space-y-1 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Entry:</span>
                <span className="text-zinc-200 font-mono">${activeSignal.entry.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Stop:</span>
                <span className="text-red-400 font-mono">${activeSignal.stop.toFixed(2)}</span>
              </div>
              {activeSignal.targets && activeSignal.targets.length > 0 && (
                <div className="flex justify-between">
                  <span>Target:</span>
                  <span className="text-green-400 font-mono">${activeSignal.targets[0].toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-zinc-700">
                <span>R:R:</span>
                <span className="text-blue-400 font-mono">
                  {activeSignal.targets && activeSignal.entry && activeSignal.stop
                    ? (
                        Math.abs(activeSignal.targets[0] - activeSignal.entry) /
                        Math.abs(activeSignal.entry - activeSignal.stop)
                      ).toFixed(1)
                    : 'N/A'}
                  R
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Options Flow Bar (Bottom) */}
      {flow && flow.length > 0 && (
        <div className="mt-2 h-12 bg-zinc-900/50 rounded border border-zinc-800 p-2">
          <div className="flex items-end h-full gap-0.5">
            {flow.map((bar, idx) => {
              const totalVolume = bar.callVolume + bar.putVolume;
              const callRatio = totalVolume > 0 ? bar.callVolume / totalVolume : 0.5;
              const heightPct = Math.min(100, (totalVolume / 100000) * 100); // Scale to max expected volume

              return (
                <div
                  key={idx}
                  className="flex-1 relative group"
                  style={{ height: `${heightPct}%`, minHeight: '4px' }}
                >
                  {/* Call/Put Bar */}
                  <div
                    className={cn(
                      'w-full h-full rounded-sm transition-all',
                      callRatio > 0.6 ? 'bg-green-500' : callRatio < 0.4 ? 'bg-red-500' : 'bg-zinc-600'
                    )}
                  />

                  {/* Sweep/Block Indicator */}
                  {(bar.hasSweep || bar.hasBlock) && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                      {bar.hasSweep && <span className="text-yellow-400 text-xs">⚡</span>}
                      {bar.hasBlock && <span className="text-purple-400 text-xs">💰</span>}
                    </div>
                  )}

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
                    <div className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs whitespace-nowrap">
                      <div className="text-green-400">Calls: {bar.callVolume.toLocaleString()}</div>
                      <div className="text-red-400">Puts: {bar.putVolume.toLocaleString()}</div>
                      {bar.hasSweep && <div className="text-yellow-400">⚡ Sweep detected</div>}
                      {bar.hasBlock && <div className="text-purple-400">💰 Block trade</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flow Legend */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-sm" />
              <span>Call Flow</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-sm" />
              <span>Put Flow</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">⚡</span>
              <span>Sweep</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-purple-400">💰</span>
              <span>Block</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Bar */}
      <div className="flex items-center justify-between mt-2 px-2 py-1.5 bg-zinc-900/30 rounded border border-zinc-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-400">{signals.length} signals</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-400">{signals.filter((s) => s.confidence >= 80).length} ready</span>
          </div>
        </div>
        <div className="text-zinc-500">{symbol}</div>
      </div>
    </div>
  );
}
