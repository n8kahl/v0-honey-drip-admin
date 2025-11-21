import { useMarketSession } from '../../../hooks/useMarketSession';
import { getSessionColor, getSessionDescription } from '../../../lib/marketSession';
import { cn } from '../../../lib/utils';
import { Clock, AlertCircle } from 'lucide-react';

interface HDMarketSessionBannerProps {
  className?: string;
  showDescription?: boolean;
}

export function HDMarketSessionBanner({ 
  className,
  showDescription = false,
}: HDMarketSessionBannerProps) {
  const { session, sessionState, loading, error, isStale } = useMarketSession();
  
  if (loading || !sessionState) {
    return null;
  }
  
  const colorClass = getSessionColor(session);
  const description = getSessionDescription(session);
  
  // Format timestamp
  const asOfTime = new Date(sessionState.asOf).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border",
      session === 'OPEN' && "bg-green-500/10 border-green-500/20",
      session === 'PRE' && "bg-yellow-500/10 border-yellow-500/20",
      session === 'POST' && "bg-blue-500/10 border-blue-500/20",
      session === 'CLOSED' && "bg-red-500/10 border-red-500/20",
      className
    )}>
      <div className={cn("flex items-center gap-2 flex-1")}>
        <div className={cn("w-2 h-2 rounded-full", colorClass)} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium", colorClass)}>
              {sessionState.label}
            </span>
            {isStale && (
              <AlertCircle className="w-3 h-3 text-yellow-500" title="Data may be stale" />
            )}
          </div>
          {showDescription && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
        <Clock className="w-3 h-3" />
        <span>as of {asOfTime}</span>
      </div>
      
      {error && (
        <div className="text-[10px] text-yellow-500" title={error}>
          Fallback
        </div>
      )}
    </div>
  );
}
