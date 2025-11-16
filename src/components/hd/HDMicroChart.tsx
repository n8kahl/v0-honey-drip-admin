import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { massiveWS } from '../../lib/massive/websocket';
import { massiveFetch } from '../../lib/massive/proxy';

interface HDMicroChartProps {
  ticker: string;
  currentPrice: number;
  dailyChange?: number;
  volume?: number;
  marketStatus?: 'open' | 'closed' | 'pre' | 'post';
  className?: string;
}

interface ChartDataPoint {
  time: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  ema9: number;
  ema21: number;
}

async function fetchReal5MinData(ticker: string): Promise<ChartDataPoint[]> {
  try {
    const isOptionsContract = ticker.startsWith('O:');
    const endpoint = isOptionsContract
      ? `/api/massive/v2/aggs/options/ticker/${ticker}/range/5/minute`
      : `/api/massive/v2/aggs/ticker/${ticker}/range/5/minute`;
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const toDate = today.toISOString().split('T')[0];
    const fromDate = yesterday.toISOString().split('T')[0];
    
    console.log('[v0] Fetching real 5-minute chart data for:', ticker, fromDate, toDate, 'endpoint:', endpoint);
    
    const response = await massiveFetch(
      `${endpoint}/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=120`
    );

    if (!response.ok) {
      console.error('[v0] Failed to fetch chart data:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    console.log('[v0] Received chart data:', data);
    
    if (!data.results || data.results.length === 0) {
      console.log('[v0] No chart data available');
      return [];
    }

    const chartData: ChartDataPoint[] = data.results.map((bar: any, index: number) => {
      const timestamp = new Date(bar.t);
      const time = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      const ema9 = calculateEMA(data.results.slice(Math.max(0, index - 8), index + 1).map((b: any) => b.c), 9);
      const ema21 = calculateEMA(data.results.slice(Math.max(0, index - 20), index + 1).map((b: any) => b.c), 21);
      
      return {
        time,
        price: parseFloat(bar.c.toFixed(2)),
        open: parseFloat(bar.o.toFixed(2)),
        high: parseFloat(bar.h.toFixed(2)),
        low: parseFloat(bar.l.toFixed(2)),
        close: parseFloat(bar.c.toFixed(2)),
        ema9: parseFloat(ema9.toFixed(2)),
        ema21: parseFloat(ema21.toFixed(2)),
      };
    });

    console.log('[v0] Transformed chart data:', chartData.length, 'bars');
    return chartData;
  } catch (error) {
    console.error('[v0] Error fetching chart data:', error);
    return [];
  }
}

// Helper function to calculate simple EMA
function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) {
    // Use simple average if not enough data
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }
  
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

export function HDMicroChart({ 
  ticker, 
  currentPrice, 
  dailyChange = 0,
  volume,
  marketStatus = 'open',
  className 
}: HDMicroChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePrice, setLivePrice] = useState(currentPrice);
  const [chartType, setChartType] = useState<'line' | 'candlestick'>('candlestick');
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      setLoading(true);
      const chartData = await fetchReal5MinData(ticker);
      if (mounted) {
        setData(chartData);
        setLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, [ticker]);
  
  useEffect(() => {
    console.log('[v0] Chart subscribing to real-time WebSocket updates for:', ticker);
    
    const isOptionsContract = ticker.startsWith('O:');
    
    const unsubscribe = isOptionsContract
      ? massiveWS.subscribeOptionQuotes([ticker], (message) => {
          if (message.type === 'option' && message.data.ticker === ticker) {
            const update = message.data;
            const newPrice = update.last || update.mid || currentPrice;
            
            console.log('[v0] Chart received real-time option update:', ticker, newPrice);
            setLivePrice(newPrice);
            
            setData(prevData => {
              if (prevData.length === 0) return prevData;
              
              const now = new Date();
              const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              
              const recentPrices = [...prevData.slice(-20).map(d => d.price), newPrice];
              const ema9 = calculateEMA(recentPrices.slice(-9), 9);
              const ema21 = calculateEMA(recentPrices, 21);
              
              const newPoint: ChartDataPoint = {
                time,
                price: parseFloat(newPrice.toFixed(2)),
                ema9: parseFloat(ema9.toFixed(2)),
                ema21: parseFloat(ema21.toFixed(2)),
              };
              
              const updatedData = [...prevData, newPoint].slice(-120);
              return updatedData;
            });
          }
        })
      : massiveWS.subscribeQuotes([ticker], (message) => {
          if (message.type === 'quote' || message.type === 'index') {
            const update = message.data;
            const newPrice = update.value || update.last || currentPrice;
            
            console.log('[v0] Chart received real-time update:', ticker, newPrice);
            setLivePrice(newPrice);
            
            setData(prevData => {
              if (prevData.length === 0) return prevData;
              
              const now = new Date();
              const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              
              const recentPrices = [...prevData.slice(-20).map(d => d.price), newPrice];
              const ema9 = calculateEMA(recentPrices.slice(-9), 9);
              const ema21 = calculateEMA(recentPrices, 21);
              
              const newPoint: ChartDataPoint = {
                time,
                price: parseFloat(newPrice.toFixed(2)),
                ema9: parseFloat(ema9.toFixed(2)),
                ema21: parseFloat(ema21.toFixed(2)),
              };
              
              const updatedData = [...prevData, newPoint].slice(-120);
              return updatedData;
            });
          }
        });
    
    return () => {
      console.log('[v0] Chart unsubscribing from real-time updates for:', ticker);
      unsubscribe();
    };
  }, [ticker, currentPrice]);
  
  const minPrice = data.length > 0 ? Math.min(...data.map(d => d.low || d.price)) : livePrice * 0.99;
  const maxPrice = data.length > 0 ? Math.max(...data.map(d => d.high || d.price)) : livePrice * 1.01;
  const priceRange = maxPrice - minPrice;
  
  const firstPrice = data.length > 0 ? data[0].price : currentPrice;
  const lastPrice = data.length > 0 ? data[data.length - 1].price : livePrice;
  const isPositive = lastPrice >= firstPrice;
  
  const positiveColor = '#16A34A';
  const negativeColor = '#EF4444';
  const priceColor = isPositive ? positiveColor : negativeColor;
  
  console.log('[v0] Chart rendering with', data.length, 'data points, loading:', loading);
  console.log('[v0] Chart data sample:', data.slice(0, 3));
  console.log('[v0] Price range:', minPrice, 'to', maxPrice);
  
  const renderFallbackChart = () => {
    if (data.length === 0) return null;
    
    const width = chartRef.current?.clientWidth || 1000;
    const height = 220;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    if (maxPrice === minPrice) {
      console.warn('[v0] Chart has flat line - no price movement');
      return (
        <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
          No price movement detected
        </div>
      );
    }
    
    const xScale = chartWidth / Math.max(data.length - 1, 1);
    const yScale = chartHeight / (maxPrice - minPrice);
    
    if (chartType === 'candlestick') {
      const candleWidth = Math.max(2, xScale * 0.7);
      
      return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + chartHeight * ratio;
            const price = maxPrice - (maxPrice - minPrice) * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#374151"
                  strokeWidth={0.5}
                  strokeDasharray="2,2"
                />
                <text
                  x={padding.left - 5}
                  y={y + 4}
                  textAnchor="end"
                  fill="#9CA3AF"
                  fontSize={10}
                >
                  ${price.toFixed(2)}
                </text>
              </g>
            );
          })}
          
          {data.map((point, index) => {
            const x = padding.left + index * xScale;
            const open = point.open || point.price;
            const close = point.close || point.price;
            const high = point.high || point.price;
            const low = point.low || point.price;
            
            const isBullish = close >= open;
            const color = isBullish ? positiveColor : negativeColor;
            
            const openY = padding.top + (maxPrice - open) * yScale;
            const closeY = padding.top + (maxPrice - close) * yScale;
            const highY = padding.top + (maxPrice - high) * yScale;
            const lowY = padding.top + (maxPrice - low) * yScale;
            
            const bodyTop = Math.min(openY, closeY);
            const bodyBottom = Math.max(openY, closeY);
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);
            
            return (
              <g key={index}>
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={color}
                  strokeWidth={1}
                />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  stroke={color}
                  strokeWidth={1}
                />
              </g>
            );
          })}
          
          {livePrice >= minPrice && livePrice <= maxPrice && (
            <line
              x1={padding.left}
              y1={padding.top + (maxPrice - livePrice) * yScale}
              x2={width - padding.right}
              y2={padding.top + (maxPrice - livePrice) * yScale}
              stroke="#F59E0B"
              strokeWidth={1}
              strokeDasharray="4,4"
              strokeOpacity={0.6}
            />
          )}
          
          {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((point, i, arr) => {
            const index = data.indexOf(point);
            const x = padding.left + index * xScale;
            return (
              <text
                key={index}
                x={x}
                y={height - padding.bottom + 15}
                textAnchor="middle"
                fill="#9CA3AF"
                fontSize={9}
              >
                {point.time}
              </text>
            );
          })}
        </svg>
      );
    }
    
    const pathData = data.map((point, index) => {
      const x = padding.left + index * xScale;
      const y = padding.top + (maxPrice - point.price) * yScale;
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');
    
    const areaPath = `${pathData} L ${padding.left + (data.length - 1) * xScale} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;
    
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight * ratio;
          const price = maxPrice - (maxPrice - minPrice) * ratio;
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#374151"
                strokeWidth={0.5}
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 5}
                y={y + 4}
                textAnchor="end"
                fill="#9CA3AF"
                fontSize={10}
              >
                ${price.toFixed(2)}
              </text>
            </g>
          );
        })}
        
        <path
          d={areaPath}
          fill={isPositive ? 'rgba(22, 163, 74, 0.2)' : 'rgba(239, 68, 68, 0.2)'}
        />
        
        <path
          d={pathData}
          fill="none"
          stroke={priceColor}
          strokeWidth={2}
        />
        
        {livePrice >= minPrice && livePrice <= maxPrice && (
          <line
            x1={padding.left}
            y1={padding.top + (maxPrice - livePrice) * yScale}
            x2={width - padding.right}
            y2={padding.top + (maxPrice - livePrice) * yScale}
            stroke="#F59E0B"
            strokeWidth={1}
            strokeDasharray="4,4"
            strokeOpacity={0.6}
          />
        )}
        
        {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((point, i, arr) => {
          const index = data.indexOf(point);
          const x = padding.left + index * xScale;
          return (
            <text
              key={index}
              x={x}
              y={height - padding.bottom + 15}
              textAnchor="middle"
              fill="#9CA3AF"
              fontSize={9}
            >
              {point.time}
            </text>
          );
        })}
      </svg>
    );
  };
  
  return (
    <div className={`bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] overflow-hidden ${className || ''}`}>
      <div className="px-3 py-2 border-b border-[var(--border-hairline)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[var(--text-high)] text-xs font-medium uppercase tracking-wide">
            Price Action (5m)
          </h3>
          <div className="flex items-center gap-1 bg-[var(--surface-1)] rounded-sm p-0.5">
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-0.5 text-micro rounded-sm transition-colors ${
                chartType === 'line'
                  ? 'bg-[var(--accent-yellow)] text-[var(--text-high)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-high)]'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('candlestick')}
              className={`px-2 py-0.5 text-micro rounded-sm transition-colors ${
                chartType === 'candlestick'
                  ? 'bg-[var(--accent-yellow)] text-[var(--text-high)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-high)]'
              }`}
            >
              Candles
            </button>
          </div>
          {marketStatus && (
            <span className={`text-micro px-2 py-0.5 rounded-sm ${
              marketStatus === 'open' 
                ? 'bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]'
                : 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'
            }`}>
              {marketStatus.toUpperCase()}
            </span>
          )}
          {!loading && data.length > 0 && (
            <span className="text-micro text-[var(--accent-positive)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-positive)] animate-pulse"></span>
              LIVE
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3 text-xs">
          <div>
            <span className="text-[var(--text-muted)] mr-1">Current:</span>
            <span className="text-[var(--text-high)] font-medium tabular-nums">
              ${livePrice.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] mr-1">Day:</span>
            <span className={`font-medium tabular-nums ${
              dailyChange >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
            }`}>
              {dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)}%
            </span>
          </div>
          {volume && (
            <div>
              <span className="text-[var(--text-muted)] mr-1">Vol:</span>
              <span className="text-[var(--text-high)] font-medium tabular-nums">
                {volume > 1000000 ? `${(volume / 1000000).toFixed(1)}M` : `${(volume / 1000).toFixed(0)}K`}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div ref={chartRef} className="p-3 bg-[#111827]" style={{ height: '250px', width: '100%' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
            Loading chart data...
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
            No chart data available
          </div>
        ) : (
          <div className="w-full h-full">
            {renderFallbackChart()}
          </div>
        )}
      </div>
    </div>
  );
}
