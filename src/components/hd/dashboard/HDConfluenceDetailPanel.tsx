import { cn } from '../../../lib/utils';
import { useMarketDataStore } from '../../../stores/marketDataStore';

interface HDConfluenceDetailPanelProps {
  ticker: string;
  direction: 'call' | 'put';
  className?: string;
  compact?: boolean; // Compact mode for active trades
  tpProgress?: number; // TP proximity (0-1) for coaching context
  isPositive?: boolean; // Current P&L status
}

export function HDConfluenceDetailPanel({
  ticker,
  direction,
  className,
  compact = false,
  tpProgress,
  isPositive,
}: HDConfluenceDetailPanelProps) {
  // Get confluence data from marketDataStore
  const confluence = useMarketDataStore((state) => state.symbols[ticker]?.confluence);
  const isStale = useMarketDataStore((state) => {
    const lastUpdated = state.symbols[ticker]?.lastUpdated;
    if (!lastUpdated) return true;
    return Date.now() - lastUpdated > 10000; // 10s stale threshold
  });
  
  const loading = !confluence;
  const error = isStale ? 'Data stale' : undefined;
  
  // Map marketDataStore's ConfluenceScore to UI display values
  const trendScore = confluence?.trend ?? 50;
  const volPercentile = confluence?.volatility ?? 50;
  const liqScore = confluence?.volume ?? 50; // Using volume as liquidity proxy
  const volume = 0; // Raw volume not available in ConfluenceScore
  const openInterest = 0; // Not available in ConfluenceScore
  const spreadPct = 0; // Not available in ConfluenceScore
  
  // Generate trend description from ConfluenceScore
  const trend = confluence ? {
    trendScore: confluence.trend,
    description: `Multi-timeframe trend: ${confluence.trend.toFixed(0)}% strength. ${
      confluence.trend >= 70 ? 'Strong alignment across timeframes.' :
      confluence.trend >= 40 ? 'Mixed signals across timeframes.' :
      'Weak trend alignment.'
    }`
  } : undefined;
  
  // Trend chip logic
  const getTrendLabel = () => {
    if (trendScore >= 70) return direction === 'call' ? 'Bullish' : 'Bearish';
    if (trendScore >= 40) return 'Mixed';
    return direction === 'call' ? 'Bearish' : 'Bullish';
  };
  
  const getTrendBg = () => {
    if (trendScore >= 70) return 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/20';
    if (trendScore >= 40) return 'bg-[var(--surface-3)] border-[var(--border-hairline)]';
    return 'bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/20';
  };
  
  const getTrendText = () => {
    if (trendScore >= 70) return 'text-[var(--accent-positive)]';
    if (trendScore >= 40) return 'text-[var(--text-med)]';
    return 'text-[var(--accent-negative)]';
  };
  
  // Volatility chip logic - use warning semantics
  const getVolatilityLabel = () => {
    if (volPercentile >= 70) return 'Elevated';
    if (volPercentile >= 30) return 'Normal';
    return 'Calm';
  };
  
  const getVolatilityBg = () => {
    if (volPercentile >= 70) return 'bg-amber-500/10 border-amber-500/30';
    if (volPercentile <= 30) return 'bg-blue-500/10 border-blue-500/20';
    return 'bg-[var(--surface-3)] border-[var(--border-hairline)]';
  };
  
  const getVolatilityText = () => {
    if (volPercentile >= 70) return 'text-amber-400';
    if (volPercentile <= 30) return 'text-blue-400';
    return 'text-[var(--text-med)]';
  };
  
  // Liquidity chip logic - use proper warning semantics
  const getLiquidityLabel = () => {
    if (liqScore >= 70) return 'Good';
    if (liqScore >= 40) return 'Fair';
    return 'Thin';
  };
  
  const getLiquidityBg = () => {
    if (liqScore >= 70) return 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/20';
    if (liqScore >= 40) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30';
  };
  
  const getLiquidityText = () => {
    if (liqScore >= 70) return 'text-[var(--accent-positive)]';
    if (liqScore >= 40) return 'text-amber-400';
    return 'text-[var(--accent-negative)]';
  };
  
  const isAligned = direction === 'call' ? trendScore >= 60 : trendScore <= 40;
  
  // Coaching logic
  const getCoachingMessage = () => {
    if (loading) return null;
    if (error) return null;
    
    if (tpProgress && tpProgress > 0.7) {
      // Near TP - evaluate if conditions support holding vs taking profit
      if (isAligned && liqScore >= 60) {
        return '✓ Strong momentum + liquidity support holding for full TP';
      } else if (!isAligned || liqScore < 40) {
        return '⚠ Consider trimming: momentum fading or liquidity concerns';
      }
      return '→ Conditions mixed near TP - watch closely';
    }
    
    if (isPositive && !isAligned) {
      return '⚠ Profitable but momentum not aligned - consider taking gains';
    }
    
    if (!isPositive && !isAligned) {
      return '⚠ Risk elevated: momentum and P&L both unfavorable';
    }
    
    if (isAligned && liqScore >= 60) {
      return '✓ Strong setup: momentum aligned with good liquidity';
    }
    
    return null;
  };
  
  const coachingMessage = getCoachingMessage();
  
  return (
    <div className={cn('space-y-2.5', compact && 'space-y-2', className)}>
      {/* Coaching Header - Only in compact/active mode */}
      {compact && coachingMessage && (
        <div className={cn(
          'px-3 py-2 rounded-[var(--radius)] border text-xs font-medium',
          coachingMessage.startsWith('✓') 
            ? 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30 text-[var(--accent-positive)]'
            : coachingMessage.startsWith('⚠')
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-[var(--surface-3)] border-[var(--border-hairline)] text-[var(--text-med)]'
        )}>
          {coachingMessage}
        </div>
      )}
      
      {/* Summary Chips */}
      <div className="grid grid-cols-3 gap-2">
        {/* Trend chip */}
        <div className={cn(
          'rounded-[var(--radius)] border p-2.5',
          loading ? 'animate-pulse' : getTrendBg()
        )}>
          <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-1">
            Trend
          </div>
          <div className={cn('text-xs font-medium', getTrendText())}>
            {loading ? 'Loading...' : error ? 'N/A' : getTrendLabel()}
          </div>
        </div>
        
        {/* Volatility chip */}
        <div className={cn(
          'rounded-[var(--radius)] border p-2.5',
          loading ? 'animate-pulse' : getVolatilityBg()
        )}>
          <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-1">
            Volatility
          </div>
          <div className={cn('text-xs font-medium', getVolatilityText())}>
            {loading ? 'Loading...' : error ? 'N/A' : getVolatilityLabel()}
          </div>
        </div>
        
        {/* Liquidity chip */}
        <div className={cn(
          'rounded-[var(--radius)] border p-2.5',
          loading ? 'animate-pulse' : getLiquidityBg()
        )}>
          <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-1">
            Liquidity
          </div>
          <div className={cn('text-xs font-medium', getLiquidityText())}>
            {loading ? 'Loading...' : error ? 'N/A' : getLiquidityLabel()}
          </div>
        </div>
      </div>
      
      {/* Detailed Metrics - MTF Analysis + Contract Health */}
      {!loading && !error && !compact && (
        <div className="space-y-2.5">
          {/* MTF Analysis Card - Clearer Presentation */}
          <div className="p-3 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs text-[var(--text-high)] font-semibold uppercase tracking-wide">Multi-Timeframe Analysis</h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--surface-2)] text-[var(--text-faint)] border border-[var(--border-hairline)]">
                {ticker}
              </span>
            </div>
            
            <div className="text-[11px] text-[var(--text-muted)] leading-relaxed mb-2.5">
              {trend?.description || 'Analyzing trend across 5m, 15m, 1h timeframes…'}
            </div>
            
            <div className="pt-2 border-t border-[var(--border-hairline)]">
              <div className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium',
                isAligned 
                  ? 'bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]'
                  : 'bg-amber-500/10 text-amber-400'
              )}>
                <span>{isAligned ? '✓' : '⚠'}</span>
                <span>
                  {isAligned 
                    ? `Momentum aligned with ${direction === 'call' ? 'calls' : 'puts'}`
                    : `Momentum not aligned with ${direction === 'call' ? 'calls' : 'puts'}`
                  }
                </span>
              </div>
            </div>
          </div>
          
          {/* Contract Health Card */}
          <div className="p-3 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)]">
            <h3 className="text-xs text-[var(--text-high)] font-semibold mb-2.5 uppercase tracking-wide">Contract Health</h3>
            
            <div className="space-y-2 text-[11px]">
              {volatility && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[var(--text-muted)]">IV Rank</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-high)] font-medium tabular-nums">
                      {volatility.ivPercentile.toFixed(0)}%
                    </span>
                    <span className={cn('text-[10px] font-medium', getVolatilityText())}>
                      {getVolatilityLabel()}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--text-muted)]">Volume</span>
                <span className="text-[var(--text-high)] tabular-nums font-medium">
                  {volume > 0 ? volume.toLocaleString() : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--text-muted)]">Open Interest</span>
                <span className="text-[var(--text-high)] tabular-nums font-medium">
                  {openInterest > 0 ? openInterest.toLocaleString() : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--text-muted)]">Bid/Ask Spread</span>
                <span className={cn(
                  'font-medium tabular-nums',
                  spreadPct === 0 ? 'text-[var(--text-muted)]' :
                  spreadPct < 1 ? 'text-[var(--accent-positive)]' : 
                  spreadPct < 3 ? 'text-amber-400' : 
                  'text-[var(--accent-negative)]'
                )}>
                  {spreadPct > 0 ? `${spreadPct.toFixed(2)}%` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Compact Metrics Row - Active trade mode */}
      {!loading && !error && compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] px-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-faint)]">IV</span>
            <span className={cn('font-medium tabular-nums', getVolatilityText())}>
              {volatility?.ivPercentile.toFixed(0) || '—'}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-faint)]">Vol</span>
            <span className="text-[var(--text-med)] tabular-nums">{volume.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-faint)]">OI</span>
            <span className="text-[var(--text-med)] tabular-nums">{openInterest.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-faint)]">Spread</span>
            <span className={cn(
              'font-medium tabular-nums',
              spreadPct < 1 ? 'text-[var(--accent-positive)]' : spreadPct < 3 ? 'text-amber-400' : 'text-[var(--accent-negative)]'
            )}>
              {spreadPct.toFixed(2)}%
            </span>
          </div>
          {isAligned ? (
            <div className="flex items-center gap-1 text-[var(--accent-positive)]">
              <span>✓</span>
              <span>Aligned</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-400">
              <span>⚠</span>
              <span>Not aligned</span>
            </div>
          )}
        </div>
      )}
      
      {/* Error/Loading States */}
      {error && (
        <div className="text-xs text-[var(--accent-negative)] px-2">
          ⚠ Confluence data unavailable
        </div>
      )}
      {loading && (
        <div className="text-xs text-[var(--text-muted)] px-2 animate-pulse">
          Loading market conditions...
        </div>
      )}
    </div>
  );
}
