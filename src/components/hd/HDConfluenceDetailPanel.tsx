import { cn } from '../../lib/utils';
import {
  MassiveTrendMetrics,
  MassiveVolatilityMetrics,
  MassiveLiquidityMetrics,
} from '../../services/massiveClient';

interface HDConfluenceDetailPanelProps {
  ticker: string;
  direction: 'call' | 'put';
  loading?: boolean;
  error?: string;
  trend?: MassiveTrendMetrics;
  volatility?: MassiveVolatilityMetrics;
  liquidity?: MassiveLiquidityMetrics;
  className?: string;
}

export function HDConfluenceDetailPanel({
  ticker,
  direction,
  loading,
  error,
  trend,
  volatility,
  liquidity,
  className
}: HDConfluenceDetailPanelProps) {
  // Use real data if available, otherwise fall back to neutral values
  const trendScore = trend?.trendScore ?? 50;
  const volPercentile = volatility?.ivPercentile ?? 50;
  const liqScore = liquidity?.liquidityScore ?? 50;
  const volume = liquidity?.volume ?? 0;
  const openInterest = liquidity?.openInterest ?? 0;
  const spreadPct = liquidity?.spreadPct ?? 0;
  
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
  
  // Volatility chip logic
  const getVolatilityLabel = () => {
    if (volPercentile >= 70) return 'Elevated';
    if (volPercentile >= 30) return 'Normal';
    return 'Calm';
  };
  
  const getVolatilityBg = () => {
    if (volPercentile >= 70) return 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/20';
    return 'bg-[var(--surface-3)] border-[var(--border-hairline)]';
  };
  
  const getVolatilityText = () => {
    if (volPercentile >= 70) return 'text-[var(--brand-primary)]';
    return 'text-[var(--text-med)]';
  };
  
  // Liquidity chip logic
  const getLiquidityLabel = () => {
    if (liqScore >= 70) return 'Good';
    if (liqScore >= 40) return 'Fair';
    return 'Thin';
  };
  
  const getLiquidityBg = () => {
    if (liqScore >= 70) return 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/20';
    if (liqScore >= 40) return 'bg-[var(--surface-3)] border-[var(--border-hairline)]';
    return 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/20';
  };
  
  const getLiquidityText = () => {
    if (liqScore >= 70) return 'text-[var(--accent-positive)]';
    if (liqScore >= 40) return 'text-[var(--text-med)]';
    return 'text-[var(--brand-primary)]';
  };
  
  const isAligned = direction === 'call' ? trendScore >= 60 : trendScore <= 40;
  
  return (
    <div className={cn('space-y-3', className)}>
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
      
      {/* Detailed Metrics */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Index Momentum Card */}
          <div className="p-3 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)]">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs text-[var(--text-high)] font-semibold">Index Momentum – {ticker}</h3>
              <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--surface-2)] text-[var(--text-faint)] border border-[var(--border-hairline)]">
                Last 30min
              </span>
            </div>
            
              <div className="space-y-1.5 text-[11px] text-[var(--text-muted)]">
                <p>
                  {trend
                    ? trend.description
                    : 'Trend metrics are loading from Massive…'}
                </p>
              </div>
            
            <div className="mt-2.5 pt-2.5 border-t border-[var(--border-hairline)]">
              <p className={cn('text-[11px]', isAligned ? 'text-[var(--accent-positive)]' : 'text-[var(--brand-primary)]')}>
                {isAligned 
                  ? `✓ Momentum aligned with ${direction} direction`
                  : `⚠ Momentum may not support ${direction} direction`
                }
              </p>
            </div>
          </div>
          
          {/* Contract Health Card */}
          <div className="p-3 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)]">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs text-[var(--text-high)] font-semibold">Contract Health</h3>
            </div>
            
            {/* Pricing & Volatility */}
            <div className="mb-2.5 pb-2.5 border-b border-[var(--border-hairline)]">
              <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide mb-1.5">Pricing & Volatility</div>
              <div className="space-y-1">
                {volatility && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-muted)]">IV Percentile</span>
                    <span className="text-[var(--text-high)] font-medium tabular-nums">
                      {volatility.ivPercentile.toFixed(0)} ·{' '}
                      <span className={volatility.ivPercentile >= 70 ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}>
                        {getVolatilityLabel()}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Liquidity */}
            <div>
              <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide mb-1.5">Liquidity</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">Volume</span>
                  <span className="text-[var(--text-high)] font-medium tabular-nums">{volume.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">Open Interest</span>
                  <span className="text-[var(--text-high)] tabular-nums">{openInterest.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">Spread</span>
                  <span className={cn(
                    'font-medium tabular-nums',
                    spreadPct < 1 ? 'text-[var(--accent-positive)]' : spreadPct < 3 ? 'text-[var(--brand-primary)]' : 'text-[var(--accent-negative)]'
                  )}>
                    {spreadPct.toFixed(1)}% <span className="text-[var(--text-muted)] font-normal">({getLiquidityLabel()})</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="text-[var(--text-faint)] text-[10px]">
        {error ? (
          <span className="text-[var(--accent-negative)]">Confluence unavailable</span>
        ) : loading ? (
          'Loading confluence data...'
        ) : (
          'Powered by Massive'
        )}
      </div>
    </div>
  );
}
