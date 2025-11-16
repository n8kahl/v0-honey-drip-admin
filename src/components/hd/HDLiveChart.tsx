import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, LineSeriesOptions, Time, CandlestickData, LineData } from 'lightweight-charts';
import { massiveWS } from '../../lib/massive/websocket';
import { massiveFetch } from '../../lib/massive/proxy';
import { calculateEMA, calculateVWAP, calculateBollingerBands, downsampleBars, Bar, IndicatorConfig } from '../../lib/indicators';
import { Wifi, WifiOff, Activity, TrendingUp } from 'lucide-react';
import { ChartLevel } from '../../types/tradeLevels';

export interface TradeEvent {
  type: 'load' | 'enter' | 'trim' | 'update' | 'exit';
  timestamp: number;
  price: number;
  label: string;
  color?: string;
}

interface HDLiveChartProps {
  ticker: string;
  timeframe?: '1' | '5' | '15' | '60'; // minutes
  indicators?: IndicatorConfig;
  events?: TradeEvent[];
  levels?: ChartLevel[]; // Added levels prop
  marketHours?: { open: string; close: string; preMarket: string; afterHours: string };
  orbWindow?: number;
  height?: number;
  className?: string;
}

export function HDLiveChart({
  ticker,
  timeframe = '1',
  indicators = { ema: { periods: [8, 21, 50, 200] }, vwap: { enabled: true, bands: false } },
  events = [],
  levels = [], // Added default empty array for levels
  marketHours = { open: '09:30', close: '16:00', preMarket: '04:00', afterHours: '20:00' },
  orbWindow = 5,
  height = 400,
  className = '',
}: HDLiveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const emaSeriesRefs = useRef<Map<number, ISeriesApi<'Line'>>>(new Map());
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollingerRefs = useRef<{ upper: ISeriesApi<'Line'>; middle: ISeriesApi<'Line'>; lower: ISeriesApi<'Line'> } | null>(null);
  const levelSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  
  const [bars, setBars] = useState<Bar[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [dataSource, setDataSource] = useState<'websocket' | 'rest'>('rest');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [fps, setFps] = useState<number>(60);
  
  const rafRef = useRef<number | null>(null);
  const pendingUpdatesRef = useRef<Bar[]>([]);
  const lastRenderTimeRef = useRef<number>(0);
  
  const fetchHistoricalBars = useCallback(async () => {
    const isOption = ticker.startsWith('O:');
    const endpoint = isOption
      ? `/api/massive/v2/aggs/options/ticker/${ticker}/range/${timeframe}/minute`
      : `/api/massive/v2/aggs/ticker/${ticker}/range/${timeframe}/minute`;

    const timeframeMinutes = Number(timeframe) || 1;
    const to = new Date();
    const toDate = to.toISOString().split('T')[0];

    const buildRequest = async (days: number) => {
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      const fromDate = from.toISOString().split('T')[0];
      const estimateBars = Math.ceil((days * 24 * 60) / timeframeMinutes);
      const limit = Math.min(500, Math.max(50, estimateBars));

      const url = `${endpoint}/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=${limit}`;
      const response = await massiveFetch(url);
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        (error as any).status = response.status;
        throw error;
      }
      return response.json();
    };

    const attemptDays = [1, 0.5, 0.25, 0.166666];
    let lastError: Error | null = null;

    for (const days of attemptDays) {
      try {
        const data = await buildRequest(days);
        const results = data.results || data;
        if (!Array.isArray(results) || results.length === 0) {
          console.warn(`[HDLiveChart] ${ticker} historical data returned empty for ${days}d window`);
          continue;
        }

        const historicalBars: Bar[] = results.map((r: any) => ({
          time: Math.floor(r.t / 1000) as Time,
          open: r.o,
          high: r.h,
          low: r.l,
          close: r.c,
          volume: r.v,
          vwap: r.vw,
        }));

        setBars(historicalBars);
        setDataSource('rest');
        console.log(`[HDLiveChart] Loaded ${historicalBars.length} historical bars for ${ticker}`);
        return;
      } catch (error: any) {
        lastError = error;
        const status = typeof error?.status === 'number' ? error.status : undefined;
        const isRetryable = !status || status >= 500;
        console.warn(
          `[HDLiveChart] Failed to fetch ${ticker} historical bars for ${days}d (status=${status ?? 'unknown'}):`,
          error
        );
        if (!isRetryable) break;
      }
    }

    if (lastError) {
      console.error('[HDLiveChart] Failed to load historical bars after retries:', lastError);
    }
  }, [ticker, timeframe]);
  
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {
        // ignore removal errors
      }
      chartRef.current = null;
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
      },
    });

    if (!chart || typeof chart.addCandlestickSeries !== 'function' || typeof chart.addLineSeries !== 'function') {
      console.error('[HDLiveChart] Chart API not ready, skipping series creation');
      chart?.remove();
      return;
    }

    chartRef.current = chart;

    const priceSeries = chart.addCandlestickSeries({
      upColor: '#16A34A',
      downColor: '#EF4444',
      borderUpColor: '#16A34A',
      borderDownColor: '#EF4444',
      wickUpColor: '#16A34A',
      wickDownColor: '#EF4444',
    });
    candleSeriesRef.current = priceSeries;

    const createLineSeries = (opts: LineSeriesOptions, label?: string) => {
      if (typeof chart.addLineSeries !== 'function') {
        if (label) {
          console.warn(`[HDLiveChart] Line series API unavailable, skipping ${label}`);
        }
        return null;
      }
      return chart.addLineSeries(opts);
    };

    // Create EMA series
    if (indicators?.ema?.periods) {
      const colors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899'];
      indicators.ema.periods.forEach((period, i) => {
        const emaSeries = createLineSeries(
          {
            color: colors[i % colors.length],
            lineWidth: 1,
            title: `EMA${period}`,
          },
          `EMA${period}`
        );
        if (emaSeries) {
          emaSeriesRefs.current.set(period, emaSeries);
        }
      });
    }

    // Create VWAP series
    if (indicators?.vwap?.enabled) {
      const vwapSeries = createLineSeries(
        {
          color: '#10B981',
          lineWidth: 2,
          lineStyle: 2, // Dashed
          title: 'VWAP',
        },
        'VWAP'
      );
      vwapSeriesRef.current = vwapSeries;
    }

    // Create Bollinger Bands
    if (indicators?.bollinger) {
      const upperSeries = createLineSeries(
        {
          color: '#6366F1',
          lineWidth: 1,
          title: 'BB Upper',
        },
        'BB Upper'
      );
      const middleSeries = createLineSeries(
        {
          color: '#6366F1',
          lineWidth: 1,
          lineStyle: 2,
          title: 'BB Middle',
        },
        'BB Middle'
      );
      const lowerSeries = createLineSeries(
        {
          color: '#6366F1',
          lineWidth: 1,
          title: 'BB Lower',
        },
        'BB Lower'
      );
      if (upperSeries && middleSeries && lowerSeries) {
        bollingerRefs.current = { upper: upperSeries, middle: middleSeries, lower: lowerSeries };
      }
    }
    
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
      levelSeriesRefs.current.forEach(series => {
        try {
          chart.removeSeries(series);
        } catch (e) {
          // Series might already be removed
        }
      });
      levelSeriesRefs.current.clear();
      candleSeriesRef.current = null;
      emaSeriesRefs.current.clear();
      vwapSeriesRef.current = null;
      bollingerRefs.current = null;
      chart.remove();
      chartRef.current = null;
    };
  }, [height, indicators]);
  
  useEffect(() => {
    fetchHistoricalBars();
  }, [fetchHistoricalBars]);
  
  useEffect(() => {
    if (!candleSeriesRef.current || bars.length === 0) return;
    
    const renderUpdate = () => {
      const now = performance.now();
      const delta = now - lastRenderTimeRef.current;
      
      // Calculate FPS
      if (delta > 0) {
        const currentFps = 1000 / delta;
        setFps(Math.round(currentFps));
      }
      
      // Downsample if FPS drops below 30
      const barsToRender = fps < 30 ? downsampleBars(bars, 200) : bars;
      
      // Update candlestick data
      const candleData: CandlestickData[] = barsToRender.map(bar => ({
        time: bar.time as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));
      candleSeriesRef.current?.setData(candleData);
      
      // Update indicators
      if (indicators?.ema?.periods) {
        const closes = barsToRender.map(b => b.close);
        indicators.ema.periods.forEach(period => {
          const emaValues = calculateEMA(closes, period);
          const emaData: LineData[] = emaValues
            .map((value, i) => ({
              time: barsToRender[i].time as Time,
              value: isNaN(value) ? null : value,
            }))
            .filter(d => d.value !== null) as LineData[];
          
          emaSeriesRefs.current.get(period)?.setData(emaData);
        });
      }
      
      if (indicators?.vwap?.enabled && vwapSeriesRef.current) {
        const vwapValues = calculateVWAP(barsToRender);
        const vwapData: LineData[] = vwapValues.map((value, i) => ({
          time: barsToRender[i].time as Time,
          value,
        }));
        vwapSeriesRef.current.setData(vwapData);
      }
      
      if (indicators?.bollinger && bollingerRefs.current) {
        const closes = barsToRender.map(b => b.close);
        const { upper, middle, lower } = calculateBollingerBands(
          closes,
          indicators.bollinger.period,
          indicators.bollinger.stdDev
        );
        
        const createBBData = (values: number[]): LineData[] =>
          values
            .map((value, i) => ({
              time: barsToRender[i].time as Time,
              value: isNaN(value) ? null : value,
            }))
            .filter(d => d.value !== null) as LineData[];
        
        bollingerRefs.current.upper.setData(createBBData(upper));
        bollingerRefs.current.middle.setData(createBBData(middle));
        bollingerRefs.current.lower.setData(createBBData(lower));
      }
      
      // Add trade event markers
      if (events.length > 0 && candleSeriesRef.current) {
        const markers = events.map(event => ({
          time: Math.floor(event.timestamp / 1000) as Time,
          position: event.type === 'enter' || event.type === 'load' ? 'belowBar' as const : 'aboveBar' as const,
          color: event.color || (event.type === 'exit' ? '#EF4444' : '#16A34A'),
          shape: 'circle' as const,
          text: event.label,
        }));
        candleSeriesRef.current.setMarkers(markers);
      }
      
      chartRef.current?.timeScale().fitContent();
      lastRenderTimeRef.current = now;
    };
    
    renderUpdate();
  }, [bars, indicators, events, fps]);
  
  useEffect(() => {
    const isOption = ticker.startsWith('O:');
    
    const unsubscribe = isOption
      ? massiveWS.subscribeOptionAggregates([ticker], (message) => {
          if (message.type === 'aggregate' && message.data.ticker === ticker) {
            const agg = message.data;
            const newBar: Bar = {
              time: Math.floor(agg.timestamp / 1000) as Time,
              open: agg.open,
              high: agg.high,
              low: agg.low,
              close: agg.close,
              volume: agg.volume,
              vwap: agg.vwap,
            };
            
            pendingUpdatesRef.current.push(newBar);
            setIsConnected(true);
            setDataSource('websocket');
            setLastUpdate(Date.now());
            
            // Batch update with RAF
            if (!rafRef.current) {
              rafRef.current = requestAnimationFrame(() => {
                setBars(prev => {
                  const updated = [...prev];
                  pendingUpdatesRef.current.forEach(bar => {
                    const existingIndex = updated.findIndex(b => b.time === bar.time);
                    if (existingIndex >= 0) {
                      updated[existingIndex] = bar;
                    } else {
                      updated.push(bar);
                    }
                  });
                  pendingUpdatesRef.current = [];
                  return updated.sort((a, b) => (a.time as number) - (b.time as number));
                });
                rafRef.current = null;
              });
            }
          }
        })
      : massiveWS.subscribeAggregates([ticker], (message) => {
          if (message.type === 'aggregate') {
            const agg = message.data;
            const newBar: Bar = {
              time: Math.floor(agg.timestamp / 1000) as Time,
              open: agg.open,
              high: agg.high,
              low: agg.low,
              close: agg.close,
              volume: agg.volume,
            };
            
            pendingUpdatesRef.current.push(newBar);
            setIsConnected(true);
            setDataSource('websocket');
            setLastUpdate(Date.now());
            
            if (!rafRef.current) {
              rafRef.current = requestAnimationFrame(() => {
                setBars(prev => {
                  const updated = [...prev];
                  pendingUpdatesRef.current.forEach(bar => {
                    const existingIndex = updated.findIndex(b => b.time === bar.time);
                    if (existingIndex >= 0) {
                      updated[existingIndex] = bar;
                    } else {
                      updated.push(bar);
                    }
                  });
                  pendingUpdatesRef.current = [];
                  return updated.sort((a, b) => (a.time as number) - (b.time as number));
                });
                rafRef.current = null;
              });
            }
          }
        });
    
    // REST fallback polling every 3 seconds
    const fallbackInterval = setInterval(() => {
      if (Date.now() - lastUpdate > 3000) {
        setIsConnected(false);
        setDataSource('rest');
        fetchHistoricalBars();
      }
    }, 3000);
    
    return () => {
      unsubscribe();
      clearInterval(fallbackInterval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ticker, lastUpdate, fetchHistoricalBars]);
  
  useEffect(() => {
    if (!chartRef.current || levels.length === 0) return;
    
    // Clear existing level series
    levelSeriesRefs.current.forEach((series, key) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {
        // Series might already be removed
      }
    });
    levelSeriesRefs.current.clear();
    
    // Helper to get color and style for level type
    const getLevelStyle = (type: ChartLevel['type']) => {
      switch (type) {
        case 'ENTRY':
          return { color: '#9CA3AF', width: 2, style: 0, title: 'Entry' }; // Solid gray
        case 'TP':
          return { color: '#16A34A', width: 2, style: 0, title: 'TP' }; // Solid green
        case 'SL':
          return { color: '#EF4444', width: 2, style: 0, title: 'SL' }; // Solid red
        case 'PREMARKET_HIGH':
        case 'PREMARKET_LOW':
          return { color: '#8B5CF6', width: 1, style: 2, title: 'PM' }; // Dashed purple
        case 'ORB_HIGH':
        case 'ORB_LOW':
          return { color: '#F59E0B', width: 1, style: 2, title: 'ORB' }; // Dashed orange
        case 'PREV_DAY_HIGH':
        case 'PREV_DAY_LOW':
          return { color: '#3B82F6', width: 1, style: 2, title: 'PDH/L' }; // Dashed blue
        case 'VWAP':
          return { color: '#10B981', width: 1, style: 2, title: 'VWAP' }; // Dashed green
        case 'VWAP_BAND':
          return { color: '#10B981', width: 1, style: 3, title: 'VWAP Band' }; // Dotted green
        case 'BOLLINGER':
          return { color: '#6366F1', width: 1, style: 3, title: 'BB' }; // Dotted indigo
        default:
          return { color: '#6B7280', width: 1, style: 2, title: 'Level' }; // Dashed gray
      }
    };
    
    // Sort levels by importance (entry/TP/SL first, then key levels)
    const sortedLevels = [...levels].sort((a, b) => {
      const importance = { ENTRY: 0, TP: 1, SL: 2 };
      const aImportance = importance[a.type] ?? 10;
      const bImportance = importance[b.type] ?? 10;
      return aImportance - bImportance;
    });
    
    // Create price line for each level
    sortedLevels.forEach((level, index) => {
      const style = getLevelStyle(level.type);
      const key = `${level.type}-${level.label}-${index}`;
      
      try {
        const lineSeries = chartRef.current!.addLineSeries({
          color: style.color,
          lineWidth: style.width,
          lineStyle: style.style as any,
          title: `${level.label}`,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        
        // Create a horizontal line by setting same price for all time points
        // We'll use a single data point and rely on price line feature
        const priceLineOptions = {
          price: level.price,
          color: style.color,
          lineWidth: style.width,
          lineStyle: style.style as any,
          axisLabelVisible: true,
          title: level.label,
        };
        
        lineSeries.createPriceLine(priceLineOptions);
        
        levelSeriesRefs.current.set(key, lineSeries);
      } catch (error) {
        console.error(`[HDLiveChart] Failed to create level line for ${level.label}:`, error);
      }
    });
    
    console.log(`[HDLiveChart] Rendered ${levels.length} level lines for ${ticker}`);
  }, [levels, ticker]);
  
  const getAsOfText = () => {
    const secondsAgo = Math.floor((Date.now() - lastUpdate) / 1000);
    if (secondsAgo < 5) return 'Live';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  };
  
  return (
    <div className={`bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-hairline)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[var(--text-high)] text-xs font-medium uppercase tracking-wide">
            Live Chart ({timeframe}m)
          </h3>
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
            )}
            <span className="text-micro text-[var(--text-muted)]">
              {dataSource === 'websocket' ? 'Streaming' : 'REST'} • {getAsOfText()}
            </span>
          </div>
          {fps < 30 && (
            <span className="text-micro text-yellow-500 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Downsampled ({fps} fps)
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-micro text-[var(--text-muted)]">
          {indicators?.ema?.periods.map(p => (
            <span key={p}>EMA{p}</span>
          ))}
          {indicators?.vwap?.enabled && <span>VWAP</span>}
          {indicators?.bollinger && <span>BB(20,2)</span>}
          {levels.map(level => (
            <span key={level.label}>{level.label}</span>
          ))}
        </div>
      </div>
      
      {/* Chart Canvas */}
      <div ref={chartContainerRef} style={{ position: 'relative', width: '100%', height: `${height}px` }} />
    </div>
  );
}
