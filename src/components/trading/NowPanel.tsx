/**
 * NowPanel - State Orchestrator (Center Panel)
 *
 * COCKPIT LAYOUT INTEGRATION - This is now a thin router that delegates
 * to cockpit-based child panels.
 *
 * The central "State Orchestrator" that switches between views based on trade lifecycle:
 * - WATCHING (no trade or viewing symbol) → NowPanelSymbol (cockpit layout)
 * - LOADED (trade ready to enter) → NowPanelTrade (cockpit layout)
 * - ENTERED (actively managing) → NowPanelManage (cockpit layout)
 * - EXITED → NowPanelTrade (cockpit layout, recap mode)
 *
 * Uses framer-motion for smooth view transitions.
 * Integrates with useTradeActionManager to pass actions to child panels.
 *
 * NOTE: The duplicate header has been removed since CockpitHeader in each
 * child panel now handles state badge, dual pricing, and data freshness.
 * The AlertPopover is kept as a floating element for quick alert access.
 */

import React, { useMemo, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Ticker, Contract, Trade, TradeState, DiscordChannel, Challenge } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import {
  type FocusTarget,
  type ViewState,
  deriveViewState,
  deriveAlertMode,
} from "../../domain/viewRouter";
import { NowPanelEmpty } from "./NowPanelEmpty";
import { NowPanelSymbol, type TradeType } from "./NowPanelSymbol";
import { NowPanelTrade } from "./NowPanelTrade";
import { NowPanelManage } from "./NowPanelManage";
import { useTradeActionManager } from "../../hooks/useTradeActionManager";
import { HDAlertComposerPopover, type AlertMode } from "../hd/alerts/HDAlertComposerPopover";
import { HDAlertComposer, type PriceOverrides } from "../hd/alerts/HDAlertComposer";
import { useDiscord } from "../../hooks/useDiscord";
import { useUIStore } from "../../stores/uiStore";
import { Bell } from "lucide-react";
import type { AlertType } from "../../types";

// ============================================================================
// Types
// ============================================================================

// ViewState is imported from viewRouter - re-export for consumers
export type { ViewState };

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
  /** Callback to load strategy (persists LOADED trade to database) */
  onLoadStrategy?: (contract: Contract, options?: { tradeType?: TradeType }) => void;
  compositeSignals?: CompositeSignal[];
  // For symbol view - watchlist reference
  watchlist?: Ticker[];
  /** Whether a trade action is currently in progress */
  isTransitioning?: boolean;
  // Discord/Challenge context (for alerts)
  channels?: DiscordChannel[];
  challenges?: Challenge[];
  // Alert composer state - when true, shows full HDAlertComposer sidebar
  showAlert?: boolean;
  alertType?: AlertType;
  alertOptions?: { updateKind?: "trim" | "generic" | "sl" | "take-profit"; trimPercent?: number };
  /** Called when alert is sent from composer */
  onSendAlert?: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  /** Called when alert composer is cancelled */
  onCancelAlert?: () => void;
  /** Called to open alert composer for entering a trade */
  onOpenEnterAlert?: () => void;
  /** Called to unload/dismiss a loaded trade */
  onUnload?: () => void;
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
// Helper Functions
// ============================================================================

// deriveViewState and deriveAlertMode are now imported from viewRouter

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
  onLoadStrategy,
  compositeSignals,
  watchlist = [],
  isTransitioning = false,
  channels = [],
  challenges = [],
  showAlert = false,
  alertType = "load",
  alertOptions,
  onSendAlert,
  onCancelAlert,
  onOpenEnterAlert,
  onUnload,
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
  // Alert Composer State
  // ============================================================================

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
            onLoadStrategy={onLoadStrategy}
            compositeSignals={compositeSignals}
            watchlist={watchlist}
            disableAutoSelect={disableAutoSelect}
          />
        );

      case "plan":
        // WATCHING state - trade preview (not yet persisted)
        if (!focusedTrade) {
          return <NowPanelEmpty message="No trade selected" />;
        }

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
            onOpenEnterAlert={onOpenEnterAlert}
            onEnterAndAlert={async (channelIds, challengeIds) => {
              // For WATCHING state, this will "Load and Alert" first
              manager.actions.updateAlertSettings({ channelIds, challengeIds, sendAlert: true });
              await manager.actions.enterTrade();
            }}
          />
        );

      case "loaded":
        // LOADED state - trade persisted, ready to enter
        if (!focusedTrade && activeTicker) {
          return (
            <NowPanelSymbol
              symbol={activeTicker.symbol}
              activeTicker={activeTicker}
              contracts={contracts}
              onContractSelect={onContractSelect}
              onLoadStrategy={onLoadStrategy}
              compositeSignals={compositeSignals}
              watchlist={watchlist}
              disableAutoSelect={disableAutoSelect}
            />
          );
        }

        // Trade is LOADED - show decision card with "Enter" option
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
              onOpenEnterAlert={onOpenEnterAlert}
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

  // Determine alert mode using centralized viewRouter
  const alertMode: AlertMode = useMemo(
    () => deriveAlertMode(viewState, focusedTrade),
    [viewState, focusedTrade]
  );

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

  // ============================================================================
  // Loading Overlay (during transitions)
  // ============================================================================

  const showLoadingOverlay = manager.state.isLoading || isTransitioning;

  // Get underlying price for the alert composer
  const underlyingPrice = activeTicker?.last || 0;
  const underlyingChange = activeTicker?.changePercent || 0;

  // Determine the trade to show in alert composer
  // Priority: focusedTrade > currentTrade > first entered trade from activeTrades
  const alertTrade = useMemo(() => {
    if (focusedTrade) return focusedTrade;
    if (currentTrade) return currentTrade;
    // Fallback: find an ENTERED trade from activeTrades
    const enteredTrade = activeTrades.find((t) => t.state === "ENTERED");
    return enteredTrade || null;
  }, [focusedTrade, currentTrade, activeTrades]);

  // DEBUG: Track alert composer conditions
  useEffect(() => {
    if (showAlert) {
      console.log("[NowPanel] showAlert is TRUE:", {
        showAlert,
        alertType,
        alertOptions,
        focusedTrade: focusedTrade?.ticker || "null",
        currentTrade: currentTrade?.ticker || "null",
        alertTrade: alertTrade?.ticker || "null",
        activeTradesCount: activeTrades.length,
        willShowComposer: !!(showAlert && alertTrade),
      });
    }
  }, [
    showAlert,
    alertType,
    alertOptions,
    focusedTrade,
    currentTrade,
    alertTrade,
    activeTrades.length,
  ]);

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${showAlert && alertTrade ? "lg:pr-0" : ""}`}
      >
        {/* Floating Alert Button - Quick access to Discord alerts (hide when composer is showing) */}
        {viewState !== "empty" && !showAlert && (
          <div className="absolute top-2 right-2 z-30">
            {channels.length > 0 ? (
              <HDAlertComposerPopover
                trade={focusedTrade || undefined}
                mode={alertMode}
                channels={channels}
                onSend={handleAlertSend}
              />
            ) : (
              <button
                onClick={() => useUIStore.getState().openDiscordSettings()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-1)]/90 backdrop-blur border border-[var(--border-hairline)] text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors shadow-sm"
                data-testid="configure-alerts-btn"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Alerts</span>
              </button>
            )}
          </div>
        )}

        {/* View Container - No unmount/remount on state transitions to preserve chart state */}
        <div className="flex-1 flex flex-col overflow-hidden">{renderContent()}</div>

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

      {/* Alert Composer Sidebar - Shows when explicitly triggered */}
      <AnimatePresence mode="wait">
        {showAlert && alertTrade && (
          <motion.div
            key="alert-composer-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{
              width: 320,
              opacity: 1,
              transition: {
                width: { duration: 0.2, ease: "easeOut" },
                opacity: { duration: 0.15, delay: 0.05 },
              },
            }}
            exit={{
              width: 0,
              opacity: 0,
              transition: {
                opacity: { duration: 0.1 },
                width: { duration: 0.15, delay: 0.05, ease: "easeIn" },
              },
            }}
            className="hidden lg:flex lg:flex-col lg:flex-shrink-0 border-l border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden"
          >
            <div className="h-full overflow-y-auto w-[320px]">
              <HDAlertComposer
                trade={alertTrade}
                alertType={alertType}
                alertOptions={alertOptions}
                availableChannels={channels}
                challenges={challenges}
                onSend={onSendAlert || (() => {})}
                onEnterAndAlert={
                  alertType === "load" || alertType === "enter"
                    ? (channelIds, challengeIds, comment, priceOverrides) => {
                        // For load/enter alerts, this transitions state and sends alert
                        onSendAlert?.(channelIds, challengeIds, comment, priceOverrides);
                      }
                    : undefined
                }
                onCancel={onCancelAlert}
                onUnload={onUnload}
                underlyingPrice={underlyingPrice}
                underlyingChange={underlyingChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NowPanel;
