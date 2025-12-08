import { useState, useEffect, useMemo } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileTabNav, type MobileTab } from "./MobileTabNav";
import { MobileActiveScreen } from "./screens/MobileActiveScreen";
import { MobileWatchScreen } from "./screens/MobileWatchScreen";
import { MobileReviewScreen } from "./screens/MobileReviewScreen";
import { MobileSettingsScreen } from "./screens/MobileSettingsScreen";
import { MobileVoiceHUD } from "./common/MobileVoiceHUD";
import { MobileAlertSheet } from "./sheets/MobileAlertSheet";

import { useTradeStore, useMarketStore, useSettingsStore } from "../../stores";
import { useVoiceCommands } from "../../hooks/useVoiceCommands";
import { useDiscord } from "../../hooks/useDiscord";
import { useAuth } from "../../contexts/AuthContext";
import { Trade, AlertType } from "../../types";
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

      {/* Spacer for fixed header */}
      <div className="h-14 pt-safe" />

      {/* Main content */}
      <main className="flex-1 overflow-hidden pb-16">
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
            onLoad={(ticker) => {
              // Navigate to contract selection - for now, just log
              console.log("[Mobile] Load ticker:", ticker.symbol);
              // TODO: Open contract sheet
            }}
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
    </div>
  );
}
