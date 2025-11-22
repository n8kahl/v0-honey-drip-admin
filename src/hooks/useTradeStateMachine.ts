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
import { useDiscord } from "./useDiscord";
import { useSettingsStore } from "../stores/settingsStore";

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

  // State
  const [activeTicker, setActiveTicker] = useState<Ticker | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [currentTrade, setCurrentTrade] = useState<Trade | null>(null);
  const [tradeState, setTradeState] = useState<TradeState>("WATCHING");
  const [alertType, setAlertType] = useState<AlertType>("load");
  const [alertOptions, setAlertOptions] = useState<{ updateKind?: "trim" | "generic" | "sl" }>({});
  const [showAlert, setShowAlert] = useState(false);
  const [activeTrades, setActiveTrades] = useState<Trade[]>(hotTrades);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  // Helper: Get actual DiscordChannel objects from IDs + challenge-linked channels
  const getDiscordChannelsForAlert = useCallback(
    (channelIds: string[], challengeIds: string[]): DiscordChannel[] => {
      const settingsState = useSettingsStore.getState();
      const allChannels = settingsState.discordChannels;
      const challenges = settingsState.challenges;

      // Start with selected channels
      const selectedChannels = channelIds
        .map((id) => allChannels.find((ch) => ch.id === id))
        .filter((ch): ch is DiscordChannel => ch !== undefined && ch.isActive !== false);

      // Add challenge-linked default channels
      const challengeChannelNames = challengeIds
        .map((challengeId) => challenges.find((ch) => ch.id === challengeId)?.defaultChannel)
        .filter((name): name is string => !!name);

      const challengeChannels = allChannels.filter(
        (ch) => challengeChannelNames.includes(ch.name) && ch.isActive !== false
      );

      // Combine and deduplicate by ID
      const combinedMap = new Map<string, DiscordChannel>();
      [...selectedChannels, ...challengeChannels].forEach((ch) => combinedMap.set(ch.id, ch));

      return Array.from(combinedMap.values());
    },
    []
  );

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

  // Actions
  const handleTickerClick = useCallback((ticker: Ticker) => {
    setActiveTicker(ticker);
    setCurrentTrade(null);
    setTradeState("WATCHING");
  }, []);

  const handleContractSelect = useCallback(
    (
      contract: Contract,
      confluenceData?: {
        trend?: any;
        volatility?: any;
        liquidity?: any;
      }
    ) => {
      if (!activeTicker) return;

      // Base defaults
      let targetPrice = contract.mid * 1.5;
      let stopLoss = contract.mid * 0.5;

      try {
        const tradeType = inferTradeTypeByDTE(contract.expiry, new Date(), DEFAULT_DTE_THRESHOLDS);

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

      const trade: Trade = {
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

      setCurrentTrade(trade);
      setTradeState("LOADED");
      setAlertType("load");
      setShowAlert(true);
    },
    [activeTicker]
  );

  const handleSendAlert = useCallback(
    async (channelIds: string[], challengeIds: string[], comment?: string) => {
      if (!currentTrade) return;

      // Get actual Discord channel objects (includes challenge-linked channels)
      const channels = getDiscordChannelsForAlert(channelIds, challengeIds);

      // Check if Discord alerts are globally enabled
      const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

      // LOAD alert: associate channels/challenges, do not create a TradeUpdate (load is not a TradeUpdate type)
      if (alertType === "load") {
        const updatedTrade: Trade = {
          ...currentTrade,
          discordChannels: channelIds,
          challenges: challengeIds,
        };
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

        // Send Discord LOAD alert
        if (discordAlertsEnabled && channels.length > 0) {
          try {
            await discord.sendLoadAlert(channels, updatedTrade, comment);
            console.log("[Discord] LOAD alert sent successfully");
          } catch (error) {
            console.error("[Discord] Failed to send LOAD alert:", error);
            toast.error("Discord alert failed", {
              description: "Check console for details",
            } as any);
          }
        }

        showAlertToast("load", currentTrade.ticker, channels);
        return;
      }

      // Determine base price to use for update entries
      const basePrice =
        currentTrade.currentPrice || currentTrade.entryPrice || currentTrade.contract.mid;
      const message = comment || "";

      let newTrade: Trade = { ...currentTrade };

      switch (alertType) {
        case "enter": {
          // If not already ENTERED, move to ENTERED and set entryPrice
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
          break;
        }
        case "trim": {
          newTrade = {
            ...newTrade,
            discordChannels: channelIds,
            challenges: challengeIds,
            updates: [...newTrade.updates, makeUpdate("trim", basePrice, message)],
          };
          break;
        }
        case "update": {
          // Map alertOptions.updateKind to appropriate TradeUpdate type
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
          break;
        }
      }

      // Persist trade changes locally
      setActiveTrades((prev) => prev.map((t) => (t.id === newTrade.id ? newTrade : t)));
      setCurrentTrade(newTrade);
      setShowAlert(false);

      // Send Discord alerts
      if (discordAlertsEnabled && channels.length > 0) {
        try {
          switch (alertType) {
            case "enter":
              await discord.sendEntryAlert(channels, newTrade, message);
              console.log("[Discord] ENTER alert sent successfully");
              break;

            case "trim":
              await discord.sendUpdateAlert(
                channels,
                newTrade,
                "trim",
                message || "Trimmed position"
              );
              console.log("[Discord] TRIM alert sent successfully");
              break;

            case "update-sl":
              await discord.sendUpdateAlert(
                channels,
                newTrade,
                "update-sl",
                message || "Stop loss updated"
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
                message || "Added to position"
              );
              console.log("[Discord] ADD alert sent successfully");
              break;

            case "exit":
              await discord.sendExitAlert(channels, newTrade, message);
              console.log("[Discord] EXIT alert sent successfully");
              break;

            case "update": {
              const updateType =
                alertOptions.updateKind === "trim"
                  ? "trim"
                  : alertOptions.updateKind === "sl"
                    ? "update-sl"
                    : "generic";
              await discord.sendUpdateAlert(
                channels,
                newTrade,
                updateType,
                message || "Trade updated"
              );
              console.log("[Discord] UPDATE alert sent successfully");
              break;
            }
          }
        } catch (error) {
          console.error(`[Discord] Failed to send ${alertType.toUpperCase()} alert:`, error);
          toast.error("Discord alert failed", { description: "Check console for details" } as any);
        }
      }

      // Mobile UX: move to active tab on enter; move to history on exit
      if (isMobile && onMobileTabChange) {
        if (newTrade.state === "ENTERED") onMobileTabChange("active");
        if (newTrade.state === "EXITED") onMobileTabChange("history");
      }

      // Callback for exited trades
      if (newTrade.state === "EXITED" && onExitedTrade) {
        onExitedTrade(newTrade);
      }

      showAlertToast(alertType, newTrade.ticker, channels);
    },
    [
      currentTrade,
      alertType,
      alertOptions,
      showAlertToast,
      discord,
      getDiscordChannelsForAlert,
      toast,
      isMobile,
      onMobileTabChange,
      onExitedTrade,
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
    (channelIds: string[], challengeIds: string[], comment?: string, entryPrice?: number) => {
      handleEnterTrade(channelIds, challengeIds, comment, entryPrice);
    },
    [handleEnterTrade]
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
    if (currentTrade && currentTrade.state === "LOADED") {
      setActiveTrades((prev) => prev.filter((t) => t.id !== currentTrade.id));
      toast.success(`${currentTrade.ticker} unloaded from watchlist`);
    }

    setCurrentTrade(null);
    setTradeState("WATCHING");
    setShowAlert(false);

    if (isMobile && onMobileTabChange) {
      onMobileTabChange("live");
    }
  }, [currentTrade, isMobile, onMobileTabChange]);

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
