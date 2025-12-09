/**
 * ActionRail - Right Panel Component
 *
 * Always visible panel containing:
 * 1. State badge (LOADED/ENTERED/EXITED)
 * 2. Risk box editor (Entry/Stop/Targets/Size)
 * 3. Discord controls (channel chips, composer toggle)
 * 4. One-click action buttons (state-dependent)
 */

import React, { useState } from "react";
import type { Trade, TradeState, AlertType, DiscordChannel, Challenge } from "../../types";
import type { PriceOverrides } from "../hd/alerts/HDAlertComposer";
import { ActionRailStateBadge } from "./ActionRailStateBadge";
import { ActionRailRiskBox } from "./ActionRailRiskBox";
import { ActionRailDiscord } from "./ActionRailDiscord";
import { ActionRailActions } from "./ActionRailActions";
import { cn } from "../../lib/utils";

export interface ActionRailProps {
  tradeState: TradeState;
  currentTrade: Trade | null;
  showAlert: boolean;
  alertType: AlertType;
  alertOptions?: { updateKind?: "trim" | "generic" | "sl" | "take-profit" };
  channels: DiscordChannel[];
  challenges: Challenge[];
  // Alert callbacks
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
  // Trade action callbacks
  onEnter?: () => void;
  onTrim: () => void;
  onMoveSL: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
  onExit: () => void;
  onTakeProfit: () => void;
}

export function ActionRail({
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
  onMoveSL,
  onTrailStop,
  onAdd,
  onExit,
  onTakeProfit,
}: ActionRailProps) {
  // Track if Discord composer is expanded
  const [discordExpanded, setDiscordExpanded] = useState(false);

  // Determine if we should show content
  const hasContent = tradeState !== "WATCHING" || currentTrade;

  return (
    <div className="w-80 flex-shrink-0 border-l border-[var(--border-hairline)] flex flex-col h-full bg-[var(--surface-1)] overflow-hidden">
      {/* State Badge - Always at top */}
      <ActionRailStateBadge state={tradeState} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {!hasContent ? (
          <EmptyRailState />
        ) : (
          <>
            {/* Risk Box - Visible when trade exists */}
            {currentTrade && (
              <ActionRailRiskBox trade={currentTrade} />
            )}

            {/* Discord Controls */}
            <ActionRailDiscord
              trade={currentTrade}
              channels={channels}
              challenges={challenges}
              showAlert={showAlert}
              alertType={alertType}
              alertOptions={alertOptions}
              expanded={discordExpanded}
              onToggleExpanded={() => setDiscordExpanded(!discordExpanded)}
              onSendAlert={onSendAlert}
              onEnterAndAlert={onEnterAndAlert}
              onCancelAlert={onCancelAlert}
            />

            {/* Action Buttons */}
            <ActionRailActions
              tradeState={tradeState}
              currentTrade={currentTrade}
              onEnter={onEnter}
              onUnload={onUnload}
              onTrim={onTrim}
              onMoveSL={onMoveSL}
              onTrailStop={onTrailStop}
              onAdd={onAdd}
              onExit={onExit}
              onTakeProfit={onTakeProfit}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Empty state when no trade is selected
function EmptyRailState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div className="space-y-2">
        <div className="text-[var(--text-muted)] text-sm">
          No trade selected
        </div>
        <p className="text-[var(--text-faint)] text-xs">
          Select a contract or trade to see actions
        </p>
      </div>
    </div>
  );
}

export default ActionRail;
