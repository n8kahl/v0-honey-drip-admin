/**
 * HDWatchlistRail - Discovery Rail for Watchlist & Scanners
 *
 * This rail is PURELY for discovery - showing potential opportunities.
 * Active trades and loaded trades are now displayed in HDPortfolioRail.
 *
 * Features:
 * - Macro Context Panel (market regime, VIX, etc.)
 * - Watchlist sorted by Smart Score (highest first)
 * - Active Challenges with progress tracking
 * - NO internal scrollbar - capped list with "View All" modal
 *
 * Anti-Pattern: NO trade management here - discovery only.
 * Trade management happens in HDPortfolioRail.
 */

import { useMarketStore, useTradeStore, useSettingsStore, useUIStore } from "../../../stores";
import { useMarketDataStore } from "../../../stores/marketDataStore";
import { HDRowWatchlist } from "../cards/HDRowWatchlist";
import { HDMacroPanel } from "../dashboard/HDMacroPanel";
import { HDDialogEditChallenge } from "../forms/HDDialogEditChallenge";
import { HDChallengeDetailSheet } from "../forms/HDChallengeDetailSheet";
import { HDChallengeShare } from "../forms/HDChallengeShare";
import { Ticker, Challenge } from "../../../types";
import { Plus, Trash2, Edit, ChevronRight, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { getFullChallengeStats } from "../../../lib/challengeHelpers";
import { useState, useMemo, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";

// Maximum visible items in the capped list (fits 1440x900 without scrollbar)
const MAX_VISIBLE_WATCHLIST = 6;
const MAX_VISIBLE_CHALLENGES = 3;

interface HDWatchlistRailProps {
  /** Callback when a watchlist ticker is clicked */
  onTickerClick?: (ticker: Ticker) => void;
  /** Callback to open Add Ticker dialog */
  onAddTicker?: () => void;
  /** Callback to remove a ticker from watchlist */
  onRemoveTicker?: (ticker: Ticker) => void;
  /** Currently active/selected ticker symbol */
  activeTicker?: string;
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
  activeTicker,
}: HDWatchlistRailProps) {
  const watchlist = useMarketStore((state) => state.watchlist);

  // Get symbol data for Smart Score sorting
  const symbolsData = useMarketDataStore((state) => state.symbols);

  // Sort watchlist by Smart Score (confluence score) - highest first
  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      const scoreA = symbolsData[a.symbol]?.confluence?.overall || 0;
      const scoreB = symbolsData[b.symbol]?.confluence?.overall || 0;
      return scoreB - scoreA; // Descending order (highest first)
    });
  }, [watchlist, symbolsData]);

  // Get trades for challenge stats (need both active and history for complete picture)
  const activeTrades = useTradeStore((state) => state.activeTrades);
  const historyTrades = useTradeStore((state) => state.historyTrades);

  // Combine active and history trades for challenge stats (exited trades move to history)
  const allTrades = useMemo(() => {
    return [...activeTrades, ...historyTrades];
  }, [activeTrades, historyTrades]);

  const challenges = useSettingsStore((state) => state.challenges);
  const discordChannels = useSettingsStore((state) => state.discordChannels);
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
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

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

  // Capped lists for display (no scrollbar)
  const visibleWatchlist = sortedWatchlist.slice(0, MAX_VISIBLE_WATCHLIST);
  const hasMoreWatchlist = sortedWatchlist.length > MAX_VISIBLE_WATCHLIST;
  const visibleChallenges = activeChallenges.slice(0, MAX_VISIBLE_CHALLENGES);
  const hasMoreChallenges = activeChallenges.length > MAX_VISIBLE_CHALLENGES;

  return (
    <div
      className="w-full border-r border-[var(--border-hairline)] flex flex-col h-full bg-[var(--surface-1)]"
      data-testid="watchlist-rail"
    >
      {/* No overflow-y-auto - capped list with View All modal */}
      <div className="flex-1 flex flex-col">
        {/* Macro Context Panel */}
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <HDMacroPanel />
        </div>

        {/* Watchlist Section - Capped list */}
        <div className="flex flex-col">
          <SectionHeader title="Watchlist" onAdd={onAddTicker} />
          <div className="divide-y divide-[var(--border-hairline)]" data-testid="watchlist-list">
            {sortedWatchlist.length === 0 ? (
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
              <>
                {visibleWatchlist.map((ticker, index) => (
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
                ))}
                {/* View All button when list is truncated */}
                {hasMoreWatchlist && (
                  <button
                    onClick={() => setShowWatchlistModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
                    data-testid="watchlist-view-all-btn"
                  >
                    View All ({sortedWatchlist.length})
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Challenges Section - Capped list */}
        <div className="mt-4">
          <SectionHeader title="Challenges" onAdd={() => setShowAddChallengeDialog(true)} />
          {activeChallenges.length > 0 ? (
            <div className="p-3 space-y-2">
              {visibleChallenges.map((challenge) => {
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
              {/* View All button for challenges when list is truncated */}
              {hasMoreChallenges && (
                <button
                  onClick={() => setShowAddChallengeDialog(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--surface-2)] rounded transition-colors"
                >
                  View All ({activeChallenges.length})
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
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

      {/* Watchlist View All Modal */}
      <Dialog.Root open={showWatchlistModal} onOpenChange={setShowWatchlistModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-h-[80vh] bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-xl shadow-2xl z-50 flex flex-col"
            data-testid="watchlist-modal"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)]">
              <Dialog.Title className="text-sm font-semibold text-[var(--text-high)]">
                Watchlist ({sortedWatchlist.length})
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors"
                  data-testid="watchlist-modal-close"
                >
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </Dialog.Close>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)]">
              {sortedWatchlist.map((ticker, index) => (
                <HDRowWatchlist
                  key={ticker.id}
                  ticker={ticker}
                  active={activeTicker === ticker.symbol}
                  onClick={() => {
                    onTickerClick?.(ticker);
                    setShowWatchlistModal(false);
                  }}
                  onRemove={onRemoveTicker ? () => onRemoveTicker(ticker) : undefined}
                  animationDelay={0}
                  viewMode={watchlistViewMode}
                  isExpanded={false}
                  onExpandChange={() => {}}
                />
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-[var(--border-hairline)] flex justify-end">
              <button
                onClick={onAddTicker}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-[var(--bg-base)] text-xs font-medium hover:bg-[var(--brand-primary)]/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Ticker
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
