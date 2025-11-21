/**
 * HDGreeksWidget.tsx - Compact Greeks Display for Trade Cards
 *
 * Features:
 * - Inline Greeks display with color-coded values
 * - Freshness indicator
 * - IV percentile badge
 * - Hover tooltip with detailed info
 */

import { useGreeks, useAreGreeksStale } from '../../stores/marketDataStore';
import { getIVStats } from '../../lib/greeks/ivHistory';
import { Badge } from '../../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { Activity, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HDGreeksWidgetProps {
  ticker: string;
  className?: string;
  compact?: boolean; // If true, show only delta & IV
}

export function HDGreeksWidget({ ticker, className = '', compact = false }: HDGreeksWidgetProps) {
  const greeks = useGreeks(ticker);
  const isStale = useAreGreeksStale(ticker);
  const [ivStats, setIvStats] = useState<any>(null);

  useEffect(() => {
    if (greeks) {
      const stats = getIVStats(ticker);
      setIvStats(stats);
    }
  }, [greeks, ticker]);

  if (!greeks) {
    return (
      <div className={`text-xs text-[var(--text-muted)] italic ${className}`}>
        No Greeks data
      </div>
    );
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 ${className}`}>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-muted)]">Δ</span>
                <span className={`text-xs font-semibold ${greeks.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {greeks.delta.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-muted)]">IV</span>
                <span className="text-xs font-semibold text-[var(--text-high)]">
                  {(greeks.iv * 100).toFixed(1)}%
                </span>
              </div>
              {isStale ? (
                <AlertTriangle className="h-3 w-3 text-orange-500" />
              ) : (
                <Activity className="h-3 w-3 text-green-500" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="font-semibold">Greeks</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Delta: {greeks.delta.toFixed(3)}</div>
                <div>Gamma: {greeks.gamma.toFixed(4)}</div>
                <div>Theta: {greeks.theta.toFixed(2)}</div>
                <div>Vega: {greeks.vega.toFixed(3)}</div>
              </div>
              <div className="text-xs text-[var(--text-muted)] pt-1 border-t">
                {isStale ? '⚠️ Stale data' : '✓ Live'}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Delta */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--text-muted)]">Δ</span>
        <span className={`text-sm font-semibold ${greeks.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
          {greeks.delta.toFixed(3)}
        </span>
      </div>

      {/* Gamma */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--text-muted)]">Γ</span>
        <span className="text-sm font-semibold text-[var(--text-high)]">
          {greeks.gamma.toFixed(4)}
        </span>
        {greeks.gamma > 0.2 && <span className="text-xs text-yellow-500">⚡</span>}
      </div>

      {/* Theta */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--text-muted)]">Θ</span>
        <span className="text-sm font-semibold text-red-500">
          {greeks.theta.toFixed(2)}
        </span>
      </div>

      {/* Vega */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--text-muted)]">ν</span>
        <span className="text-sm font-semibold text-[var(--text-high)]">
          {greeks.vega.toFixed(3)}
        </span>
      </div>

      {/* IV with percentile */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--text-muted)]">IV</span>
        <span className="text-sm font-semibold text-[var(--text-high)]">
          {(greeks.iv * 100).toFixed(1)}%
        </span>
        {ivStats && (
          <Badge
            variant="outline"
            className={`text-xs ${ivStats.isHigh ? 'text-red-500' : ivStats.isLow ? 'text-green-500' : ''}`}
          >
            {ivStats.percentile.toFixed(0)}%ile
          </Badge>
        )}
      </div>

      {/* Freshness indicator */}
      {isStale ? (
        <Badge variant="outline" className="text-xs text-orange-500">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Stale
        </Badge>
      ) : greeks.isFresh ? (
        <Badge variant="outline" className="text-xs text-green-500">
          <Activity className="h-3 w-3 mr-1" />
          Live
        </Badge>
      ) : null}
    </div>
  );
}
