import { useState, useEffect, useCallback } from "react";
import {
  Trade,
  Ticker,
  Contract,
  TradeState,
  AlertType,
  TradeUpdate,
  DiscordChannel,
} from "../types";
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
    confluenceData?: { trend?: any; volatility?: any; liquidity?: any }
  ) => void;
  handleSendAlert: (channelIds: string[], challengeIds: string[], comment?: string) => void;
  handleEnterAndAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    entryPrice?: number
  ) => void;
  handleEnterTrade: (
    channelIds?: string[],
    challengeIds?: string[],
    comment?: string,
    entryPrice?: number
  ) => void;
  handleCancelAlert: () => void;
  handleDiscard: () => void;
  handleUnloadTrade: () => void;
  handleTrim: () => void;
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
  const userId = auth?.user?.id;

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
          channels.push(channel);
        }
      });

      // Add channels from linked challenges
      challengeIds.forEach((challengeId) => {
        const challenge = settingsStore.getChallengeById(challengeId);
        if (challenge?.defaultChannel) {
          const channel = settingsStore.discordChannels.find(
            (ch) => ch.name === challenge.defaultChannel
          );
          if (channel && !channels.some((c) => c.id === channel.id)) {
            channels.push(channel);
          }
        }
      });

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

  const handleContractSelect = useCallback(
    async (
      contract: Contract,
      confluenceData?: {
        trend?: any;
        volatility?: any;
        liquidity?: any;
      }
    ) => {
      if (!activeTicker || !userId) {
        toast.error("Unable to create trade: User not authenticated");
        return;
      }

      setIsCreatingTrade(true);

      try {
        // Base defaults
        let targetPrice = contract.mid * 1.5;
        let stopLoss = contract.mid * 0.5;

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
            currentUnderlyingPrice: contract.mid,
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
            defaults: {
              mode: "percent",
              tpPercent: 50,
              slPercent: 50,
              dteThresholds: DEFAULT_DTE_THRESHOLDS,
            },
          });
          if (risk.targetPrice) targetPrice = risk.targetPrice;
          if (risk.stopLoss) stopLoss = risk.stopLoss;
        } catch {
          /* fallback silently */
        }

        // Create trade locally first (optimistic update)
        const localTrade: Trade = {
          id: crypto.randomUUID(),
          ticker: activeTicker.symbol,
          state: "LOADED",
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
        };

        setCurrentTrade(localTrade);
        setTradeState("LOADED");
        setAlertType("load");
        setShowAlert(true);

        // Add trade to activeTrades immediately (optimistic update)
        setActiveTrades((prev) => [...prev, localTrade]);

        // Persist to database
        try {
          const dbTrade = await createTradeApi(userId, {
            ticker: activeTicker.symbol,
            contract: {
              type: contract.type,
              strike: contract.strike,
              expiry: contract.expiry,
            },
            targetPrice,
            stopLoss,
            discordChannelIds: [],
            challengeIds: [],
          });

          // Update with database ID
          const persistedTrade: Trade = {
            ...localTrade,
            id: dbTrade.id,
          };
          setCurrentTrade(persistedTrade);
          setActiveTrades((prev) => prev.map((t) => (t.id === localTrade.id ? persistedTrade : t)));
        } catch (error) {
          console.error("[v0] Failed to persist trade to database:", error);
          // Show error toast but don't block the UI - user can still use the trade locally
          toast.error("Failed to save trade to database", {
            description: "You can continue working, but it won't be saved.",
          } as any);
        }
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
    async (channelIds: string[], challengeIds: string[], comment?: string) => {
      if (!currentTrade || !userId) {
        toast.error("Unable to send alert: Trade or user missing");
        return;
      }

      const selectedChannels = channelIds
        .map((id) => ({ id, name: `Channel ${id.slice(0, 8)}` }))
        .filter((c) => c);

      // LOAD alert: associate channels/challenges, do not create a TradeUpdate (load is not a TradeUpdate type)
      if (alertType === "load") {
        const updatedTrade: Trade = {
          ...currentTrade,
          discordChannels: channelIds,
          challenges: challengeIds,
        };

        // Optimistic update
        setActiveTrades((prev) => {
          const exists = prev.find((t) => t.id === updatedTrade.id);
          return exists
            ? prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t))
            : [...prev, updatedTrade];
        });
        setCurrentTrade(updatedTrade);
        setTradeState("LOADED");
        setShowAlert(false);
        setContracts([]);
        setActiveTicker(null);

        // Persist to database
        try {
          const persistencePromises = [];

          if (channelIds.length > 0) {
            persistencePromises.push(
              linkChannelsApi(userId, currentTrade.id, channelIds).catch((error) => {
                console.error("[v0] Failed to link channels:", error);
                throw error;
              })
            );
          }

          if (challengeIds.length > 0) {
            persistencePromises.push(
              linkChallengesApi(userId, currentTrade.id, challengeIds).catch((error) => {
                console.error("[v0] Failed to link challenges:", error);
                throw error;
              })
            );
          }

          if (persistencePromises.length > 0) {
            await Promise.all(persistencePromises);
          }

          // Send Discord LOAD alert
          const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
          const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

          if (discordAlertsEnabled && channels.length > 0) {
            try {
              await discord.sendLoadAlert(channels, updatedTrade);
              console.log("[Discord] LOAD alert sent successfully");
            } catch (error) {
              console.error("[Discord] Failed to send LOAD alert:", error);
              toast.error("Discord alert failed", {
                description: "Check console for details",
              } as any);
            }
          }

          showAlertToast("load", currentTrade.ticker, selectedChannels as DiscordChannel[]);
        } catch (error) {
          console.error("[v0] Failed to persist load alert to database:", error);
          toast.error("Failed to save trade links", {
            description: "Alert sent but database save failed.",
          } as any);
        }
        return;
      }

      // Determine base price to use for update entries
      const basePrice =
        currentTrade.currentPrice || currentTrade.entryPrice || currentTrade.contract.mid;
      const message = comment || "";

      let newTrade: Trade = { ...currentTrade };
      let updateType: TradeUpdate["type"] | null = null;

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
            updates: [...newTrade.updates, makeUpdate("enter", entryPrice, message)],
          };
          updateType = "enter";
          break;
        }
        case "trim": {
          newTrade = {
            ...newTrade,
            discordChannels: channelIds,
            challenges: challengeIds,
            updates: [...newTrade.updates, makeUpdate("trim", basePrice, message)],
          };
          updateType = "trim";
          break;
        }
        case "update": {
          const kind =
            alertOptions.updateKind === "trim"
              ? "trim"
              : alertOptions.updateKind === "sl"
                ? "update-sl"
                : "update";
          newTrade = {
            ...newTrade,
            discordChannels: channelIds,
            challenges: challengeIds,
            updates: [
              ...newTrade.updates,
              makeUpdate(kind as TradeUpdate["type"], basePrice, message),
            ],
          };
          updateType = kind as TradeUpdate["type"];
          break;
        }
        case "update-sl": {
          newTrade = {
            ...newTrade,
            updates: [
              ...newTrade.updates,
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
              ...newTrade.updates,
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
              ...newTrade.updates,
              makeUpdate("add", basePrice, message || "Added to position"),
            ],
          };
          updateType = "add";
          break;
        }
        case "exit": {
          const exitPrice = basePrice;
          newTrade = {
            ...newTrade,
            state: "EXITED",
            exitPrice,
            exitTime: new Date(),
            updates: [
              ...newTrade.updates,
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

      // Mobile UX: move to active tab on enter; move to history on exit
      if (isMobile && onMobileTabChange) {
        if (newTrade.state === "ENTERED") onMobileTabChange("active");
        if (newTrade.state === "EXITED") onMobileTabChange("history");
      }

      // Callback for exited trades
      if (newTrade.state === "EXITED" && onExitedTrade) {
        onExitedTrade(newTrade);
      }

      // Persist to database
      try {
        const persistencePromises = [];

        // Update trade state if changed
        if (newTrade.state !== currentTrade.state) {
          persistencePromises.push(
            updateTradeApi(userId, newTrade.id, {
              status: newTrade.state === "ENTERED" ? "entered" : "exited",
              entry_price: newTrade.entryPrice,
              entry_time: newTrade.entryTime,
              exit_price: newTrade.exitPrice,
              exit_time: newTrade.exitTime,
            }).catch((error) => {
              console.error("[v0] Failed to update trade state:", error);
              throw error;
            })
          );
        }

        // Add trade update record
        if (updateType) {
          persistencePromises.push(
            addTradeUpdateApi(userId, newTrade.id, updateType, basePrice, message).catch(
              (error) => {
                console.error("[v0] Failed to add trade update:", error);
                throw error;
              }
            )
          );
        }

        // Link channels if provided
        if (
          channelIds.length > 0 &&
          (alertType === "enter" || alertType === "trim" || alertType === "update")
        ) {
          persistencePromises.push(
            linkChannelsApi(userId, newTrade.id, channelIds).catch((error) => {
              console.error("[v0] Failed to link channels:", error);
              throw error;
            })
          );
        }

        // Link challenges if provided
        if (
          challengeIds.length > 0 &&
          (alertType === "enter" || alertType === "trim" || alertType === "update")
        ) {
          persistencePromises.push(
            linkChallengesApi(userId, newTrade.id, challengeIds).catch((error) => {
              console.error("[v0] Failed to link challenges:", error);
              throw error;
            })
          );
        }

        if (persistencePromises.length > 0) {
          await Promise.all(persistencePromises);
        }

        // Send Discord alerts
        const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
        const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

        if (discordAlertsEnabled && channels.length > 0) {
          try {
            switch (alertType) {
              case "enter":
                await discord.sendEntryAlert(channels, newTrade, comment);
                console.log("[Discord] ENTER alert sent successfully");
                break;
              case "trim":
                await discord.sendUpdateAlert(
                  channels,
                  newTrade,
                  "trim",
                  comment || "Position trimmed"
                );
                console.log("[Discord] TRIM alert sent successfully");
                break;
              case "update":
                await discord.sendUpdateAlert(
                  channels,
                  newTrade,
                  alertOptions.updateKind === "sl" ? "update-sl" : "generic",
                  comment || "Position updated"
                );
                console.log("[Discord] UPDATE alert sent successfully");
                break;
              case "update-sl":
                await discord.sendUpdateAlert(
                  channels,
                  newTrade,
                  "update-sl",
                  comment || "Stop loss updated"
                );
                console.log("[Discord] UPDATE-SL alert sent successfully");
                break;
              case "trail-stop":
                await discord.sendTrailingStopAlert(channels, newTrade);
                console.log("[Discord] TRAIL-STOP alert sent successfully");
                break;
              case "add":
                await discord.sendUpdateAlert(
                  channels,
                  newTrade,
                  "generic",
                  comment || "Added to position"
                );
                console.log("[Discord] ADD alert sent successfully");
                break;
              case "exit":
                await discord.sendExitAlert(channels, newTrade, comment);
                console.log("[Discord] EXIT alert sent successfully");
                break;
            }
          } catch (error) {
            console.error(`[Discord] Failed to send ${alertType.toUpperCase()} alert:`, error);
            toast.error("Discord alert failed", {
              description: "Check console for details",
            } as any);
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
    (channelIds?: string[], challengeIds?: string[], comment?: string, entryPrice?: number) => {
      if (!currentTrade) return;

      const finalEntryPrice = entryPrice || currentTrade.contract.mid;

      // Recalculate TP/SL with actual entry price
      let targetPrice = finalEntryPrice * 1.5;
      let stopLoss = finalEntryPrice * 0.5;

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
          defaults: {
            mode: "percent",
            tpPercent: 50,
            slPercent: 50,
            dteThresholds: DEFAULT_DTE_THRESHOLDS,
          },
        });

        if (risk.targetPrice) targetPrice = risk.targetPrice;
        if (risk.stopLoss) stopLoss = risk.stopLoss;
      } catch (error) {
        console.warn("[v0] TP/SL recalculation failed, using fallback:", error);
      }

      const enteredTrade: Trade = {
        ...currentTrade,
        state: "ENTERED",
        entryPrice: finalEntryPrice,
        currentPrice: finalEntryPrice,
        targetPrice,
        stopLoss,
        movePercent: 0,
        discordChannels: channelIds || [],
        challenges: challengeIds || [],
        updates: [
          ...(currentTrade.updates || []),
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
    async (channelIds: string[], challengeIds: string[], comment?: string, entryPrice?: number) => {
      if (!currentTrade) return;

      const finalEntryPrice = entryPrice || currentTrade.contract.mid;

      // Recalculate TP/SL with actual entry price
      let targetPrice = finalEntryPrice * 1.5;
      let stopLoss = finalEntryPrice * 0.5;

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
          defaults: {
            mode: "percent",
            tpPercent: 50,
            slPercent: 50,
            dteThresholds: DEFAULT_DTE_THRESHOLDS,
          },
        });

        if (risk.targetPrice) targetPrice = risk.targetPrice;
        if (risk.stopLoss) stopLoss = risk.stopLoss;
      } catch (error) {
        console.warn("[v0] TP/SL recalculation failed, using fallback:", error);
      }

      const enteredTrade: Trade = {
        ...currentTrade,
        state: "ENTERED",
        entryPrice: finalEntryPrice,
        currentPrice: finalEntryPrice,
        targetPrice,
        stopLoss,
        movePercent: 0,
        discordChannels: channelIds || [],
        challenges: challengeIds || [],
        updates: [
          ...(currentTrade.updates || []),
          {
            id: crypto.randomUUID(),
            type: "enter",
            timestamp: new Date(),
            price: finalEntryPrice,
            message: comment || "",
          },
        ],
      };

      // Update local state
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

      // Send Discord alerts
      const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
      const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

      if (discordAlertsEnabled && channels.length > 0) {
        try {
          await discord.sendEntryAlert(channels, enteredTrade, comment);
          console.log("[Discord] ENTER alert sent successfully");
        } catch (error) {
          console.error("[Discord] Failed to send ENTER alert:", error);
          toast.error("Discord alert failed", {
            description: "Check console for details",
          } as any);
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
      handleExit,
      setActiveTicker,
      setContracts,
      setCurrentTrade,
      setTradeState,
      setActiveTrades,
    },
  };
}
