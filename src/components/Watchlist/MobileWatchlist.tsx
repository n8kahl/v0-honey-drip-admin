import React from 'react';
import { Ticker } from '../../types';
import { useSymbolData, useCandles } from '../../stores/marketDataStore';
import { useUIStore } from '../../stores/uiStore';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MobileWatchlistProps {
  tickers: Ticker[];
  onRemoveTicker?: (ticker: Ticker) => void;
}

interface WatchlistCardProps {
  ticker: Ticker;
  onTap: () => void;
}

const MiniSparkline: React.FC<{ data: number[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <svg className="w-full h-12" viewBox="0 0 100 40" preserveAspectRatio="none">
        <line x1="0" y1="20" x2="100" y2="20" stroke="var(--border-hairline)" strokeWidth="1" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 40 - ((value - min) / range) * 40;
      return `${x},${y}`;
    })
    .join(' ');

  const isPositive = data[data.length - 1] >= data[0];
  const color = isPositive ? 'var(--accent-positive)' : 'var(--accent-negative)';

  return (
    <svg className="w-full h-12" viewBox="0 0 100 40" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const WatchlistCard: React.FC<WatchlistCardProps> = ({ ticker, onTap }) => {
  const symbolData = useSymbolData(ticker.symbol);
  const oneMinCandles = useCandles(ticker.symbol, '1m') || [];
  const strategySignals = symbolData?.strategySignals || [];
  const activeSignals = strategySignals.filter((s) => s.status === 'ACTIVE');
  const confluence = symbolData?.confluence;

  // Calculate price change %
  const currentPrice = ticker.last || 0;
  const priceChangePercent = ticker.changePercent || 0;
  const isPositive = priceChangePercent >= 0;

  // Sparkline: last 20 minutes of 1m closes, fallback to simple mock if unavailable
  const sparklineData = React.useMemo(() => {
    const closes = oneMinCandles.slice(-20).map(c => c.close).filter(n => typeof n === 'number' && !Number.isNaN(n));
    if (closes.length >= 2) return closes;
    return Array.from({ length: 20 }, (_, i) => currentPrice * (1 + Math.sin(i * 0.3) * 0.004));
  }, [oneMinCandles, currentPrice]);

  // Confluence pills
  const confluenceLabels = React.useMemo(() => {
    const labels: string[] = [];
    if (confluence?.components.supportResistance) labels.push('ORB');
    if (confluence?.components.aboveVWAP) labels.push('VWAP');
    if (confluence?.components.trendAlignment) labels.push('MTF↑');
    return labels;
  }, [confluence]);

  return (
    <div
      onClick={onTap}
      className={cn(
        'flex-shrink-0 w-64 h-80 rounded-2xl p-4 flex flex-col justify-between',
        'bg-[var(--surface-2)]',
        'border border-[var(--border-hairline)]',
        'active:scale-95 transition-transform cursor-pointer',
        'relative overflow-hidden'
      )}
    >

      {/* Top: Symbol + Active Badge */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-5xl font-extrabold text-zinc-100 tracking-tight">{ticker.symbol}</h2>
          {activeSignals.length > 0 && (
            <div className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-300 text-xs font-medium">
              {activeSignals.length}
            </div>
          )}
        </div>

        {/* Price + Change */}
        <div className="mb-4">
          <div className="text-3xl font-semibold text-[var(--text-high)] mb-1">
            ${currentPrice.toFixed(2)}
          </div>
          <div className={cn('flex items-center gap-1 text-sm font-medium', isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]')}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isPositive ? '+' : ''}
            {priceChangePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Middle: Sparkline */}
      <div className="relative z-10 flex-1 flex items-center">
        <MiniSparkline data={sparklineData} />
      </div>

      {/* Bottom: Confluence Pills */}
      <div className="relative z-10">
        {confluenceLabels.length > 0 ? (
          <div className="text-xs text-zinc-400">
            {confluenceLabels.join(' · ')}
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)] italic">No active setups</div>
        )}
      </div>
    </div>
  );
};

export const MobileWatchlist: React.FC<MobileWatchlistProps> = ({ tickers }) => {
  const setMainCockpitSymbol = useUIStore((s) => s.setMainCockpitSymbol);

  const handleCardTap = (ticker: Ticker) => {
    console.log('[v0] MobileWatchlist: Card tapped:', ticker.symbol);
    setMainCockpitSymbol(ticker.symbol);
  };

  if (tickers.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-sm text-[var(--text-muted)]">No symbols in watchlist</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Add tickers to start tracking</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden py-4">
      <div className="flex items-center gap-4 px-4 overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {tickers.map((ticker) => (
          <div key={ticker.symbol} className="snap-center">
            <WatchlistCard ticker={ticker} onTap={() => handleCardTap(ticker)} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobileWatchlist;
