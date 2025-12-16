import { useMarketStore, useTradeStore, useSettingsStore, useUIStore } from "../../../stores";
import { HDRowWatchlist } from "../cards/HDRowWatchlist";
import { HDRowLoadedTrade } from "../cards/HDRowLoadedTrade";
import { HDActiveTradeRow } from "../cards/HDActiveTradeRow";
import { HDMacroPanel } from "../dashboard/HDMacroPanel";
import { HDDialogEditChallenge } from "../forms/HDDialogEditChallenge";
import { HDChallengeDetailSheet } from "../forms/HDChallengeDetailSheet";
import { HDChallengeShare } from "../forms/HDChallengeShare";
import { Ticker, Trade, Challenge } from "../../../types";
import { Plus, Trash2, Edit } from "lucide-react";
import { cn } from "../../../lib/utils";
import { ensureArray } from "../../../lib/utils/validation";
import { getFullChallengeStats } from "../../../lib/challengeHelpers";
import { useState, useMemo, useCallback } from "react";

interface HDWatchlistRailProps {
  onTickerClick?: (ticker: Ticker) => void;
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onLoadedTradeClick?: (trade: Trade) => void;
  onActiveTradeClick?: (trade: Trade) => void;
  onRemoveLoadedTrade?: (trade: Trade) => void;
  activeTicker?: string;
  activeTrades?: Trade[]; // Add this prop
}

/**
 * SectionHeader - Yellow/black gradient header for rail sections
 */
function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="px-3 py-2 bg-gradient-to-r from-yellow-500/10 to-transparent border-l-2 border-yellow-500 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-yellow-500">{title}</h3>
      {onAdd && (
        <button
          onClick={onAdd}
          className="p-1 rounded hover:bg-yellow-500/20 transition-colors"
          title={`Add ${title.toLowerCase()}`}
        >
          <Plus className="w-3.5 h-3.5 text-yellow-500" />
        </button>
      )}
    </div>
  );
}

export function HDWatchlistRail({
  onTickerClick,
  onAddTicker,
  onRemoveTicker,
  onLoadedTradeClick,
  onActiveTradeClick,
  onRemoveLoadedTrade,
  activeTicker,
  activeTrades: propActiveTrades,
}: HDWatchlistRailProps) {
  const watchlist = useMarketStore((state) => state.watchlist);
  // Use prop if provided, otherwise fall back to store (for backward compatibility)
  const storeActiveTrades = useTradeStore((state) => state.activeTrades);
  const historyTrades = useTradeStore((state) => state.historyTrades);
  const rawActiveTrades = propActiveTrades ?? storeActiveTrades;

  // REACTIVE subscription for focused trade - triggers re-render when trade focus changes
  // This replaces non-reactive getState() calls that were causing highlight lag
  const currentTradeId = useTradeStore((state) => state.currentTradeId);

  // Combine active and history trades for challenge stats (exited trades move to history)
  const allTrades = useMemo(() => {
    return [...rawActiveTrades, ...historyTrades];
  }, [rawActiveTrades, historyTrades]);
  const challenges = useSettingsStore((state) => state.challenges);
  const discordChannels = useSettingsStore((state) => state.discordChannels);

  // Deduplicate trades by ID - if same ID appears multiple times with different states,
  // keep the one with the most advanced state (WATCHING < LOADED < ENTERED < EXITED)
  const activeTrades = useMemo(() => {
    const stateOrder: Record<string, number> = {
      WATCHING: 0,
      LOADED: 1,
      ENTERED: 2,
      EXITED: 3,
    };
    const map = new Map<string, Trade>();
    for (const trade of rawActiveTrades) {
      const existing = map.get(trade.id);
      if (!existing) {
        map.set(trade.id, trade);
      } else {
        // Keep the one with more advanced state
        const existingOrder = stateOrder[existing.state] ?? 0;
        const currentOrder = stateOrder[trade.state] ?? 0;
        if (currentOrder > existingOrder) {
          map.set(trade.id, trade);
        }
      }
    }
    return Array.from(map.values());
  }, [rawActiveTrades]);
  const removeChallenge = useSettingsStore((state) => state.removeChallenge);
  const updateChallengeSettings = useSettingsStore((state) => state.updateChallengeSettings);
  const setShowAddChallengeDialog = useUIStore((state) => state.setShowAddChallengeDialog);
  const [deletingChallengeId, setDeletingChallengeId] = useState<string | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [sharingChallenge, setSharingChallenge] = useState<Challenge | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Watchlist expand state - use uiStore for consistency
  const watchlistViewMode = useUIStore((state) => state.watchlistViewMode);
  const expandedWatchlistRow = useUIStore((state) => state.expandedWatchlistRow);
  const setExpandedWatchlistRow = useUIStore((state) => state.setExpandedWatchlistRow);

  // Handle expand change for a watchlist row
  const handleExpandChange = useCallback(
    (symbol: string, expanded: boolean) => {
      setExpandedWatchlistRow(expanded ? symbol : null);
    },
    [setExpandedWatchlistRow]
  );

  // Filter trades by state with explicit dedup to prevent race condition duplicates
  // The dedup at lines 70-94 handles different states, but this guards against
  // same-state duplicates that could slip through during rapid transitions
  const loadedTrades = [
    ...new Map(activeTrades.filter((t) => t.state === "LOADED").map((t) => [t.id, t])).values(),
  ];
  const enteredTrades = [
    ...new Map(activeTrades.filter((t) => t.state === "ENTERED").map((t) => [t.id, t])).values(),
  ];

  // Calculate challenge progress
  const activeChallenges = challenges.filter((c) => c.isActive);

  const handleDeleteChallenge = async (challengeId: string) => {
    if (deletingChallengeId === challengeId) {
      // Confirm delete
      try {
        await removeChallenge(challengeId);
        setDeletingChallengeId(null);
      } catch (error) {
        console.error("[HDWatchlistRail] Failed to delete challenge:", error);
      }
    } else {
      // First click - show confirmation
      setDeletingChallengeId(challengeId);
      // Auto-cancel after 3 seconds
      setTimeout(() => setDeletingChallengeId(null), 3000);
    }
  };

  const handleEditChallenge = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setShowEditDialog(true);
  };

  const handleUpdateChallenge = async (challengeId: string, updates: Partial<Challenge>) => {
    try {
      await updateChallengeSettings(challengeId, updates);
    } catch (error) {
      console.error("[HDWatchlistRail] Failed to update challenge:", error);
    }
  };

  const handleChallengeClick = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setShowDetailSheet(true);
  };

  const handleShareChallenge = (challenge: Challenge) => {
    setSharingChallenge(challenge);
    setShowShareDialog(true);
  };

  // Calculate stats for sharing challenge
  const shareStats = useMemo(() => {
    if (!sharingChallenge) {
      return {
        totalPnL: 0,
        winRate: 0,
        completedTrades: 0,
        activeTrades: 0,
      };
    }

    // Use allTrades to include exited trades from history
    const stats = getFullChallengeStats(sharingChallenge.id, allTrades);

    return {
      totalPnL: stats.dollarPnL,
      winRate: stats.winRate,
      completedTrades: stats.completedTrades,
      activeTrades: stats.activeTrades,
    };
  }, [sharingChallenge, allTrades]);

  return (
    <div className="w-full lg:w-80 lg:flex-shrink-0 border-r border-[var(--border-hairline)] flex flex-col h-full bg-[var(--surface-1)]">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Macro Context Panel */}
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <HDMacroPanel />
        </div>

        {/* Active Trades Section - FIRST (highest priority) */}
        {enteredTrades.length > 0 && (
          <div>
            <SectionHeader title="Active" />
            <div className="divide-y divide-[var(--border-hairline)]">
              {enteredTrades.map((trade) => (
                <HDActiveTradeRow
                  key={trade.id}
                  trade={trade}
                  active={currentTradeId === trade.id}
                  onClick={() => {
                    if (onActiveTradeClick) {
                      onActiveTradeClick(trade);
                    } else {
                      // Use the atomic setFocusedTrade action (sets both previewTrade and currentTradeId)
                      useTradeStore.getState().setFocusedTrade(trade);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loaded Trades Section - SECOND */}
        {loadedTrades.length > 0 && (
          <div className={enteredTrades.length > 0 ? "mt-4" : ""}>
            <SectionHeader title="Loaded" />
            <div className="divide-y divide-[var(--border-hairline)]">
              {loadedTrades.map((trade) => (
                <HDRowLoadedTrade
                  key={trade.id}
                  trade={trade}
                  active={currentTradeId === trade.id}
                  onClick={() => onLoadedTradeClick?.(trade)}
                  onRemove={() => onRemoveLoadedTrade?.(trade)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Watchlist Section - THIRD */}
        <div className={enteredTrades.length > 0 || loadedTrades.length > 0 ? "mt-4" : ""}>
          <SectionHeader title="Watchlist" onAdd={onAddTicker} />
          <div className="divide-y divide-[var(--border-hairline)]">
            {watchlist.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[var(--text-muted)] mb-3">No tickers in watchlist</p>
                <button
                  onClick={onAddTicker}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-[var(--bg-base)] text-sm font-medium hover:bg-[var(--brand-primary)]/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Ticker
                </button>
              </div>
            ) : (
              watchlist.map((ticker, index) => (
                <HDRowWatchlist
                  key={ticker.id}
                  ticker={ticker}
                  active={activeTicker === ticker.symbol}
                  onClick={() => onTickerClick?.(ticker)}
                  onRemove={onRemoveTicker ? () => onRemoveTicker(ticker) : undefined}
                  animationDelay={index * 40}
                  viewMode={watchlistViewMode}
                  isExpanded={expandedWatchlistRow === ticker.symbol}
                  onExpandChange={(expanded) => handleExpandChange(ticker.symbol, expanded)}
                />
              ))
            )}
          </div>
        </div>

        {/* Challenges Section */}
        <div className="mt-4">
          <SectionHeader title="Challenges" onAdd={() => setShowAddChallengeDialog(true)} />
          {activeChallenges.length > 0 ? (
            <div className="p-3 space-y-2">
              {activeChallenges.map((challenge) => {
                // Use centralized stats helper for consistency with detail sheet
                // Pass allTrades (active + history) so exited trades are included
                const stats = getFullChallengeStats(challenge.id, allTrades);

                // Calculate dollar progress toward target goal
                const targetGain = challenge.targetBalance - challenge.startingBalance;
                const progress = targetGain > 0 ? (stats.dollarPnL / targetGain) * 100 : 0;
                const isDeleting = deletingChallengeId === challenge.id;

                return (
                  <div
                    key={challenge.id}
                    onClick={() => handleChallengeClick(challenge)}
                    className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] group cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[var(--text-high)] truncate">
                        {challenge.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs whitespace-nowrap font-mono",
                            stats.dollarPnL >= 0
                              ? "text-[var(--accent-positive)]"
                              : "text-[var(--accent-negative)]"
                          )}
                        >
                          {stats.dollarPnL >= 0 ? "+" : ""}${stats.dollarPnL.toFixed(0)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditChallenge(challenge);
                          }}
                          className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-3)]"
                          title="Edit challenge"
                        >
                          <Edit className="w-3 h-3 text-[var(--text-muted)]" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChallenge(challenge.id);
                          }}
                          className={cn(
                            "p-1 rounded transition-colors",
                            isDeleting
                              ? "bg-[var(--accent-negative)] text-white"
                              : "opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-3)]"
                          )}
                          title={isDeleting ? "Click again to confirm delete" : "Delete challenge"}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300 rounded-full",
                          progress >= 100
                            ? "bg-[var(--accent-positive)]"
                            : "bg-[var(--brand-primary)]"
                        )}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-xs text-[var(--text-muted)] mb-2">No active challenges</p>
              <button
                onClick={() => setShowAddChallengeDialog(true)}
                className="text-xs text-[var(--brand-primary)] hover:underline"
              >
                Create your first challenge
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Challenge Dialog */}
      <HDDialogEditChallenge
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        challenge={editingChallenge}
        onUpdateChallenge={handleUpdateChallenge}
      />

      {/* Challenge Detail Sheet */}
      <HDChallengeDetailSheet
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        challenge={selectedChallenge}
        trades={allTrades}
        onEdit={handleEditChallenge}
        onDelete={handleDeleteChallenge}
        onShare={handleShareChallenge}
      />

      {/* Challenge Share Dialog */}
      <HDChallengeShare
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        challenge={sharingChallenge}
        stats={shareStats}
        availableChannels={discordChannels}
      />
    </div>
  );
}
