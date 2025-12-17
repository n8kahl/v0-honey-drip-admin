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

  // Stores
  const { activeTrades, historyTrades, loadTrades, updateTrade } = useTradeStore();
  const { watchlist, loadWatchlist } = useMarketStore();
  const {
    discordChannels,
    challenges,
    loadDiscordChannels,
    loadChallenges,
    discordAlertsEnabled,
    getDefaultChannels,
  } = useSettingsStore();

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
      // Handle voice alerts
      console.log("[Mobile] Voice alert:", alert);
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
    setContractSheetOpen(true);

    try {
      const response = await fetch(`/api/options/chain?symbol=${ticker.symbol}&window=10`);
      if (!response.ok) throw new Error("Failed to fetch options chain");
      const data = await response.json();
      setContractsForTicker(data.contracts || []);
    } catch (error) {
      console.error("[Mobile] Failed to load contracts:", error);
      toast.error("Failed to load options chain");
      setContractSheetOpen(false);
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

  // Handle contract selection - create LOADED trade and open alert sheet
  const handleContractSelect = (contract: Contract) => {
    if (!contractSheetTicker || !user) return;

    // Calculate TP/SL based on trade type
    const tradeType = getTradeType(contract.daysToExpiry || 0);
    const tpMultiplier = tradeType === "Scalp" ? 1.3 : tradeType === "Day" ? 1.5 : 2.0;
    const slMultiplier = tradeType === "Scalp" ? 0.7 : tradeType === "Day" ? 0.5 : 0.3;

    // Create trade in LOADED state
    const newTrade: Trade = {
      id: crypto.randomUUID(),
      ticker: contractSheetTicker.symbol,
      state: "LOADED",
      contract,
      tradeType,
      targetPrice: contract.mid * tpMultiplier,
      stopLoss: contract.mid * slMultiplier,
      currentPrice: contract.mid,
      discordChannels: [],
      challenges: [],
      updates: [],
    };

    // Add to active trades (in-memory, will persist on entry)
    const currentTrades = useTradeStore.getState().activeTrades;
    useTradeStore.getState().setActiveTrades([...currentTrades, newTrade]);

    // Close contract sheet and open alert sheet
    setContractSheetOpen(false);
    setContractSheetTicker(null);
    setContractsForTicker([]);

    // Open alert sheet for load alert
    openAlertSheet(newTrade, "load");
  };

  // Handle sending alert
  const handleSendAlert = async (channels: string[], challengeIds: string[], comment?: string) => {
    if (!alertTrade) return;

    try {
      const selectedChannels = discordChannels.filter((c) => channels.includes(c.id));

      if (alertType === "update" && alertOptions.updateKind === "trim") {
        await discord.sendUpdateAlert(selectedChannels, alertTrade, "trim", comment);
        toast.success("Trim alert sent");
      } else if (alertType === "update" && alertOptions.updateKind === "sl") {
        await discord.sendUpdateAlert(selectedChannels, alertTrade, "update-sl", comment);
        toast.success("Stop loss update sent");
      } else if (alertType === "exit") {
        await discord.sendExitAlert(selectedChannels, alertTrade, comment);
        // Update trade state to EXITED
        await updateTrade(alertTrade.id, {
          state: "EXITED",
          exitPrice: alertTrade.currentPrice,
          exitTime: new Date(),
        });
        toast.success("Exit alert sent");
      } else if (alertType === "enter") {
        await discord.sendEntryAlert(selectedChannels, alertTrade, comment);
        // Update trade state to ENTERED
        await updateTrade(alertTrade.id, {
          state: "ENTERED",
          entryPrice: alertTrade.contract?.mid,
          entryTime: new Date(),
        });
        toast.success("Entry alert sent");
      } else if (alertType === "load") {
        await discord.sendLoadAlert(selectedChannels, alertTrade, comment);
        toast.success("Load alert sent");
      }

      setAlertSheetOpen(false);
      setAlertTrade(null);
    } catch (error) {
      console.error("[Mobile] Failed to send alert:", error);
      toast.error("Failed to send alert");
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
      />
    </div>
  );
}
