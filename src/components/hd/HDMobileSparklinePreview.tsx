import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';

interface HDMobileSparklinePreviewProps {
  ticker: string;
  currentPrice: number;
  change?: number;
  contract?: string;
  bars?: number;
  onTap?: () => void;
  className?: string;
}

// Generate mock micro data for mobile sparkline
function generateSparklineData(currentPrice: number, bars: number = 25) {
  const data = [];
  let price = currentPrice * 0.992; // Start slightly lower
  
  for (let i = 0; i < bars; i++) {
    // Simulate volatility with slight upward bias
    const change = (Math.random() - 0.46) * (currentPrice * 0.002);
    price = Math.max(price + change, currentPrice * 0.985);
    
    data.push({
      value: parseFloat(price.toFixed(2)),
    });
  }
  
  return data;
}

export function HDMobileSparklinePreview({ 
  ticker, 
  currentPrice, 
  change = 0,
  contract = '',
  bars = 25,
  onTap,
  className 
}: HDMobileSparklinePreviewProps) {
  const data = useMemo(() => generateSparklineData(currentPrice, bars), [currentPrice, bars]);
  
  // Calculate trend
  const firstPrice = data[0].value;
  const lastPrice = data[data.length - 1].value;
  const isUptrend = lastPrice >= firstPrice;
  
  // Get CSS variable colors
  const positiveColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-positive').trim() || '#16A34A';
  const negativeColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-negative').trim() || '#EF4444';
  const strokeColor = isUptrend ? positiveColor : negativeColor;
  
  return (
    <div 
      onClick={onTap}
      className={cn(
        'bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4 active:bg-[var(--surface-3)] transition-colors',
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
          <div className={cn(
            'text-xs tabular-nums',
            change >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
          )}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        </div>
      </div>
      
      {/* Sparkline Chart */}
      <div style={{ height: '60px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id={`mobileSparklineGradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
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
      </div>
    </div>
  );
}
