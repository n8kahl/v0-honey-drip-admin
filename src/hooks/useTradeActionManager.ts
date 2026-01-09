/**
 * useTradeActionManager - Bridge between UI and backend trade/Discord logic
 *
 * This hook acts as the orchestration layer for trade actions, managing:
 * 1. Alert settings (channels, mentions) that persist across trade lifecycle
 * 2. Smart Gate validation before entry
 * 3. Trade lifecycle transitions (LOAD → ENTER → EXIT)
 * 4. Discord alert dispatch
 * 5. Toast notifications for all actions
 *
 * @module hooks/useTradeActionManager
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Trade, TradeState, DiscordChannel, Challenge, Contract } from "../types";
import type { SymbolFeatures } from "../lib/strategy/engine";
import type { StrategySmartGates } from "../types/strategy";
import type { PriceOverrides } from "../components/hd/alerts/HDAlertComposer";
import { useAuth } from "../contexts/AuthContext";
import { useDiscord } from "./useDiscord";
import { useTradeStore } from "../stores/tradeStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useMarketDataStore } from "../stores/marketDataStore";
import {
  createTradeApi,
  updateTradeApi,
  deleteTradeApi,
  addTradeUpdateApi,
  linkChannelsApi,
  linkChallengesApi,
} from "../lib/api/tradeApi";
import { calculateNetPnLPercent } from "../services/pnlCalculator";
import { areAllGatesPassing } from "../components/hd/terminal/SmartGateList";

// ============================================================================
// Types
// ============================================================================

export interface AlertSettings {
  /** Selected Discord channel IDs for alerts */
  channelIds: string[];
  /** Selected challenge IDs to link trade to */
  challengeIds: string[];
  /** Optional @mentions for Discord alerts */
  mentions: string[];
  /** Optional comment/note for alerts */
  comment: string;
  /** Send alert flag */
  sendAlert: boolean;
}

export interface TradeActionManagerState {
  /** Current alert settings (persists across lifecycle) */
  alertSettings: AlertSettings;
  /** Whether an action is in progress */
  isLoading: boolean;
  /** Current action being performed */
  currentAction: "load" | "enter" | "exit" | "cancel" | null;
  /** Last error message */
  error: string | null;
  /** Smart Gates validation result */
  gatesStatus: {
    allPassed: boolean;
    blockedGates: string[];
  };
}

export interface TradeActionManagerActions {
  /** Load a strategy/signal as a LOADED trade */
  loadStrategy: (params: LoadStrategyParams) => Promise<Trade | null>;
  /** Enter a trade (validates Smart Gates first) */
  enterTrade: (overrideParams?: EnterTradeParams) => Promise<Trade | null>;
  /** Exit a trade (full or partial) */
  exitTrade: (params: ExitTradeParams) => Promise<Trade | null>;
  /** Cancel/unload a LOADED trade */
  cancelOrder: () => Promise<boolean>;
  /** Update alert settings */
  updateAlertSettings: (updates: Partial<AlertSettings>) => void;
  /** Reset alert settings to defaults */
  resetAlertSettings: () => void;
  /** Validate Smart Gates without executing */
  validateGates: (gates?: StrategySmartGates, features?: SymbolFeatures) => boolean;
}

export interface LoadStrategyParams {
  /** Contract to load */
  contract: Contract;
  /** Optional trade type override */
  tradeType?: "Scalp" | "Day" | "Swing" | "LEAP";
  /** Target price */
  targetPrice?: number;
  /** Stop loss price */
  stopLoss?: number;
  /** Setup type from strategy */
  setupType?: string;
  /** Confluence data */
  confluence?: Trade["confluence"];
  /** Price overrides for Discord alert */
  priceOverrides?: PriceOverrides;
}

export interface EnterTradeParams {
  /** Entry price override */
  entryPrice?: number;
  /** Target price override */
  targetPrice?: number;
  /** Stop loss override */
  stopLoss?: number;
  /** Price overrides for Discord alert */
  priceOverrides?: PriceOverrides;
  /** Bypass Smart Gate validation (use with caution) */
  bypassGates?: boolean;
}

export interface ExitTradeParams {
  /** Exit percentage (100 = full exit, 50 = trim half) */
  exitPercent: number;
  /** Exit reason/comment */
  reason?: string;
  /** Current price at exit */
  exitPrice?: number;
  /** Price overrides for Discord alert */
  priceOverrides?: PriceOverrides;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  channelIds: [],
  challengeIds: [],
  mentions: [],
  comment: "",
  sendAlert: true,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTradeActionManager(
  activeTrade: Trade | null,
  selectedTicker: string
): {
  actions: TradeActionManagerActions;
  state: TradeActionManagerState;
  alertConfig: AlertSettings;
} {
  // ========================================================================
  // Dependencies
  // ========================================================================
  const { user } = useAuth();
  const discord = useDiscord();
  const discordChannels = useSettingsStore((s) => s.discordChannels);
  const challenges = useSettingsStore((s) => s.challenges);
  const symbolData = useMarketDataStore((s) => s.symbols[selectedTicker]);

  // Store actions
  const {
    setActiveTrades,
    loadTrades,
    applyTradePatch,
    setCurrentTradeId,
    setPreviewTrade,
    setIsTransitioning,
  } = useTradeStore();

  // ========================================================================
  // Local State
  // ========================================================================
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() => {
    // Initialize with default channels if available
    const defaultChannels = discordChannels
      .filter((ch) => ch.isDefaultLoad || ch.isDefaultEnter || ch.isGlobalDefault)
      .map((ch) => ch.id);

    return {
      ...DEFAULT_ALERT_SETTINGS,
      channelIds: defaultChannels,
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<"load" | "enter" | "exit" | "cancel" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Ref to track previous trade for settings persistence
  const prevTradeIdRef = useRef<string | null>(null);

  // ========================================================================
  // Preserve alert settings when trade changes (but stay in same symbol)
  // ========================================================================
  useEffect(() => {
    if (activeTrade?.id !== prevTradeIdRef.current) {
      // Only reset if completely new trade context
      if (activeTrade && prevTradeIdRef.current === null) {
        // New trade started - preserve existing settings
      } else if (!activeTrade && prevTradeIdRef.current) {
        // Trade exited - optionally reset
        // Keep settings for now to support rapid re-entry
      }
      prevTradeIdRef.current = activeTrade?.id ?? null;
    }
  }, [activeTrade?.id]);

  // ========================================================================
  // Smart Gates Validation
  // ========================================================================
  const gatesStatus = useMemo(() => {
    // Get features for current symbol
    // Note: SymbolData has similar structure but different typing than SymbolFeatures
    // We cast through unknown since the shape is compatible for gate checking
    const features = symbolData as unknown as SymbolFeatures | undefined;

    // TODO: Get smart gates from active strategy/signal
    // For now, return all passed if no gates defined
    const gates: StrategySmartGates | undefined = undefined;

    const allPassed = areAllGatesPassing(gates, features, true);

    // Collect blocked gate names for UI
    const blockedGates: string[] = [];
    if (gates && features) {
      if (gates.minFlowScore !== undefined) {
        const flowScore = features?.flow?.flowScore ?? 0;
        if (flowScore < gates.minFlowScore) {
          blockedGates.push(`Flow Score < ${gates.minFlowScore}`);
        }
      }
      if (gates.requiredFlowBias && gates.requiredFlowBias !== "any") {
        const flowBias = features?.flow?.flowBias ?? "neutral";
        if (flowBias !== gates.requiredFlowBias) {
          blockedGates.push(`Flow Bias not ${gates.requiredFlowBias}`);
        }
      }
      if (gates.minInstitutionalScore !== undefined) {
        const instScore = features?.flow?.institutionalConviction ?? 0;
        if (instScore < gates.minInstitutionalScore) {
          blockedGates.push(`Institutional Score < ${gates.minInstitutionalScore}`);
        }
      }
    }

    return { allPassed, blockedGates };
  }, [symbolData]);

  // ========================================================================
  // Actions
  // ========================================================================

  /**
   * Update alert settings
   */
  const updateAlertSettings = useCallback((updates: Partial<AlertSettings>) => {
    setAlertSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset alert settings to defaults
   */
  const resetAlertSettings = useCallback(() => {
    const defaultChannels = discordChannels
      .filter((ch) => ch.isDefaultLoad || ch.isDefaultEnter || ch.isGlobalDefault)
      .map((ch) => ch.id);

    setAlertSettings({
      ...DEFAULT_ALERT_SETTINGS,
      channelIds: defaultChannels,
    });
  }, [discordChannels]);

  /**
   * Validate Smart Gates without executing
   */
  const validateGates = useCallback(
    (gates?: StrategySmartGates, features?: SymbolFeatures): boolean => {
      const featuresToUse = features ?? (symbolData as unknown as SymbolFeatures | undefined);
      return areAllGatesPassing(gates, featuresToUse, true);
    },
    [symbolData]
  );

  /**
   * Load a strategy/signal as a LOADED trade
   */
  const loadStrategy = useCallback(
    async (params: LoadStrategyParams): Promise<Trade | null> => {
      if (!user?.id) {
        toast.error("Authentication Required", { description: "Please sign in to load trades" });
        return null;
      }

      if (!selectedTicker) {
        toast.error("No Symbol Selected", { description: "Select a symbol first" });
        return null;
      }

      setIsLoading(true);
      setCurrentAction("load");
      setError(null);
      setIsTransitioning(true);

      try {
        // Create trade in database
        const dbTrade = await createTradeApi(user.id, {
          ticker: selectedTicker,
          contract: params.contract,
          tradeType: params.tradeType ?? "Day",
          targetPrice: params.targetPrice,
          stopLoss: params.stopLoss,
          status: "loaded",
          setupType: params.setupType,
          confluence: params.confluence,
          discordChannelIds: alertSettings.channelIds,
          challengeIds: alertSettings.challengeIds,
        });

        // Link channels and challenges
        if (alertSettings.channelIds.length > 0) {
          await linkChannelsApi(user.id, dbTrade.id, alertSettings.channelIds).catch(console.warn);
        }
        if (alertSettings.challengeIds.length > 0) {
          await linkChallengesApi(user.id, dbTrade.id, alertSettings.challengeIds).catch(
            console.warn
          );
        }

        // Build trade object
        const trade: Trade = {
          ...dbTrade,
          state: "LOADED",
          discordChannels: alertSettings.channelIds,
          challenges: alertSettings.challengeIds,
        };

        // Send Discord alert if enabled
        if (alertSettings.sendAlert && alertSettings.channelIds.length > 0) {
          const channels = discordChannels.filter((ch) => alertSettings.channelIds.includes(ch.id));
          if (channels.length > 0) {
            await discord.sendLoadAlert(
              channels,
              trade,
              alertSettings.comment,
              params.priceOverrides
            );
            toast.success("Trade Loaded", {
              description: `${selectedTicker} loaded. Alert sent to ${channels.length} channel(s)`,
            });
          }
        } else {
          toast.success("Trade Loaded", { description: `${selectedTicker} ready for entry` });
        }

        // Reload trades from DB to sync state
        await loadTrades(user.id);
        setCurrentTradeId(dbTrade.id);

        return trade;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load strategy";
        setError(message);
        toast.error("Load Failed", { description: message });
        return null;
      } finally {
        setIsLoading(false);
        setCurrentAction(null);
        setIsTransitioning(false);
      }
    },
    [
      user?.id,
      selectedTicker,
      alertSettings,
      discordChannels,
      discord,
      loadTrades,
      setCurrentTradeId,
      setIsTransitioning,
    ]
  );

  /**
   * Enter a trade (validates Smart Gates first)
   */
  const enterTrade = useCallback(
    async (overrideParams?: EnterTradeParams): Promise<Trade | null> => {
      if (!user?.id) {
        toast.error("Authentication Required", { description: "Please sign in to enter trades" });
        return null;
      }

      if (!activeTrade) {
        toast.error("No Trade Selected", { description: "Load a trade first" });
        return null;
      }

      // Validate trade state
      if (activeTrade.state !== "WATCHING" && activeTrade.state !== "LOADED") {
        toast.error("Invalid State", {
          description: `Cannot enter from ${activeTrade.state} state`,
        });
        return null;
      }

      // Validate Smart Gates (unless bypassed)
      if (!overrideParams?.bypassGates && !gatesStatus.allPassed) {
        toast.error("Smart Gates Blocked", {
          description: `Entry blocked: ${gatesStatus.blockedGates.join(", ")}`,
        });
        return null;
      }

      setIsLoading(true);
      setCurrentAction("enter");
      setError(null);
      setIsTransitioning(true);

      try {
        const entryPrice =
          overrideParams?.entryPrice ?? activeTrade.contract?.mid ?? activeTrade.entryPrice ?? 0;
        const targetPrice = overrideParams?.targetPrice ?? activeTrade.targetPrice;
        const stopLoss = overrideParams?.stopLoss ?? activeTrade.stopLoss;
        const now = new Date();

        // Update trade in database
        await updateTradeApi(user.id, activeTrade.id, {
          status: "entered",
          entry_price: entryPrice,
          entry_time: now.toISOString(),
          target_price: targetPrice,
          stop_loss: stopLoss,
        });

        // Record entry action
        await addTradeUpdateApi(
          user.id,
          activeTrade.id,
          "enter",
          entryPrice,
          alertSettings.comment || "Position entered"
        );

        // Build updated trade
        const trade: Trade = {
          ...activeTrade,
          state: "ENTERED",
          entryPrice,
          entryTime: now,
          targetPrice,
          stopLoss,
        };

        // Send Discord alert if enabled
        if (alertSettings.sendAlert && alertSettings.channelIds.length > 0) {
          const channels = discordChannels.filter((ch) => alertSettings.channelIds.includes(ch.id));
          if (channels.length > 0) {
            await discord.sendEntryAlert(
              channels,
              trade,
              alertSettings.comment,
              undefined,
              undefined,
              overrideParams?.priceOverrides
            );
            toast.success("Trade Entered", {
              description: `${activeTrade.ticker} @ $${entryPrice.toFixed(2)}. Alert sent!`,
            });
          }
        } else {
          toast.success("Trade Entered", {
            description: `${activeTrade.ticker} @ $${entryPrice.toFixed(2)}`,
          });
        }

        // Reload trades to sync state
        await loadTrades(user.id);

        return trade;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to enter trade";
        setError(message);
        toast.error("Entry Failed", { description: message });
        return null;
      } finally {
        setIsLoading(false);
        setCurrentAction(null);
        setIsTransitioning(false);
      }
    },
    [
      user?.id,
      activeTrade,
      gatesStatus,
      alertSettings,
      discordChannels,
      discord,
      loadTrades,
      setIsTransitioning,
    ]
  );

  /**
   * Exit a trade (full or partial)
   */
  const exitTrade = useCallback(
    async (params: ExitTradeParams): Promise<Trade | null> => {
      if (!user?.id) {
        toast.error("Authentication Required", { description: "Please sign in to exit trades" });
        return null;
      }

      if (!activeTrade) {
        toast.error("No Trade Selected", { description: "Select a trade to exit" });
        return null;
      }

      if (activeTrade.state !== "ENTERED") {
        toast.error("Invalid State", { description: "Trade must be ENTERED to exit" });
        return null;
      }

      setIsLoading(true);
      setCurrentAction("exit");
      setError(null);
      setIsTransitioning(true);

      try {
        const exitPrice = params.exitPrice ?? activeTrade.currentPrice ?? 0;
        const entryPrice = activeTrade.entryPrice ?? 0;
        const quantity = activeTrade.quantity ?? 1;
        const now = new Date();

        // Calculate P&L
        // If exit price is 0 (expired), force -100% loss
        let pnlPercent = 0;
        let movePercent = 0;

        if (exitPrice === 0 && entryPrice > 0) {
          pnlPercent = -100;
          movePercent = -100;
        } else if (entryPrice > 0 && exitPrice > 0) {
          pnlPercent = calculateNetPnLPercent(entryPrice, exitPrice, quantity);
          movePercent = ((exitPrice - entryPrice) / entryPrice) * 100;
        }

        // Determine if partial or full exit
        const isPartialExit = params.exitPercent < 100;

        if (isPartialExit) {
          // Partial exit (trim)
          await updateTradeApi(user.id, activeTrade.id, {
            current_price: exitPrice,
          });

          await addTradeUpdateApi(
            user.id,
            activeTrade.id,
            "trim",
            exitPrice,
            params.reason || `Trimmed ${params.exitPercent}%`,
            pnlPercent,
            params.exitPercent
          );

          toast.success("Position Trimmed", {
            description: `${activeTrade.ticker} trimmed ${params.exitPercent}% @ $${exitPrice.toFixed(2)}`,
          });

          // Send update alert
          if (alertSettings.sendAlert && alertSettings.channelIds.length > 0) {
            const channels = discordChannels.filter((ch) =>
              alertSettings.channelIds.includes(ch.id)
            );
            if (channels.length > 0) {
              await discord.sendUpdateAlert(
                channels,
                { ...activeTrade, currentPrice: exitPrice, movePercent },
                "trim",
                params.reason || `Trimmed ${params.exitPercent}%`
              );
            }
          }

          await loadTrades(user.id);
          return { ...activeTrade, currentPrice: exitPrice };
        } else {
          // Full exit / Expiration
          await updateTradeApi(user.id, activeTrade.id, {
            status: "exited",
            exit_price: exitPrice,
            exit_time: now.toISOString(),
            move_percent: movePercent,
          });

          await addTradeUpdateApi(
            user.id,
            activeTrade.id,
            "exit",
            exitPrice,
            params.reason ||
              (exitPrice === 0 ? "Expired Worthless" : `Exit at $${exitPrice.toFixed(2)}`),
            pnlPercent
          );

          const trade: Trade = {
            ...activeTrade,
            state: "EXITED",
            exitPrice,
            exitTime: now,
            movePercent,
          };

          // Send exit alert
          if (alertSettings.sendAlert && alertSettings.channelIds.length > 0) {
            const channels = discordChannels.filter((ch) =>
              alertSettings.channelIds.includes(ch.id)
            );
            if (channels.length > 0) {
              await discord.sendExitAlert(
                channels,
                trade,
                params.reason || (exitPrice === 0 ? "Shared Expired Recap" : params.reason)
              );
            }
          }

          const pnlEmoji = movePercent >= 0 ? "🟢" : "🔴";
          const desc =
            exitPrice === 0
              ? "Contract expired and removed from active trades"
              : `${pnlEmoji} ${activeTrade.ticker} closed ${movePercent >= 0 ? "+" : ""}${movePercent.toFixed(1)}%`;

          toast.success(exitPrice === 0 ? "Position Cleared" : "Trade Exited", {
            description: desc,
          });

          await loadTrades(user.id);
          return trade;
        }
      } catch (err) {
        console.error("[useTradeActionManager] Exit failed:", err);
        const message = err instanceof Error ? err.message : "Failed to exit trade";
        setError(message);
        toast.error("Exit Failed", { description: message });
        return null;
      } finally {
        setIsLoading(false);
        setCurrentAction(null);
        setIsTransitioning(false);
      }
    },
    [user?.id, activeTrade, alertSettings, discordChannels, discord, loadTrades, setIsTransitioning]
  );

  /**
   * Cancel/unload a LOADED trade
   */
  const cancelOrder = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      toast.error("Authentication Required", { description: "Please sign in" });
      return false;
    }

    if (!activeTrade) {
      toast.error("No Trade Selected", { description: "Select a trade to cancel" });
      return false;
    }

    if (activeTrade.state !== "LOADED") {
      toast.error("Invalid State", { description: "Only LOADED trades can be cancelled" });
      return false;
    }

    setIsLoading(true);
    setCurrentAction("cancel");
    setError(null);
    setIsTransitioning(true);

    try {
      // Delete trade from database
      await deleteTradeApi(user.id, activeTrade.id);

      toast.success("Order Cancelled", {
        description: `${activeTrade.ticker} removed from loaded trades`,
      });

      // Clear current trade and reload
      setCurrentTradeId(null);
      setPreviewTrade(null);
      await loadTrades(user.id);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel order";
      setError(message);
      toast.error("Cancel Failed", { description: message });
      return false;
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
      setIsTransitioning(false);
    }
  }, [user?.id, activeTrade, loadTrades, setCurrentTradeId, setPreviewTrade, setIsTransitioning]);

  // ========================================================================
  // Return Value
  // ========================================================================
  const actions: TradeActionManagerActions = useMemo(
    () => ({
      loadStrategy,
      enterTrade,
      exitTrade,
      cancelOrder,
      updateAlertSettings,
      resetAlertSettings,
      validateGates,
    }),
    [
      loadStrategy,
      enterTrade,
      exitTrade,
      cancelOrder,
      updateAlertSettings,
      resetAlertSettings,
      validateGates,
    ]
  );

  const state: TradeActionManagerState = useMemo(
    () => ({
      alertSettings,
      isLoading,
      currentAction,
      error,
      gatesStatus,
    }),
    [alertSettings, isLoading, currentAction, error, gatesStatus]
  );

  return {
    actions,
    state,
    alertConfig: alertSettings,
  };
}

export default useTradeActionManager;
