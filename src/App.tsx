import { useState, useEffect } from 'react';
import { DiscordChannel, SessionStatus, Ticker, Challenge } from './types';
import { DesktopLiveCockpit } from './components/DesktopLiveCockpit';
import { DesktopHistory } from './components/DesktopHistory';
import { DesktopSettings } from './components/DesktopSettings';
import { MobileActive } from './components/MobileActive';
import { VoiceCommandDemo } from './components/VoiceCommandDemo';
import { HDHeader } from './components/hd/HDHeader';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HDDialogDiscordSettings } from './components/hd/HDDialogDiscordSettings';
import { HDDialogAddTicker } from './components/hd/HDDialogAddTicker';
import { HDDialogAddChallenge } from './components/hd/HDDialogAddChallenge';
import { Toaster } from './components/ui/sonner';
import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { useQuotes } from './hooks/useMassiveData';
import { useDiscord } from './hooks/useDiscord';
import {
  getDiscordChannels,
  addDiscordChannel,
  deleteDiscordChannel,
  getChallenges,
  addChallenge,
  deleteChallenge,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getTrades,
  createTrade,
  updateTrade,
  deleteTrade,
} from './lib/supabase/database';
import './styles/globals.css';

type AppTab = 'live' | 'active' | 'history' | 'settings';

export default function App() {
  const { user, loading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<AppTab>('live');
  const [sessionStatus] = useState<SessionStatus>('open');
  const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>([]);
  const [watchlist, setWatchlist] = useState<Ticker[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [historyTrades, setHistoryTrades] = useState<any[]>([]);
  const [showDiscordDialog, setShowDiscordDialog] = useState(false);
  const [showAddTickerDialog, setShowAddTickerDialog] = useState(false);
  const [showAddChallengeDialog, setShowAddChallengeDialog] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [focusedTrade, setFocusedTrade] = useState<any | null>(null);
  const [flashTradeTab, setFlashTradeTab] = useState(false);
  const [updatedTradeIds, setUpdatedTradeIds] = useState<Set<string>>(new Set());

  const watchlistSymbols = watchlist.map(t => t.symbol);
  const { quotes } = useQuotes(watchlistSymbols);
  
  useEffect(() => {
    if (quotes.size > 0) {
      setWatchlist(prev => prev.map(ticker => {
        const quote = quotes.get(ticker.symbol);
        if (quote) {
          return {
            ...ticker,
            last: quote.last,
            change: quote.change,
            changePercent: quote.changePercent,
          };
        }
        return ticker;
      }));
    }
  }, [quotes]);

  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      console.log('[v0] Loading user data from Supabase...');
      try {
        try {
          const channelsData = await getDiscordChannels(user.id);
          console.log('[v0] Loaded Discord channels:', channelsData.length);
          if (channelsData.length > 0) {
            const mappedChannels = channelsData.map(ch => ({
              id: ch.id,
              name: ch.name,
              webhookUrl: ch.webhook_url,
              createdAt: new Date(ch.created_at),
              isActive: ch.is_active,
              isDefaultLoad: ch.is_default_load,
              isDefaultEnter: ch.is_default_enter,
              isDefaultExit: ch.is_default_exit,
              isDefaultUpdate: ch.is_default_update,
            }));
            setDiscordChannels(mappedChannels as any);
          }
        } catch (error) {
          console.error('[v0] Failed to load Discord channels:', error);
        }

        try {
          const challengesData = await getChallenges(user.id);
          console.log('[v0] Loaded challenges:', challengesData.length);
          if (challengesData.length > 0) {
            const mappedChallenges = challengesData.map(ch => ({
              id: ch.id,
              name: ch.name,
              description: ch.description,
              startingBalance: parseFloat(ch.starting_balance),
              currentBalance: parseFloat(ch.current_balance),
              targetBalance: parseFloat(ch.target_balance),
              startDate: ch.start_date,
              endDate: ch.end_date,
              isActive: ch.is_active,
              createdAt: new Date(ch.created_at),
            }));
            setChallenges(mappedChallenges as any);
          }
        } catch (error) {
          console.error('[v0] Failed to load challenges:', error);
        }

        try {
          const watchlistData = await getWatchlist(user.id);
          console.log('[v0] Loaded watchlist:', watchlistData.length);
          if (watchlistData.length > 0) {
            const tickers: Ticker[] = watchlistData.map(w => ({
              id: w.id,
              symbol: w.ticker,
              last: 0,
              change: 0,
              changePercent: 0,
            }));
            setWatchlist(tickers);
          } else {
            console.log('[v0] Empty watchlist - user can add tickers');
          }
        } catch (error) {
          console.error('[v0] Failed to load watchlist:', error);
        }

        try {
          const tradesData = await getTrades(user.id);
          console.log('[v0] Loaded trades:', tradesData.length);
          if (tradesData.length > 0) {
            const mappedTrades = tradesData.map(t => ({
              id: t.id,
              ticker: t.ticker,
              contract: {
                id: `${t.ticker}-${t.strike}-${t.expiration}`,
                strike: parseFloat(t.strike),
                expiry: t.expiration,
                expiryDate: new Date(t.expiration),
                daysToExpiry: Math.ceil((new Date(t.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                type: t.contract_type === 'call' ? 'C' : 'P',
                mid: 0,
                bid: 0,
                ask: 0,
                volume: 0,
                openInterest: 0,
              },
              quantity: t.quantity,
              entryPrice: t.entry_price ? parseFloat(t.entry_price) : undefined,
              exitPrice: t.exit_price ? parseFloat(t.exit_price) : undefined,
              entryTime: t.entry_time ? new Date(t.entry_time) : undefined,
              exitTime: t.exit_time ? new Date(t.exit_time) : undefined,
              pnl: t.pnl ? parseFloat(t.pnl) : undefined,
              pnlPercent: t.pnl_percent ? parseFloat(t.pnl_percent) : undefined,
              status: t.status,
              state: mapStatusToState(t.status),
              notes: t.notes,
              updates: t.trade_updates || [],
              tradeType: 'Day' as any,
              discordChannels: [],
              challenges: t.challenge_id ? [t.challenge_id] : [],
            }));
            
            const active = mappedTrades.filter(t => t.status !== 'exited');
            const history = mappedTrades.filter(t => t.status === 'exited');
            setActiveTrades(active);
            setHistoryTrades(history);
          }
        } catch (error) {
          console.error('[v0] Failed to load trades:', error);
        }
      } catch (error) {
        console.error('[v0] Failed to load user data:', error);
      }
    };

    loadUserData();
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTrades((prevTrades) => {
        if (prevTrades.length === 0) return prevTrades;
        
        const updated = prevTrades.map((trade) => {
          if (trade.state !== 'ENTERED') return trade;
          
          const priceChange = (Math.random() - 0.5) * 0.04;
          const newCurrentPrice = trade.currentPrice * (1 + priceChange);
          const newMovePercent = ((newCurrentPrice - trade.entryPrice) / trade.entryPrice) * 100;
          
          return {
            ...trade,
            currentPrice: newCurrentPrice,
            movePercent: newMovePercent,
          };
        });
        
        setUpdatedTradeIds(new Set(updated.map(t => t.id)));
        setTimeout(() => setUpdatedTradeIds(new Set()), 300);
        
        return updated;
      });
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const handleTickerClick = () => {
    // In a future version we could track "last viewed ticker" here if needed.
  };

  const handleHotTradeClick = () => {
    // Reserved for future cross-tab behavior (e.g. jump from history to live).
  };
  
  const handleMicClick = () => {
    setVoiceActive(!voiceActive);
    setVoiceState(voiceActive ? 'idle' : 'listening');
  };

  const handleMobileTabChange = (tab: AppTab) => {
    setActiveTab(tab);
    
    if (tab === 'live') {
      setFocusedTrade(null);
    }
    
    if (tab === 'active') {
      setFlashTradeTab(true);
      setTimeout(() => setFlashTradeTab(false), 2000);
    }
  };

  const openActiveTrade = (tradeId: string) => {
    const trade = activeTrades.find(t => t.id === tradeId);
    if (!trade) return;
    
    setActiveTab('active');
    
    setFocusedTrade({ ...trade, _clickTime: Date.now() } as any);
    
    setTimeout(() => setFocusedTrade(null), 100);
  };

  const openReviewTrade = (tradeId: string) => {
    setActiveTab('history');
  };
  
  const handleExitedTrade = (trade: any) => {
    console.log('Trade exited:', trade);
    
    setHistoryTrades(prev => [trade, ...prev]);
    
    setTimeout(() => {
      setActiveTab('history');
    }, 100);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col pb-16 lg:pb-0">
      <HDHeader
        sessionStatus={sessionStatus}
        voiceState={voiceState}
        onSettingsClick={() => setActiveTab('settings')}
        onMicClick={handleMicClick}
      />

      <nav className="hidden lg:flex gap-4 lg:gap-6 px-4 lg:px-6 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-x-auto">
        <TabButton
          label="Watch"
          active={activeTab === 'live'}
          onClick={() => setActiveTab('live')}
        />
        <TabButton
          label="Trade"
          active={activeTab === 'active'}
          onClick={() => setActiveTab('active')}
        />
        <TabButton
          label="Review"
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
        />
      </nav>

      <main className="flex-1 w-full bg-[var(--bg-base)]">
        {(activeTab === 'live' || activeTab === 'active') && (
          <DesktopLiveCockpit
            watchlist={watchlist}
            hotTrades={activeTrades}
            challenges={challenges}
            onTickerClick={handleTickerClick}
            onHotTradeClick={handleHotTradeClick}
            onAddTicker={() => setShowAddTickerDialog(true)}
            onRemoveTicker={(ticker) => {
              setWatchlist(prev => prev.filter(t => t.id !== ticker.id));
              if (user) {
                removeFromWatchlist(ticker.id).catch(console.error);
              }
            }}
            onAddChallenge={() => setShowAddChallengeDialog(true)}
            onRemoveChallenge={(challenge) => {
              setChallenges(prev => prev.filter(c => c.id !== challenge.id));
              if (user) {
                deleteChallenge(challenge.id).catch(console.error);
              }
            }}
            onTradesChange={(trades) => setActiveTrades(trades)}
            channels={discordChannels}
            focusedTrade={focusedTrade}
            onMobileTabChange={handleMobileTabChange}
            hideDesktopPanels={activeTab === 'active'}
            hideMobilePanelsOnActiveTab={activeTab === 'active'}
            updatedTradeIds={updatedTradeIds}
            onOpenActiveTrade={openActiveTrade}
            onOpenReviewTrade={openReviewTrade}
            onExitedTrade={handleExitedTrade}
            activeTab={activeTab}
          />
        )}

        {activeTab === 'active' && (
          <div className="lg:hidden">
            <MobileActive
              trades={activeTrades}
              updatedTradeIds={updatedTradeIds}
              onTradeClick={(trade) => {
                setFocusedTrade({ ...trade, _clickTime: Date.now() } as any);
                setTimeout(() => setFocusedTrade(null), 100);
              }}
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
          <DesktopSettings
            onOpenDiscordSettings={() => {
              setShowDiscordDialog(true);
            }}
            onClose={() => setActiveTab('live')}
          />
        )}

        {activeTab === 'voice-demo' && (
          <VoiceCommandDemo />
        )}
      </main>

      <HDDialogDiscordSettings
        open={showDiscordDialog}
        onOpenChange={setShowDiscordDialog}
        channels={discordChannels}
        onAddChannel={async (name, webhookUrl) => {
          if (!user) return;
          
          try {
            await addDiscordChannel(user.id, name, webhookUrl);
            const channels = await getDiscordChannels(user.id);
            setDiscordChannels(channels);
          } catch (error) {
            console.error('Failed to add Discord channel:', error);
          }
        }}
        onRemoveChannel={async (id) => {
          try {
            await deleteDiscordChannel(id);
            setDiscordChannels(prev => prev.filter(ch => ch.id !== id));
          } catch (error) {
            console.error('Failed to remove Discord channel:', error);
          }
        }}
        onTestWebhook={async (channel) => {
          const discord = useDiscord();
          return await discord.testWebhook(channel);
        }}
      />

      <HDDialogAddTicker
        open={showAddTickerDialog}
        onOpenChange={setShowAddTickerDialog}
        onAddTicker={async (ticker) => {
          setWatchlist(prev => [...prev, ticker]);
          
          if (user) {
            try {
              await addToWatchlist(user.id, ticker.symbol);
            } catch (error) {
              console.error('Failed to add ticker to database:', error);
            }
          }
        }}
      />

      <HDDialogAddChallenge
        open={showAddChallengeDialog}
        onOpenChange={setShowAddChallengeDialog}
        onAddChallenge={async (challenge) => {
          if (!user) return;
          
          try {
            await addChallenge(user.id, challenge);
            const challenges = await getChallenges(user.id);
            setChallenges(challenges);
          } catch (error) {
            console.error('Failed to add challenge:', error);
          }
        }}
      />

      <div className="lg:hidden">
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={handleMobileTabChange}
          hasActiveTrades={activeTrades.filter(t => t.state === 'ENTERED').length > 0}
          flashTradeTab={flashTradeTab}
        />
      </div>

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

function cn(...args: any[]) {
  return args.filter(Boolean).join(' ');
}

function mapStatusToState(status: string): 'WATCHING' | 'LOADED' | 'ENTERED' | 'EXITED' {
  switch (status?.toLowerCase()) {
    case 'watching': return 'WATCHING';
    case 'loaded': return 'LOADED';
    case 'entered': return 'ENTERED';
    case 'exited': return 'EXITED';
    default: return 'WATCHING';
  }
}
