import React from 'react';
import { Calendar, TrendingUp, Award, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { DESIGN_TOKENS } from '../lib/designTokens';

interface WatchlistRecapCardProps {
  date: string; // e.g., "12/15"
  dayName: string; // e.g., "Friday"
  totalR: number; // Total R-multiple for the day
  winRate: number; // Win rate percentage
  tradeCount: number; // Number of trades
  onClick?: () => void;
}

export const WatchlistRecapCard: React.FC<WatchlistRecapCardProps> = ({
  date,
  dayName,
  totalR,
  winRate,
  tradeCount,
  onClick,
}) => {
  const rColor = totalR >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]';
  const bgGlow = totalR >= 0 ? 'shadow-green-500/20' : 'shadow-red-500/20';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-lg bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)]',
        'border border-[var(--border-strong)]',
        'hover:scale-[1.02] hover:shadow-lg transition-all duration-150 ease-out',
        bgGlow,
        DESIGN_TOKENS.tap.touch
      )}
    >
      <div className="flex items-center justify-between">
        {/* Left: Day Label + Date */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-[var(--brand-primary)]" />
          </div>
          <div className="flex flex-col items-start">
            <div className={cn('text-sm font-semibold', DESIGN_TOKENS.text.high)}>
              {dayName} Recap
            </div>
            <div className={cn('text-xs', DESIGN_TOKENS.text.muted)}>{date}</div>
          </div>
        </div>
        
        {/* Center: Stats */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center">
            <div className={cn('text-lg font-bold', rColor)}>
              {totalR >= 0 ? '+' : ''}{totalR.toFixed(1)}R
            </div>
            <div className={cn('text-[10px]', DESIGN_TOKENS.text.muted)}>Total</div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className={cn('text-lg font-bold', DESIGN_TOKENS.text.high)}>
              {winRate.toFixed(0)}%
            </div>
            <div className={cn('text-[10px]', DESIGN_TOKENS.text.muted)}>Win Rate</div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className={cn('text-lg font-bold', DESIGN_TOKENS.text.high)}>
              {tradeCount}
            </div>
            <div className={cn('text-[10px]', DESIGN_TOKENS.text.muted)}>Trades</div>
          </div>
        </div>
        
        {/* Right: Action Button */}
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[var(--brand-primary)]" />
          <span className={cn('text-sm font-medium', DESIGN_TOKENS.text.high)}>
            Review Setups
          </span>
          <ChevronRight className={cn('w-4 h-4', DESIGN_TOKENS.text.muted)} />
        </div>
      </div>
    </button>
  );
};
