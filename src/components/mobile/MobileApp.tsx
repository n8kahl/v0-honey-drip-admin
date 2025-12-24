import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
import { createAlertDraft } from "../../domain/alertDraft";
import { commitAlertDraft, type DiscordAlertService } from "../../domain/alerts/commitAlertDraft";
import {
  alertTypeToIntent,
  type UIAlertType,
  type UIUpdateKind,
} from "../../domain/alerts/intentMapping";

interface MobileAppProps {
  onLogout?: () => void;
}

export function MobileApp({ onLogout }: MobileAppProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active tab from URL (with fallback to "active")
  const activeTab = (searchParams.get("tab") as MobileTab) || "active";

  // Set active tab by updating URL
  const setActiveTab = (tab: MobileTab) => {
    setSearchParams({ tab });
  };

  // Alert sheet state
  const [alertSheetOpen, setAlertSheetOpen] = useState(false);
  const [alertTrade, setAlertTrade] = useState<Trade | null>(null);
  const [alertType, setAlertType] = useState<AlertType>("update");
  const [alertOptions, setAlertOptions] = useState<{
    updateKind?: "trim" | "generic" | "sl" | "take-profit";
    trimPercent?: number;
  }>({});

  // Contract sheet state
  const [contractSheetOpen, setContractSheetOpen] = useState(false);
  const [contractSheetTicker, setContractSheetTicker] = useState<Ticker | null>(null);
  const [contractsForTicker, setContractsForTicker] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsError, setContractsError] = useState<string | null>(null);

  // Stores
  const { activeTrades, historyTrades, loadTrades } = useTradeStore();
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
    options?: { updateKind?: "trim" | "generic" | "sl" | "take-profit"; trimPercent?: number }
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
      trimPercent?: number;
    }
  ) => {
    if (!alertTrade || !user?.id) {
      toast.error("Not authenticated");
      return;
    }

    try {
      // Convert UI alert type to domain intent
      const intent = alertTypeToIntent(
        alertType as UIAlertType,
        alertOptions.updateKind as UIUpdateKind
      );

      // Create alert draft using domain layer
      const draft = createAlertDraft({
        intent,
        trade: alertTrade,
        currentPrice: priceOverrides?.currentPrice,
        initialChannels: channels,
        initialChallenges: challengeIds,
        trimPercent: priceOverrides?.trimPercent ?? alertOptions?.trimPercent,
      });

      // Apply price overrides to draft
      if (priceOverrides) {
        if (priceOverrides.entryPrice !== undefined) {
          draft.editablePrices.entry = priceOverrides.entryPrice;
        }
        if (priceOverrides.currentPrice !== undefined) {
          draft.editablePrices.current = priceOverrides.currentPrice;
        }
        if (priceOverrides.targetPrice !== undefined) {
          draft.editablePrices.target = priceOverrides.targetPrice;
        }
        if (priceOverrides.stopLoss !== undefined) {
          draft.editablePrices.stop = priceOverrides.stopLoss;
        }
        if (priceOverrides.trimPercent !== undefined) {
          draft.trimPercent = priceOverrides.trimPercent;
        }
      }

      // Set comment if provided
      if (comment) {
        draft.comment = comment;
      }

      // Commit the alert draft through domain layer
      const discordService: DiscordAlertService = {
        sendLoadAlert: discord.sendLoadAlert,
        sendEntryAlert: discord.sendEntryAlert,
        sendUpdateAlert: discord.sendUpdateAlert,
        sendTrailingStopAlert: discord.sendTrailingStopAlert,
        sendExitAlert: discord.sendExitAlert,
      };

      const result = await commitAlertDraft(draft, user.id, discordService);

      if (!result.success) {
        toast.error(result.error || "Failed to send alert");
        return;
      }

      // Update store based on intent
      const tradeStore = useTradeStore.getState();

      if (intent === "LOAD") {
        // Clear preview and add to activeTrades
        tradeStore.setPreviewTrade(null);
        if (result.trade) {
          tradeStore.setActiveTrades([...tradeStore.activeTrades, result.trade]);
        }
        toast.success("Trade loaded and alert sent");
      } else if (
        intent === "ENTER" ||
        intent === "UPDATE_SL" ||
        intent === "TRIM" ||
        intent === "EXIT"
      ) {
        // Reload trades to get updated state
        await tradeStore.loadTrades(user.id);

        // Success messages
        if (intent === "ENTER") toast.success("Entry alert sent");
        else if (intent === "UPDATE_SL") toast.success("Stop loss update sent");
        else if (intent === "TRIM") toast.success("Trim alert sent");
        else if (intent === "EXIT") toast.success("Exit alert sent");
      }

      setAlertSheetOpen(false);
      setAlertTrade(null);
    } catch (error) {
      console.error("[MobileApp] Failed to send alert:", error);
      toast.error("Failed to send alert");
      // Close modal after 1.5s to allow user to see error
      setTimeout(() => {
        setAlertSheetOpen(false);
        setAlertTrade(null);
      }, 1500);
    }
  };

  // Handle Enter and Alert - skip LOADED state, go directly to ENTERED
  const handleEnterAndAlert = async (
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
    if (!alertTrade || !user?.id) {
      toast.error("Not authenticated");
      return;
    }

    try {
      // Use ENTER intent (skips LOADED state)
      const intent = "ENTER";

      // Create alert draft using domain layer
      const draft = createAlertDraft({
        intent,
        trade: alertTrade,
        currentPrice: priceOverrides?.currentPrice,
        initialChannels: channels,
        initialChallenges: challengeIds,
      });

      // Apply price overrides to draft
      if (priceOverrides) {
        if (priceOverrides.entryPrice !== undefined) {
          draft.editablePrices.entry = priceOverrides.entryPrice;
        }
        if (priceOverrides.currentPrice !== undefined) {
          draft.editablePrices.current = priceOverrides.currentPrice;
        }
        if (priceOverrides.targetPrice !== undefined) {
          draft.editablePrices.target = priceOverrides.targetPrice;
        }
        if (priceOverrides.stopLoss !== undefined) {
          draft.editablePrices.stop = priceOverrides.stopLoss;
        }
      }

      // Set comment if provided
      if (comment) {
        draft.comment = comment;
      }

      // Commit draft (persists to database + sends Discord)
      const discordService: DiscordAlertService = {
        sendLoadAlert: discord.sendLoadAlert,
        sendEntryAlert: discord.sendEntryAlert,
        sendUpdateAlert: discord.sendUpdateAlert,
        sendTrailingStopAlert: discord.sendTrailingStopAlert,
        sendExitAlert: discord.sendExitAlert,
      };

      const result = await commitAlertDraft(draft, user.id, discordService);

      if (!result.success) {
        toast.error(result.error || "Failed to enter trade");
        return;
      }

      toast.success("Trade entered successfully!");

      // Close alert sheet
      setAlertSheetOpen(false);
      setAlertTrade(null);

      // Clear preview trade
      const tradeStore = useTradeStore.getState();
      tradeStore.setPreviewTrade(null);

      // Add to active trades
      if (result.trade) {
        tradeStore.setActiveTrades([...tradeStore.activeTrades, result.trade]);
      }

      // Switch to Active tab
      setActiveTab("active");

      // Reload trades to get latest state
      await tradeStore.loadTrades(user.id);
    } catch (error) {
      console.error("[MobileApp] Failed to enter trade:", error);
      toast.error("Failed to enter trade");
      // Keep sheet open on error to allow retry
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
        onEnterAndAlert={handleEnterAndAlert}
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
