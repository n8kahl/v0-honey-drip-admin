import React from 'react';
import { Ticker, Contract, Trade, TradeState, AlertType } from '../../types';
import type { SymbolSignals } from '../../hooks/useStrategyScanner';
import { HDLiveChart } from '../hd/HDLiveChart';
import { HDContractGrid } from '../hd/HDContractGrid';
import { HDLoadedTradeCard } from '../hd/HDLoadedTradeCard';
import { HDEnteredTradeCard } from '../hd/HDEnteredTradeCard';
import { HDPanelFocusedTrade } from '../hd/HDPanelFocusedTrade';
import { MobileWatermark } from '../MobileWatermark';

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
  signalsBySymbol?: Map<string, SymbolSignals>;
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
  signalsBySymbol,
}) => {
  const currentPrice = activeTicker ? (watchlist.find(t => t.symbol === activeTicker.symbol)?.last || activeTicker.last) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] relative">
      <MobileWatermark />
      {tradeState === 'WATCHING' && activeTicker ? (
        <div className="p-4 lg:p-6 space-y-3 pointer-events-auto relative z-10">
          <HDLiveChart
            ticker={activeTicker.symbol}
            timeframe="5"
            indicators={{ ema: { periods: [8,21,50,200] }, vwap: { enabled: true, bands: false } }}
            events={[]}
            height={280}
          />
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
      ) : tradeState === 'LOADED' && currentTrade && !showAlert ? (
        <div className="p-4 lg:p-6 pointer-events-auto">
          <HDLoadedTradeCard
            trade={currentTrade}
            onEnter={onEnterTrade}
            onDiscard={onDiscard}
            underlyingPrice={activeTicker?.last}
            underlyingChange={activeTicker?.changePercent}
            confluence={confluence}
            signals={signalsBySymbol?.get(currentTrade.ticker)}
          />
        </div>
      ) : tradeState === 'ENTERED' && currentTrade && !showAlert ? (
        <div className="p-4 lg:p-6 pointer-events-auto">
          <HDEnteredTradeCard
            trade={currentTrade}
            direction={currentTrade.contract.type === 'C' ? 'call' : 'put'}
            confluence={confluence}
            onAutoTrim={onAutoTrim}
            signals={signalsBySymbol?.get(currentTrade.ticker)}
          />
        </div>
      ) : showAlert ? (
        <div className="hidden lg:block p-4 lg:p-6 pointer-events-auto">
          {currentTrade && (
            <HDPanelFocusedTrade
              trade={currentTrade}
              ticker={activeTicker?.symbol}
              state={tradeState}
            />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
            <img src="/src/assets/1ccfd6d57f7ce66b9991f55ed3e9ec600aadd57a.png" alt="Honey Drip" className="w-auto h-[50vh] max-w-[60vw] object-contain" />
          </div>
          <div className="relative z-10 text-center space-y-4 max-w-md">
            <h3 className="text-xl lg:text-2xl font-semibold text-white">Honey Drip Admin</h3>
            <p className="text-gray-400 text-sm lg:text-base leading-relaxed">Select a Ticker from the Watchlist or Loaded Trades to begin</p>
          </div>
        </div>
      )}
    </div>
  );
};
