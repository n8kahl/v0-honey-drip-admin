import { HDChip } from '../common/HDChip';
import { cn } from '../../../lib/utils';
import { useMarketDataStore } from '../../../stores/marketDataStore';

interface HDConfluencePanelProps {
  ticker: string;
  tradeState: 'LOADED' | 'ENTERED' | 'EXITED';
  direction: 'call' | 'put';
}

export function HDConfluencePanel({
  ticker,
  tradeState,
  direction,
}: HDConfluencePanelProps) {
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
  const trendDescription = confluence ? `${confluence.trend.toFixed(0)}% trend strength` : 'Loading...';
  
  const volPercentile = confluence?.volatility ?? 50;
  const volDescription = confluence ? `${confluence.volatility.toFixed(0)}% volatility` : 'Loading...';
  
  const liqScore = confluence?.volume ?? 50; // Using volume as liquidity proxy
  const liqDescription = confluence ? `${confluence.volume.toFixed(0)}% volume` : 'Loading...';
  const spreadPct = 0; // Not available in ConfluenceScore
  const volume = 0; // Raw volume not available
  const openInterest = 0; // Not available in ConfluenceScore
  
  // Trend chip logic
  const getTrendLabel = () => {
    if (trendScore >= 70) return direction === 'call' ? 'Bullish' : 'Bearish';
    if (trendScore >= 40) return 'Mixed';
    return direction === 'call' ? 'Bearish' : 'Bullish';
  };
  
  const getTrendIndicators = () => {
    if (trendScore >= 70) return '3/3';
    if (trendScore >= 40) return '2/3';
    return '1/3';
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
    if (volPercentile >= 30) return 'bg-[var(--surface-3)] border-[var(--border-hairline)]';
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
  
  const getLiquidityDetail = () => {
    if (liqScore >= 70) return 'Tight spread';
    if (liqScore >= 40) return 'Moderate spread';
    return 'Wide spread';
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
  
  // State pill
  const getStatePill = () => {
    if (tradeState === 'LOADED') {
      return (
        <HDChip variant="neutral" size="sm" className="uppercase tracking-wide">
          Idea
        </HDChip>
      );
    }
    if (tradeState === 'ENTERED') {
      return (
        <HDChip variant="custom" size="sm" color="var(--bg-base)" bg="var(--brand-primary)" className="uppercase tracking-wide">
          Active
        </HDChip>
      );
    }
    return (
      <HDChip variant="neutral" size="sm" className="uppercase tracking-wide">
        Closed
      </HDChip>
    );
  };
  
  return (
    <div className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-0.5">
            Confluence
          </div>
          <div className="text-[var(--text-high)] text-sm">
            {ticker} · {direction === 'call' ? 'Call bias' : 'Put bias'}
          </div>
        </div>
        {getStatePill()}
      </div>
      
      {/* Chips */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Trend chip */}
        <div className={cn(
          'rounded-[var(--radius)] border p-2.5',
          loading ? 'animate-pulse' : getTrendBg()
        )}>
          <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">
            Trend
          </div>
          <div className={cn('text-xs', getTrendText())}>
            {loading ? 'Loading...' : error ? 'N/A' : trendDescription}
          </div>
        </div>
        
        {/* Volatility chip */}
        <div className={cn(
          'rounded-[var(--radius)] border p-2.5',
          loading ? 'animate-pulse' : getVolatilityBg()
        )}>
          <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">
            Volatility
          </div>
          <div className={cn('text-xs', getVolatilityText())}>
            {loading ? 'Loading...' : error ? 'N/A' : volDescription}
          </div>
        </div>
        
        {/* Liquidity chip */}
        <div className={cn(
          'rounded-[var(--radius)] border p-2.5',
          loading ? 'animate-pulse' : getLiquidityBg()
        )}>
          <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1">
            Liquidity
          </div>
          <div className={cn('text-xs', getLiquidityText())}>
            {loading ? 'Loading...' : error ? 'N/A' : liqDescription}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-[var(--text-muted)] text-xs">
        {error ? (
          <span className="text-[var(--accent-negative)]">Confluence unavailable ({error})</span>
        ) : loading ? (
          'Loading confluence data from Massive...'
        ) : (
          'Confluence powered by Massive (read-only)'
        )}
      </div>
    </div>
  );
}
