/**
 * HDLoadedLayout - Two-column layout for LOADED state
 * Left: Options chain grid for quick contract switching
 * Right: Contract details + market analysis
 */

import type { Trade, Contract, Ticker } from "../../types";
import { HDContractGrid } from "../hd/common/HDContractGrid";
import { HDLoadedTradeCard } from "../hd/cards/HDLoadedTradeCard";

interface HDLoadedLayoutProps {
  trade: Trade;
  contracts: Contract[];
  currentPrice: number;
  ticker: string;
  activeTicker: Ticker | null;
  onContractSelect: (contract: Contract) => void;
  onEnter: () => void;
  onDiscard: () => void;
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
}: HDLoadedLayoutProps) {
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
        {/* Contract Details Card - without action buttons */}
        {trade?.contract ? (
          <HDLoadedTradeCard
            trade={trade}
            onEnter={onEnter}
            onDiscard={onDiscard}
            underlyingPrice={activeTicker?.last}
            underlyingChange={activeTicker?.changePercent}
            showActions={false}
          />
        ) : (
          <div className="border border-gray-700 rounded-lg bg-gray-900/30 p-4 text-center text-gray-400 text-sm">
            Loading contract details...
          </div>
        )}

        {/* Contract Analysis Panel */}
        <div className="border border-gray-700 rounded-lg bg-gray-900/30 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Contract Analysis</h3>

          {trade?.contract ? (
            <div className="space-y-3 text-xs">
              {/* Greeks Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {trade.contract?.delta !== undefined && (
                  <div className="bg-gray-800/50 p-2 rounded">
                    <div className="text-gray-400">Delta</div>
                    <div className="font-semibold text-blue-400">
                      {trade.contract.delta?.toFixed(3) || "-"}
                    </div>
                  </div>
                )}

                {trade.contract?.theta !== undefined && (
                  <div className="bg-gray-800/50 p-2 rounded">
                    <div className="text-gray-400">Theta</div>
                    <div
                      className={`font-semibold ${
                        (trade.contract?.theta ?? 0) < 0 ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {trade.contract.theta?.toFixed(4) || "-"}
                    </div>
                  </div>
                )}

                {trade.contract?.vega !== undefined && (
                  <div className="bg-gray-800/50 p-2 rounded">
                    <div className="text-gray-400">Vega</div>
                    <div className="font-semibold text-purple-400">
                      {trade.contract.vega?.toFixed(3) || "-"}
                    </div>
                  </div>
                )}

                {trade.contract?.iv !== undefined && (
                  <div className="bg-gray-800/50 p-2 rounded">
                    <div className="text-gray-400">IV</div>
                    <div className="font-semibold text-yellow-400">
                      {trade.contract.iv?.toFixed(2) || "-"}%
                    </div>
                  </div>
                )}
              </div>

              {/* Key Levels */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-700">
                <div>
                  <div className="text-gray-400">Entry</div>
                  <div className="font-semibold text-gray-200">
                    ${trade.entryPrice?.toFixed(2) || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Current</div>
                  <div className="font-semibold text-gray-200">
                    ${trade.contract?.mid?.toFixed(2) || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Target</div>
                  <div className="font-semibold text-green-400">
                    ${trade.targetPrice?.toFixed(2) || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Stop</div>
                  <div className="font-semibold text-red-400">
                    ${trade.stopLoss?.toFixed(2) || "—"}
                  </div>
                </div>
              </div>

              {/* Risk/Reward */}
              {trade.targetPrice && trade.stopLoss && trade.entryPrice && (
                <div className="pt-2 border-t border-gray-700">
                  <div className="text-gray-400 mb-1">Risk/Reward Ratio</div>
                  <div className="font-semibold text-blue-400">
                    {(
                      Math.abs(
                        (trade.targetPrice - trade.entryPrice) / (trade.entryPrice - trade.stopLoss)
                      ) || 0
                    ).toFixed(2)}
                    :1
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-xs">Contract data unavailable</div>
          )}
        </div>
      </div>
    </div>
  );
}
