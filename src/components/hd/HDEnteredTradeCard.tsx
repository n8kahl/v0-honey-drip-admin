import { Trade } from '../../types';
import { HDTagTradeType } from './HDTagTradeType';
import { HDCard } from './HDCard';
import { HDChip } from './HDChip';
import { formatPrice, formatPercent, formatTime, cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Wifi } from 'lucide-react';
import {
  MassiveTrendMetrics,
  MassiveVolatilityMetrics,
  MassiveLiquidityMetrics,
} from '../../services/massiveClient';
import { useActiveTradePnL } from '../../hooks/useMassiveData';
import { HDLiveChart } from './HDLiveChart';
import { TradeEvent } from '../../types';
import { useOptionTrades, useOptionQuote } from '../../hooks/useOptionsAdvanced';
import { HDConfluenceChips } from './HDConfluenceChips';
import { useMemo } from 'react';
import { buildChartLevelsForTrade } from '../../lib/riskEngine/chartLevels';
import { KeyLevels } from '../../lib/riskEngine/types';

interface HDEnteredTradeCardProps {
  trade: Trade;
  direction: 'call' | 'put';
  confluence?: {
    loading: boolean;
    error?: string;
    trend?: MassiveTrendMetrics;
    volatility?: MassiveVolatilityMetrics;
    liquidity?: MassiveLiquidityMetrics;
  };
}

export function HDEnteredTradeCard({ trade, direction, confluence }: HDEnteredTradeCardProps) {
  const { currentPrice, pnlPercent, asOf, source } = useActiveTradePnL(
    trade.contract.id,
    trade.entryPrice || trade.contract.mid
  );
  
  const { tradeTape } = useOptionTrades(trade.contract.id);
  const { quote, liquidity } = useOptionQuote(trade.contract.id, {
    ticker: trade.contract.id,
    bid: trade.contract.bid,
    bidSize: 0,
    ask: trade.contract.ask,
    askSize: 0,
    last: trade.contract.mid,
    openInterest: trade.contract.openInterest,
    volume: 0,
    implied_volatility: trade.contract.iv || 0,
    underlying_price: trade.underlyingPrice || 0,
  });
  
  const isPositive = pnlPercent >= 0;
  
  // Format "as of" timestamp
  const getAsOfText = () => {
    const secondsAgo = Math.floor((Date.now() - asOf) / 1000);
    if (secondsAgo < 5) return 'Live';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo}m ago`;
  };
  
  // Confluence data
  const trendScore = confluence?.trend?.trendScore ?? 50;
  const trendDescription = confluence?.trend?.description ?? 'Loading...';
  const volDescription = confluence?.volatility?.description ?? 'Loading...';
  const liqDescription = confluence?.liquidity?.description ?? 'Loading...';
  
  const getTrendBg = () => {
    if (trendScore >= 70) return 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30 text-[var(--accent-positive)]';
    if (trendScore >= 40) return 'bg-[var(--surface-3)] border-[var(--border-hairline)] text-[var(--text-med)]';
    return 'bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30 text-[var(--accent-negative)]';
  };
  
  const tradeEvents: TradeEvent[] = [
    ...(trade.loadedAt
      ? [{
          type: 'load' as const,
          timestamp: new Date(trade.loadedAt).getTime(),
          price: trade.contract.mid,
          label: 'Load',
        }]
      : []),
    ...(trade.enteredAt
      ? [{
          type: 'enter' as const,
          timestamp: new Date(trade.enteredAt).getTime(),
          price: trade.entryPrice || trade.contract.mid,
          label: 'Enter',
        }]
      : []),
    ...(trade.updates || []).map(update => ({
      type: update.type as TradeEvent['type'],
      timestamp: new Date(update.timestamp).getTime(),
      price: update.price || trade.contract.mid,
      label: update.type.charAt(0).toUpperCase() + update.type.slice(1),
    })),
  ];
  
  const chartLevels = useMemo(() => {
    // Mock key levels - in production, get these from risk engine context
    const keyLevels: KeyLevels = {
      preMarketHigh: 0,
      preMarketLow: 0,
      orbHigh: 0,
      orbLow: 0,
      priorDayHigh: 0,
      priorDayLow: 0,
      vwap: 0,
      vwapUpperBand: 0,
      vwapLowerBand: 0,
      bollingerUpper: 0,
      bollingerLower: 0,
    };
    
    return buildChartLevelsForTrade(trade, keyLevels);
  }, [trade]);
  
  return (
    <div className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-3 lg:p-4 space-y-3">
      {/* Header Row - Compact */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-[var(--text-high)] font-medium">
              {trade.ticker}
            </h2>
            <HDTagTradeType type={trade.tradeType} />
          </div>
          <div className="text-[var(--text-muted)] text-xs">
            {trade.contract.strike}{trade.contract.type} • {trade.contract.expiry} • {trade.contract.daysToExpiry}DTE
          </div>
        </div>
        
        {/* P&L Badge - Compact with streaming indicator */}
        <div className="flex flex-col items-end gap-1">
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius)] flex-shrink-0',
            isPositive ? 'bg-[var(--accent-positive)]/10' : 'bg-[var(--accent-negative)]/10'
          )}>
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-positive)]" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-[var(--accent-negative)]" />
            )}
            <span className={cn(
              'font-semibold tabular-nums',
              isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
            )}>
              {formatPercent(pnlPercent)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Wifi className={cn(
              "w-2.5 h-2.5",
              source === 'websocket' ? "text-green-500" : "text-yellow-500"
            )} />
            <span>{getAsOfText()}</span>
          </div>
        </div>
      </div>
      
      {(tradeTape || liquidity) && (
        <HDConfluenceChips 
          tradeTape={tradeTape}
          liquidity={liquidity ? {
            quality: liquidity.quality,
            spreadPercent: liquidity.spreadPercent,
          } : undefined}
        />
      )}
      
      {/* Tight 2×2 Levels Grid */}
      <div className="grid grid-cols-2 gap-2">
        {trade.entryPrice && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--border-hairline)]">
            <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">Entry</div>
            <div className="text-[var(--text-high)] text-sm tabular-nums font-medium">
              ${formatPrice(trade.entryPrice)}
            </div>
          </div>
        )}
        
        {currentPrice && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--border-hairline)]">
            <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">Current</div>
            <div className="text-[var(--text-high)] text-sm tabular-nums font-medium">
              ${formatPrice(currentPrice)}
            </div>
          </div>
        )}
        
        {trade.targetPrice && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--accent-positive)]/20">
            <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">Target</div>
            <div className="text-[var(--accent-positive)] text-sm tabular-nums font-medium">
              ${formatPrice(trade.targetPrice)}
            </div>
          </div>
        )}
        
        {trade.stopLoss && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--accent-negative)]/20">
            <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">Stop</div>
            <div className="text-[var(--accent-negative)] text-sm tabular-nums font-medium">
              ${formatPrice(trade.stopLoss)}
            </div>
          </div>
        )}
      </div>
      
      {/* HDLiveChart with levels */}
      <HDLiveChart
        ticker={trade.ticker}
        timeframe="1"
        indicators={{
          ema: { periods: [8, 21, 50, 200] },
          vwap: { enabled: true, bands: false },
          bollinger: { period: 20, stdDev: 2 },
        }}
        events={tradeEvents}
        levels={chartLevels} // Pass chart levels
        height={350}
        className="my-3"
      />
      
      {/* Confluence - Inline Compact Chips */}
      {!confluence?.loading && !confluence?.error && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[var(--text-muted)] text-micro uppercase tracking-wide">
            Confluence:
          </span>
          <div className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius)] border text-micro',
            getTrendBg()
          )}>
            <span className="font-medium">Trend</span>
            <span className="opacity-80">{trendDescription}</span>
          </div>
          
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius)] border bg-[var(--surface-3)] border-[var(--border-hairline)] text-[var(--text-med)] text-micro">
            <span className="font-medium">Vol</span>
            <span className="opacity-80">{volDescription}</span>
          </div>
          
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius)] border bg-[var(--surface-3)] border-[var(--border-hairline)] text-[var(--text-med)] text-micro">
            <span className="font-medium">Liq</span>
            <span className="opacity-80">{liqDescription}</span>
          </div>
        </div>
      )}
      
      {/* Activity Timeline - Ultra Compact */}
      {trade.updates && trade.updates.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-hairline)]">
          <h3 className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1.5">
            Activity
          </h3>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            {trade.updates
              .slice()
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 5)
              .map(update => {
                const updateLabel = {
                  'enter': 'Entered',
                  'exit': 'Exited',
                  'trim': 'Trimmed',
                  'add': 'Added',
                  'update-sl': 'Updated SL',
                  'trail-stop': 'Trail stop',
                  'update': 'Update'
                }[update.type] || update.type;
                
                const displayText = update.message || updateLabel;
                
                return (
                  <li key={update.id} className="flex justify-between gap-2 leading-tight">
                    <span className="truncate">
                      <span className="text-[var(--text-muted)]/70">{formatTime(update.timestamp)}</span>
                      <span className="mx-1">·</span>
                      <span>{displayText}</span>
                    </span>
                    {update.pnlPercent != null && (
                      <span className={cn(
                        'tabular-nums font-medium flex-shrink-0',
                        update.pnlPercent >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                      )}>
                        {update.pnlPercent >= 0 ? '+' : ''}{update.pnlPercent.toFixed(1)}%
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
