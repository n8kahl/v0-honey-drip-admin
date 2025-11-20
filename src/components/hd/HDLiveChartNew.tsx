import { useEffect, useRef, useState, useCallback } from 'react';
// Replay & session imports removed (feature deferred)
import { createChart, IChartApi, ISeriesApi, Time, LineData } from 'lightweight-charts';
import { useMarketDataStore, Timeframe as MarketTimeframe } from '../../stores/marketDataStore';
import { useUIStore } from '../../stores/uiStore';
import { calculateEMA, calculateBollingerBands } from '../../lib/indicators';
import { Wifi, WifiOff } from 'lucide-react';
import { ChartLevel } from '../../types/tradeLevels';

// Map legacy timeframe strings to marketDataStore timeframes
type TfKey = '1' | '5' | '15' | '60' | '1D';
const TF_MAP: Record<TfKey, MarketTimeframe> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '60': '60m',
  '1D': '1D',
};

type IndicatorState = {
  ema9: boolean;
  ema21: boolean;
  vwap: boolean;
  bb: boolean;
};

export interface TradeEvent {
  type: 'load' | 'enter' | 'trim' | 'update' | 'exit';
  timestamp: number;
  price: number;
  label: string;
  color?: string;
}

interface HDLiveChartNewProps {
  ticker: string;
  timeframe?: TfKey;
  initialTimeframe?: TfKey;
  events?: TradeEvent[];
  levels?: ChartLevel[];
  height?: number;
  className?: string;
  showControls?: boolean;
  onTimeframeChange?: (tf: TfKey) => void;
  stickyHeader?: boolean;
}

export function HDLiveChartNew({
  ticker,
  timeframe = '5',
  initialTimeframe,
  events = [],
  levels = [],
  height = 400,
  className = '',
  showControls = true,
  onTimeframeChange,
  stickyHeader = false,
}: HDLiveChartNewProps) {
  // Refs for chart instance and series
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const emaSeriesRefs = useRef<Map<number, ISeriesApi<'Line'>>>(new Map());
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollingerRefs = useRef<{ upper: ISeriesApi<'Line'>; middle: ISeriesApi<'Line'>; lower: ISeriesApi<'Line'> } | null>(null);
  const levelSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  
  // Track last bar time for AUTO mode fitContent
  const lastBarTimeRef = useRef<number>(0);
  
  // Local state
  const [currentTf, setCurrentTf] = useState<TfKey>(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('hdchart.timeframe') : null;
      if (stored === '1' || stored === '5' || stored === '15' || stored === '60' || stored === '1D') return stored;
    } catch {}
    return initialTimeframe || timeframe;
  });

  const [indState, setIndState] = useState<IndicatorState>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('hdchart.indicators') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ema9: Boolean(parsed.ema9 ?? true),
          ema21: Boolean(parsed.ema21 ?? true),
          vwap: Boolean(parsed.vwap ?? true),
          bb: Boolean(parsed.bb ?? false),
        };
      }
    } catch {}
    return { ema9: true, ema21: true, vwap: true, bb: false };
  });

  const [opacity, setOpacity] = useState<number>(1);
  
  // Get data from marketDataStore
  const marketTf = TF_MAP[currentTf];
  const normalizedTicker = ticker.toUpperCase();
  
  const candles = useMarketDataStore((state) => 
    state.symbols[normalizedTicker]?.candles[marketTf] || []
  );
  
  const indicators = useMarketDataStore((state) => 
    state.symbols[normalizedTicker]?.indicators
  );

  // Replay / market-closed mode deferred
  
  const isConnected = useMarketDataStore((state) => state.isConnected);
  const lastUpdated = useMarketDataStore((state) => 
    state.symbols[normalizedTicker]?.lastUpdated || 0
  );
  
  // Get viewport management from uiStore
  const chartViewportMode = useUIStore((state) => state.chartViewportMode);
  const setChartViewportMode = useUIStore((state) => state.setChartViewportMode);
  const saveChartRange = useUIStore((state) => state.saveChartRange);
  const getChartRange = useUIStore((state) => state.getChartRange);
  const registerChartScrollCallback = useUIStore((state) => state.registerChartScrollCallback);
  const unregisterChartScrollCallback = useUIStore((state) => state.unregisterChartScrollCallback);
  
  const rangeKey = `${normalizedTicker}:${currentTf}`;
  
  // Scroll to bar callback for strategy badge navigation
  const scrollToBar = useCallback((barTimeKey: string) => {
    if (!chartRef.current) {
      console.warn('[v0] Chart not initialized, cannot scroll to bar');
      return;
    }
    
    try {
      // Parse barTimeKey format: "2025-01-17T09:35:00Z_5m"
      const [dateStr] = barTimeKey.split('_');
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000); // Convert to seconds for LWC
      
      console.log('[v0] Scrolling chart to bar:', barTimeKey, '→', timestamp);
      
      // Scroll to the timestamp
      const timeScale = chartRef.current.timeScale();
      timeScale.scrollToPosition(3, true); // Scroll to show 3 bars from left edge
      
      // Then set visible range centered on target bar
      const range = timeScale.getVisibleLogicalRange();
      if (range) {
        const width = range.to - range.from;
        timeScale.setVisibleLogicalRange({
          from: timestamp - width / 2,
          to: timestamp + width / 2,
        });
      }
      
      // Switch to MANUAL mode to prevent auto-scroll overriding
      setChartViewportMode('MANUAL');
      
      // TODO: Add vertical line marker at timestamp for visual feedback
      // This would require creating a line series or primitive shape
      
    } catch (err) {
      console.error('[v0] Failed to scroll chart to bar:', barTimeKey, err);
    }
  }, [setChartViewportMode]);
  
  // Register scroll callback on mount
  useEffect(() => {
    console.log('[v0] Registering chart scroll callback for', normalizedTicker);
    registerChartScrollCallback(scrollToBar);
    return () => {
      console.log('[v0] Unregistering chart scroll callback for', normalizedTicker);
      unregisterChartScrollCallback();
    };
  }, [scrollToBar, registerChartScrollCallback, unregisterChartScrollCallback, normalizedTicker]);
  
  // Subtle fade transition on ticker/timeframe changes
  useEffect(() => {
    setOpacity(0);
    const id = setTimeout(() => setOpacity(1), 160);
    return () => clearTimeout(id);
  }, [ticker, currentTf]);
  
  // Initialize chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    if (chartRef.current) {
      chartRef.current.applyOptions({
        width: container.clientWidth,
        height,
      });
      return;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    try {
      candleSeriesRef.current = (chart as any).addCandlestickSeries({
        upColor: '#16A34A',
        downColor: '#EF4444',
        borderUpColor: '#16A34A',
        borderDownColor: '#EF4444',
        wickUpColor: '#16A34A',
        wickDownColor: '#EF4444',
      });
    } catch (err) {
      console.error('[HDLiveChart] Failed to create candlestick series:', err);
    }

    // Create EMA series (initially hidden if not enabled)
    const emaColors = { 9: '#3B82F6', 21: '#8B5CF6' };
    [9, 21].forEach((period) => {
      try {
        const emaSeries = (chart as any).addLineSeries({
          color: emaColors[period as 9 | 21],
          lineWidth: 1,
          title: `EMA${period}`,
          visible: indState[`ema${period}` as 'ema9' | 'ema21'],
        });
        emaSeriesRefs.current.set(period, emaSeries);
      } catch (err) {
        console.error(`[HDLiveChart] Failed to create EMA${period} series:`, err);
      }
    });

    // Create VWAP series
    try {
      vwapSeriesRef.current = (chart as any).addLineSeries({
        color: '#10B981',
        lineWidth: 2,
        lineStyle: 2,
        title: 'VWAP',
        visible: indState.vwap,
      });
    } catch (err) {
      console.error('[HDLiveChart] Failed to create VWAP series:', err);
    }

    // Create Bollinger Bands
    try {
      const upperSeries = (chart as any).addLineSeries({
        color: '#6366F1',
        lineWidth: 1,
        title: 'BB Upper',
        visible: indState.bb,
      });
      const middleSeries = (chart as any).addLineSeries({
        color: '#6366F1',
        lineWidth: 1,
        lineStyle: 2,
        title: 'BB Middle',
        visible: indState.bb,
      });
      const lowerSeries = (chart as any).addLineSeries({
        color: '#6366F1',
        lineWidth: 1,
        title: 'BB Lower',
        visible: indState.bb,
      });
      bollingerRefs.current = { upper: upperSeries, middle: middleSeries, lower: lowerSeries };
    } catch (err) {
      console.error('[HDLiveChart] Failed to create Bollinger Bands:', err);
    }

    // Subscribe to viewport changes
    const timeScale = chart.timeScale();
    const handleVisibleRange = () => {
      const range = timeScale.getVisibleLogicalRange();
      if (range && chartViewportMode === 'AUTO') {
        // User interacted, switch to MANUAL
        setChartViewportMode('MANUAL');
        saveChartRange(rangeKey, { from: range.from, to: range.to });
      } else if (range && chartViewportMode === 'MANUAL') {
        // Save range updates
        saveChartRange(rangeKey, { from: range.from, to: range.to });
      }
    };
    
    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRange);

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chart) return;
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleRange);
      chart.remove();
    };
  }, [height]); // Only recreate chart if height changes
  
  // Update candlestick data
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const chartData = candles
      .filter(c => {
        // Filter out invalid bars (must have valid time and all OHLC values)
        const hasValidTime = (c.time || c.timestamp) && (c.time || c.timestamp) > 0;
        const hasValidOHLC = c.open != null && c.high != null && c.low != null && c.close != null &&
                            !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close) &&
                            isFinite(c.open) && isFinite(c.high) && isFinite(c.low) && isFinite(c.close);
        return hasValidTime && hasValidOHLC;
      })
      .map(c => ({
        time: (c.time || c.timestamp || 0) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

    if (chartData.length === 0) {
      console.warn('[HDLiveChart] No valid candle data to display for', ticker, currentTf);
      return;
    }

    candleSeriesRef.current.setData(chartData);
    
    // Check if new bar closed (time changed)
    const lastBarTime = candles[candles.length - 1]?.time || candles[candles.length - 1]?.timestamp || 0;
    const isNewBar = lastBarTime !== lastBarTimeRef.current && lastBarTimeRef.current !== 0;
    lastBarTimeRef.current = lastBarTime;
    
    // AUTO mode: fit content on new bar close
    if (chartViewportMode === 'AUTO' && isNewBar && chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, chartViewportMode]);
  
  // Restore MANUAL mode viewport
  useEffect(() => {
    if (!chartRef.current) return;
    
    if (chartViewportMode === 'MANUAL') {
      const savedRange = getChartRange(rangeKey);
      if (savedRange) {
        try {
          chartRef.current.timeScale().setVisibleLogicalRange(savedRange);
        } catch (err) {
          console.warn('[HDLiveChart] Failed to restore viewport range:', err);
        }
      }
    }
  }, [chartViewportMode, rangeKey]);
  
  // Update EMA9 series
  useEffect(() => {
    const ema9Series = emaSeriesRefs.current.get(9);
    if (!ema9Series || candles.length === 0) return;
    
    ema9Series.applyOptions({ visible: indState.ema9 });
    
    if (indState.ema9) {
      const closes = candles.map(c => c.close);
      const ema9Values = calculateEMA(closes, 9);
      const ema9Data: LineData[] = ema9Values
        .map((value, i) => ({
          time: (candles[i].time || candles[i].timestamp || 0) as Time,
          value,
        }))
        .filter(d => !isNaN(d.value) && isFinite(d.value));
      ema9Series.setData(ema9Data);
    }
  }, [candles, indState.ema9]);
  
  // Update EMA21 series
  useEffect(() => {
    const ema21Series = emaSeriesRefs.current.get(21);
    if (!ema21Series || candles.length === 0) return;
    
    ema21Series.applyOptions({ visible: indState.ema21 });
    
    if (indState.ema21) {
      const closes = candles.map(c => c.close);
      const ema21Values = calculateEMA(closes, 21);
      const ema21Data: LineData[] = ema21Values
        .map((value, i) => ({
          time: (candles[i].time || candles[i].timestamp || 0) as Time,
          value,
        }))
        .filter(d => !isNaN(d.value) && isFinite(d.value));
      ema21Series.setData(ema21Data);
    }
  }, [candles, indState.ema21]);
  
  // Update VWAP series (from indicators)
  useEffect(() => {
    if (!vwapSeriesRef.current || !indicators?.vwap) return;
    
    vwapSeriesRef.current.applyOptions({ visible: indState.vwap });
    
    if (indState.vwap && candles.length > 0) {
      const vwapData: LineData[] = candles
        .map(c => ({
          time: (c.time || c.timestamp || 0) as Time,
          value: indicators.vwap!,
        }))
        .filter(d => !isNaN(d.value) && isFinite(d.value));
      vwapSeriesRef.current.setData(vwapData);
    }
  }, [candles, indicators?.vwap, indState.vwap]);
  
  // Update Bollinger Bands
  useEffect(() => {
    if (!bollingerRefs.current || candles.length === 0) return;
    
    const { upper, middle, lower } = bollingerRefs.current;
    upper.applyOptions({ visible: indState.bb });
    middle.applyOptions({ visible: indState.bb });
    lower.applyOptions({ visible: indState.bb });
    
    if (indState.bb) {
      const closes = candles.map(c => c.close);
      const bb = calculateBollingerBands(closes, 20, 2);
      
      const upperData: LineData[] = bb.upper
        .map((value, i) => ({
          time: (candles[i].time || candles[i].timestamp || 0) as Time,
          value,
        }))
        .filter(d => !isNaN(d.value) && isFinite(d.value));
      
      const middleData: LineData[] = bb.middle
        .map((value, i) => ({
          time: (candles[i].time || candles[i].timestamp || 0) as Time,
          value,
        }))
        .filter(d => !isNaN(d.value) && isFinite(d.value));
      
      const lowerData: LineData[] = bb.lower
        .map((value, i) => ({
          time: (candles[i].time || candles[i].timestamp || 0) as Time,
          value,
        }))
        .filter(d => !isNaN(d.value) && isFinite(d.value));
      
      upper.setData(upperData);
      middle.setData(middleData);
      lower.setData(lowerData);
    }
  }, [candles, indState.bb]);
  
  // Get color for level type
  const getLevelColor = (level: ChartLevel): string => {
    switch (level.type) {
      case 'ENTRY': return '#3B82F6';
      case 'TP': return '#10B981';
      case 'SL': return '#EF4444';
      case 'VWAP': return '#10B981';
      case 'ORB_HIGH':
      case 'ORB_LOW': return '#F59E0B';
      case 'PREMARKET_HIGH':
      case 'PREMARKET_LOW': return '#8B5CF6';
      default: return '#6366F1';
    }
  };
  
  // Update level lines
  useEffect(() => {
    if (!chartRef.current || levels.length === 0) return;
    
    // Clear existing level series
    levelSeriesRefs.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (err) {
        console.warn('[HDLiveChart] Failed to remove level series:', err);
      }
    });
    levelSeriesRefs.current.clear();
    
    // Create new level lines
    levels.forEach((level) => {
      try {
        const color = getLevelColor(level);
        const lineSeries = (chartRef.current as any).addLineSeries({
          color,
          lineWidth: 2,
          lineStyle: 0,
          title: level.label,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        
        lineSeries.createPriceLine({
          price: level.price,
          color,
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: level.label,
        });
        
        levelSeriesRefs.current.set(level.label, lineSeries);
      } catch (error) {
        console.error(`[HDLiveChart] Failed to create level line for ${level.label}:`, error);
      }
    });
  }, [levels]);
  
  const getAsOfText = () => {
    const secondsAgo = Math.floor((Date.now() - lastUpdated) / 1000);
    if (secondsAgo < 5) return 'Live';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  };

  const handleBackToLive = () => {
    setChartViewportMode('AUTO');
  };

  const handleToggle = (key: keyof IndicatorState) => {
    setIndState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('hdchart.indicators', JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  const tfOptions: { key: TfKey; label: string }[] = [
    { key: '1', label: '1m' },
    { key: '5', label: '5m' },
    { key: '15', label: '15m' },
    { key: '60', label: '60m' },
    { key: '1D', label: '1D' },
  ];

  const selectTimeframe = (tf: TfKey) => {
    if (tf === currentTf) return;
    setChartViewportMode('AUTO');
    setCurrentTf(tf);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('hdchart.timeframe', tf);
      }
    } catch {}
    onTimeframeChange?.(tf);
  };
  
  if (candles.length === 0) {
    return (
      <div className="h-[var(--chart-height,400px)] flex items-center justify-center bg-[var(--surface-2)] rounded-[var(--radius)] border border-dashed border-[var(--border-hairline)] text-[var(--text-muted)] text-sm">
        Loading market data…
      </div>
    );
  }

  return (
    <div className={`bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] overflow-hidden ${className}`}
         style={{ opacity, transition: 'opacity 160ms ease' }}>
      {/* Header */}
      <div className={`${stickyHeader ? 'sticky top-0 z-10 bg-[var(--surface-2)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-2)]/80' : ''} px-3 py-2 border-b border-[var(--border-hairline)] flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <h3 className="text-[var(--text-high)] text-xs font-medium uppercase tracking-wide">
            Live Chart ({currentTf})
          </h3>
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
            )}
            <span className="text-micro text-[var(--text-muted)]">
              {isConnected ? 'Streaming' : 'Disconnected'} • {getAsOfText()}
            </span>
            <span className={`text-micro px-1.5 py-0.5 rounded border ${chartViewportMode === 'AUTO' ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-blue-400 border-blue-400/30 bg-blue-400/10'}`}>
              {chartViewportMode === 'AUTO' ? 'LIVE' : 'HISTORICAL'}
            </span>
            {chartViewportMode === 'MANUAL' && (
              <button className="text-micro px-2 py-0.5 rounded border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]" onClick={handleBackToLive} title="Back to Live">
                Back to Live
              </button>
            )}
          </div>
        </div>
        {showControls && (
          <div className="flex items-center gap-3">
            {/* Timeframe */}
            <div className="flex items-center gap-1 text-micro">
              {tfOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => selectTimeframe(opt.key)}
                  className={`px-2 py-0.5 rounded border ${currentTf === opt.key ? 'bg-[var(--surface-3)] border-[var(--border-strong)] text-[var(--text-high)]' : 'border-[var(--border-hairline)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Indicators */}
            <div className="flex items-center gap-1 text-micro">
              <button onClick={() => handleToggle('ema9')} className={`min-h-[32px] px-3 py-1 rounded border transition-all duration-150 ease-out touch-manipulation active:scale-95 ${indState.ema9 ? 'text-[var(--text-high)] border-[var(--border-strong)] bg-[var(--surface-2)] shadow-sm' : 'text-zinc-400 border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:text-zinc-300'}`}>EMA9</button>
              <button onClick={() => handleToggle('ema21')} className={`min-h-[32px] px-3 py-1 rounded border transition-all duration-150 ease-out touch-manipulation active:scale-95 ${indState.ema21 ? 'text-[var(--text-high)] border-[var(--border-strong)] bg-[var(--surface-2)] shadow-sm' : 'text-zinc-400 border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:text-zinc-300'}`}>EMA21</button>
              <button onClick={() => handleToggle('vwap')} className={`min-h-[32px] px-3 py-1 rounded border transition-all duration-150 ease-out touch-manipulation active:scale-95 ${indState.vwap ? 'text-[var(--text-high)] border-[var(--border-strong)] bg-[var(--surface-2)] shadow-sm' : 'text-zinc-400 border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:text-zinc-300'}`}>VWAP</button>
              <button onClick={() => handleToggle('bb')} className={`min-h-[32px] px-3 py-1 rounded border transition-all duration-150 ease-out touch-manipulation active:scale-95 ${indState.bb ? 'text-[var(--text-high)] border-[var(--border-strong)] bg-[var(--surface-2)] shadow-sm' : 'text-zinc-400 border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:text-zinc-300'}`}>BB</button>
            </div>
          </div>
        )}
      </div>
      
      {/* Chart Canvas */}
      <div ref={chartContainerRef} style={{ position: 'relative', width: '100%', height: `${height}px` }} />
    </div>
  );
}
