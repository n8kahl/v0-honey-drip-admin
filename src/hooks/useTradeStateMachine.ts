import { useState, useEffect, useCallback } from "react";
import {
  Trade,
  Ticker,
  Contract,
  TradeState,
  AlertType,
  TradeUpdate,
  DiscordChannel,
  SetupType,
} from "../types";
import type { PriceOverrides } from "../components/hd/alerts/HDAlertComposer";
import { calculateRisk } from "../lib/riskEngine/calculator";
import {
  inferTradeTypeByDTE,
  DEFAULT_DTE_THRESHOLDS,
  RISK_PROFILES,
} from "../lib/riskEngine/profiles";
import { adjustProfileByConfluence } from "../lib/riskEngine/confluenceAdjustment";
import { useAppToast } from "./useAppToast";
import { useAuth } from "../contexts/AuthContext";
import { useDiscord } from "./useDiscord";
import { useSettingsStore } from "../stores/settingsStore";
import {
  createTradeApi,
  updateTradeApi,
  deleteTradeApi,
  addTradeUpdateApi,
  linkChannelsApi,
  linkChallengesApi,
} from "../lib/api/tradeApi";
import { recordAlertHistory } from "../lib/supabase/database";
import { discordAlertLimiter, formatWaitTime } from "../lib/utils/rateLimiter";
import { getInitialConfluence } from "./useTradeConfluenceMonitor";

// Helper to get risk defaults from TP settings store
function getRiskDefaultsFromStore() {
  const { tpSettings } = useSettingsStore.getState();
  return {
    mode: tpSettings.tpMode,
    tpPercent: tpSettings.tpPercent,
    slPercent: tpSettings.slPercent,
    dteThresholds: DEFAULT_DTE_THRESHOLDS,
  };
}

interface UseTradeStateMachineProps {
  hotTrades: Trade[];
  onTradesChange?: (trades: Trade[]) => void;
  onExitedTrade?: (trade: Trade) => void;
  focusedTrade?: Trade | null;
  onMobileTabChange?: (tab: "live" | "active" | "history" | "settings") => void;
  confluence?: {
    loading: boolean;
    error: string | null;
    trend?: string;
    volatility?: string;
    liquidity?: string;
  };
}

interface TradeStateMachineState {
  activeTicker: Ticker | null;
  contracts: Contract[];
  currentTrade: Trade | null;
  tradeState: TradeState;
  alertType: AlertType;
  alertOptions: { updateKind?: "trim" | "generic" | "sl" };
  showAlert: boolean;
  activeTrades: Trade[];
}

interface TradeStateMachineActions {
  handleTickerClick: (ticker: Ticker) => void;
  handleContractSelect: (
    contract: Contract,
    confluenceData?: { trend?: any; volatility?: any; liquidity?: any },
    voiceReasoning?: string,
    explicitTicker?: Ticker
  ) => void;
  handleActiveTradeClick: (trade: Trade, watchlist: Ticker[]) => void;
  handleSendAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  handleEnterAndAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  handleEnterTrade: (
    channelIds?: string[],
    challengeIds?: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  handleCancelAlert: () => void;
  handleDiscard: () => void;
  handleUnloadTrade: () => void;
  handleTrim: () => void;
  handleTakeProfit: () => void;
  handleUpdate: () => void;
  handleUpdateSL: () => void;
  handleTrailStop: () => void;
  handleAdd: () => void;
  handleExit: () => void;
  setActiveTicker: (ticker: Ticker | null) => void;
  setContracts: (contracts: Contract[]) => void;
  setCurrentTrade: (trade: Trade | null) => void;
  setTradeState: (state: TradeState) => void;
  setActiveTrades: (trades: Trade[] | ((prev: Trade[]) => Trade[])) => void;
}

export function useTradeStateMachine({
  hotTrades,
  onTradesChange,
  onExitedTrade,
  focusedTrade,
  onMobileTabChange,
  confluence,
}: UseTradeStateMachineProps): TradeStateMachineState & { actions: TradeStateMachineActions } {
  const toast = useAppToast();
  const discord = useDiscord();
  const auth = useAuth();
  // Use fallback test user ID for local testing when not authenticated
  const userId = auth?.user?.id || "00000000-0000-0000-0000-000000000001";

  // State
  const [activeTicker, setActiveTicker] = useState<Ticker | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [currentTrade, setCurrentTrade] = useState<Trade | null>(null);
  const [tradeState, setTradeState] = useState<TradeState>("WATCHING");
  const [alertType, setAlertType] = useState<AlertType>("load");
  const [alertOptions, setAlertOptions] = useState<{ updateKind?: "trim" | "generic" | "sl" }>({});
  const [showAlert, setShowAlert] = useState(false);
  const [activeTrades, setActiveTrades] = useState<Trade[]>(hotTrades);
  const [isCreatingTrade, setIsCreatingTrade] = useState(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  // Sync active trades back to parent
  useEffect(() => {
    if (onTradesChange) {
      onTradesChange(activeTrades);
    }
  }, [activeTrades, onTradesChange]);

  // Handle focused trade from external navigation
  useEffect(() => {
    if (focusedTrade) {
      setCurrentTrade(focusedTrade);
      setTradeState(focusedTrade.state);
      const existing = activeTrades.find((t) => t.id === focusedTrade.id);
      if (!existing) {
        setActiveTrades((prev) => [...prev, focusedTrade]);
      }
    }
  }, [focusedTrade]);

  // Helper functions
  const openAlertComposer = useCallback(
    (type: AlertType, options?: { updateKind?: "trim" | "generic" | "sl" }) => {
      setAlertType(type);
      setAlertOptions(options || {});
      setShowAlert(true);
    },
    []
  );

  const showAlertToast = useCallback((type: string, ticker: string, channels: DiscordChannel[]) => {
    const channelNames = channels.map((c) => c.name).join(", ");
    const title = `${type.toUpperCase()} · ${ticker}`;
    const desc = channelNames ? `Sent to: ${channelNames}` : "Alert dispatched";
    toast.success(title, { description: desc } as any);
  }, []);

  const makeUpdate = useCallback(
    (type: TradeUpdate["type"], price: number, message: string = ""): TradeUpdate => {
      return {
        id: crypto.randomUUID(),
        type,
        timestamp: new Date(),
        price,
        message,
      };
    },
    []
  );

  const getDiscordChannelsForAlert = useCallback(
    (channelIds: string[], challengeIds: string[]): DiscordChannel[] => {
      const settingsStore = useSettingsStore.getState();
      const channels: DiscordChannel[] = [];

      // Add user-selected channels
      channelIds.forEach((id) => {
        const channel = settingsStore.getChannelById(id);
        if (channel) {
          // Validate webhook URL exists
          if (!channel.webhookUrl) {
            console.warn(
              `[Discord] Channel "${channel.name}" (${id}) missing webhook URL - skipping`
            );
          } else {
            channels.push(channel);
          }
        } else {
          console.warn(`[Discord] Channel ID "${id}" not found in settings store - skipping`);
        }
      });

      // Add channels from linked challenges
      challengeIds.forEach((challengeId) => {
        const challenge = settingsStore.getChallengeById(challengeId);
        if (challenge?.defaultChannel) {
          const channel = settingsStore.discordChannels.find(
            (ch) => ch.name.toLowerCase() === challenge.defaultChannel.toLowerCase()
          );
          if (channel && !channels.some((c) => c.id === channel.id)) {
            if (!channel.webhookUrl) {
              console.warn(
                `[Discord] Challenge channel "${channel.name}" missing webhook URL - skipping`
              );
            } else {
              channels.push(channel);
            }
          }
        }
      });

      // Warn if we requested channels but none were valid
      if (channelIds.length > 0 && channels.length === 0) {
        console.warn(
          `[Discord] No valid channels found from ${channelIds.length} requested channel IDs`
        );
      }

      return channels;
    },
    []
  );

  // Actions
  const handleTickerClick = useCallback((ticker: Ticker) => {
    setActiveTicker(ticker);
    setCurrentTrade(null);
    setTradeState("WATCHING");
  }, []);

  /**
   * Handle clicking on an active (ENTERED) trade in the left rail.
   * This properly sets up the middle column to display the trade cockpit.
   */
  const handleActiveTradeClick = useCallback((trade: Trade, watchlist: Ticker[]) => {
    // Set the trade as current
    setCurrentTrade(trade);
    setTradeState(trade.state);

    // Find and set the activeTicker so the chart renders
    const ticker = watchlist.find((w) => w.symbol === trade.ticker);
    if (ticker) {
      setActiveTicker(ticker);
    } else {
      // If ticker not in watchlist, create a minimal ticker object
      // This ensures charts can still render for the trade
      setActiveTicker({
        id: trade.ticker,
        symbol: trade.ticker,
        last: trade.currentPrice || trade.entryPrice || 0,
        change: 0,
        changePercent: 0,
      });
    }

    // Close alert composer if open (we're viewing, not alerting)
    setShowAlert(false);

    console.log(`[TradeStateMachine] Active trade clicked: ${trade.ticker} (${trade.id})`);
  }, []);

  const handleContractSelect = useCallback(
    async (
      contract: Contract,
      confluenceData?: {
        trend?: any;
        volatility?: any;
        liquidity?: any;
      },
      voiceReasoning?: string,
      explicitTicker?: Ticker
    ) => {
      // Use explicit ticker (from voice command) or activeTicker from state
      const ticker = explicitTicker || activeTicker;

      if (!ticker) {
        toast.error("Unable to create trade: No ticker selected");
        return;
      }

      setIsCreatingTrade(true);

      try {
        // Base defaults
        let targetPrice = contract.mid * 1.5;
        let stopLoss = contract.mid * 0.5;
        // Underlying price context for Format C display
        const underlyingPrice = ticker.last;
        let targetUnderlyingPrice: number | undefined;
        let stopUnderlyingPrice: number | undefined;

        try {
          const tradeType = inferTradeTypeByDTE(
            contract.expiry,
            new Date(),
            DEFAULT_DTE_THRESHOLDS
          );

          // Apply confluence adjustments if available
          let riskProfile = RISK_PROFILES[tradeType];
          if (
            confluenceData &&
            (confluenceData.trend || confluenceData.volatility || confluenceData.liquidity)
          ) {
            riskProfile = adjustProfileByConfluence(riskProfile, confluenceData);
            console.log("[v0] Applied confluence adjustments to risk profile");
          }

          const risk = calculateRisk({
            entryPrice: contract.mid,
            currentUnderlyingPrice: underlyingPrice,
            currentOptionMid: contract.mid,
            keyLevels: {
              preMarketHigh: 0,
              preMarketLow: 0,
              orbHigh: 0,
              orbLow: 0,
              priorDayHigh: 0,
              priorDayLow: 0,
              vwap: 0,
              vwapUpperBand: 0,
              vwapLowerBand: 0,
              bollingerUpper: 0,
              bollingerLower: 0,
              weeklyHigh: 0,
              weeklyLow: 0,
              monthlyHigh: 0,
              monthlyLow: 0,
              quarterlyHigh: 0,
              quarterlyLow: 0,
              yearlyHigh: 0,
              yearlyLow: 0,
            },
            expirationISO: contract.expiry,
            tradeType,
            delta: contract.delta ?? 0.5,
            gamma: contract.gamma ?? 0,
            defaults: getRiskDefaultsFromStore(),
          });
          if (risk.targetPrice) targetPrice = risk.targetPrice;
          if (risk.stopLoss) stopLoss = risk.stopLoss;
          // Capture underlying prices from risk calculation if available
          if (risk.targetUnderlyingPrice) targetUnderlyingPrice = risk.targetUnderlyingPrice;
          if (risk.stopUnderlyingPrice) stopUnderlyingPrice = risk.stopUnderlyingPrice;
        } catch {
          /* fallback silently */
        }

        // Capture initial confluence data from context engines
        // This runs in background and may complete after UI update
        const direction: "LONG" | "SHORT" = contract.type === "C" ? "LONG" : "SHORT";
        const initialConfluence = await getInitialConfluence(ticker.symbol, direction);
        console.log("[v0] Initial confluence captured:", initialConfluence?.score);

        // Create trade locally for UI display only
        // NOTE: State is WATCHING, not LOADED - this is just for previewing the contract
        // The trade is NOT added to activeTrades and NOT persisted yet
        const localTrade: Trade = {
          id: crypto.randomUUID(),
          ticker: ticker.symbol,
          state: "WATCHING", // Temporary state for contract preview
          contract,
          tradeType: inferTradeTypeByDTE(
            contract.expiry,
            new Date(),
            DEFAULT_DTE_THRESHOLDS
          ) as Trade["tradeType"],
          targetPrice,
          stopLoss,
          movePercent: 0,
          discordChannels: [],
          challenges: [],
          updates: [],
          // Rich confluence data from context engines
          confluence: initialConfluence || undefined,
          confluenceUpdatedAt: initialConfluence ? new Date() : undefined,
          // Underlying price context for Format C display
          underlyingPriceAtLoad: underlyingPrice,
          targetUnderlyingPrice,
          stopUnderlyingPrice,
          // Voice command context for alert composer
          voiceContext: voiceReasoning,
        };

        // Set as currentTrade for UI display (Trade Details, Analysis, etc.)
        setCurrentTrade(localTrade);
        setTradeState("WATCHING");
        setAlertType("load");
        setShowAlert(true);

        // DO NOT add to activeTrades yet - wait for "Load and Alert" button
        // DO NOT persist to database yet - wait for "Load and Alert" button
        // The user is just previewing this contract
      } catch (error) {
        console.error("[v0] Error in handleContractSelect:", error);
        toast.error("Failed to create trade", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        } as any);
        setCurrentTrade(null);
        setTradeState("WATCHING");
        setShowAlert(false);
      } finally {
        setIsCreatingTrade(false);
      }
    },
    [activeTicker, userId, toast]
  );

  const handleSendAlert = useCallback(
    async (
      channelIds: string[],
      challengeIds: string[],
      comment?: string,
      priceOverrides?: PriceOverrides
    ) => {
      if (!currentTrade || !userId) {
        toast.error("Unable to send alert: Trade or user missing");
        return;
      }

      const selectedChannels = channelIds
        .map((id) => ({ id, name: `Channel ${id.slice(0, 8)}` }))
        .filter((c) => c);

      // Apply price overrides from the alert composer (user-edited values)
      const effectiveTargetPrice = priceOverrides?.targetPrice ?? currentTrade.targetPrice;
      const effectiveStopLoss = priceOverrides?.stopLoss ?? currentTrade.stopLoss;
      const effectiveCurrentPrice =
        priceOverrides?.currentPrice ?? currentTrade.currentPrice ?? currentTrade.contract.mid;

      console.warn("[v0] handleSendAlert price overrides:", {
        from: {
          target: currentTrade.targetPrice,
          stop: currentTrade.stopLoss,
          current: currentTrade.currentPrice,
        },
        overrides: priceOverrides,
        effective: {
          target: effectiveTargetPrice,
          stop: effectiveStopLoss,
          current: effectiveCurrentPrice,
        },
      });

      // LOAD alert: Persist trade to database immediately so subsequent actions work
      if (alertType === "load") {
        try {
          console.warn("[v0] Loading trade (persisting to database)");

          // Create trade in database FIRST to get a real ID
          const dbTrade = await createTradeApi(userId, {
            ticker: currentTrade.ticker,
            contract: currentTrade.contract,
            targetPrice: effectiveTargetPrice,
            stopLoss: effectiveStopLoss,
            status: "loaded", // DB status for LOADED state
            discordChannelIds: channelIds,
            challengeIds: challengeIds,
            setupType: currentTrade.setupType,
            confluence: currentTrade.confluence,
            confluenceUpdatedAt: currentTrade.confluenceUpdatedAt?.toISOString(),
          });

          console.warn(`[v0] Trade created with DB ID: ${dbTrade.id}`);

          // Verify trade was actually saved to database
          try {
            const verifyTrades = await getTrades(userId);
            const foundTrade = verifyTrades.find((t) => t.id === dbTrade.id);
            if (!foundTrade) {
              console.error(
                `[v0] ❌ CRITICAL: Trade ${dbTrade.id} not found in database immediately after creation!`
              );
              toast.error("Trade failed to persist", {
                description: "Please try again or contact support.",
              } as any);
              return;
            }
            console.warn(
              `[v0] ✅ Verified trade ${dbTrade.id} exists in database with status: ${foundTrade.status}`
            );
          } catch (verifyError) {
            console.error(`[v0] Failed to verify trade creation:`, verifyError);
          }

          // Create trade object with REAL database ID
          const loadedTrade: Trade = {
            ...currentTrade,
            id: dbTrade.id, // Use real DB ID, not temp ID
            state: "LOADED",
            targetPrice: effectiveTargetPrice,
            stopLoss: effectiveStopLoss,
            currentPrice: effectiveCurrentPrice,
            discordChannels: channelIds,
            challenges: challengeIds,
          };

          // Update UI state
          setCurrentTrade(loadedTrade);
          setTradeState("LOADED");

          // Add to activeTrades list (so it shows in left sidebar)
          setActiveTrades((prev) => [...prev, loadedTrade]);

          setShowAlert(false);
          setContracts([]);
          // IMPORTANT: Do NOT clear activeTicker for load alerts - middle column needs it to display the chart
          // setActiveTicker(null);

          // Send Discord LOAD alert
          const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
          const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

          if (!discordAlertsEnabled) {
            toast.info("Discord alerts disabled", {
              description: "Enable in Settings → Discord to send alerts to channels.",
            } as any);
          } else if (channels.length === 0 && channelIds.length > 0) {
            toast.warning("No valid Discord channels", {
              description: "Check channel configuration in Settings → Discord.",
            } as any);
          } else if (channels.length > 0) {
            try {
              // Pass price overrides to Discord alert for Format C display
              // This ensures user-edited values flow through to Discord
              await discord.sendLoadAlert(
                channels,
                loadedTrade,
                undefined, // notes
                {
                  targetPrice: effectiveTargetPrice,
                  stopLoss: effectiveStopLoss,
                  targetUnderlyingPrice:
                    priceOverrides?.targetUnderlyingPrice ?? loadedTrade.targetUnderlyingPrice,
                  stopUnderlyingPrice:
                    priceOverrides?.stopUnderlyingPrice ?? loadedTrade.stopUnderlyingPrice,
                }
              );
              console.log("[Discord] LOAD alert sent successfully");
            } catch (error) {
              console.error("[Discord] Failed to send LOAD alert:", error);
              toast.error("Discord alert failed", {
                description: "Check console for details",
              } as any);
            }
          }

          showAlertToast("load", loadedTrade.ticker, selectedChannels as DiscordChannel[]);
        } catch (error) {
          console.error("[v0] Failed to load trade:", error);
          toast.error("Failed to load trade", {
            description: error instanceof Error ? error.message : "Unknown error occurred",
          } as any);
          // Revert state on error
          setCurrentTrade(null);
          setTradeState("WATCHING");
        }
        return;
      }

      // Determine base price to use for update entries
      const basePrice =
        currentTrade.currentPrice || currentTrade.entryPrice || currentTrade.contract.mid;
      const message = comment || "";

      let newTrade: Trade = { ...currentTrade };
      let updateType: TradeUpdate["type"] | null = null;

      // Ensure current updates array is valid before spreading
      const currentUpdates = Array.isArray(newTrade.updates) ? newTrade.updates : [];

      switch (alertType) {
        case "enter": {
          const entryPrice = basePrice;
          newTrade = {
            ...newTrade,
            state: "ENTERED",
            entryPrice,
            currentPrice: entryPrice,
            discordChannels: channelIds,
            challenges: challengeIds,
            updates: [...currentUpdates, makeUpdate("enter", entryPrice, message)],
          };
          updateType = "enter";
          break;
        }
        case "trim": {
          newTrade = {
            ...newTrade,
            discordChannels: channelIds,
            challenges: challengeIds,
            updates: [...currentUpdates, makeUpdate("trim", basePrice, message)],
          };
          updateType = "trim";
          break;
        }
        case "update": {
          const kind =
            alertOptions.updateKind === "trim"
              ? "trim"
              : alertOptions.updateKind === "take-profit"
                ? "trim" // Take profit uses "trim" update type (partial exit at target)
                : alertOptions.updateKind === "sl"
                  ? "update-sl"
                  : "update";
          const updateMessage =
            alertOptions.updateKind === "take-profit"
              ? message || "Taking profit at target"
              : message;
          newTrade = {
            ...newTrade,
            discordChannels: channelIds,
            challenges: challengeIds,
            updates: [
              ...currentUpdates,
              makeUpdate(kind as TradeUpdate["type"], basePrice, updateMessage),
            ],
          };
          updateType = kind as TradeUpdate["type"];
          break;
        }
        case "update-sl": {
          newTrade = {
            ...newTrade,
            updates: [
              ...currentUpdates,
              makeUpdate("update-sl", basePrice, message || "Stop loss adjusted"),
            ],
          };
          updateType = "update-sl";
          break;
        }
        case "trail-stop": {
          newTrade = {
            ...newTrade,
            updates: [
              ...currentUpdates,
              makeUpdate("trail-stop", basePrice, message || "Trailing stop moved"),
            ],
          };
          updateType = "trail-stop";
          break;
        }
        case "add": {
          newTrade = {
            ...newTrade,
            updates: [
              ...currentUpdates,
              makeUpdate("add", basePrice, message || "Added to position"),
            ],
          };
          updateType = "add";
          break;
        }
        case "exit": {
          const exitPrice = basePrice;
          // Calculate P&L percentage
          const movePercent = newTrade.entryPrice
            ? ((exitPrice - newTrade.entryPrice) / newTrade.entryPrice) * 100
            : 0;
          newTrade = {
            ...newTrade,
            state: "EXITED",
            exitPrice,
            exitTime: new Date(),
            movePercent,
            updates: [
              ...currentUpdates,
              makeUpdate("exit", exitPrice, message || "Exited position"),
            ],
          };
          updateType = "exit";
          break;
        }
      }

      // Optimistic update
      setActiveTrades((prev) => prev.map((t) => (t.id === newTrade.id ? newTrade : t)));
      setCurrentTrade(newTrade);
      setShowAlert(false);

      // Mobile UX: move to active tab on enter; go back to live on exit
      if (isMobile && onMobileTabChange) {
        if (newTrade.state === "ENTERED") onMobileTabChange("active");
        if (newTrade.state === "EXITED") onMobileTabChange("live");
      }

      // Callback for exited trades
      if (newTrade.state === "EXITED" && onExitedTrade) {
        // Clear currentTrade and remove from activeTrades immediately
        // The callback can handle any navigation it needs
        setCurrentTrade(null);
        setTradeState("WATCHING");
        setActiveTrades((prev) => prev.filter((t) => t.id !== newTrade.id));

        // Call the callback after state updates
        onExitedTrade(newTrade);
      }

      // Persist to database
      try {
        const persistencePromises = [];

        // LOADED → ENTERED: Trade already exists in DB (created on LOAD), just update status
        if (currentTrade.state === "LOADED" && newTrade.state === "ENTERED") {
          console.warn(`[v0] Updating trade in database (LOADED → ENTERED transition)`);

          persistencePromises.push(
            updateTradeApi(userId, newTrade.id, {
              status: "entered",
              entry_price: newTrade.entryPrice,
              entry_time: newTrade.entryTime?.toISOString?.() || new Date().toISOString(),
              target_price: newTrade.targetPrice,
              stop_loss: newTrade.stopLoss,
            }).catch((error) => {
              // Best-effort: trade may be in-memory only
              console.warn(
                "[v0] Trade status update failed (trade may be in-memory only):",
                error?.message
              );
            })
          );

          console.warn(`[v0] Trade ${newTrade.id} transitioning to ENTERED`);
        }
        // Normal case: Update existing trade in database
        else if (newTrade.state !== currentTrade.state) {
          const newStatus = newTrade.state === "ENTERED" ? "entered" : "exited";
          console.warn(
            `[v0] Updating trade ${newTrade.id} status: ${currentTrade.state} → ${newTrade.state} (DB status: ${newStatus})`
          );

          persistencePromises.push(
            updateTradeApi(userId, newTrade.id, {
              status: newStatus,
              entry_price: newTrade.entryPrice,
              entry_time: newTrade.entryTime,
              exit_price: newTrade.exitPrice,
              exit_time: newTrade.exitTime,
              move_percent: newTrade.movePercent,
            }).catch((error) => {
              // Best-effort: trade may be in-memory only
              console.warn(
                "[v0] Trade status update failed (trade may be in-memory only):",
                error?.message
              );
            })
          );
        } else {
          console.warn(
            `[v0] Trade state unchanged (${newTrade.state}), not updating database status`
          );
        }

        // Add trade update record (best-effort - trade may not exist in DB yet)
        if (updateType) {
          persistencePromises.push(
            addTradeUpdateApi(userId, newTrade.id, updateType, basePrice, message).catch(
              (error) => {
                // Don't fail the alert if trade_update insert fails
                // This happens when trade is in-memory only (not yet persisted via LOAD)
                console.warn(
                  "[v0] Trade update not persisted (trade may be in-memory only):",
                  error?.message
                );
              }
            )
          );
        }

        // Link channels if provided (best-effort - trade may not exist in DB yet)
        if (
          channelIds.length > 0 &&
          (alertType === "enter" || alertType === "trim" || alertType === "update")
        ) {
          persistencePromises.push(
            linkChannelsApi(userId, newTrade.id, channelIds).catch((error) => {
              console.warn(
                "[v0] Channels not linked (trade may be in-memory only):",
                error?.message
              );
            })
          );
        }

        // Link challenges if provided (best-effort - trade may not exist in DB yet)
        if (
          challengeIds.length > 0 &&
          (alertType === "enter" || alertType === "trim" || alertType === "update")
        ) {
          persistencePromises.push(
            linkChallengesApi(userId, newTrade.id, challengeIds).catch((error) => {
              console.warn(
                "[v0] Challenges not linked (trade may be in-memory only):",
                error?.message
              );
            })
          );
        }

        if (persistencePromises.length > 0) {
          await Promise.all(persistencePromises);
        }

        // Send Discord alerts
        const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
        const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

        if (!discordAlertsEnabled) {
          toast.info("Discord alerts disabled", {
            description: "Enable in Settings → Discord to send alerts to channels.",
          } as any);
        } else if (channels.length === 0 && channelIds.length > 0) {
          toast.warning("No valid Discord channels", {
            description: "Check channel configuration in Settings → Discord.",
          } as any);
        } else if (channels.length > 0) {
          // Check rate limit
          if (!discordAlertLimiter.canProceed()) {
            const waitTime = discordAlertLimiter.getWaitTime();
            toast.error("Discord alert rate limit exceeded", {
              description: `Too many alerts sent. Wait ${formatWaitTime(waitTime)} before sending more.`,
            } as any);

            // Rollback optimistic update since we won't send the alert
            setActiveTrades((prev) =>
              prev.map((t) => (t.id === currentTrade.id ? currentTrade : t))
            );
            setCurrentTrade(currentTrade);
            setShowAlert(false);
            return;
          }

          try {
            let results = { success: 0, failed: 0 };

            switch (alertType) {
              case "enter":
                // Pass price overrides to Discord alert for Format C display
                results = await discord.sendEntryAlert(
                  channels,
                  newTrade,
                  comment,
                  undefined, // imageUrl
                  undefined, // challengeInfo
                  {
                    entryPrice: priceOverrides?.entryPrice ?? newTrade.entryPrice,
                    targetPrice: priceOverrides?.targetPrice ?? newTrade.targetPrice,
                    stopLoss: priceOverrides?.stopLoss ?? newTrade.stopLoss,
                    targetUnderlyingPrice:
                      priceOverrides?.targetUnderlyingPrice ?? newTrade.targetUnderlyingPrice,
                    stopUnderlyingPrice:
                      priceOverrides?.stopUnderlyingPrice ?? newTrade.stopUnderlyingPrice,
                  }
                );
                console.log("[Discord] ENTER alert sent successfully");
                break;
              case "trim":
                results = await discord.sendUpdateAlert(
                  channels,
                  newTrade,
                  "trim",
                  comment || "Position trimmed"
                );
                console.log("[Discord] TRIM alert sent successfully");
                break;
              case "update":
                results = await discord.sendUpdateAlert(
                  channels,
                  newTrade,
                  alertOptions.updateKind === "sl" ? "update-sl" : "generic",
                  comment || "Position updated"
                );
                console.log("[Discord] UPDATE alert sent successfully");
                break;
              case "update-sl":
                results = await discord.sendUpdateAlert(
                  channels,
                  newTrade,
                  "update-sl",
                  comment || "Stop loss updated"
                );
                console.log("[Discord] UPDATE-SL alert sent successfully");
                break;
              case "trail-stop":
                results = await discord.sendTrailingStopAlert(channels, newTrade);
                console.log("[Discord] TRAIL-STOP alert sent successfully");
                break;
              case "add":
                results = await discord.sendUpdateAlert(
                  channels,
                  newTrade,
                  "generic",
                  comment || "Added to position"
                );
                console.log("[Discord] ADD alert sent successfully");
                break;
              case "exit":
                results = await discord.sendExitAlert(channels, newTrade, comment);
                console.log("[Discord] EXIT alert sent successfully");
                break;
            }

            // Record alert history (non-blocking)
            if (userId) {
              recordAlertHistory({
                userId,
                tradeId: newTrade.id,
                alertType: alertType === "update-sl" ? "update-sl" : (alertType as any),
                channelIds: channels.map((c) => c.id),
                challengeIds: challengeIds,
                successCount: results.success,
                failedCount: results.failed,
                tradeTicker: newTrade.ticker,
              }).catch((err) => {
                console.error("[Database] Failed to record alert history:", err);
              });
            }
          } catch (error) {
            console.error(`[Discord] Failed to send ${alertType.toUpperCase()} alert:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Failed to send ${alertType} alert to Discord`, {
              description: `${channels.length} channel(s) selected. ${errorMessage}`,
            } as any);

            // Record failed alert history
            if (userId) {
              recordAlertHistory({
                userId,
                tradeId: newTrade.id,
                alertType: alertType === "update-sl" ? "update-sl" : (alertType as any),
                channelIds: channels.map((c) => c.id),
                challengeIds: challengeIds,
                successCount: 0,
                failedCount: channels.length,
                errorMessage,
                tradeTicker: newTrade.ticker,
              }).catch((err) => {
                console.error("[Database] Failed to record failed alert history:", err);
              });
            }
          }
        }

        showAlertToast(alertType, newTrade.ticker, selectedChannels as DiscordChannel[]);
      } catch (error) {
        console.error("[v0] Failed to persist alert to database:", error);

        // Rollback optimistic update
        setActiveTrades((prev) => prev.map((t) => (t.id === currentTrade.id ? currentTrade : t)));
        setCurrentTrade(currentTrade);

        // Show error with retry
        const retryFn = () => handleSendAlert(channelIds, challengeIds, comment);
        toast.error(`Failed to save ${alertType}`, {
          description: "Click retry to try again",
          action: {
            label: "Retry",
            onClick: retryFn,
          },
        } as any);
      }
    },
    [
      currentTrade,
      alertType,
      alertOptions,
      userId,
      isMobile,
      onMobileTabChange,
      onExitedTrade,
      showAlertToast,
      toast,
      makeUpdate,
    ]
  );

  const handleEnterTrade = useCallback(
    (
      channelIds?: string[],
      challengeIds?: string[],
      comment?: string,
      priceOverrides?: PriceOverrides
    ) => {
      if (!currentTrade) return;

      const finalEntryPrice = priceOverrides?.entryPrice || currentTrade.contract.mid;

      // Use user-provided overrides if available, otherwise calculate defaults
      let targetPrice = priceOverrides?.targetPrice ?? finalEntryPrice * 1.5;
      let stopLoss = priceOverrides?.stopLoss ?? finalEntryPrice * 0.5;

      // Only recalculate if user didn't provide explicit overrides
      if (!priceOverrides?.targetPrice || !priceOverrides?.stopLoss) {
        try {
          const tradeType = inferTradeTypeByDTE(
            currentTrade.contract.expiry,
            new Date(),
            DEFAULT_DTE_THRESHOLDS
          );

          const risk = calculateRisk({
            entryPrice: finalEntryPrice,
            currentUnderlyingPrice: finalEntryPrice,
            currentOptionMid: finalEntryPrice,
            keyLevels: {
              preMarketHigh: 0,
              preMarketLow: 0,
              orbHigh: 0,
              orbLow: 0,
              priorDayHigh: 0,
              priorDayLow: 0,
              vwap: 0,
              vwapUpperBand: 0,
              vwapLowerBand: 0,
              bollingerUpper: 0,
              bollingerLower: 0,
              weeklyHigh: 0,
              weeklyLow: 0,
              monthlyHigh: 0,
              monthlyLow: 0,
              quarterlyHigh: 0,
              quarterlyLow: 0,
              yearlyHigh: 0,
              yearlyLow: 0,
            },
            expirationISO: currentTrade.contract.expiry,
            tradeType,
            delta: currentTrade.contract.delta ?? 0.5,
            gamma: currentTrade.contract.gamma ?? 0,
            defaults: getRiskDefaultsFromStore(),
          });

          // Only apply calculated values for fields not overridden by user
          if (!priceOverrides?.targetPrice && risk.targetPrice) targetPrice = risk.targetPrice;
          if (!priceOverrides?.stopLoss && risk.stopLoss) stopLoss = risk.stopLoss;
        } catch (error) {
          console.warn("[v0] TP/SL recalculation failed, using fallback:", error);
        }
      }

      const enteredTrade: Trade = {
        ...currentTrade,
        state: "ENTERED",
        entryPrice: finalEntryPrice,
        currentPrice: finalEntryPrice,
        targetPrice,
        stopLoss,
        movePercent: 0,
        // Ensure arrays are always valid
        discordChannels: Array.isArray(channelIds) ? channelIds : [],
        challenges: Array.isArray(challengeIds) ? challengeIds : [],
        updates: [
          ...(Array.isArray(currentTrade.updates) ? currentTrade.updates : []),
          {
            id: crypto.randomUUID(),
            type: "enter",
            timestamp: new Date(),
            price: finalEntryPrice,
            message: comment || "",
          },
        ],
      };

      setActiveTrades((prev) => {
        const existing = prev.find((t) => t.id === currentTrade.id);
        if (existing) {
          return prev.map((t) => (t.id === currentTrade.id ? enteredTrade : t));
        } else {
          return [...prev, enteredTrade];
        }
      });
      setCurrentTrade(enteredTrade);
      setTradeState("ENTERED");
      setShowAlert(false);

      if (isMobile && onMobileTabChange) {
        onMobileTabChange("active");
      }
    },
    [currentTrade, isMobile, onMobileTabChange]
  );

  const handleEnterAndAlert = useCallback(
    async (
      channelIds: string[],
      challengeIds: string[],
      comment?: string,
      priceOverrides?: PriceOverrides
    ) => {
      if (!currentTrade || !userId) {
        toast.error("Unable to enter trade: Trade or user missing");
        return;
      }

      const finalEntryPrice = priceOverrides?.entryPrice || currentTrade.contract.mid;

      // Use user-provided overrides if available, otherwise calculate defaults
      let targetPrice = priceOverrides?.targetPrice ?? finalEntryPrice * 1.5;
      let stopLoss = priceOverrides?.stopLoss ?? finalEntryPrice * 0.5;

      console.warn("[v0] handleEnterAndAlert price overrides:", {
        from: {
          entry: currentTrade.contract.mid,
          target: currentTrade.targetPrice,
          stop: currentTrade.stopLoss,
        },
        overrides: priceOverrides,
        effective: { entry: finalEntryPrice, target: targetPrice, stop: stopLoss },
      });

      // Only recalculate if user didn't provide explicit overrides
      if (!priceOverrides?.targetPrice || !priceOverrides?.stopLoss) {
        try {
          const tradeType = inferTradeTypeByDTE(
            currentTrade.contract.expiry,
            new Date(),
            DEFAULT_DTE_THRESHOLDS
          );

          const risk = calculateRisk({
            entryPrice: finalEntryPrice,
            currentUnderlyingPrice: finalEntryPrice,
            currentOptionMid: finalEntryPrice,
            keyLevels: {
              preMarketHigh: 0,
              preMarketLow: 0,
              orbHigh: 0,
              orbLow: 0,
              priorDayHigh: 0,
              priorDayLow: 0,
              vwap: 0,
              vwapUpperBand: 0,
              vwapLowerBand: 0,
              bollingerUpper: 0,
              bollingerLower: 0,
              weeklyHigh: 0,
              weeklyLow: 0,
              monthlyHigh: 0,
              monthlyLow: 0,
              quarterlyHigh: 0,
              quarterlyLow: 0,
              yearlyHigh: 0,
              yearlyLow: 0,
            },
            expirationISO: currentTrade.contract.expiry,
            tradeType,
            delta: currentTrade.contract.delta ?? 0.5,
            gamma: currentTrade.contract.gamma ?? 0,
            defaults: getRiskDefaultsFromStore(),
          });

          // Only apply calculated values for fields not overridden by user
          if (!priceOverrides?.targetPrice && risk.targetPrice) targetPrice = risk.targetPrice;
          if (!priceOverrides?.stopLoss && risk.stopLoss) stopLoss = risk.stopLoss;
        } catch (error) {
          console.warn("[v0] TP/SL recalculation failed, using fallback:", error);
        }
      }

      let enteredTrade: Trade = {
        ...currentTrade,
        state: "ENTERED",
        entryPrice: finalEntryPrice,
        entryTime: new Date(),
        currentPrice: finalEntryPrice,
        targetPrice,
        stopLoss,
        movePercent: 0,
        // Persist selected channels/challenges with the trade
        discordChannels: Array.isArray(channelIds) ? channelIds : [],
        challenges: Array.isArray(challengeIds) ? challengeIds : [],
        updates: [
          ...(Array.isArray(currentTrade.updates) ? currentTrade.updates : []),
          {
            id: crypto.randomUUID(),
            type: "enter",
            timestamp: new Date(),
            price: finalEntryPrice,
            message: comment || "",
          },
        ],
      };

      // Update local state optimistically
      setActiveTrades((prev) => {
        const existing = prev.find((t) => t.id === currentTrade.id);
        if (existing) {
          return prev.map((t) => (t.id === currentTrade.id ? enteredTrade : t));
        } else {
          return [...prev, enteredTrade];
        }
      });
      setCurrentTrade(enteredTrade);
      setTradeState("ENTERED");
      setShowAlert(false);

      // Persist to database - handle WATCHING vs LOADED differently
      try {
        if (currentTrade.state === "WATCHING") {
          // WATCHING → ENTERED: Create new trade in database
          console.warn("[v0] Creating trade in database (Enter and Alert from WATCHING)");

          const dbTrade = await createTradeApi(userId, {
            ticker: enteredTrade.ticker,
            contract: enteredTrade.contract,
            targetPrice: enteredTrade.targetPrice,
            stopLoss: enteredTrade.stopLoss,
            entryPrice: enteredTrade.entryPrice,
            entryTime: enteredTrade.entryTime,
            status: "entered",
            discordChannelIds: channelIds,
            challengeIds: challengeIds,
            setupType: enteredTrade.setupType,
            confluence: enteredTrade.confluence,
            confluenceUpdatedAt: enteredTrade.confluenceUpdatedAt?.toISOString(),
          });

          // Update with real database ID
          enteredTrade = { ...enteredTrade, id: dbTrade.id };
          setCurrentTrade(enteredTrade);
          setActiveTrades((prev) => prev.map((t) => (t.id === currentTrade.id ? enteredTrade : t)));

          console.warn(`[v0] Trade created with DB ID: ${dbTrade.id}`);

          // Verify trade was actually saved to database
          try {
            const verifyTrades = await getTrades(userId);
            const foundTrade = verifyTrades.find((t) => t.id === dbTrade.id);
            if (!foundTrade) {
              console.error(
                `[v0] ❌ CRITICAL: Trade ${dbTrade.id} not found in database immediately after creation!`
              );
              toast.error("Trade failed to persist", {
                description: "Please try again or contact support.",
              } as any);
              return;
            }
            console.warn(
              `[v0] ✅ Verified trade ${dbTrade.id} exists in database with status: ${foundTrade.status}`
            );
          } catch (verifyError) {
            console.error(`[v0] Failed to verify trade creation:`, verifyError);
          }
        } else if (currentTrade.state === "LOADED") {
          // LOADED → ENTERED: Trade already in DB, just update status
          console.warn("[v0] Updating trade in database (Enter and Alert from LOADED)");

          await updateTradeApi(userId, currentTrade.id, {
            status: "entered",
            entry_price: enteredTrade.entryPrice,
            entry_time: enteredTrade.entryTime?.toISOString?.() || new Date().toISOString(),
            target_price: enteredTrade.targetPrice,
            stop_loss: enteredTrade.stopLoss,
          });

          console.warn(`[v0] Trade ${currentTrade.id} updated to ENTERED`);

          // Verify trade status was actually updated in database
          try {
            const verifyTrades = await getTrades(userId);
            const foundTrade = verifyTrades.find((t) => t.id === currentTrade.id);
            if (!foundTrade) {
              console.error(
                `[v0] ❌ CRITICAL: Trade ${currentTrade.id} not found in database after update!`
              );
              toast.error("Trade update failed to persist", {
                description: "Trade may revert on refresh.",
              } as any);
            } else if (foundTrade.status !== "entered") {
              console.error(
                `[v0] ❌ CRITICAL: Trade ${currentTrade.id} status is '${foundTrade.status}', expected 'entered'`
              );
              toast.error("Trade status not updated correctly", {
                description: `Status is '${foundTrade.status}' instead of 'entered'`,
              } as any);
            } else {
              console.warn(
                `[v0] ✅ Verified trade ${currentTrade.id} status updated to: ${foundTrade.status}`
              );
            }
          } catch (verifyError) {
            console.error(`[v0] Failed to verify trade update:`, verifyError);
          }
        }
      } catch (error) {
        console.error("[v0] Failed to persist trade to database:", error);
        toast.error("Failed to save trade", {
          description: "Trade entered locally but may not persist on refresh.",
        } as any);
      }

      // Send Discord alerts
      const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
      const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

      if (discordAlertsEnabled && channels.length > 0) {
        // Check rate limit
        if (!discordAlertLimiter.canProceed()) {
          const waitTime = discordAlertLimiter.getWaitTime();
          toast.error("Discord alert rate limit exceeded", {
            description: `Too many alerts sent. Wait ${formatWaitTime(waitTime)} before sending more.`,
          } as any);
        } else {
          try {
            // Pass price overrides to Discord alert for Format C display
            const results = await discord.sendEntryAlert(
              channels,
              enteredTrade,
              comment,
              undefined, // imageUrl
              undefined, // challengeInfo
              {
                entryPrice: priceOverrides?.entryPrice ?? enteredTrade.entryPrice,
                targetPrice: priceOverrides?.targetPrice ?? enteredTrade.targetPrice,
                stopLoss: priceOverrides?.stopLoss ?? enteredTrade.stopLoss,
                targetUnderlyingPrice:
                  priceOverrides?.targetUnderlyingPrice ?? enteredTrade.targetUnderlyingPrice,
                stopUnderlyingPrice:
                  priceOverrides?.stopUnderlyingPrice ?? enteredTrade.stopUnderlyingPrice,
              }
            );
            console.log("[Discord] ENTER alert sent successfully");

            // Record alert history
            recordAlertHistory({
              userId,
              tradeId: enteredTrade.id,
              alertType: "enter",
              channelIds: channels.map((c) => c.id),
              challengeIds: challengeIds,
              successCount: results.success,
              failedCount: results.failed,
              tradeTicker: enteredTrade.ticker,
            }).catch((err) => {
              console.error("[Database] Failed to record alert history:", err);
            });
          } catch (error) {
            console.error("[Discord] Failed to send ENTER alert:", error);
            toast.error("Discord alert failed", {
              description: "Check console for details",
            } as any);
          }
        }
      }

      // Mobile UX: navigate to active tab
      if (isMobile && onMobileTabChange) {
        onMobileTabChange("active");
      }

      // Show success toast
      showAlertToast("enter", enteredTrade.ticker, channels);
    },
    [
      currentTrade,
      userId,
      discord,
      getDiscordChannelsForAlert,
      setActiveTrades,
      setCurrentTrade,
      setTradeState,
      setShowAlert,
      showAlertToast,
      toast,
      isMobile,
      onMobileTabChange,
    ]
  );

  const handleCancelAlert = useCallback(() => {
    setShowAlert(false);
    if (isMobile && onMobileTabChange) {
      onMobileTabChange("live");
    }
  }, [isMobile, onMobileTabChange]);

  const handleDiscard = useCallback(() => {
    if (currentTrade && currentTrade.state === "LOADED") {
      setActiveTrades((prev) => prev.filter((t) => t.id !== currentTrade.id));
    }

    setCurrentTrade(null);
    setTradeState("WATCHING");
    setShowAlert(false);
  }, [currentTrade]);

  const handleUnloadTrade = useCallback(() => {
    if (currentTrade && currentTrade.state === "LOADED" && userId) {
      // Remove from local state immediately
      setActiveTrades((prev) => prev.filter((t) => t.id !== currentTrade.id));
      toast.success(`${currentTrade.ticker} unloaded`);

      // Delete from database asynchronously
      deleteTradeApi(userId, currentTrade.id).catch((error) => {
        console.error("[v0] Failed to delete trade from database:", error);
        toast.error("Failed to delete trade", {
          description: "The trade was removed locally but may persist on refresh.",
        } as any);
      });
    }

    setCurrentTrade(null);
    setTradeState("WATCHING");
    setShowAlert(false);

    if (isMobile && onMobileTabChange) {
      onMobileTabChange("live");
    }
  }, [currentTrade, isMobile, onMobileTabChange, userId]);

  const handleTrim = useCallback(() => {
    if (!currentTrade) return;
    openAlertComposer("update", { updateKind: "trim" });
  }, [currentTrade, openAlertComposer]);

  const handleUpdate = useCallback(() => {
    if (!currentTrade) return;
    openAlertComposer("update", { updateKind: "generic" });
  }, [currentTrade, openAlertComposer]);

  const handleUpdateSL = useCallback(() => {
    if (!currentTrade) return;
    openAlertComposer("update", { updateKind: "sl" });
  }, [currentTrade, openAlertComposer]);

  const handleTrailStop = useCallback(() => {
    if (!currentTrade) return;
    openAlertComposer("trail-stop");
  }, [currentTrade, openAlertComposer]);

  const handleAdd = useCallback(() => {
    if (!currentTrade) return;
    openAlertComposer("add");
  }, [currentTrade, openAlertComposer]);

  const handleTakeProfit = useCallback(() => {
    if (!currentTrade) return;
    // Take profit is a PARTIAL exit at target level (like Trim but specifically at TP)
    setAlertOptions({ updateKind: "take-profit" });
    openAlertComposer("update");
  }, [currentTrade, openAlertComposer]);

  const handleExit = useCallback(() => {
    if (!currentTrade) return;
    openAlertComposer("exit");
  }, [currentTrade, openAlertComposer]);

  return {
    // State
    activeTicker,
    contracts,
    currentTrade,
    tradeState,
    alertType,
    alertOptions,
    showAlert,
    activeTrades,
    // Actions
    actions: {
      handleTickerClick,
      handleContractSelect,
      handleActiveTradeClick,
      handleSendAlert,
      handleEnterAndAlert,
      handleEnterTrade,
      handleCancelAlert,
      handleDiscard,
      handleUnloadTrade,
      handleTrim,
      handleUpdate,
      handleUpdateSL,
      handleTrailStop,
      handleAdd,
      handleTakeProfit,
      handleExit,
      setActiveTicker,
      setContracts,
      setCurrentTrade,
      setTradeState,
      setActiveTrades,
    },
  };
}
