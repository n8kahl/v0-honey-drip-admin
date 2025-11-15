import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus, Activity, DollarSign } from 'lucide-react';
import { TradeTape } from '../../lib/massive/options-advanced';

interface HDConfluenceChipsProps {
  tradeTape?: TradeTape | null;
  technicals?: {
    rsi?: number;
    macdSignal?: 'bullish' | 'bearish' | 'neutral';
    bollingerPosition?: 'upper' | 'middle' | 'lower';
    vwapPosition?: 'above' | 'below';
  };
  liquidity?: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    spreadPercent: number;
  };
  className?: string;
}

export function HDConfluenceChips({ tradeTape, technicals, liquidity, className }: HDConfluenceChipsProps) {
  const chips: Array<{
    label: string;
    icon: React.ReactNode;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    value?: string;
  }> = [];
  
  // Trade Flow Chip
  if (tradeTape) {
    const { sentiment, buyPressure } = tradeTape;
    chips.push({
      label: 'Flow',
      icon: sentiment.includes('buy') ? <TrendingUp className="w-3 h-3" /> : 
            sentiment.includes('sell') ? <TrendingDown className="w-3 h-3" /> : 
            <Minus className="w-3 h-3" />,
      sentiment: sentiment.includes('buy') ? 'bullish' : 
                 sentiment.includes('sell') ? 'bearish' : 'neutral',
      value: `${Math.round(buyPressure)}% buy`,
    });
  }
  
  // RSI Chip
  if (technicals?.rsi !== undefined) {
    const rsi = technicals.rsi;
    chips.push({
      label: 'RSI',
      icon: <Activity className="w-3 h-3" />,
      sentiment: rsi > 70 ? 'bearish' : rsi < 30 ? 'bullish' : 'neutral',
      value: rsi.toFixed(0),
    });
  }
  
  // MACD Chip
  if (technicals?.macdSignal) {
    chips.push({
      label: 'MACD',
      icon: technicals.macdSignal === 'bullish' ? <TrendingUp className="w-3 h-3" /> :
            technicals.macdSignal === 'bearish' ? <TrendingDown className="w-3 h-3" /> :
            <Minus className="w-3 h-3" />,
      sentiment: technicals.macdSignal === 'bullish' ? 'bullish' :
                 technicals.macdSignal === 'bearish' ? 'bearish' : 'neutral',
    });
  }
  
  // Liquidity Chip
  if (liquidity) {
    chips.push({
      label: 'Liquidity',
      icon: <DollarSign className="w-3 h-3" />,
      sentiment: liquidity.quality === 'excellent' || liquidity.quality === 'good' ? 'bullish' :
                 liquidity.quality === 'poor' ? 'bearish' : 'neutral',
      value: liquidity.quality,
    });
  }
  
  if (chips.length === 0) return null;
  
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {chips.map((chip, idx) => (
        <div
          key={idx}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
            chip.sentiment === 'bullish' && 'bg-green-500/10 text-green-500 border border-green-500/20',
            chip.sentiment === 'bearish' && 'bg-red-500/10 text-red-500 border border-red-500/20',
            chip.sentiment === 'neutral' && 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
          )}
        >
          {chip.icon}
          <span>{chip.label}</span>
          {chip.value && (
            <span className="opacity-80">· {chip.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
