'use client';

import { useEffect, useMemo, useState } from 'react';
import { DesktopLiveCockpitSlim } from './components/DesktopLiveCockpitSlim';
import { DesktopHistory } from './components/DesktopHistory';
import { SettingsPage } from './components/settings/SettingsPage';
import { MobileActive } from './components/MobileActive';
import { VoiceCommandDemo } from './components/VoiceCommandDemo';
// Header moved to app/layout via <TraderHeader />
import { LiveStatusBar } from './components/LiveStatusBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { useAppNavigation } from './hooks/useAppNavigation';
import { HDDialogDiscordSettings } from './components/hd/HDDialogDiscordSettings';
import { HDDialogAddTicker } from './components/hd/HDDialogAddTicker';
import { HDDialogAddChallenge } from './components/hd/HDDialogAddChallenge';
import { Toaster } from './components/ui/sonner';
import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { useQuotes } from './hooks/useMassiveData';
import { useDiscord } from './hooks/useDiscord';
import { useStrategyScanner } from './hooks/useStrategyScanner';
import { useTradeStore, useMarketStore, useUIStore, useSettingsStore } from './stores';
import { useMarketSessionActions, useMarketDataStore } from './stores/marketDataStore';
import { useKeyboardShortcuts, type KeyboardShortcut } from './hooks/useKeyboardShortcuts';
import { KeyboardShortcutsDialog } from './components/shortcuts/KeyboardShortcutsDialog';
import { DemoChartShowcase } from './components/demo/DemoChartShowcase';
import './styles/globals.css';

interface AppProps {
  initialTab?: 'live' | 'active' | 'history' | 'settings';
}

export default function App({ initialTab = 'live' }: AppProps) {
  const { user, loading } = useAuth();
  const isTestAuto = ((import.meta as any)?.env?.VITE_TEST_AUTO_LOGIN === 'true');
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);

  // Zustand stores
  const { loadTrades, activeTrades, historyTrades, updatedTradeIds } = useTradeStore();
  const { watchlist, loadWatchlist, updateQuotes, getWatchlistSymbols } = useMarketStore();
  const {
    activeTab,
    showDiscordDialog,
    showAddTickerDialog,
    showAddChallengeDialog,
    voiceState,
    voiceActive,
    focusedTrade,
    flashTradeTab,
    setActiveTab,
    toggleVoice,
    focusTradeInLive,
    navigateToActive,
    navigateToHistory,
  } = useUIStore();

  // Navigation hook (provides alternative to prop drilling - available for future use)
  const nav = useAppNavigation();
  const { 
    discordChannels, 
    challenges, 
    loadDiscordChannels, 
    loadChallenges 
  } = useSettingsStore();
  
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
  
  // Strategy scanner - monitors watchlist for strategy signals
  const { signalsBySymbol, scanning } = useStrategyScanner({
    symbols: watchlistSymbols,
    enabled: !!user, // Only scan when authenticated
    scanInterval: 60000, // Scan every 1 minute
  });

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      // Navigation shortcuts
      {
        key: '1',
        description: 'Go to Watch tab (Live)',
        action: () => {
          setActiveTab('live');
        },
        category: 'navigation',
      },
      {
        key: '2',
        description: 'Go to Trade tab (Active)',
        action: () => {
          setActiveTab('active');
        },
        category: 'navigation',
      },
      {
        key: '3',
        description: 'Go to Review tab (History)',
        action: () => {
          setActiveTab('history');
        },
        category: 'navigation',
      },
      {
        key: '4',
        description: 'Go to Settings',
        action: () => {
          setActiveTab('settings');
        },
        category: 'navigation',
      },
      {
        key: 'Escape',
        description: 'Close shortcuts dialog',
        action: () => setShowShortcutsDialog(false),
        category: 'general',
      },
      {
        key: 'Ctrl+?',
        description: 'Show keyboard shortcuts',
        action: () => setShowShortcutsDialog(true),
        category: 'help',
      },
      {
        key: 'Cmd+?',
        description: 'Show keyboard shortcuts (Mac)',
        action: () => setShowShortcutsDialog(true),
        category: 'help',
      },
    ],
    [setActiveTab]
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
      console.log('[v0] Loading user data from Supabase...');
      try {
        await Promise.all([
          loadDiscordChannels((user?.id || 'test-user') as string),
          loadChallenges((user?.id || 'test-user') as string),
          loadWatchlist((user?.id || 'test-user') as string),
          loadTrades((user?.id || 'test-user') as string),
        ]);
      } catch (error) {
        console.error('[v0] Failed to load user data:', error);
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
      console.log('[v0] App: Initializing marketDataStore with watchlist:', watchlistSymbols);
      initializeMarketData(watchlistSymbols);
    }

    // Cleanup on unmount
    return () => {
      console.log('[v0] App: Cleaning up marketDataStore');
      marketDataCleanup();
    };
  }, [watchlistSymbols.length]); // Only reinitialize if watchlist size changes

  // Initialize active tab based on route (from initialTab prop)
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // CENTRALIZED - REMOVE: Simulated price updates replaced by real-time marketDataStore quotes
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     const enteredTrades = activeTrades.filter((t) => t.state === 'ENTERED');
  //     if (enteredTrades.length === 0) return;
  //     
  //     enteredTrades.forEach((trade) => {
  //       if (!trade.currentPrice || !trade.entryPrice) return;
  //       
  //       const priceChange = (Math.random() - 0.5) * 0.04;
  //       const newCurrentPrice = trade.currentPrice * (1 + priceChange);
  //       const newMovePercent = ((newCurrentPrice - trade.entryPrice) / trade.entryPrice) * 100;
  //       
  //       // Update trade in store
  //       useTradeStore.getState().updateTrade(trade.id, {
  //         currentPrice: newCurrentPrice,
  //         movePercent: newMovePercent,
  //       });
  //       
  //       // Mark as updated for flash effect
  //       useTradeStore.getState().markTradeAsUpdated(trade.id);
  //     });
  //     
  //     // Clear flash after brief moment
  //     setTimeout(() => useTradeStore.getState().clearUpdatedFlags(), 300);
  //   }, 2000);
  //   
  //   return () => clearInterval(interval);
  // }, [activeTrades]);

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

  const handleExitedTrade = (trade: any) => {
    console.log('Trade exited:', trade);
    setTimeout(() => navigateToHistory(), 100);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col pb-16 lg:pb-0">
      <LiveStatusBar />

      <nav className="hidden lg:flex gap-4 lg:gap-6 px-4 lg:px-6 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-x-auto">
        <TabButton
          label="Watch"
          active={activeTab === 'live'}
          onClick={() => {
            setActiveTab('live');
          }}
        />
        <TabButton
          label="Trade"
          active={activeTab === 'active'}
          onClick={() => {
            navigateToActive();
          }}
        />
        <TabButton
          label="Review"
          active={activeTab === 'history'}
          onClick={() => {
            navigateToHistory();
          }}
        />
      </nav>

      <main className="flex-1 w-full bg-[var(--bg-base)]">
        {(activeTab === 'live' || activeTab === 'active') && (
          <DesktopLiveCockpitSlim
            watchlist={watchlist}
            hotTrades={activeTrades}
            challenges={challenges}
            onTickerClick={() => {}}
            onHotTradeClick={() => {}}
            onAddTicker={() => useUIStore.getState().setShowAddTickerDialog(true)}
            onRemoveTicker={(ticker) => useMarketStore.getState().removeTicker(ticker.id)}
            onAddChallenge={() => useUIStore.getState().setShowAddChallengeDialog(true)}
            onRemoveChallenge={(challenge) => useSettingsStore.getState().removeChallenge(challenge.id)}
            onTradesChange={() => {}} // Not needed anymore, store handles it
            channels={discordChannels}
            focusedTrade={focusedTrade}
            onMobileTabChange={(tab) => setActiveTab(tab)}
            hideDesktopPanels={activeTab === 'active'}
            hideMobilePanelsOnActiveTab={activeTab === 'active'}
            updatedTradeIds={updatedTradeIds}
            onOpenActiveTrade={(tradeId) => {
              const trade = activeTrades.find((t) => t.id === tradeId);
              if (trade) focusTradeInLive(trade);
            }}
            onOpenReviewTrade={navigateToHistory}
            onExitedTrade={handleExitedTrade}
            activeTab={activeTab}
            signalsBySymbol={signalsBySymbol}
          />
        )}

        {activeTab === 'active' && (
          <div className="lg:hidden">
            <MobileActive
              trades={activeTrades}
              updatedTradeIds={updatedTradeIds}
              onTradeClick={(trade) => focusTradeInLive(trade)}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <DesktopHistory 
            trades={historyTrades} 
            channels={discordChannels}
            challenges={challenges}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            onOpenDiscordSettings={() => useUIStore.getState().setShowDiscordDialog(true)}
            onClose={() => setActiveTab('live')}
          />
        )}
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

      <div className="lg:hidden">
        <MobileBottomNav
          activeTab={activeTab as any}
          onTabChange={(tab) => {
            setActiveTab(tab as any);
          }}
          hasActiveTrades={activeTrades.filter((t) => t.state === 'ENTERED').length > 0}
          flashTradeTab={flashTradeTab}
        />
      </div>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsDialog
        isOpen={showShortcutsDialog}
        onClose={() => setShowShortcutsDialog(false)}
        shortcuts={shortcuts}
      />

      {/* Demo Chart Showcase - Shows strategy charts when demo mode is active */}
      <DemoChartShowcase />

      <Toaster />
    </div>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap rounded-[var(--radius)]',
        active 
          ? 'text-[var(--text-high)] bg-[var(--surface-2)]' 
          : 'text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)]',
      ].join(' ')}
    >
      {label}
      {active && (
        <span className="absolute left-0 right-0 -bottom-1 h-0.5 bg-[var(--brand-primary)]" />
      )}
    </button>
  );
}
