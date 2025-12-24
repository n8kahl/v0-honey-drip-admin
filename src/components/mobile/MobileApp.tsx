import { useState, useEffect, useMemo } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileTabNav, type MobileTab } from "./MobileTabNav";
import { MobileActiveScreen } from "./screens/MobileActiveScreen";
import { MobileWatchScreen } from "./screens/MobileWatchScreen";
import { MobileReviewScreen } from "./screens/MobileReviewScreen";
import { MobileSettingsScreen } from "./screens/MobileSettingsScreen";
import { MobileVoiceHUD } from "./common/MobileVoiceHUD";
import { MobileAlertSheet } from "./sheets/MobileAlertSheet";
import { MobileContractSheet } from "./sheets/MobileContractSheet";

import { useTradeStore, useMarketStore, useSettingsStore } from "../../stores";
import { useVoiceCommands } from "../../hooks/useVoiceCommands";
import { useDiscord } from "../../hooks/useDiscord";
import { useAuth } from "../../contexts/AuthContext";
import { Trade, AlertType, Contract, Ticker, TradeType } from "../../types";
import { toast } from "sonner";
import { massive } from "../../lib/massive";
import { fetchNormalizedChain } from "../../services/options";
import { createTradeApi, linkChallengesApi } from "../../lib/api/tradeApi";

interface MobileAppProps {
  onLogout?: () => void;
}

export function MobileApp({ onLogout }: MobileAppProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MobileTab>("active");

  // Alert sheet state
  const [alertSheetOpen, setAlertSheetOpen] = useState(false);
  const [alertTrade, setAlertTrade] = useState<Trade | null>(null);
  const [alertType, setAlertType] = useState<AlertType>("update");
  const [alertOptions, setAlertOptions] = useState<{ updateKind?: "trim" | "generic" | "sl" }>({});

  // Contract sheet state
  const [contractSheetOpen, setContractSheetOpen] = useState(false);
  const [contractSheetTicker, setContractSheetTicker] = useState<Ticker | null>(null);
  const [contractsForTicker, setContractsForTicker] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsError, setContractsError] = useState<string | null>(null);

  // Stores
  const { activeTrades, historyTrades, loadTrades, updateTrade } = useTradeStore();
  const { watchlist, loadWatchlist } = useMarketStore();
  const { discordChannels, challenges, loadDiscordChannels, loadChallenges, discordAlertsEnabled } =
    useSettingsStore();

  // Discord hook
  const discord = useDiscord();

  // Filter trades by state
  const enteredTrades = useMemo(
    () => activeTrades.filter((t) => t.state === "ENTERED"),
    [activeTrades]
  );
  const loadedTrades = useMemo(
    () => activeTrades.filter((t) => t.state === "LOADED"),
    [activeTrades]
  );
  const exitedTrades = useMemo(
    () => historyTrades.filter((t) => t.state === "EXITED"),
    [historyTrades]
  );

  // Voice commands
  const voice = useVoiceCommands({
    watchlist,
    activeTrades,
    currentTrade: null,
    onAddTicker: () => {},
    onRemoveTicker: () => {},
    onEnterTrade: () => {},
    onTrimTrade: () => {
      // Find the most recently updated active trade and open trim sheet
      if (enteredTrades.length > 0) {
        openAlertSheet(enteredTrades[0], "update", { updateKind: "trim" });
      }
    },
    onUpdateSL: () => {
      if (enteredTrades.length > 0) {
        openAlertSheet(enteredTrades[0], "update", { updateKind: "sl" });
      }
    },
    onExitTrade: () => {
      if (enteredTrades.length > 0) {
        openAlertSheet(enteredTrades[0], "exit");
      }
    },
    onAddPosition: () => {},
    onSendAlert: async (alert) => {
      if (!discordAlertsEnabled) {
        toast.info("Discord alerts disabled");
        return;
      }
      // Handle voice alerts (logged to console for debugging)
      console.error("[v0] Mobile voice alert:", alert);
    },
  });

  // Load user data
  useEffect(() => {
    if (!user) return;
    Promise.all([
      loadTrades(user.id),
      loadWatchlist(user.id),
      loadDiscordChannels(user.id),
      loadChallenges(user.id),
    ]).catch(console.error);
  }, [user, loadTrades, loadWatchlist, loadDiscordChannels, loadChallenges]);

  // Open alert sheet helper
  const openAlertSheet = (
    trade: Trade,
    type: AlertType,
    options?: { updateKind?: "trim" | "generic" | "sl" }
  ) => {
    setAlertTrade(trade);
    setAlertType(type);
    setAlertOptions(options || {});
    setAlertSheetOpen(true);
  };

  // Handle Load button - fetch contracts and open contract sheet
  const handleLoadTicker = async (ticker: Ticker) => {
    setContractSheetTicker(ticker);
    setContractsLoading(true);
    setContractsError(null);
    setContractSheetOpen(true);

    try {
      // Use fetchNormalizedChain with token manager for authenticated requests
      const tokenManager = massive.getTokenManager();
      const contracts = await fetchNormalizedChain(ticker.symbol, {
        window: 10,
        tokenManager,
      });
      setContractsForTicker(contracts);
    } catch (error) {
      console.error("[v0] Mobile failed to load contracts:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to load options chain";
      setContractsError(errorMsg);
      toast.error("Failed to load options chain");
      // Keep sheet open to show error state with retry button
    } finally {
      setContractsLoading(false);
    }
  };

  // Helper to infer trade type from DTE
  const getTradeType = (daysToExpiry: number): TradeType => {
    if (daysToExpiry <= 1) return "Scalp";
    if (daysToExpiry <= 7) return "Day";
    if (daysToExpiry <= 30) return "Swing";
    return "LEAP";
  };

  // Handle contract selection - create WATCHING trade (like desktop) and open alert sheet
  const handleContractSelect = (contract: Contract) => {
    if (!contractSheetTicker || !user) return;

    // Calculate TP/SL based on trade type
    const tradeType = getTradeType(contract.daysToExpiry || 0);
    const tpMultiplier = tradeType === "Scalp" ? 1.3 : tradeType === "Day" ? 1.5 : 2.0;
    const slMultiplier = tradeType === "Scalp" ? 0.7 : tradeType === "Day" ? 0.5 : 0.3;

    // Create trade in WATCHING state (like desktop - not persisted yet)
    const previewTrade: Trade = {
      id: crypto.randomUUID(),
      ticker: contractSheetTicker.symbol,
      state: "WATCHING", // Changed from LOADED to WATCHING (matching desktop)
      contract,
      tradeType,
      targetPrice: contract.mid * tpMultiplier,
      stopLoss: contract.mid * slMultiplier,
      currentPrice: contract.mid,
      discordChannels: [],
      challenges: [],
      updates: [],
    };

    // Set as preview trade (NOT activeTrades) - matches desktop pattern
    useTradeStore.getState().setPreviewTrade(previewTrade);

    // Close contract sheet and open alert sheet
    setContractSheetOpen(false);
    setContractSheetTicker(null);
    setContractsForTicker([]);

    // Open alert sheet for load alert
    openAlertSheet(previewTrade, "load");
  };

  // Handle sending alert (desktop pattern: persist channels + challenges)
  const handleSendAlert = async (
    channels: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: {
      entryPrice?: number;
      currentPrice?: number;
      targetPrice?: number;
      stopLoss?: number;
    }
  ) => {
    if (!alertTrade) return;

    try {
      const selectedChannels = discordChannels.filter((c) => channels.includes(c.id));

      // Apply price overrides to trade object (matching desktop pattern)
      const tradeWithPrices = priceOverrides
        ? {
            ...alertTrade,
            entryPrice: priceOverrides.entryPrice ?? alertTrade.entryPrice,
            currentPrice: priceOverrides.currentPrice ?? alertTrade.currentPrice,
            targetPrice: priceOverrides.targetPrice ?? alertTrade.targetPrice,
            stopLoss: priceOverrides.stopLoss ?? alertTrade.stopLoss,
          }
        : alertTrade;

      // Persist challenges if provided (desktop pattern)
      if (challengeIds.length > 0 && tradeWithPrices.id) {
        await useTradeStore.getState().linkTradeToChallenges(tradeWithPrices.id, challengeIds);
      }

      if (alertType === "update" && alertOptions.updateKind === "trim") {
        await discord.sendUpdateAlert(selectedChannels, tradeWithPrices, "trim", comment);
        toast.success("Trim alert sent");
      } else if (alertType === "update" && alertOptions.updateKind === "sl") {
        await discord.sendUpdateAlert(selectedChannels, tradeWithPrices, "update-sl", comment);
        toast.success("Stop loss update sent");
      } else if (alertType === "exit") {
        await discord.sendExitAlert(selectedChannels, tradeWithPrices, comment);
        // Update trade state to EXITED
        await updateTrade(tradeWithPrices.id, {
          state: "EXITED",
          exitPrice: tradeWithPrices.currentPrice,
          exitTime: new Date(),
        });
        toast.success("Exit alert sent");
      } else if (alertType === "enter") {
        await discord.sendEntryAlert(selectedChannels, tradeWithPrices, comment);
        // Update trade state to ENTERED with price overrides (desktop pattern)
        await updateTrade(tradeWithPrices.id, {
          state: "ENTERED",
          entryPrice: priceOverrides?.entryPrice ?? tradeWithPrices.contract?.mid,
          currentPrice: priceOverrides?.currentPrice ?? tradeWithPrices.contract?.mid,
          targetPrice: priceOverrides?.targetPrice,
          stopLoss: priceOverrides?.stopLoss,
          entryTime: new Date(),
        });
        toast.success("Entry alert sent");
      } else if (alertType === "load") {
        // MOBILE FIX: Persist trade to DB first (matching desktop pattern)
        // Trade is currently in WATCHING state as previewTrade
        if (!user?.id) {
          toast.error("Not authenticated");
          return;
        }

        // Create trade in database with LOADED state
        const dbTrade = await createTradeApi(user.id, {
          ticker: tradeWithPrices.ticker,
          tradeType: tradeWithPrices.tradeType,
          state: "LOADED",
          contract: tradeWithPrices.contract,
          currentPrice: priceOverrides?.currentPrice ?? tradeWithPrices.currentPrice,
          targetPrice: priceOverrides?.targetPrice ?? tradeWithPrices.targetPrice,
          stopLoss: priceOverrides?.stopLoss ?? tradeWithPrices.stopLoss,
          discordChannels: channels,
          challenges: challengeIds,
        });

        // Link channels to trade
        if (channels.length > 0 && dbTrade?.id) {
          for (const channelId of channels) {
            await fetch(`/api/trades/${dbTrade.id}/channels/${channelId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }).catch(console.error);
          }
        }

        // Link challenges to trade
        if (challengeIds.length > 0 && dbTrade?.id) {
          await linkChallengesApi(user.id, dbTrade.id, challengeIds);
        }

        // Update store: clear preview, add to activeTrades via applyTradePatch
        const tradeStore = useTradeStore.getState();
        tradeStore.setPreviewTrade(null);

        // Create the persisted trade with real DB ID
        const persistedTrade: Trade = {
          ...tradeWithPrices,
          id: dbTrade?.id || tradeWithPrices.id,
          state: "LOADED",
          discordChannels: channels,
          challenges: challengeIds,
        };

        // Add to activeTrades
        tradeStore.setActiveTrades([...tradeStore.activeTrades, persistedTrade]);

        // Send Discord alert
        await discord.sendLoadAlert(selectedChannels, persistedTrade, comment);
        toast.success("Trade loaded and alert sent");
      }

      setAlertSheetOpen(false);
      setAlertTrade(null);
    } catch (error) {
      console.error("[v0] Mobile failed to send alert:", error);
      toast.error("Failed to send alert");
      // Close modal after 1.5s to allow user to see error
      setTimeout(() => {
        setAlertSheetOpen(false);
        setAlertTrade(null);
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col">
      {/* Header */}
      <MobileHeader
        isListening={voice.isListening}
        isProcessing={voice.hudState === "processing"}
        waitingForWakeWord={voice.waitingForWakeWord}
        onToggleVoice={() => {
          if (voice.isListening) {
            voice.stopListening();
          } else {
            voice.startListening();
          }
        }}
      />

      {/* Spacer for fixed header (h-14 = 56px + safe-area-inset-top) */}
      <div className="h-header-safe" />

      {/* Main content - pb-nav-safe accounts for nav height (64px) + safe area bottom */}
      <main className="flex-1 overflow-hidden pb-nav-safe">
        {activeTab === "active" && (
          <MobileActiveScreen
            trades={enteredTrades}
            onTrim={(trade) => openAlertSheet(trade, "update", { updateKind: "trim" })}
            onUpdateSL={(trade) => openAlertSheet(trade, "update", { updateKind: "sl" })}
            onExit={(trade) => openAlertSheet(trade, "exit")}
          />
        )}

        {activeTab === "watch" && (
          <MobileWatchScreen
            watchlist={watchlist}
            loadedTrades={loadedTrades}
            onEnter={(trade) => openAlertSheet(trade, "enter")}
            onDismiss={(trade) => {
              // Remove from loaded trades
              useTradeStore.getState().deleteTrade(trade.id);
            }}
            onLoad={handleLoadTicker}
          />
        )}

        {activeTab === "review" && (
          <MobileReviewScreen
            trades={exitedTrades}
            onShare={(trade) => openAlertSheet(trade, "exit")}
          />
        )}

        {activeTab === "settings" && (
          <MobileSettingsScreen
            channels={discordChannels}
            voiceEnabled={!voice.isListening}
            onLogout={onLogout}
          />
        )}
      </main>

      {/* Bottom navigation */}
      <MobileTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeTradesCount={enteredTrades.length}
        loadedTradesCount={loadedTrades.length}
      />

      {/* Voice HUD overlay */}
      {voice.hudState && (
        <MobileVoiceHUD
          state={voice.hudState}
          transcript={voice.transcript}
          command={voice.command || undefined}
          error={voice.error}
          onConfirm={voice.confirmAction}
          onCancel={voice.cancelAction}
        />
      )}

      {/* Alert sheet */}
      <MobileAlertSheet
        open={alertSheetOpen}
        onOpenChange={setAlertSheetOpen}
        trade={alertTrade}
        alertType={alertType}
        alertOptions={alertOptions}
        channels={discordChannels}
        challenges={challenges}
        onSend={handleSendAlert}
      />

      {/* Contract sheet */}
      <MobileContractSheet
        open={contractSheetOpen}
        onOpenChange={setContractSheetOpen}
        symbol={contractSheetTicker?.symbol || ""}
        contracts={contractsForTicker}
        onSelect={handleContractSelect}
        loading={contractsLoading}
        error={contractsError}
        onRetry={() => contractSheetTicker && handleLoadTicker(contractSheetTicker)}
        underlyingPrice={contractSheetTicker?.last || 0}
      />
    </div>
  );
}
