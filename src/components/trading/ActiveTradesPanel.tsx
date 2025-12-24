import React from "react";
import { Trade, TradeState, AlertType, DiscordChannel, Challenge } from "../../types";
import { HDAlertComposer, PriceOverrides } from "../hd/alerts/HDAlertComposer";
import { HDQuickActions } from "../hd/common/HDQuickActions";

interface ActiveTradesPanelProps {
  tradeState: TradeState;
  currentTrade: Trade | null;
  showAlert: boolean;
  alertType: AlertType;
  alertOptions: { updateKind?: "trim" | "generic" | "sl"; trimPercent?: number };
  channels: DiscordChannel[];
  challenges: Challenge[];
  onSendAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onEnterAndAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onCancelAlert: () => void;
  onUnload: () => void;
  onEnter: () => void;
  onTrim: (trimPercent?: number) => void;
  onUpdate: () => void;
  onUpdateSL: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
  onTakeProfit: () => void;
  onExit: () => void;
  underlyingPrice?: number;
  underlyingChange?: number;
}

export const ActiveTradesPanel: React.FC<ActiveTradesPanelProps> = ({
  tradeState,
  currentTrade,
  showAlert,
  alertType,
  alertOptions,
  channels,
  challenges,
  onSendAlert,
  onEnterAndAlert,
  onCancelAlert,
  onUnload,
  onEnter,
  onTrim,
  onUpdate,
  onUpdateSL,
  onTrailStop,
  onAdd,
  onTakeProfit,
  onExit,
  underlyingPrice,
  underlyingChange,
}) => {
  return (
    <div className="w-full lg:w-80 lg:flex-shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-hairline)] flex flex-col h-full">
      {showAlert && currentTrade ? (
        <div className="hidden lg:flex lg:flex-col lg:h-full">
          <HDAlertComposer
            trade={currentTrade}
            alertType={alertType}
            alertOptions={alertOptions}
            availableChannels={channels}
            challenges={challenges}
            onSend={onSendAlert}
            onEnterAndAlert={onEnterAndAlert}
            onCancel={onCancelAlert}
            onUnload={onUnload}
            underlyingPrice={underlyingPrice}
            underlyingChange={underlyingChange}
          />
        </div>
      ) : tradeState === "LOADED" && currentTrade ? (
        <div className="flex flex-col h-auto lg:h-full bg-[var(--surface-2)] p-6 space-y-4">
          {/* Trade Details Summary */}
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-[var(--text-high)] font-semibold mb-2">
                {currentTrade.ticker} {currentTrade.contract.strike}
                {currentTrade.contract.type}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {currentTrade.contract.daysToExpiry}DTE • {currentTrade.tradeType}
              </p>
            </div>

            {/* Price Info */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[var(--surface-3)] rounded p-2">
                <div className="text-[var(--text-muted)] text-[10px] mb-1">Entry</div>
                <div className="text-[var(--text-high)] font-medium">
                  ${currentTrade.contract.mid?.toFixed(2) || "—"}
                </div>
              </div>
              <div className="bg-[var(--surface-3)] rounded p-2">
                <div className="text-[var(--accent-positive)] text-[10px] mb-1">Target</div>
                <div className="text-[var(--accent-positive)] font-medium">
                  ${currentTrade.targetPrice?.toFixed(2) || "—"}
                </div>
              </div>
              <div className="bg-[var(--surface-3)] rounded p-2">
                <div className="text-[var(--accent-negative)] text-[10px] mb-1">Stop</div>
                <div className="text-[var(--accent-negative)] font-medium">
                  ${currentTrade.stopLoss?.toFixed(2) || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onEnter}
              className="w-full py-2 px-3 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] font-medium text-sm hover:bg-[var(--brand-primary)]/90 transition-colors"
            >
              Enter Trade
            </button>
            <button
              onClick={onUnload}
              className="w-full py-2 px-3 rounded-[var(--radius)] bg-[var(--surface-3)] text-[var(--text-high)] font-medium text-sm hover:bg-[var(--surface-3)]/80 transition-colors border border-[var(--border-hairline)]"
            >
              Dismiss Trade
            </button>
          </div>
        </div>
      ) : tradeState === "ENTERED" && currentTrade ? (
        <div className="h-auto lg:h-full bg-[var(--surface-2)] p-4 lg:p-6">
          <HDQuickActions
            state={tradeState}
            onTrim={onTrim}
            onUpdate={onUpdate}
            onUpdateSL={onUpdateSL}
            onTrailStop={onTrailStop}
            onAdd={onAdd}
            onTakeProfit={onTakeProfit}
            onExit={onExit}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-auto lg:h-full bg-[var(--surface-2)] p-4 lg:p-6 min-h-[200px]">
          <p className="text-[var(--text-muted)] text-sm text-center">
            Select a contract to load a trade
          </p>
        </div>
      )}
    </div>
  );
};
