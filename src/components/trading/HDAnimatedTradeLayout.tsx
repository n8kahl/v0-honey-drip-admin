/**
 * HDAnimatedTradeLayout - Three-column animated layout for trading workspace
 *
 * Layout States:
 * - DEFAULT (no contract selected): Options Chain (50%) | Empty/Preview (50%)
 * - CONTRACT SELECTED: Collapsed Options (120px) | Contract Details (flex) | Alert Composer (400px)
 *
 * Animations:
 * - Options chain collapses with 300ms ease-in-out transition
 * - Alert composer slides in from right with 300ms ease-in-out transition
 */

import React from "react";
import type { Trade, Contract, Ticker, AlertType, DiscordChannel, Challenge } from "../../types";
import { isKCUSetupType } from "../../types";
import { HDContractGrid } from "../hd/common/HDContractGrid";
import { HDLoadedTradeCard } from "../hd/cards/HDLoadedTradeCard";
import { HDKCUTradeCard } from "../hd/cards/HDKCUTradeCard";
import { HDRecommendedContractPreview } from "../hd/cards/HDRecommendedContractPreview";
import { HDAlertComposer, PriceOverrides } from "../hd/alerts/HDAlertComposer";
import { useBidAskThresholdMonitor } from "../../hooks/useBidAskThresholdMonitor";
import type { ContractRecommendation } from "../../hooks/useContractRecommendation";
import type { KCUTradeSetup } from "../../lib/composite/detectors/kcu/types";
import { cn } from "../../lib/utils";

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
  /** Whether alert composer is shown */
  showAlert: boolean;
  alertType: AlertType;
  alertOptions?: { updateKind?: "trim" | "generic" | "sl" };
  /** Discord channels for alert composer */
  channels: DiscordChannel[];
  challenges: Challenge[];
  /** Alert composer callbacks */
  onSendAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onEnterAndAlert?: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onCancelAlert: () => void;
  onUnload?: () => void;
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
  showAlert,
  alertType,
  alertOptions,
  channels,
  challenges,
  onSendAlert,
  onEnterAndAlert,
  onCancelAlert,
  onUnload,
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

  // Desktop: Three-column when alert is shown
  // Mobile: Stacked layout with sheet/modal for alert
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;

  return (
    <div className="flex flex-col lg:flex-row gap-0 px-4 lg:px-6 py-4 lg:py-6 pointer-events-auto relative z-10 h-full">
      {/* Left Column: Options Chain Grid - Collapses when alert is shown */}
      <div
        className={cn(
          "border border-gray-700 rounded-lg bg-gray-900/30 overflow-hidden flex flex-col transition-all duration-300 ease-in-out flex-shrink-0",
          // Mobile: Full width always
          "w-full",
          // Desktop: Width based on alert state
          showAlert && hasContractSelected
            ? "lg:w-[140px]" // Collapsed width when alert shown
            : "lg:w-1/2", // Normal 50% width
          // Height constraints
          "min-h-[300px] lg:min-h-0"
        )}
      >
        <div className="px-3 py-2 border-b border-gray-700 bg-gray-900/50 flex-shrink-0">
          <h3
            className={cn(
              "text-sm font-semibold text-gray-300 truncate transition-all duration-300",
              showAlert && hasContractSelected && "lg:text-xs"
            )}
          >
            {showAlert && hasContractSelected ? "Strikes" : "Options Chain"}
          </h3>
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
              collapsed={showAlert && hasContractSelected}
            />
          ) : (
            <div className="flex items-center justify-center p-4 text-gray-400 text-xs h-full">
              Loading contracts...
            </div>
          )}
        </div>
      </div>

      {/* Middle Column: Contract Details + Market Analysis */}
      <div
        className={cn(
          "overflow-y-auto flex-1 space-y-4 transition-all duration-300 ease-in-out",
          // Padding adjustments
          showAlert && hasContractSelected ? "lg:px-4" : "lg:pl-6",
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
              showActions={!showAlert}
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

      {/* Right Column: Alert Composer - Slides in from right */}
      <div
        className={cn(
          "border border-gray-700 rounded-lg bg-gray-900/30 overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out",
          // Desktop: Fixed width, slide from right
          "lg:w-[400px]",
          // Transform and opacity for slide animation
          showAlert && hasContractSelected
            ? "lg:opacity-100 lg:translate-x-0 lg:ml-4"
            : "lg:opacity-0 lg:translate-x-full lg:w-0 lg:ml-0 lg:border-0",
          // Mobile: Full width, show/hide with height
          "w-full mt-4 lg:mt-0",
          !showAlert && "hidden lg:block"
        )}
        style={{
          // Ensure smooth transition even when width changes
          maxWidth: showAlert && hasContractSelected ? "400px" : "0px",
        }}
      >
        {showAlert && trade?.contract && (
          <HDAlertComposer
            trade={trade}
            alertType={alertType}
            alertOptions={alertOptions}
            availableChannels={channels}
            challenges={challenges}
            onSend={onSendAlert}
            onEnterAndAlert={onEnterAndAlert}
            onCancel={onCancelAlert}
            onUnload={onUnload}
            underlyingPrice={activeTicker?.last}
            underlyingChange={activeTicker?.changePercent}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}
