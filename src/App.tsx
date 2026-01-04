"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DesktopLiveCockpitSlim } from "./components/DesktopLiveCockpitSlim";
import { DesktopHistory } from "./components/DesktopHistory";
import { SettingsPage } from "./components/settings/SettingsPage";
import { MobileActive } from "./components/MobileActive";
import { TraderHeader } from "./components/Header/TraderHeader";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { MobileApp } from "./components/mobile/MobileApp";
import { HDDialogDiscordSettings } from "./components/hd/forms/HDDialogDiscordSettings";
import { HDDialogAddTicker } from "./components/hd/forms/HDDialogAddTicker";
import { HDDialogAddChallenge } from "./components/hd/forms/HDDialogAddChallenge";
import { Toaster } from "./components/ui/sonner";
import { useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { PublicPortal } from "./pages/PublicPortal";
import { WinsPage } from "./pages/WinsPage";
import { MemberDashboard } from "./pages/MemberDashboard";
import { useQuotes } from "./hooks/useMassiveData";
import { useDiscord } from "./hooks/useDiscord";
import { useCompositeSignals } from "./hooks/useCompositeSignals";
import { useTradeStore, useMarketStore, useUIStore, useSettingsStore } from "./stores";
import { useMarketSessionActions, useMarketDataStore } from "./stores/marketDataStore";
import type { MarketQuote } from "./stores/marketStore";
import { useKeyboardShortcuts, type KeyboardShortcut } from "./hooks/useKeyboardShortcuts";
import type { Trade } from "./types";
import { KeyboardShortcutsDialog } from "./components/shortcuts/KeyboardShortcutsDialog";
import { MonitoringDashboard } from "./components/monitoring/MonitoringDashboard";
import { initWhisper, isWhisperSupported } from "./lib/whisper/client";
import { ActiveTradePollingService } from "./services/ActiveTradePollingService";
import "./styles/globals.css";

// Hook to detect mobile viewport
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
}

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
  const isTestAuto = import.meta.env?.VITE_TEST_AUTO_LOGIN === "true";
  const isMobile = useIsMobile();
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [headerVoiceState, setHeaderVoiceState] = useState<{
    isListening: boolean;
    isProcessing: boolean;
    waitingForWakeWord: boolean;
    onToggle: () => void;
  } | null>(null);

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
    voiceState: _voiceState,
    voiceActive: _voiceActive,
    focusedTrade,
    flashTradeTab,
    toggleVoice: _toggleVoice,
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
  const subscribeToMarketData = useMarketDataStore((state) => state.subscribe);

  // Discord hook - MUST be called before any early returns
  const discord = useDiscord();

  // Streaming-first with initial batched REST fill
  const watchlistSymbols = useMemo(() => getWatchlistSymbols(), [watchlist]);
  const { quotes } = useQuotes(watchlistSymbols);

  // FIXED: Create a stable key based on actual symbol content (not array reference)
  // This prevents unnecessary re-runs when the watchlist array reference changes but content is the same
  const watchlistKey = useMemo(() => [...watchlistSymbols].sort().join(","), [watchlistSymbols]);

  // Composite signals - monitors for trade setup signals
  const {
    signals: _compositeSignals,
    activeSignals,
    loading: _signalsLoading,
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
      updateQuotes(quotes as Map<string, MarketQuote>);
    }
  }, [quotes, updateQuotes]);

  // Pre-load Whisper model in background (if supported)
  useEffect(() => {
    if (isWhisperSupported()) {
      initWhisper().catch((err) => {
        console.warn("[v0] Failed to pre-load Whisper model:", err);
      });
    }
  }, []);

  // Load user data on auth
  useEffect(() => {
    if (!user && !isTestAuto) return;

    const loadUserData = async () => {
      console.warn("[v0] Loading user data from Supabase...");
      try {
        await Promise.all([
          loadDiscordChannels((user?.id || "00000000-0000-0000-0000-000000000001") as string),
          loadChallenges((user?.id || "00000000-0000-0000-0000-000000000001") as string),
          loadWatchlist((user?.id || "00000000-0000-0000-0000-000000000001") as string),
          loadTrades((user?.id || "00000000-0000-0000-0000-000000000001") as string),
        ]);

        // Sync active trade polling with loaded trades
        ActiveTradePollingService.syncWithStore();

        // Log polling service status for debugging
        const pollingStatus = ActiveTradePollingService.getStatus();
        console.warn("[v0] ActiveTradePollingService status after sync:", pollingStatus);
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

  // FIXED: Consolidated market data initialization and subscription
  // Uses stable watchlistKey to prevent unnecessary re-runs
  useEffect(() => {
    console.warn(
      "[v0-App] Market data useEffect triggered, watchlistSymbols:",
      watchlistSymbols.length,
      watchlistSymbols.slice(0, 3).join(", ")
    );
    if (watchlistSymbols.length > 0) {
      console.warn(
        "[v0-App] Calling initializeMarketData with",
        watchlistSymbols.length,
        "symbols"
      );
      // Initialize with all symbols (preserves existing candle data)
      initializeMarketData(watchlistSymbols);

      // Subscribe each symbol for streaming updates
      watchlistSymbols.forEach((symbol) => {
        subscribeToMarketData(symbol);
      });
    }

    // Cleanup on unmount
    return () => {
      marketDataCleanup();
    };
  }, [watchlistKey]); // ONLY depend on watchlistKey (stable string) - NOT watchlistSymbols array reference

  // Public routes (no auth required)
  if (location.pathname === "/public") {
    return <PublicPortal />;
  }

  if (location.pathname === "/wins") {
    return <WinsPage />;
  }

  if (location.pathname === "/member") {
    return <MemberDashboard />;
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

  // Render mobile app on mobile devices
  if (isMobile) {
    return (
      <>
        <MobileApp />
        {/* Dialogs still need to work on mobile */}
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
        <Toaster />
      </>
    );
  }

  // Helper function to navigate to active tab with flash effect
  const navigateToActive = () => {
    navigate("/active");
    setFlashTradeTab(true);
    setTimeout(() => setFlashTradeTab(false), 2000);
  };

  // Voice navigation handler
  const handleVoiceNavigate = (
    destination: "live" | "active" | "history" | "settings" | "monitoring"
  ) => {
    switch (destination) {
      case "live":
        navigate("/");
        break;
      case "active":
        navigateToActive();
        break;
      case "history":
        navigate("/history");
        break;
      case "settings":
        navigate("/settings");
        break;
      case "monitoring":
        navigate("/monitoring");
        break;
    }
  };

  // Helper function to focus a trade in the live view
  const focusTradeInLive = (trade: Trade) => {
    navigate("/");
    setFocusedTrade(trade);
    // Clear focus after component has processed the state change
    setTimeout(() => setFocusedTrade(null), 300);
  };

  const handleExitedTrade = (_trade: Trade) => {
    // Trade exited - navigate back to main page
    // Navigate back to main page so user can select another ticker
    setTimeout(() => navigate("/"), 100);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col pb-16 md:pb-0">
      {/* Trader Header with status bar and navigation */}
      <TraderHeader
        isListening={headerVoiceState?.isListening}
        isProcessingVoice={headerVoiceState?.isProcessing}
        waitingForWakeWord={headerVoiceState?.waitingForWakeWord}
        onToggleVoice={headerVoiceState?.onToggle}
      />

      {/* Spacer for fixed header (80px for status bar + nav) */}
      <div className="h-20" />

      <main className="flex-1 w-full bg-[var(--bg-base)]">
        {(activeTab === "live" || activeTab === "active") && (
          <DesktopLiveCockpitSlim
            watchlist={watchlist}
            challenges={challenges}
            onTickerClick={() => {}}
            onAddTicker={() => useUIStore.getState().setShowAddTickerDialog(true)}
            onRemoveTicker={(ticker) =>
              useMarketStore.getState().removeTicker(user?.id || "", ticker.id)
            }
            onAddChallenge={() => useUIStore.getState().setShowAddChallengeDialog(true)}
            onRemoveChallenge={(challenge) =>
              useSettingsStore.getState().removeChallenge(challenge.id)
            }
            channels={discordChannels}
            onVoiceNavigate={handleVoiceNavigate}
            onMobileTabChange={(tab) => {
              // Map tab names to routes
              if (tab === "live") navigate("/");
              else if (tab === "active") navigateToActive();
              else if (tab === "history") navigate("/history");
              else if (tab === "settings") navigate("/settings");
              else if (tab === "monitoring") navigate("/monitoring");
            }}
            onOpenActiveTrade={(tradeId) => {
              const trade = activeTrades.find((t) => t.id === tradeId);
              if (trade) focusTradeInLive(trade);
            }}
            onOpenReviewTrade={() => navigate("/history")}
            onExitedTrade={handleExitedTrade}
            onEnteredTrade={() => {
              // NO-OP: Stay on cockpit page - NowPanel automatically shows NowPanelManage
              // for ENTERED trades. Navigating to /trades/:id was causing regression
              // by showing a static page instead of the live management cockpit.
            }}
            activeTab={activeTab}
            compositeSignals={activeSignals}
            onVoiceStateChange={setHeaderVoiceState}
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
          activeTab={activeTab === "live" || activeTab === "history" ? activeTab : "live"}
          onTabChange={(tab) => {
            // Navigate using React Router
            if (tab === "live") navigate("/");
            else if (tab === "history") navigate("/history");
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
