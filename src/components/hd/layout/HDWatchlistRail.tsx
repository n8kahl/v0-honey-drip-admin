import { useMarketStore, useTradeStore, useSettingsStore, useUIStore } from "../../../stores";
import { HDRowWatchlist } from "../cards/HDRowWatchlist";
import { HDRowLoadedTrade } from "../cards/HDRowLoadedTrade";
import { HDMacroPanel } from "../dashboard/HDMacroPanel";
import { HDEnteredTradeCard } from "../cards/HDEnteredTradeCard";
import { HDDialogEditChallenge } from "../forms/HDDialogEditChallenge";
import { HDChallengeDetailSheet } from "../forms/HDChallengeDetailSheet";
import { HDChallengeShare } from "../forms/HDChallengeShare";
import { Ticker, Trade, Challenge } from "../../../types";
import { Plus, Trash2, Edit } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useState, useMemo } from "react";

interface HDWatchlistRailProps {
  onTickerClick?: (ticker: Ticker) => void;
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onLoadedTradeClick?: (trade: Trade) => void;
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
  onRemoveLoadedTrade,
  activeTicker,
  activeTrades: propActiveTrades,
}: HDWatchlistRailProps) {
  const watchlist = useMarketStore((state) => state.watchlist);
  // Use prop if provided, otherwise fall back to store (for backward compatibility)
  const storeActiveTrades = useTradeStore((state) => state.activeTrades);
  const activeTrades = propActiveTrades ?? storeActiveTrades;
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

  // Filter trades by state
  const loadedTrades = activeTrades.filter((t) => t.state === "LOADED");
  const enteredTrades = activeTrades.filter((t) => t.state === "ENTERED");

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

    const challengeTrades = activeTrades.filter((t) => t.challenges.includes(sharingChallenge.id));
    const completedTrades = challengeTrades.filter((t) => t.state === "EXITED");
    const activeCount = challengeTrades.filter(
      (t) => t.state === "ENTERED" || t.state === "LOADED"
    ).length;

    const totalPnL = completedTrades.reduce((sum, t) => {
      const pnl =
        t.exitPrice && t.entryPrice
          ? (t.exitPrice - t.entryPrice) * t.quantity * (t.contract.type === "CALL" ? 1 : -1)
          : 0;
      return sum + pnl;
    }, 0);

    const winners = completedTrades.filter((t) => {
      const pnl =
        t.exitPrice && t.entryPrice
          ? (t.exitPrice - t.entryPrice) * t.quantity * (t.contract.type === "CALL" ? 1 : -1)
          : 0;
      return pnl > 0;
    });
    const winRate =
      completedTrades.length > 0 ? (winners.length / completedTrades.length) * 100 : 0;

    return {
      totalPnL,
      winRate,
      completedTrades: completedTrades.length,
      activeTrades: activeCount,
    };
  }, [sharingChallenge, activeTrades]);

  return (
    <div className="w-full lg:w-80 border-r border-[var(--border-hairline)] flex flex-col h-full bg-[var(--surface-1)]">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Macro Context Panel */}
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <HDMacroPanel />
        </div>

        {/* Watchlist Section */}
        <div>
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
              watchlist.map((ticker) => (
                <HDRowWatchlist
                  key={ticker.id}
                  ticker={ticker}
                  active={activeTicker === ticker.symbol}
                  onClick={() => onTickerClick?.(ticker)}
                  onRemove={() => onRemoveTicker?.(ticker)}
                />
              ))
            )}
          </div>
        </div>

        {/* Loaded Trades Section */}
        {loadedTrades.length > 0 && (
          <div className="mt-4">
            <SectionHeader title="Loaded" />
            <div className="divide-y divide-[var(--border-hairline)]">
              {loadedTrades.map((trade) => {
                const currentTrade = useTradeStore.getState().currentTrade;
                return (
                  <HDRowLoadedTrade
                    key={trade.id}
                    trade={trade}
                    active={currentTrade?.id === trade.id}
                    onClick={() => onLoadedTradeClick?.(trade)}
                    onRemove={() => onRemoveLoadedTrade?.(trade)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Active Trades Section */}
        {enteredTrades.length > 0 && (
          <div className="mt-4">
            <SectionHeader title="Active" />
            <div className="p-3 space-y-3">
              {enteredTrades.map((trade) => (
                <HDEnteredTradeCard
                  key={trade.id}
                  trade={trade}
                  onTrim={() => {}}
                  onMoveSL={() => {}}
                  onExit={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Challenges Section */}
        <div className="mt-4">
          <SectionHeader title="Challenges" onAdd={() => setShowAddChallengeDialog(true)} />
          {activeChallenges.length > 0 ? (
            <div className="p-3 space-y-2">
              {activeChallenges.map((challenge) => {
                const completedTrades = activeTrades.filter(
                  (t) => t.challenges.includes(challenge.id) && t.state === "EXITED"
                ).length;
                const totalTrades = 10; // Default target, can be enhanced later
                const progress = totalTrades > 0 ? (completedTrades / totalTrades) * 100 : 0;
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
                        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                          {completedTrades}/{totalTrades}
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
        trades={activeTrades}
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
