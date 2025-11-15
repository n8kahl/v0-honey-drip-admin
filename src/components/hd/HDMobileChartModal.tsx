import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { X } from 'lucide-react';
import { Dialog, DialogContent } from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface HDMobileChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  currentPrice: number;
  dailyChange?: number;
}

// Generate mock 5-minute candle data for mobile
function generateMobile5MinData(currentPrice: number, bars: number = 35) {
  const data = [];
  const startTime = new Date();
  startTime.setHours(9, 30, 0, 0); // Market open
  
  let price = currentPrice * 0.995; // Start slightly lower
  
  for (let i = 0; i < bars; i++) {
    const time = new Date(startTime);
    time.setMinutes(startTime.getMinutes() + (i * 5));
    
    // Simulate some volatility
    const change = (Math.random() - 0.48) * (currentPrice * 0.003);
    price = Math.max(price + change, currentPrice * 0.98);
    
    // Add EMAs
    const ema9 = price * (0.998 + Math.random() * 0.004);
    const ema21 = price * (0.996 + Math.random() * 0.008);
    
    data.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      price: parseFloat(price.toFixed(2)),
      ema9: parseFloat(ema9.toFixed(2)),
      ema21: parseFloat(ema21.toFixed(2)),
    });
  }
  
  return data;
}

export function HDMobileChartModal({ 
  isOpen, 
  onClose, 
  ticker, 
  currentPrice,
  dailyChange = 0
}: HDMobileChartModalProps) {
  const data = useMemo(() => generateMobile5MinData(currentPrice), [currentPrice]);
  
  const minPrice = Math.min(...data.map(d => d.price));
  const maxPrice = Math.max(...data.map(d => d.price));
  const priceRange = maxPrice - minPrice;
  
  const isPositive = dailyChange >= 0;
  
  // Get CSS variable colors
  const positiveColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-positive').trim() || '#16A34A';
  const negativeColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-negative').trim() || '#EF4444';
  const emaPrimaryColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-ema-primary').trim() || '#9CA3AF';
  const emaSecondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-ema-secondary').trim() || '#6B7280';
  const priceColor = isPositive ? positiveColor : negativeColor;
  
  if (!isOpen) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full w-full h-[80vh] p-0 bg-[var(--surface-1)] border-[var(--border-hairline)] rounded-t-[var(--radius-lg)] rounded-b-none">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--surface-2)]">
          <div>
            <h2 className="text-[var(--text-high)] font-medium">{ticker}</h2>
            <div className="text-[var(--text-muted)] text-xs">5-Minute Chart</div>
          </div>
          
          <div className="text-right">
            <div className="text-[var(--text-high)] tabular-nums font-medium">
              ${currentPrice.toFixed(2)}
            </div>
            <div className={cn(
              'text-xs tabular-nums',
              isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
            )}>
              {isPositive ? '+' : ''}{dailyChange.toFixed(2)}%
            </div>
          </div>
        </div>
        
        {/* Chart */}
        <div className="p-4" style={{ height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="mobilePriceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={priceColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={priceColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              
              <XAxis 
                dataKey="time" 
                stroke="var(--text-faint)"
                fontSize={9}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-hairline)' }}
                interval="preserveStartEnd"
                tick={{ fill: 'var(--text-faint)' }}
              />
              
              <YAxis 
                domain={[minPrice - priceRange * 0.1, maxPrice + priceRange * 0.1]}
                stroke="var(--text-faint)"
                fontSize={9}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-hairline)' }}
                tick={{ fill: 'var(--text-faint)' }}
                width={35}
              />
              
              {/* Reference line at current price */}
              <ReferenceLine 
                y={currentPrice} 
                stroke="var(--brand-primary)" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
              />
              
              {/* EMAs - very subtle */}
              <Area
                type="monotone"
                dataKey="ema21"
                stroke={emaSecondaryColor}
                strokeWidth={0.5}
                fill="none"
                dot={false}
                strokeOpacity={0.3}
              />
              
              <Area
                type="monotone"
                dataKey="ema9"
                stroke={emaPrimaryColor}
                strokeWidth={0.5}
                fill="none"
                dot={false}
                strokeOpacity={0.4}
              />
              
              {/* Main price line */}
              <Area
                type="monotone"
                dataKey="price"
                stroke={priceColor}
                strokeWidth={2}
                fill="url(#mobilePriceGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-[var(--border-hairline)] bg-[var(--surface-2)] text-center">
          <p className="text-[var(--text-faint)] text-micro">
            Showing last ~3 hours of 5-minute candles
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
