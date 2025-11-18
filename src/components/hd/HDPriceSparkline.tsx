import { useEffect, useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { massiveClient } from '../../lib/massive/client';

interface PricePoint {
  time: number;
  price: number;
}

interface HDPriceSparklineProps {
  ticker: string;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  currentPrice?: number;
  height?: number;
  className?: string;
}

export function HDPriceSparkline({
  ticker,
  entryPrice,
  targetPrice,
  stopLoss,
  currentPrice,
  height = 120,
  className = '',
}: HDPriceSparklineProps) {
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // For now, use a simple price visualization based on current price
    // Future: fetch real intraday bars when API is more reliable
    if (currentPrice && entryPrice) {
      // Create a simple trend line from entry to current
      const now = Date.now();
      const entryTime = now - 3600000; // 1 hour ago as estimate
      
      setPoints([
        { time: entryTime, price: entryPrice },
        { time: now, price: currentPrice },
      ]);
      setLoading(false);
      setError(false);
    } else if (currentPrice) {
      // Just show current price as single point
      setPoints([{ time: Date.now(), price: currentPrice }]);
      setLoading(false);
      setError(false);
    } else {
      setLoading(false);
      setError(true);
    }
  }, [ticker, currentPrice, entryPrice]);

  if (loading) {
    return (
      <div className={cn('rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] animate-pulse', className)} style={{ height }}>
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">
          Loading trend...
        </div>
      </div>
    );
  }

  if (error || points.length === 0) {
    return (
      <div className={cn('rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]', className)} style={{ height }}>
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">
          Price data unavailable
        </div>
      </div>
    );
  }

  // Calculate price range with padding
  const prices = points.map(p => p.price);
  const allPrices = [
    ...prices,
    ...(entryPrice ? [entryPrice] : []),
    ...(targetPrice ? [targetPrice] : []),
    ...(stopLoss ? [stopLoss] : []),
  ].filter(Boolean);

  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1 || 1;

  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;
  const yRange = yMax - yMin;

  // SVG dimensions
  const width = 400;
  const chartHeight = height - 40; // Leave room for labels
  const marginLeft = 50;
  const marginRight = 10;
  const marginTop = 10;
  const marginBottom = 10;
  const chartWidth = width - marginLeft - marginRight;

  // Scale functions
  const scaleY = (price: number) => {
    return chartHeight - ((price - yMin) / yRange) * chartHeight + marginTop;
  };

  const scaleX = (index: number) => {
    return marginLeft + (index / (points.length - 1 || 1)) * chartWidth;
  };

  // Generate sparkline path
  const linePath = points
    .map((point, i) => {
      const x = scaleX(i);
      const y = scaleY(point.price);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // Determine trend
  const firstPrice = points[0]?.price || 0;
  const lastPrice = points[points.length - 1]?.price || 0;
  const isPositive = lastPrice >= firstPrice;

  return (
    <div className={cn('rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] p-2', className)}>
      <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Entry Price Line */}
        {entryPrice && (
          <>
            <line
              x1={marginLeft}
              y1={scaleY(entryPrice)}
              x2={width - marginRight}
              y2={scaleY(entryPrice)}
              stroke="var(--text-muted)"
              strokeWidth="1"
              strokeDasharray="4 2"
              opacity="0.5"
            />
            <text
              x={marginLeft - 5}
              y={scaleY(entryPrice)}
              textAnchor="end"
              fontSize="10"
              fill="var(--text-muted)"
              dominantBaseline="middle"
            >
              Entry
            </text>
          </>
        )}

        {/* Target Price Line */}
        {targetPrice && (
          <>
            <line
              x1={marginLeft}
              y1={scaleY(targetPrice)}
              x2={width - marginRight}
              y2={scaleY(targetPrice)}
              stroke="var(--accent-positive)"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              opacity="0.6"
            />
            <text
              x={marginLeft - 5}
              y={scaleY(targetPrice)}
              textAnchor="end"
              fontSize="10"
              fill="var(--accent-positive)"
              dominantBaseline="middle"
            >
              TP
            </text>
          </>
        )}

        {/* Stop Loss Line */}
        {stopLoss && (
          <>
            <line
              x1={marginLeft}
              y1={scaleY(stopLoss)}
              x2={width - marginRight}
              y2={scaleY(stopLoss)}
              stroke="var(--accent-negative)"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              opacity="0.6"
            />
            <text
              x={marginLeft - 5}
              y={scaleY(stopLoss)}
              textAnchor="end"
              fontSize="10"
              fill="var(--accent-negative)"
              dominantBaseline="middle"
            >
              SL
            </text>
          </>
        )}

        {/* Sparkline */}
        <path
          d={linePath}
          fill="none"
          stroke={isPositive ? 'var(--accent-positive)' : 'var(--accent-negative)'}
          strokeWidth="2"
          opacity="0.8"
        />

        {/* Current price indicator */}
        {points.length > 0 && (
          <circle
            cx={scaleX(points.length - 1)}
            cy={scaleY(lastPrice)}
            r="3"
            fill={isPositive ? 'var(--accent-positive)' : 'var(--accent-negative)'}
          />
        )}

        {/* Y-axis labels */}
        <text
          x={marginLeft - 5}
          y={scaleY(maxPrice)}
          textAnchor="end"
          fontSize="10"
          fill="var(--text-faint)"
          dominantBaseline="middle"
        >
          ${maxPrice.toFixed(2)}
        </text>
        <text
          x={marginLeft - 5}
          y={scaleY(minPrice)}
          textAnchor="end"
          fontSize="10"
          fill="var(--text-faint)"
          dominantBaseline="middle"
        >
          ${minPrice.toFixed(2)}
        </text>
      </svg>

      {/* Footer info */}
      <div className="flex items-center justify-between px-2 text-[10px] text-[var(--text-faint)] mt-1">
        <span>Last hour</span>
        <span className={cn(
          'font-medium',
          isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
        )}>
          {isPositive ? '+' : ''}{((lastPrice - firstPrice) / firstPrice * 100).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
