/**
 * NowPanel - State Orchestrator (Center Panel)
 *
 * The central "State Orchestrator" that switches between views based on trade lifecycle:
 * - WATCHING (no trade or viewing symbol) → NowPanelSymbol
 * - LOADED (trade ready to enter) → NowPanelTrade
 * - ENTERED (actively managing) → NowPanelManage
 * - EXITED → NowPanelTrade (recap mode)
 *
 * Uses framer-motion for smooth view transitions.
 * Integrates with useTradeActionManager to pass actions to child panels.
 */

import React, { useMemo, useCallback } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import type { FocusTarget } from "../../hooks/useTradeStateMachine";
import type { Ticker, Contract, Trade, TradeState, DiscordChannel, Challenge } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { NowPanelEmpty } from "./NowPanelEmpty";
import { NowPanelSymbol, type TradeType } from "./NowPanelSymbol";
import { NowPanelTrade } from "./NowPanelTrade";
import { NowPanelManage } from "./NowPanelManage";
import { useTradeActionManager } from "../../hooks/useTradeActionManager";
import { HDAlertComposerPopover, type AlertMode } from "../hd/alerts/HDAlertComposerPopover";
import { useDiscord } from "../../hooks/useDiscord";
import { cn } from "../../lib/utils";

// ============================================================================
// Types
// ============================================================================

/** View state derived from trade lifecycle */
export type ViewState = "empty" | "symbol" | "loaded" | "entered" | "exited";

/** Panel mode for distinguishing Setup vs Manage mode */
export type PanelMode = "setup" | "manage";

export interface NowPanelProps {
  focus: FocusTarget;
  activeTicker: Ticker | null;
  currentTrade: Trade | null;
  tradeState: TradeState;
  contracts: Contract[];
  activeTrades: Trade[];
  onContractSelect: (contract: Contract, options?: { tradeType?: TradeType }) => void;
  compositeSignals?: CompositeSignal[];
  // For symbol view - watchlist reference
  watchlist?: Ticker[];
  /** Whether a trade action is currently in progress */
  isTransitioning?: boolean;
  // Discord/Challenge context (for alerts)
  channels?: DiscordChannel[];
  challenges?: Challenge[];
  // Action callbacks for NowPanelManage (legacy - kept for backward compat)
  onTrim?: (percent: number) => void;
  onMoveSLToBreakeven?: () => void;
  onTrailStop?: () => void;
  onAdd?: () => void;
  onExit?: (sendAlert: boolean) => void;
  onTakeProfit?: (sendAlert: boolean) => void;
  onBroadcastUpdate?: (message: string) => void;
}

// ============================================================================
// Animation Variants
// ============================================================================

const viewAnimationVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.15,
      ease: "easeIn",
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Derive the view state from focus and trade state
 */
function deriveViewState(
  focus: FocusTarget,
  currentTrade: Trade | null,
  activeTrades: Trade[],
  tradeState: TradeState
): ViewState {
  // No focus → empty
  if (!focus) {
    return "empty";
  }

  // Symbol focus → symbol view
  if (focus.kind === "symbol") {
    return "symbol";
  }

  // Trade focus → determine based on trade state
  if (focus.kind === "trade") {
    // Find the trade from activeTrades or currentTrade
    const trade =
      currentTrade?.id === focus.tradeId
        ? currentTrade
        : activeTrades.find((t) => t.id === focus.tradeId);

    if (!trade) {
      return "empty";
    }

    // Use trade.state as the source of truth
    const effectiveState = trade.state;

    switch (effectiveState) {
      case "WATCHING":
        // WATCHING = preview state (Load Strategy clicked)
        // Show NowPanelTrade in 'setup' mode
        return "loaded";
      case "LOADED":
        return "loaded";
      case "ENTERED":
        return "entered";
      case "EXITED":
        return "exited";
      default:
        return "symbol";
    }
  }

  return "empty";
}

// ============================================================================
// Main Component
// ============================================================================

export function NowPanel({
  focus,
  activeTicker,
  currentTrade,
  tradeState,
  contracts,
  activeTrades,
  onContractSelect,
  compositeSignals,
  watchlist = [],
  isTransitioning = false,
  channels = [],
  challenges = [],
  onTrim,
  onMoveSLToBreakeven,
  onTrailStop,
  onAdd,
  onExit,
  onTakeProfit,
  onBroadcastUpdate,
}: NowPanelProps) {
  // ============================================================================
  // Trade Action Manager
  // ============================================================================

  const manager = useTradeActionManager(currentTrade, activeTicker?.symbol || "");

  // ============================================================================
  // Derived State
  // ============================================================================

  // Derive view state from focus and trade
  const viewState = useMemo(
    () => deriveViewState(focus, currentTrade, activeTrades, tradeState),
    [focus, currentTrade, activeTrades, tradeState]
  );

  // Get the focused trade
  const focusedTrade = useMemo(() => {
    if (!focus || focus.kind !== "trade") return null;
    return (
      (currentTrade?.id === focus.tradeId
        ? currentTrade
        : activeTrades.find((t) => t.id === focus.tradeId)) || null
    );
  }, [focus, currentTrade, activeTrades]);

  // Determine panel mode
  const mode: PanelMode = viewState === "entered" ? "manage" : "setup";

  // Check if auto-select should be disabled
  const hasActiveTrade = tradeState === "LOADED" || tradeState === "ENTERED";
  const disableAutoSelect = hasActiveTrade || isTransitioning;

  // ============================================================================
  // Render Logic
  // ============================================================================

  const renderContent = () => {
    switch (viewState) {
      case "empty":
        return <NowPanelEmpty />;

      case "symbol":
        return (
          <NowPanelSymbol
            symbol={focus?.kind === "symbol" ? focus.symbol : activeTicker?.symbol || ""}
            activeTicker={activeTicker}
            contracts={contracts}
            onContractSelect={onContractSelect}
            compositeSignals={compositeSignals}
            watchlist={watchlist}
            disableAutoSelect={disableAutoSelect}
          />
        );

      case "loaded":
        // LOADED or WATCHING state - show trade preparation view
        // If we have an activeTicker but no trade selected, show symbol view
        if (!focusedTrade && activeTicker) {
          return (
            <NowPanelSymbol
              symbol={activeTicker.symbol}
              activeTicker={activeTicker}
              contracts={contracts}
              onContractSelect={onContractSelect}
              compositeSignals={compositeSignals}
              watchlist={watchlist}
              disableAutoSelect={disableAutoSelect}
            />
          );
        }

        // Trade is LOADED - show decision card
        if (focusedTrade) {
          return (
            <NowPanelTrade
              trade={focusedTrade}
              tradeState={focusedTrade.state}
              activeTicker={activeTicker}
              watchlist={watchlist}
              channels={channels}
              challenges={challenges}
              selectedChannels={manager.alertConfig.channelIds}
              selectedChallenges={manager.alertConfig.challengeIds}
              onChannelsChange={(channelIds) => manager.actions.updateAlertSettings({ channelIds })}
              onChallengesChange={(challengeIds) =>
                manager.actions.updateAlertSettings({ challengeIds })
              }
              onEnterAndAlert={async (channelIds, challengeIds) => {
                // Update alert settings then enter trade
                manager.actions.updateAlertSettings({ channelIds, challengeIds, sendAlert: true });
                await manager.actions.enterTrade();
              }}
            />
          );
        }

        return <NowPanelEmpty message="No trade selected" />;

      case "entered":
        // ENTERED state - show management cockpit
        if (!focusedTrade) {
          return <NowPanelEmpty message="Trade not found" />;
        }

        return (
          <NowPanelManage
            trade={focusedTrade}
            activeTicker={activeTicker}
            watchlist={watchlist}
            // Use manager actions when available, fall back to legacy props
            onTrim={
              onTrim ||
              ((percent) => {
                // TODO: Integrate with manager.actions when trim is implemented
                console.log(`[NowPanel] Trim ${percent}%`);
              })
            }
            onMoveSLToBreakeven={onMoveSLToBreakeven}
            onTrailStop={onTrailStop}
            onAdd={onAdd}
            onExit={
              onExit ||
              (async (sendAlert) => {
                manager.actions.updateAlertSettings({ sendAlert });
                await manager.actions.exitTrade({ exitPercent: 100, reason: "manual_exit" });
              })
            }
            onTakeProfit={
              onTakeProfit ||
              (async (sendAlert) => {
                manager.actions.updateAlertSettings({ sendAlert });
                await manager.actions.exitTrade({ exitPercent: 100, reason: "take_profit" });
              })
            }
            onBroadcastUpdate={onBroadcastUpdate}
          />
        );

      case "exited":
        // EXITED state - show trade recap
        if (!focusedTrade) {
          return <NowPanelEmpty message="Trade not found" />;
        }

        return (
          <NowPanelTrade
            trade={focusedTrade}
            tradeState="EXITED"
            activeTicker={activeTicker}
            watchlist={watchlist}
          />
        );

      default:
        return <NowPanelEmpty />;
    }
  };

  // ============================================================================
  // Alert Popover Logic
  // ============================================================================

  // Determine alert mode based on view/trade state
  const alertMode: AlertMode = useMemo(() => {
    if (viewState === "entered") return "update";
    if (viewState === "loaded" && focusedTrade?.state === "LOADED") return "entry";
    if (viewState === "exited") return "exit";
    return "load";
  }, [viewState, focusedTrade?.state]);

  // Discord hook for sending alerts
  const { sendUpdateAlert } = useDiscord();

  // Handle alert send from popover
  const handleAlertSend = useCallback(
    async (channelIds: string[], message: string, options?: { includeChart?: boolean }) => {
      if (!focusedTrade || channelIds.length === 0) return;

      // Get channel objects from IDs
      const selectedChannels = channels.filter((ch) => channelIds.includes(ch.id));
      if (selectedChannels.length === 0) return;

      // Send update alert (generic type for now)
      await sendUpdateAlert(selectedChannels, focusedTrade, "generic", message);
    },
    [focusedTrade, channels, sendUpdateAlert]
  );

  // Get header title based on view state
  const headerTitle = useMemo(() => {
    switch (viewState) {
      case "symbol":
        return focus?.kind === "symbol" ? focus.symbol : activeTicker?.symbol || "Symbol";
      case "loaded":
        return focusedTrade?.ticker || "Trade Setup";
      case "entered":
        return focusedTrade?.ticker || "Managing Trade";
      case "exited":
        return focusedTrade?.ticker || "Trade Complete";
      default:
        return "Now Panel";
    }
  }, [viewState, focus, activeTicker, focusedTrade]);

  // ============================================================================
  // Loading Overlay (during transitions)
  // ============================================================================

  const showLoadingOverlay = manager.state.isLoading || isTransitioning;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Context-Aware Header Strip */}
      {viewState !== "empty" && (
        <div className="flex-shrink-0 h-10 px-3 flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
          {/* Left: View Title */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                viewState === "entered"
                  ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                  : viewState === "loaded"
                    ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                    : viewState === "exited"
                      ? "bg-[var(--text-muted)]/20 text-[var(--text-muted)]"
                      : "bg-[var(--surface-2)] text-[var(--text-muted)]"
              )}
            >
              {viewState === "symbol" ? "Watch" : viewState}
            </span>
            <span className="text-sm font-medium text-[var(--text-high)]">{headerTitle}</span>
          </div>

          {/* Right: Alert Popover Button */}
          {channels.length > 0 && (
            <HDAlertComposerPopover
              trade={focusedTrade || undefined}
              mode={alertMode}
              channels={channels}
              onSend={handleAlertSend}
            />
          )}
        </div>
      )}

      {/* Animated View Transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewState}
          variants={viewAnimationVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex-1 flex flex-col overflow-hidden"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-[var(--surface-0)]/50 backdrop-blur-sm flex items-center justify-center z-10"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
            <span className="text-sm text-[var(--text-muted)]">
              {manager.state.currentAction
                ? `${manager.state.currentAction.charAt(0).toUpperCase() + manager.state.currentAction.slice(1)}ing...`
                : "Processing..."}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default NowPanel;
