import { Trade, Challenge } from '../../types';
import { formatPrice, formatPercent, cn } from '../../lib/utils';

interface HDShareCardProps {
  trade: Trade;
  challenges?: Challenge[];
  className?: string;
}

export function HDShareCard({ trade, challenges = [], className }: HDShareCardProps) {
  const isProfit = (trade.movePercent || 0) >= 0;
  const duration = trade.entryTime && trade.exitTime ? formatDuration(trade.entryTime, trade.exitTime) : null;
  
  // Get challenge name if trade is associated with one
  const challengeName = trade.challenges.length > 0 
    ? challenges.find(c => c.id === trade.challenges[0])?.name 
    : null;
  
  // Format date/time
  const exitDateTime = trade.exitTime ? new Date(trade.exitTime) : null;
  const dateStr = exitDateTime ? exitDateTime.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }) : null;
  const timeStr = exitDateTime ? exitDateTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  }) : null;
  
  return (
    <div 
      className={cn(
        "relative w-full aspect-video rounded-lg overflow-hidden",
        "bg-gradient-to-br from-[var(--surface-1)] via-[var(--surface-2)] to-[var(--surface-1)]",
        "border border-[var(--border-hairline)]",
        className
      )}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[var(--brand-primary)] rounded-full blur-[120px]" />
        <div className={cn(
          "absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]",
          isProfit ? "bg-[var(--accent-positive)]" : "bg-[var(--accent-negative)]"
        )} />
      </div>
      
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-6 md:p-8">
        {/* Header - Logo & Branding */}
        <div className="flex items-center justify-between mb-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[var(--brand-primary)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.8"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-[var(--text-high)] font-medium text-sm">HoneyDrip</div>
              <div className="text-[var(--text-muted)] text-micro -mt-0.5">Network</div>
            </div>
          </div>
          
          {/* Challenge badge if applicable */}
          {challengeName && (
            <div className="px-2.5 py-1 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
              <span className="text-[var(--text-med)] text-micro uppercase tracking-wide">
                {challengeName}
              </span>
            </div>
          )}
        </div>
        
        {/* Main Trade Content */}
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Ticker & Contract */}
          <div>
            <div className="text-[var(--text-high)] text-2xl md:text-3xl font-medium mb-1">
              {trade.ticker}
            </div>
            <div className="text-[var(--text-muted)] text-sm md:text-base">
              {trade.contract.daysToExpiry}DTE ${trade.contract.strike}{trade.contract.type}
            </div>
          </div>
          
          {/* P&L - Hero Element */}
          <div className={cn(
            "relative px-6 py-3 rounded-lg",
            isProfit 
              ? "bg-[var(--accent-positive)]/20 border border-[var(--accent-positive)]/30"
              : "bg-[var(--accent-negative)]/20 border border-[var(--accent-negative)]/30"
          )}>
            {/* Glow effect */}
            <div className={cn(
              "absolute inset-0 rounded-lg blur-xl opacity-40",
              isProfit ? "bg-[var(--accent-positive)]" : "bg-[var(--accent-negative)]"
            )} />
            
            <div className="relative z-10">
              <div className={cn(
                "text-4xl md:text-5xl font-bold tabular-nums",
                isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
              )}>
                {formatPercent(trade.movePercent || 0)}
              </div>
            </div>
          </div>
          
          {/* Trade Details Grid */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-md pt-2">
            <div className="flex flex-col items-center">
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">
                Entry
              </div>
              <div className="text-[var(--text-high)] text-sm md:text-base tabular-nums">
                ${formatPrice(trade.entryPrice || 0)}
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">
                Exit
              </div>
              <div className="text-[var(--text-high)] text-sm md:text-base tabular-nums">
                ${formatPrice(trade.exitPrice || 0)}
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">
                Type
              </div>
              <div className={cn(
                "text-xs px-2 py-0.5 rounded uppercase tracking-wide",
                "bg-[var(--surface-2)] text-[var(--text-high)] border border-[var(--border-hairline)]"
              )}>
                {trade.tradeType}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer - Duration & Date */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--border-hairline)]/50">
          {duration && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[var(--text-muted)] text-xs">
                {duration}
              </span>
            </div>
          )}
          {dateStr && timeStr && (
            <div className="text-[var(--text-muted)] text-xs">
              {dateStr} • {timeStr}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(start: Date, end: Date) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours === 0) {
    if (minutes === 0) return 'Less than 1 minute';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  }
  
  if (minutes === 0) {
    if (hours === 1) return '1 hour';
    return `${hours} hours`;
  }
  
  if (hours === 1) {
    return minutes === 1 ? '1 hour 1 minute' : `1 hour ${minutes} minutes`;
  }
  
  return `${hours} hours ${minutes} minutes`;
}
