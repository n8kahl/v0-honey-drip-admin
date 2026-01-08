/**
 * MobileApp - "The Opportunity Stack"
 *
 * Refactored mobile trading interface with:
 * 1. Sticky Ticker Tape header (active symbol + SmartScore + FlowPulse)
 * 2. Swipeable tab navigation (SCAN | DEEP | MGMT)
 * 3. Gold Action FAB for quick trading
 *
 * Design principles:
 * - 44px+ touch targets
 * - 14px+ text for legibility
 * - Institutional-grade data visualization
 */

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MobileTickerTape } from "./MobileTickerTape";
import { MobileOpportunityTabs, type OpportunityTab } from "./MobileOpportunityTabs";
import { MobileActionFab } from "./MobileActionFab";
import { MobileScanScreen } from "./screens/MobileScanScreen";
import { MobileDeepScreen } from "./screens/MobileDeepScreen";
import { MobileMgmtScreen } from "./screens/MobileMgmtScreen";
import { MobileAlertSheet } from "./sheets/MobileAlertSheet";
import { MobileContractSheet } from "./sheets/MobileContractSheet";
import { MobileSettingsScreen } from "./screens/MobileSettingsScreen";

import { useTradeStore, useMarketStore, useSettingsStore, useUIStore } from "../../stores";
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
import { Settings } from "lucide-react";

interface MobileAppProps {
  onLogout?: () => void;
}

export function MobileApp({ onLogout }: MobileAppProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active tab from URL (with fallback to "scan")
  const activeTab = (searchParams.get("tab") as OpportunityTab | "settings") || "scan";
  const isSettingsOpen = activeTab === "settings";

  // Set active tab by updating URL
  const setActiveTab = (tab: OpportunityTab | "settings") => {
    setSearchParams({ tab });
  };

  // Focus symbol from UI store
  const focusSymbol = useUIStore((s) => s.mainCockpitSymbol);
  const setFocusSymbol = useUIStore((s) => s.setMainCockpitSymbol);

  // Alert sheet state
  const [alertSheetOpen, setAlertSheetOpen] = useState(false);
  const [alertTrade, setAlertTrade] = useState<Trade | null>(null);
  const [alertType, setAlertType] = useState<AlertType>("update");
  const [alertOptions, setAlertOptions] = useState<{
    updateKind?: "trim" | "generic" | "sl" | "take-profit";
    trimPercent?: number;
  }>({});

  // Contract sheet state (for Action FAB)
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

  // Handle ticker tap from watchlist - set focus and go to DEEP tab
  const handleTickerTap = (ticker: Ticker) => {
    setFocusSymbol(ticker.symbol);
    setActiveTab("deep");
  };

  // Handle Action FAB tap - open contract sheet for focused symbol
  const handleActionFabTap = () => {
    if (!focusSymbol) {
      // No symbol selected, prompt to select one
      setActiveTab("scan");
      toast.info("Select a symbol first", { description: "Tap a card in the SCAN tab" });
      return;
    }

    // Find ticker in watchlist
    const ticker = watchlist.find((t) => t.symbol === focusSymbol);
    if (ticker) {
      handleLoadTicker(ticker);
    }
  };

  // Handle Load button - fetch contracts and open contract sheet
  const handleLoadTicker = async (ticker: Ticker) => {
    setContractSheetTicker(ticker);
    setContractsLoading(true);
    setContractsError(null);
    setContractSheetOpen(true);

    try {
      const tokenManager = massive.getTokenManager();
      const contracts = await fetchNormalizedChain(ticker.symbol, {
        window: 10,
        tokenManager,
      });
      setContractsForTicker(contracts);
    } catch (error) {
      console.error("[Mobile] Failed to load contracts:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to load options chain";
      setContractsError(errorMsg);
      toast.error("Failed to load options chain");
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

  // Handle contract selection - create WATCHING trade and open alert sheet
  const handleContractSelect = (contract: Contract) => {
    if (!contractSheetTicker || !user) return;

    const tradeType = getTradeType(contract.daysToExpiry || 0);
    const tpMultiplier = tradeType === "Scalp" ? 1.3 : tradeType === "Day" ? 1.5 : 2.0;
    const slMultiplier = tradeType === "Scalp" ? 0.7 : tradeType === "Day" ? 0.5 : 0.3;

    const previewTrade: Trade = {
      id: crypto.randomUUID(),
      ticker: contractSheetTicker.symbol,
      state: "WATCHING",
      contract,
      tradeType,
      targetPrice: contract.mid * tpMultiplier,
      stopLoss: contract.mid * slMultiplier,
      currentPrice: contract.mid,
      discordChannels: [],
      challenges: [],
      updates: [],
    };

    useTradeStore.getState().setPreviewTrade(previewTrade);

    setContractSheetOpen(false);
    setContractSheetTicker(null);
    setContractsForTicker([]);

    openAlertSheet(previewTrade, "load");
  };

  // Handle sending alert
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

    if (!discordAlertsEnabled) {
      toast.info("Discord alerts disabled", {
        description: "Enable in Settings → Discord to send alerts.",
      });
      return;
    }

    try {
      const intent = alertTypeToIntent(
        alertType as UIAlertType,
        alertOptions.updateKind as UIUpdateKind
      );

      const draft = createAlertDraft({
        intent,
        trade: alertTrade,
        currentPrice: priceOverrides?.currentPrice,
        initialChannels: channels,
        initialChallenges: challengeIds,
        trimPercent: priceOverrides?.trimPercent ?? alertOptions?.trimPercent,
      });

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

      if (comment) {
        draft.comment = comment;
      }

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

      const tradeStore = useTradeStore.getState();

      if (intent === "LOAD") {
        tradeStore.setPreviewTrade(null);
        if (result.trade) {
          tradeStore.setActiveTrades([...tradeStore.activeTrades, result.trade]);
        }
        toast.success("Trade loaded and alert sent");
        setActiveTab("mgmt"); // Switch to MGMT tab
      } else if (
        intent === "ENTER" ||
        intent === "UPDATE_SL" ||
        intent === "TRIM" ||
        intent === "EXIT"
      ) {
        await tradeStore.loadTrades(user.id);

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
      setTimeout(() => {
        setAlertSheetOpen(false);
        setAlertTrade(null);
      }, 1500);
    }
  };

  // Handle Enter and Alert - skip LOADED state
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

    if (!discordAlertsEnabled) {
      toast.info("Discord alerts disabled", {
        description: "Enable in Settings → Discord to send alerts.",
      });
      return;
    }

    try {
      const intent = "ENTER";

      const draft = createAlertDraft({
        intent,
        trade: alertTrade,
        currentPrice: priceOverrides?.currentPrice,
        initialChannels: channels,
        initialChallenges: challengeIds,
      });

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

      if (comment) {
        draft.comment = comment;
      }

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

      setAlertSheetOpen(false);
      setAlertTrade(null);

      const tradeStore = useTradeStore.getState();
      tradeStore.setPreviewTrade(null);

      if (result.trade) {
        tradeStore.setActiveTrades([...tradeStore.activeTrades, result.trade]);
      }

      setActiveTab("mgmt");
      await tradeStore.loadTrades(user.id);
    } catch (error) {
      console.error("[MobileApp] Failed to enter trade:", error);
      toast.error("Failed to enter trade");
    }
  };

  // Check if there's an opportunity (high score in watchlist)
  const hasOpportunity = useMemo(() => {
    if (!focusSymbol) return false;
    // Opportunity exists when we have a focused symbol and no active positions
    return enteredTrades.length === 0 && loadedTrades.length === 0;
  }, [focusSymbol, enteredTrades.length, loadedTrades.length]);

  // Settings screen
  if (isSettingsOpen) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
          <div className="safe-area-top" />
          <div className="flex items-center justify-between h-14 px-4">
            <button
              onClick={() => setActiveTab("scan")}
              className="text-sm font-medium text-[var(--brand-primary)] min-h-[44px] min-w-[44px] flex items-center"
            >
              ← Back
            </button>
            <span className="text-base font-semibold text-[var(--text-high)]">Settings</span>
            <div className="w-11" /> {/* Spacer for alignment */}
          </div>
        </div>

        <MobileSettingsScreen channels={discordChannels} onLogout={onLogout} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col">
      {/* Sticky Ticker Tape Header */}
      <MobileTickerTape onSymbolClick={() => setActiveTab("scan")} />

      {/* Settings button (top right) */}
      <button
        onClick={() => setActiveTab("settings")}
        className="fixed top-3 right-4 z-50 p-2.5 rounded-xl bg-[var(--surface-2)]/80 backdrop-blur min-h-[44px] min-w-[44px] flex items-center justify-center"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <Settings className="w-5 h-5 text-[var(--text-muted)]" />
      </button>

      {/* Tabbed Content Area */}
      <MobileOpportunityTabs
        activeTab={activeTab as OpportunityTab}
        onTabChange={setActiveTab}
        scanBadge={watchlist.length}
        mgmtBadge={enteredTrades.length + loadedTrades.length}
        scanContent={
          <MobileScanScreen
            watchlist={watchlist}
            onTickerTap={handleTickerTap}
            onAddTicker={() => useUIStore.getState().setShowAddTickerDialog(true)}
          />
        }
        deepContent={<MobileDeepScreen />}
        mgmtContent={
          <MobileMgmtScreen
            enteredTrades={enteredTrades}
            loadedTrades={loadedTrades}
            onTrim={(trade) => openAlertSheet(trade, "update", { updateKind: "trim" })}
            onUpdateSL={(trade) => openAlertSheet(trade, "update", { updateKind: "sl" })}
            onExit={(trade) => openAlertSheet(trade, "exit")}
            onEnter={(trade) => openAlertSheet(trade, "enter")}
            onDismiss={(trade) => useTradeStore.getState().deleteTrade(trade.id)}
          />
        }
      />

      {/* Gold Action FAB */}
      <MobileActionFab
        symbol={focusSymbol}
        hasOpportunity={hasOpportunity}
        onTap={handleActionFabTap}
        disabled={!focusSymbol}
      />

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
