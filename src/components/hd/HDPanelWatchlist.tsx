import { Ticker, Trade, Challenge } from '../../types';
import { HDRowWatchlist } from './HDRowWatchlist';
import { HDRowTrade } from './HDRowTrade';
import { HDRowChallenge } from './HDRowChallenge';
import { HDConfirmDialog } from './HDConfirmDialog';
import { formatPercent, cn } from '../../lib/utils';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuotes } from '../../hooks/useMassiveData';

interface HDPanelWatchlistProps {
  watchlist: Ticker[];
  hotTrades?: Trade[];
  challenges: Challenge[];
  allTrades: Trade[];
  activeTicker?: string;
  activeChallenge?: string;
  expandLoadedList?: boolean; // External control to expand loaded list
  onTickerClick?: (ticker: Ticker) => void;
  onHotTradeClick?: (trade: Trade) => void;
  onChallengeClick?: (challenge: Challenge) => void;
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onRemoveLoadedTrade?: (trade: Trade) => void; // Remove loaded trade callback
  onAddChallenge?: () => void;
  onRemoveChallenge?: (challenge: Challenge) => void;
  onOpenActiveTrade?: (tradeId: string) => void; // Navigate to active trade
  onOpenReviewTrade?: (tradeId: string) => void; // Navigate to review trade
  className?: string;
}

export function HDPanelWatchlist({
  watchlist,
  hotTrades,
  challenges,
  allTrades,
  activeTicker,
  activeChallenge,
  expandLoadedList,
  onTickerClick,
  onHotTradeClick,
  onChallengeClick,
  onAddTicker,
  onRemoveTicker,
  onRemoveLoadedTrade,
  onAddChallenge,
  onRemoveChallenge,
  onOpenActiveTrade,
  onOpenReviewTrade,
  className
}: HDPanelWatchlistProps) {
  const symbols = watchlist.map(t => t.symbol);
  const { quotes } = useQuotes(symbols);
  
  // Calculate P&L for a challenge
  const calculateChallengePnL = (challengeId: string): number => {
    const challengeTrades = allTrades.filter(
      (trade) => trade.challenges.includes(challengeId) && 
      (trade.state === 'ENTERED' || trade.state === 'EXITED')
    );
    
    if (challengeTrades.length === 0) return 0;
    
    const totalPnL = challengeTrades.reduce((sum, trade) => {
      return sum + (trade.movePercent || 0);
    }, 0);
    
    return totalPnL / challengeTrades.length;
  };

  const [loadedExpanded, setLoadedExpanded] = useState(expandLoadedList || true);
  const [activeExpanded, setActiveExpanded] = useState(true);
  const [watchlistExpanded, setWatchlistExpanded] = useState(true);
  const [challengesExpanded, setChallengesExpanded] = useState(true);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'ticker' | 'challenge' | 'loadedTrade';
    item: Ticker | Challenge | Trade | null;
  }>({
    isOpen: false,
    type: 'ticker',
    item: null,
  });

  const loadedTrades = hotTrades?.filter(t => t.state === 'LOADED') || [];
  const activeTrades = hotTrades?.filter(t => t.state === 'ENTERED') || []; // Only ENTERED, not EXITED

  useEffect(() => {
    if (expandLoadedList !== undefined) {
      setLoadedExpanded(expandLoadedList);
    }
  }, [expandLoadedList]);

  const handleConfirmDelete = () => {
    if (!confirmDialog.item) return;

    if (confirmDialog.type === 'ticker') {
      onRemoveTicker?.(confirmDialog.item as Ticker);
    } else if (confirmDialog.type === 'challenge') {
      onRemoveChallenge?.(confirmDialog.item as Challenge);
    } else if (confirmDialog.type === 'loadedTrade') {
      onRemoveLoadedTrade?.(confirmDialog.item as Trade);
    }

    setConfirmDialog({ isOpen: false, type: 'ticker', item: null });
  };

  const getConfirmDialogContent = () => {
    if (!confirmDialog.item) return { title: '', message: '' };

    if (confirmDialog.type === 'ticker') {
      const ticker = confirmDialog.item as Ticker;
      return {
        title: 'Remove from Watchlist?',
        message: `Are you sure you want to remove ${ticker.symbol} from your watchlist? This action cannot be undone.`,
      };
    } else if (confirmDialog.type === 'challenge') {
      const challenge = confirmDialog.item as Challenge;
      return {
        title: 'Delete Challenge?',
        message: `Are you sure you want to delete "${challenge.name}"? Trades associated with this challenge will not be affected.`,
      };
    } else if (confirmDialog.type === 'loadedTrade') {
      const trade = confirmDialog.item as Trade;
      return {
        title: 'Remove Loaded Trade?',
        message: `Are you sure you want to remove ${trade.ticker} from loaded trades? No alert will be sent.`,
      };
    }

    return { title: '', message: '' };
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)] overflow-y-auto">
      {/* Hot Trades / Active Loaded Trades Section */}
      <div className="border-b border-[var(--border-hairline)] flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--brand-primary)]">
          <button
            onClick={() => setLoadedExpanded(!loadedExpanded)}
            className="flex items-center gap-2 hover:text-black/80 transition-colors flex-1"
          >
            <h2 className="text-black uppercase tracking-wide text-xs font-semibold">
              Loaded Trades ({loadedTrades.length})
            </h2>
            {loadedExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-black/70" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-black/70" />
            )}
          </button>
          <div className="w-7 h-7 flex-shrink-0" />
        </div>
        {loadedExpanded && loadedTrades.length > 0 && (
          <div className="flex-shrink-0">
            {loadedTrades.map((trade) => (
              <HDRowTrade
                key={trade.id}
                trade={trade}
                active={false}
                onClick={() => onHotTradeClick?.(trade)}
                onRemove={() => setConfirmDialog({ isOpen: true, type: 'loadedTrade', item: trade })}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Watchlist Section */}
      <div className="border-b border-[var(--border-hairline)] flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--brand-primary)]">
          <button
            onClick={() => setWatchlistExpanded(!watchlistExpanded)}
            className="flex items-center gap-2 hover:text-black/80 transition-colors flex-1"
          >
            <h2 className="text-black uppercase tracking-wide text-xs font-semibold">
              WATCHLIST ({watchlist.length})
            </h2>
            {watchlistExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-black/70" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-black/70" />
            )}
          </button>
          <button
            onClick={onAddTicker}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-black/70 hover:text-black hover:bg-black/10 transition-colors flex-shrink-0"
            aria-label="Add ticker"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {watchlistExpanded && (
          <div className="flex-shrink-0">
            {watchlist.map((ticker) => {
              const quoteData = quotes.get(ticker.symbol);
              return (
                <HDRowWatchlist
                  key={ticker.id}
                  ticker={{
                    ...ticker,
                    // Update with real-time data if available
                    last: quoteData?.last ?? ticker.last,
                    change: quoteData?.change ?? ticker.change,
                    changePercent: quoteData?.changePercent ?? ticker.changePercent,
                  }}
                  active={ticker.symbol === activeTicker}
                  onClick={() => {
                    console.log('[v0] Ticker clicked in watchlist:', ticker.symbol);
                    onTickerClick?.(ticker);
                  }}
                  onRemove={() => setConfirmDialog({ isOpen: true, type: 'ticker', item: ticker })}
                  asOf={quoteData?.asOf}
                  source={quoteData?.source}
                />
              );
            })}
          </div>
        )}
      </div>
      
      {/* Challenges Section */}
      <div className="border-b border-[var(--border-hairline)] flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--brand-primary)]">
          <button
            onClick={() => setChallengesExpanded(!challengesExpanded)}
            className="flex items-center gap-2 hover:text-black/80 transition-colors flex-1"
          >
            <h2 className="text-black uppercase tracking-wide text-xs font-semibold">
              Challenges ({challenges.length})
            </h2>
            {challengesExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-black/70" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-black/70" />
            )}
          </button>
          {onAddChallenge && (
            <button
              onClick={onAddChallenge}
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-black/70 hover:text-black hover:bg-black/10 transition-colors flex-shrink-0"
              aria-label="Add challenge"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        {challengesExpanded && (
          <div className="flex-shrink-0">
            {challenges.length === 0 ? (
              <div className="px-4 py-6 text-center text-[var(--text-muted)] text-xs">
                No challenges yet. Click + to add one.
              </div>
            ) : (
              challenges.map((challenge) => (
                <HDRowChallenge
                  key={challenge.id}
                  challenge={challenge}
                  active={challenge.id === activeChallenge}
                  onClick={() => onChallengeClick?.(challenge)}
                  onRemove={() => setConfirmDialog({ isOpen: true, type: 'challenge', item: challenge })}
                  pnl={calculateChallengePnL(challenge.id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <HDConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, type: 'ticker', item: null })}
        onConfirm={handleConfirmDelete}
        title={getConfirmDialogContent().title}
        message={getConfirmDialogContent().message}
        confirmText="Remove"
        confirmVariant="danger"
      />
    </div>
  );
}
