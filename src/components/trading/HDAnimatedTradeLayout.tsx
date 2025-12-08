/**
 * HDAnimatedTradeLayout - Two-column animated layout for trading workspace
 *
 * Layout States:
 * - DEFAULT (no contract selected): Options Chain (50%) | Empty/Preview (50%)
 * - CONTRACT SELECTED: Collapsed Options (140px) | Contract Details (flex-1)
 *   - Click "Strikes" header to toggle expand/collapse
 *
 * Animations:
 * - Options chain collapses with 300ms ease-in-out transition
 */

import React, { useState } from "react";
import type { Trade, Contract, Ticker } from "../../types";
import { isKCUSetupType } from "../../types";
import { HDContractGrid } from "../hd/common/HDContractGrid";
import { HDLoadedTradeCard } from "../hd/cards/HDLoadedTradeCard";
import { HDKCUTradeCard } from "../hd/cards/HDKCUTradeCard";
import { HDRecommendedContractPreview } from "../hd/cards/HDRecommendedContractPreview";
import { useBidAskThresholdMonitor } from "../../hooks/useBidAskThresholdMonitor";
import type { ContractRecommendation } from "../../hooks/useContractRecommendation";
import type { KCUTradeSetup } from "../../lib/composite/detectors/kcu/types";
import { cn } from "../../lib/utils";
import { ChevronLeft } from "lucide-react";

interface HDAnimatedTradeLayoutProps {
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

export function HDAnimatedTradeLayout({
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
}: HDAnimatedTradeLayoutProps) {
  // Determine if this is a KCU trade
  const isKCUTrade = isKCUSetupType(trade.setupType) && kcuSetup !== undefined;

  // Use bid/ask monitoring for KCU trades
  const bidAskStatus = useBidAskThresholdMonitor(isKCUTrade ? trade.contract?.id : undefined, {
    spreadThresholdPercent: 2.0,
    confirmationSeconds: 5,
  });

  // Determine if we have a contract selected (for layout transition)
  const hasContractSelected = Boolean(trade?.contract?.id);

  // Local state for manual toggle of options chain collapse
  // Auto-collapses when contract selected, but user can toggle back
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);

  // Options chain is collapsed when contract selected AND not manually expanded
  const isOptionsCollapsed = hasContractSelected && !isManuallyExpanded;

  // Toggle handler for clicking the header
  const handleHeaderClick = () => {
    if (hasContractSelected) {
      setIsManuallyExpanded(!isManuallyExpanded);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-0 px-4 lg:px-6 py-4 lg:py-6 pointer-events-auto relative z-10 h-full">
      {/* Left Column: Options Chain Grid - Collapses when contract selected */}
      <div
        className={cn(
          "border border-gray-700 rounded-lg bg-gray-900/30 overflow-hidden flex flex-col transition-all duration-300 ease-in-out flex-shrink-0",
          // Mobile: Full width always
          "w-full",
          // Desktop: Width based on collapse state
          isOptionsCollapsed
            ? "lg:w-[140px]" // Collapsed width
            : "lg:w-1/2", // Normal 50% width
          // Height constraints
          "min-h-[300px] lg:min-h-0"
        )}
      >
        {/* Clickable header - toggles collapse when contract selected */}
        <div
          className={cn(
            "px-3 py-2 border-b border-gray-700 bg-gray-900/50 flex-shrink-0",
            hasContractSelected && "cursor-pointer hover:bg-gray-800/50"
          )}
          onClick={handleHeaderClick}
        >
          <div className="flex items-center justify-between">
            <h3
              className={cn(
                "text-sm font-semibold text-gray-300 truncate transition-all duration-300",
                isOptionsCollapsed && "lg:text-xs"
              )}
            >
              {isOptionsCollapsed ? "Strikes" : "Options Chain"}
            </h3>
            {hasContractSelected && (
              <ChevronLeft
                className={cn(
                  "w-4 h-4 text-gray-400 transition-transform duration-300 hidden lg:block",
                  !isOptionsCollapsed && "rotate-180"
                )}
              />
            )}
          </div>
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
              collapsed={isOptionsCollapsed}
            />
          ) : (
            <div className="flex items-center justify-center p-4 text-gray-400 text-xs h-full">
              Loading contracts...
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Contract Details + Market Analysis */}
      <div
        className={cn(
          "overflow-y-auto flex-1 space-y-4 transition-all duration-300 ease-in-out",
          // Padding adjustments
          "lg:pl-6",
          // Mobile: margin top when stacked
          "mt-4 lg:mt-0"
        )}
      >
        {/* Contract Details Card - KCU or standard */}
        {trade?.contract?.id ? (
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
              showActions={true}
            />
          )
        ) : (
          /* Show recommended contract preview when no contract selected */
          <HDRecommendedContractPreview
            recommendation={recommendation || null}
            ticker={ticker}
            currentPrice={currentPrice}
            onSelectContract={onContractSelect}
          />
        )}
      </div>
    </div>
  );
}
