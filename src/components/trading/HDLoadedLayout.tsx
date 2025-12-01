/**
 * HDLoadedLayout - Two-column layout for LOADED state
 * Left: Options chain grid for quick contract switching
 * Right: Contract details + market analysis
 *
 * Supports both standard trade cards and KCU-specific trade cards
 * based on the trade's setupType.
 */

import type { Trade, Contract, Ticker } from "../../types";
import { isKCUSetupType } from "../../types";
import { HDContractGrid } from "../hd/common/HDContractGrid";
import { HDLoadedTradeCard } from "../hd/cards/HDLoadedTradeCard";
import { HDKCUTradeCard } from "../hd/cards/HDKCUTradeCard";
import { useBidAskThresholdMonitor } from "../../hooks/useBidAskThresholdMonitor";
import type { ContractRecommendation } from "../../hooks/useContractRecommendation";
import type { KCUTradeSetup } from "../../lib/composite/detectors/kcu/types";

interface HDLoadedLayoutProps {
  trade: Trade;
  contracts: Contract[];
  currentPrice: number;
  ticker: string;
  activeTicker: Ticker | null;
  onContractSelect: (contract: Contract) => void;
  onEnter: () => void;
  onDiscard: () => void;
  recommendation?: ContractRecommendation | null;
  /** KCU setup data when trade is a KCU strategy */
  kcuSetup?: KCUTradeSetup | null;
}

export function HDLoadedLayout({
  trade,
  contracts,
  currentPrice,
  ticker,
  activeTicker,
  onContractSelect,
  onEnter,
  onDiscard,
  recommendation,
  kcuSetup,
}: HDLoadedLayoutProps) {
  // Determine if this is a KCU trade
  const isKCUTrade = isKCUSetupType(trade.setupType) && kcuSetup !== undefined;

  // Use bid/ask monitoring for KCU trades
  const bidAskStatus = useBidAskThresholdMonitor(isKCUTrade ? trade.contract?.id : undefined, {
    spreadThresholdPercent: 2.0,
    confirmationSeconds: 5,
  });

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 px-4 lg:px-6 py-4 lg:py-6 pointer-events-auto relative z-10 h-full">
      {/* Left Column: Options Chain Grid - Wide column matching chart width, independent scroll */}
      <div className="w-full lg:w-1/2 border border-gray-700 rounded-lg bg-gray-900/30 overflow-hidden flex flex-col min-h-[400px] lg:min-h-0">
        <div className="px-3 py-2 border-b border-gray-700 bg-gray-900/50 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-300">Options Chain</h3>
        </div>
        <div className="overflow-y-auto flex-1">
          {contracts.length > 0 ? (
            <HDContractGrid
              contracts={contracts}
              currentPrice={currentPrice}
              ticker={ticker}
              onContractSelect={onContractSelect}
              recommendation={recommendation}
              className="text-sm"
            />
          ) : (
            <div className="flex items-center justify-center p-4 text-gray-400 text-xs h-full">
              Loading contracts...
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Contract Details + Market Analysis - Independent scroll */}
      <div className="w-full lg:w-1/2 overflow-y-auto flex-1 space-y-4">
        {/* Contract Details Card - KCU or standard */}
        {trade?.contract ? (
          isKCUTrade && kcuSetup ? (
            <HDKCUTradeCard
              trade={trade}
              setup={kcuSetup}
              bidAskStatus={bidAskStatus}
              onEnter={onEnter}
              onDiscard={onDiscard}
              underlyingPrice={activeTicker?.last}
            />
          ) : (
            <HDLoadedTradeCard
              trade={trade}
              onEnter={onEnter}
              onDiscard={onDiscard}
              underlyingPrice={activeTicker?.last}
              underlyingChange={activeTicker?.changePercent}
              showActions={false}
            />
          )
        ) : (
          <div className="border border-gray-700 rounded-lg bg-gray-900/30 p-4 text-center text-gray-400 text-sm">
            Loading contract details...
          </div>
        )}
      </div>
    </div>
  );
}
