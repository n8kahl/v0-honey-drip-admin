"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DesktopLiveCockpitSlim } from "./components/DesktopLiveCockpitSlim";
import { DesktopHistory } from "./components/DesktopHistory";
import { SettingsPage } from "./components/settings/SettingsPage";
import { MobileActive } from "./components/MobileActive";
import { VoiceCommandDemo } from "./components/VoiceCommandDemo";
import { TraderHeader } from "./components/Header/TraderHeader";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { HDDialogDiscordSettings } from "./components/hd/forms/HDDialogDiscordSettings";
import { HDDialogAddTicker } from "./components/hd/forms/HDDialogAddTicker";
import { HDDialogAddChallenge } from "./components/hd/forms/HDDialogAddChallenge";
import { Toaster } from "./components/ui/sonner";
import { useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { PublicPortal } from "./pages/PublicPortal";
import { useQuotes } from "./hooks/useMassiveData";
import { useDiscord } from "./hooks/useDiscord";
import { useCompositeSignals } from "./hooks/useCompositeSignals";
import { useTradeStore, useMarketStore, useUIStore, useSettingsStore } from "./stores";
import { useMarketSessionActions, useMarketDataStore } from "./stores/marketDataStore";
import { useKeyboardShortcuts, type KeyboardShortcut } from "./hooks/useKeyboardShortcuts";
import { KeyboardShortcutsDialog } from "./components/shortcuts/KeyboardShortcutsDialog";
import { MonitoringDashboard } from "./components/monitoring/MonitoringDashboard";
import "./styles/globals.css";

type AppTab = "live" | "active" | "history" | "settings" | "monitoring";

/**
 * Derive the active tab from the current route
 */
function getActiveTabFromPath(pathname: string): AppTab {
  if (pathname === "/active") return "active";
  if (pathname === "/history") return "history";
  if (pathname === "/settings") return "settings";
  if (pathname === "/monitoring") return "monitoring";
  return "live"; // Default to live for '/' and unknown routes
}

export default function App() {
  const { user, loading } = useAuth();
  const isTestAuto = (import.meta as any)?.env?.VITE_TEST_AUTO_LOGIN === "true";
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);

  // React Router hooks - single source of truth for navigation
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useMemo(() => getActiveTabFromPath(location.pathname), [location.pathname]);

  // Zustand stores
  const { loadTrades, activeTrades, historyTrades, updatedTradeIds } = useTradeStore();
  const { watchlist, loadWatchlist, updateQuotes, getWatchlistSymbols } = useMarketStore();
  const {
    showDiscordDialog,
    showAddTickerDialog,
    showAddChallengeDialog,
    voiceState,
    voiceActive,
    focusedTrade,
    flashTradeTab,
    toggleVoice,
    setFocusedTrade,
    setFlashTradeTab,
  } = useUIStore();

  // Settings store
  const { discordChannels, challenges, loadDiscordChannels, loadChallenges, discordAlertsEnabled } =
    useSettingsStore();

  // Market session actions
  const { fetchMarketSession } = useMarketSessionActions();

  // Market data store - for WebSocket management
  const initializeMarketData = useMarketDataStore((state) => state.initialize);
  const marketDataCleanup = useMarketDataStore((state) => state.cleanup);

  // Discord hook - MUST be called before any early returns
  const discord = useDiscord();

  // Streaming-first with initial batched REST fill
  const watchlistSymbols = useMemo(() => getWatchlistSymbols(), [watchlist]);
  const { quotes } = useQuotes(watchlistSymbols);

  // Composite signals - monitors for trade setup signals
  const {
    signals: compositeSignals,
    activeSignals,
    loading: signalsLoading,
  } = useCompositeSignals({
    userId: user?.id || "00000000-0000-0000-0000-000000000001",
    autoSubscribe: !!user, // Only subscribe when authenticated
    autoExpire: true, // Auto-expire old signals
  });

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      // Navigation shortcuts
      {
        key: "1",
        description: "Go to Watch tab (Live)",
        action: () => navigate("/"),
        category: "navigation",
      },
      {
        key: "2",
        description: "Go to Trade tab (Active)",
        action: () => {
          navigate("/active");
          setFlashTradeTab(true);
          setTimeout(() => setFlashTradeTab(false), 2000);
        },
        category: "navigation",
      },
      {
        key: "3",
        description: "Go to Review tab (History)",
        action: () => navigate("/history"),
        category: "navigation",
      },
      {
        key: "4",
        description: "Go to Settings",
        action: () => navigate("/settings"),
        category: "navigation",
      },
      {
        key: "5",
        description: "Go to Monitoring",
        action: () => navigate("/monitoring"),
        category: "navigation",
      },
      {
        key: "Escape",
        description: "Close shortcuts dialog",
        action: () => setShowShortcutsDialog(false),
        category: "general",
      },
      {
        key: "Ctrl+?",
        description: "Show keyboard shortcuts",
        action: () => setShowShortcutsDialog(true),
        category: "help",
      },
      {
        key: "Cmd+?",
        description: "Show keyboard shortcuts (Mac)",
        action: () => setShowShortcutsDialog(true),
        category: "help",
      },
    ],
    [navigate, setFlashTradeTab]
  );

  // Register keyboard shortcuts
  useKeyboardShortcuts(shortcuts);

  // Update quotes in market store when new data arrives
  useEffect(() => {
    if (quotes.size > 0) {
      updateQuotes(quotes as any);
    }
  }, [quotes, updateQuotes]);

  // Load user data on auth
  useEffect(() => {
    if (!user && !isTestAuto) return;

    const loadUserData = async () => {
      console.log("[v0] Loading user data from Supabase...");
      try {
        await Promise.all([
          loadDiscordChannels((user?.id || "00000000-0000-0000-0000-000000000001") as string),
          loadChallenges((user?.id || "00000000-0000-0000-0000-000000000001") as string),
          loadWatchlist((user?.id || "00000000-0000-0000-0000-000000000001") as string),
          loadTrades((user?.id || "00000000-0000-0000-0000-000000000001") as string),
        ]);
      } catch (error) {
        console.error("[v0] Failed to load user data:", error);
      }
    };

    loadUserData();
  }, [user, isTestAuto, loadDiscordChannels, loadChallenges, loadWatchlist, loadTrades]);

  // Initialize market session and poll every minute
  useEffect(() => {
    // Fetch immediately
    fetchMarketSession();

    // Poll every 60 seconds to keep session data fresh
    const interval = setInterval(() => {
      fetchMarketSession();
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchMarketSession]);

  // Initialize market data WebSocket when watchlist is loaded
  useEffect(() => {
    if (watchlistSymbols.length > 0) {
      console.log("[v0] App: Initializing marketDataStore with watchlist:", watchlistSymbols);
      initializeMarketData(watchlistSymbols);
    }

    // Cleanup on unmount
    return () => {
      console.log("[v0] App: Cleaning up marketDataStore");
      marketDataCleanup();
    };
  }, [watchlistSymbols.length]); // Only reinitialize if watchlist size changes

  // Public portal route (no auth required)
  if (location.pathname === "/public") {
    return <PublicPortal />;
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  if (!user && !isTestAuto) {
    return <AuthPage />;
  }

  // Helper function to navigate to active tab with flash effect
  const navigateToActive = () => {
    navigate("/active");
    setFlashTradeTab(true);
    setTimeout(() => setFlashTradeTab(false), 2000);
  };

  // Helper function to focus a trade in the live view
  const focusTradeInLive = (trade: any) => {
    navigate("/");
    setFocusedTrade(trade);
    // Clear focus after component has processed the state change
    setTimeout(() => setFocusedTrade(null), 300);
  };

  const handleExitedTrade = (trade: any) => {
    console.log("Trade exited:", trade);
    setTimeout(() => navigate("/history"), 100);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col pb-16 md:pb-0">
      {/* Trader Header with status bar and navigation */}
      <TraderHeader />

      {/* Spacer for fixed header (80px for status bar + nav) */}
      <div className="h-20" />

      <main className="flex-1 w-full bg-[var(--bg-base)]">
        {(activeTab === "live" || activeTab === "active") && (
          <DesktopLiveCockpitSlim
            watchlist={watchlist}
            hotTrades={activeTrades}
            challenges={challenges}
            onTickerClick={() => {}}
            onHotTradeClick={() => {}}
            onAddTicker={() => useUIStore.getState().setShowAddTickerDialog(true)}
            onRemoveTicker={(ticker) => useMarketStore.getState().removeTicker(ticker.id)}
            onAddChallenge={() => useUIStore.getState().setShowAddChallengeDialog(true)}
            onRemoveChallenge={(challenge) =>
              useSettingsStore.getState().removeChallenge(challenge.id)
            }
            onTradesChange={() => {}} // Not needed anymore, store handles it
            channels={discordChannels}
            focusedTrade={focusedTrade}
            onMobileTabChange={(tab) => {
              // Map tab names to routes
              if (tab === "live") navigate("/");
              else if (tab === "active") navigateToActive();
              else if (tab === "history") navigate("/history");
              else if (tab === "settings") navigate("/settings");
              else if (tab === "monitoring") navigate("/monitoring");
            }}
            updatedTradeIds={updatedTradeIds}
            onOpenActiveTrade={(tradeId) => {
              const trade = activeTrades.find((t) => t.id === tradeId);
              if (trade) focusTradeInLive(trade);
            }}
            onOpenReviewTrade={() => navigate("/history")}
            onExitedTrade={handleExitedTrade}
            activeTab={activeTab}
            compositeSignals={activeSignals}
          />
        )}

        {activeTab === "active" && (
          <div className="lg:hidden">
            <MobileActive
              trades={activeTrades}
              updatedTradeIds={updatedTradeIds}
              onTradeClick={(trade) => focusTradeInLive(trade)}
            />
          </div>
        )}

        {activeTab === "history" && (
          <DesktopHistory
            trades={historyTrades}
            channels={discordChannels}
            challenges={challenges}
          />
        )}

        {activeTab === "settings" && (
          <SettingsPage
            onOpenDiscordSettings={() => useUIStore.getState().setShowDiscordDialog(true)}
            onClose={() => navigate("/")}
          />
        )}

        {activeTab === "monitoring" && <MonitoringDashboard />}
      </main>

      <HDDialogDiscordSettings
        open={showDiscordDialog}
        onOpenChange={(open) => useUIStore.getState().setShowDiscordDialog(open)}
        channels={discordChannels}
        onAddChannel={async (name, webhookUrl) => {
          if (!user) return;
          await useSettingsStore.getState().createDiscordChannel(user.id, name, webhookUrl);
        }}
        onRemoveChannel={async (id) => {
          await useSettingsStore.getState().removeDiscordChannel(id);
        }}
        onTestWebhook={async (channel) => {
          return await discord.testWebhook(channel);
        }}
        discordAlertsEnabled={discordAlertsEnabled}
        onToggleAlertsEnabled={(enabled) =>
          useSettingsStore.getState().setDiscordAlertsEnabled(enabled)
        }
      />

      <HDDialogAddTicker
        open={showAddTickerDialog}
        onOpenChange={(open) => useUIStore.getState().setShowAddTickerDialog(open)}
        onAddTicker={async (ticker) => {
          if (!user) return;
          await useMarketStore.getState().addTicker(user.id, ticker);
        }}
      />

      <HDDialogAddChallenge
        open={showAddChallengeDialog}
        onOpenChange={(open) => useUIStore.getState().setShowAddChallengeDialog(open)}
        onAddChallenge={async (challenge) => {
          if (!user) return;
          await useSettingsStore.getState().createChallenge(user.id, challenge);
        }}
      />

      <div className="md:hidden">
        <MobileBottomNav
          activeTab={activeTab as any}
          onTabChange={(tab) => {
            // Navigate using React Router
            if (tab === "live") navigate("/");
            else if (tab === "active") navigateToActive();
            else if (tab === "history") navigate("/history");
            else if (tab === "settings") navigate("/settings");
          }}
          hasActiveTrades={activeTrades.filter((t) => t.state === "ENTERED").length > 0}
          flashTradeTab={flashTradeTab}
        />
      </div>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsDialog
        isOpen={showShortcutsDialog}
        onClose={() => setShowShortcutsDialog(false)}
        shortcuts={shortcuts}
      />

      <Toaster />
    </div>
  );
}
