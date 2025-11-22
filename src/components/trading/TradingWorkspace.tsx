import React from 'react';
import { Ticker, Contract, Trade, TradeState, AlertType } from '../../types';
import type { CompositeSignal } from '../../lib/composite/CompositeSignal';
import { HDLiveChart } from '../hd/charts/HDLiveChart';
import { HDContractGrid } from '../hd/common/HDContractGrid';
import { HDLoadedTradeCard } from '../hd/cards/HDLoadedTradeCard';
import { HDEnteredTradeCard } from '../hd/cards/HDEnteredTradeCard';
import { HDPanelFocusedTrade } from '../hd/dashboard/HDPanelFocusedTrade';
import { HDPriceSparkline } from '../hd/charts/HDPriceSparkline';
import { MobileWatermark } from '../MobileWatermark';
import { useMemo } from 'react';
import { useKeyLevels } from '../../hooks/useKeyLevels';
import { buildChartLevelsForTrade } from '../../lib/riskEngine/chartLevels';
import type { KeyLevels } from '../../lib/riskEngine/types';

// Use permissive typing for confluence metrics; downstream components will handle specifics.
interface TradingWorkspaceProps {
  watchlist: Ticker[];
  activeTicker: Ticker | null;
  contracts: Contract[];
  currentTrade: Trade | null;
  tradeState: TradeState;
  showAlert: boolean;
  confluence: any;
  alertType: AlertType;
  onContractSelect: (c: Contract, confluenceData?: any) => void;
  onEnterTrade: () => void;
  onDiscard: () => void;
  onAutoTrim?: () => void;
  compositeSignals?: CompositeSignal[];
}

export const TradingWorkspace: React.FC<TradingWorkspaceProps> = ({
  watchlist,
  activeTicker,
  contracts,
  currentTrade,
  tradeState,
  showAlert,
  confluence,
  alertType,
  onContractSelect,
  onEnterTrade,
  onDiscard,
  onAutoTrim,
  compositeSignals,
}) => {
  const currentPrice = activeTicker ? (watchlist.find(t => t.symbol === activeTicker.symbol)?.last || activeTicker.last) : 0;

  const enteredTrade = tradeState === 'ENTERED' && currentTrade && !showAlert ? currentTrade : null;
  // Enable key level computation for LOADED and ENTERED states
  const levelsTicker = currentTrade?.ticker || activeTicker?.symbol || '';
  const { keyLevels: computedKeyLevels } = useKeyLevels(levelsTicker, {
    timeframe: '5',
    lookbackDays: 5,
    orbWindow: 5,
    enabled: Boolean(levelsTicker && (tradeState === 'LOADED' || tradeState === 'ENTERED')),
  });
  const [chartHeight, setChartHeight] = React.useState(360);
  React.useEffect(() => {
    const update = () => setChartHeight(window.innerWidth < 768 ? 260 : 360);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Decide which ticker drives the global chart
  const chartTicker = useMemo(() => {
    if (currentTrade && (tradeState === 'LOADED' || tradeState === 'ENTERED')) {
      return currentTrade.ticker;
    }
    if (activeTicker) return activeTicker.symbol;
    return null;
  }, [currentTrade, tradeState, activeTicker]);

  const enteredTradeEvents = useMemo(() => {
    if (!enteredTrade) return [] as any[];
    return [
      ...(enteredTrade.entryTime
        ? [{
            type: 'enter' as const,
            timestamp: new Date(enteredTrade.entryTime).getTime(),
            price: enteredTrade.entryPrice || enteredTrade.contract.mid,
            label: 'Enter',
          }]
        : []),
      ...(enteredTrade.updates || []).map(update => ({
        type: update.type as any,
        timestamp: new Date(update.timestamp).getTime(),
        price: update.price || enteredTrade.contract.mid,
        label: update.type.charAt(0).toUpperCase() + update.type.slice(1),
      })),
    ];
  }, [enteredTrade]);

  const enteredChartLevels = useMemo(() => {
    if (!enteredTrade) return [] as any[];
    const keyLevels: KeyLevels = computedKeyLevels || {
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
      weeklyHigh: 0,
      weeklyLow: 0,
      monthlyHigh: 0,
      monthlyLow: 0,
      quarterlyHigh: 0,
      quarterlyLow: 0,
      yearlyHigh: 0,
      yearlyLow: 0,
    };
    return buildChartLevelsForTrade(enteredTrade, keyLevels);
  }, [enteredTrade, computedKeyLevels]);

  // Add loaded trade chart levels (for LOADED state)
  const loadedChartLevels = useMemo(() => {
    if (!currentTrade || tradeState !== 'LOADED') return [] as any[];
    const keyLevels: KeyLevels = computedKeyLevels || {
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
      weeklyHigh: 0,
      weeklyLow: 0,
      monthlyHigh: 0,
      monthlyLow: 0,
      quarterlyHigh: 0,
      quarterlyLow: 0,
      yearlyHigh: 0,
      yearlyLow: 0,
    };
    return buildChartLevelsForTrade(currentTrade, keyLevels);
  }, [currentTrade, tradeState, computedKeyLevels]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] relative">
      <MobileWatermark />
      {/* Chart area - full chart for WATCHING/LOADED/ENTERED */}
      {chartTicker && (
        <div className="p-4 lg:p-6 pointer-events-auto relative z-20 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/80">
          <HDLiveChart
            ticker={chartTicker}
            initialTimeframe="5"
            indicators={{ ema: { periods: [8,21,50,200] }, vwap: { enabled: true, bands: false }, bollinger: { period: 20, stdDev: 2 } }}
            events={tradeState === 'ENTERED' ? enteredTradeEvents : []}
            levels={tradeState === 'LOADED' ? loadedChartLevels : tradeState === 'ENTERED' ? enteredChartLevels : []}
            height={chartHeight}
            stickyHeader
          />
        </div>
      )}
      {/* Entered Trade Card with details */}
      {tradeState === 'ENTERED' && currentTrade && (
        <div className="p-4 lg:p-6 pt-0 pointer-events-auto relative z-10">
          <HDEnteredTradeCard
            trade={currentTrade}
            direction={currentTrade.contract.type === 'C' ? 'call' : 'put'}
            confluence={confluence}
            onAutoTrim={onAutoTrim}
          />
        </div>
      )}
      {/* Loaded Trade Card with details */}
      {tradeState === 'LOADED' && currentTrade && (
        <div className="p-4 lg:p-6 pt-0 pointer-events-auto relative z-10">
          <HDLoadedTradeCard
            trade={currentTrade}
            onEnter={onEnterTrade}
            onDiscard={onDiscard}
            underlyingPrice={activeTicker?.last}
            underlyingChange={activeTicker?.changePercent}
            confluence={confluence}
            signals={compositeSignals?.filter(s => s.symbol === currentTrade.ticker)}
          />
        </div>
      )}
      {tradeState === 'WATCHING' && activeTicker && (
        <div className="p-4 lg:p-6 space-y-3 pointer-events-auto relative z-10">
          {contracts.length > 0 ? (
            <HDContractGrid
              contracts={contracts}
              currentPrice={currentPrice}
              ticker={activeTicker.symbol}
              onContractSelect={(c) => onContractSelect(c, confluence)}
            />
          ) : (
            <div className="flex items-center justify-center p-8 text-gray-400 text-sm">
              Loading contracts for {activeTicker.symbol}...
            </div>
          )}
        </div>
      )}
      {!currentTrade && !activeTicker && (
        <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
            <img src="/src/assets/1ccfd6d57f7ce66b9991f55ed3e9ec600aadd57a.png" alt="Honey Drip" className="w-auto h-[50vh] max-w-[60vw] object-contain" />
          </div>
          <div className="relative z-10 text-center space-y-4 max-w-md">
            <h3 className="text-xl lg:text-2xl font-semibold text-white">Honey Drip Admin</h3>
            <p className="text-zinc-400 text-sm lg:text-base leading-relaxed">Select a Ticker from the Watchlist or Loaded Trades to begin</p>
          </div>
        </div>
      )}
    </div>
  );
};
