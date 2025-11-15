import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface HDSparklineProps {
  currentPrice: number;
  bars?: number;
  className?: string;
}

// Generate mock micro data for sparkline
function generateSparklineData(currentPrice: number, bars: number = 30) {
  const data = [];
  let price = currentPrice * 0.992; // Start slightly lower
  
  for (let i = 0; i < bars; i++) {
    // Simulate volatility with upward bias
    const change = (Math.random() - 0.45) * (currentPrice * 0.002);
    price = Math.max(price + change, currentPrice * 0.985);
    
    data.push({
      value: parseFloat(price.toFixed(2)),
    });
  }
  
  return data;
}

export function HDSparkline({ currentPrice, bars = 30, className }: HDSparklineProps) {
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
    <div className={`relative ${className || ''}`} style={{ height: '60px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`sparklineGradient-${isUptrend ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#sparklineGradient-${isUptrend ? 'up' : 'down'})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
