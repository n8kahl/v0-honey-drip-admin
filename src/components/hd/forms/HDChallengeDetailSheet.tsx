import { useMemo } from "react";
import { Challenge, Trade } from "../../../types";
import { AppSheet } from "../../ui/AppSheet";
import { HDButton } from "../common/HDButton";
import { Share2, Edit, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../../../lib/utils";

interface HDChallengeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge | null;
  trades: Trade[];
  onEdit: (challenge: Challenge) => void;
  onDelete: (challengeId: string) => void;
  onShare: (challenge: Challenge) => void;
}

export function HDChallengeDetailSheet({
  open,
  onOpenChange,
  challenge,
  trades,
  onEdit,
  onDelete,
  onShare,
}: HDChallengeDetailSheetProps) {
  // Calculate challenge statistics
  const stats = useMemo(() => {
    if (!challenge) {
      return {
        totalPnL: 0,
        winRate: 0,
        avgR: 0,
        bestTrade: 0,
        worstTrade: 0,
        totalTrades: 0,
        activeTrades: 0,
        completedTrades: 0,
      };
    }

    // Filter trades associated with this challenge
    const challengeTrades = trades.filter((t) => t.challenges.includes(challenge.id));
    const completedTrades = challengeTrades.filter((t) => t.state === "EXITED");
    const activeTrades = challengeTrades.filter(
      (t) => t.state === "ENTERED" || t.state === "LOADED"
    );

    // Calculate P&L
    const totalPnL = completedTrades.reduce((sum, t) => {
      const pnl =
        t.exitPrice && t.entryPrice
          ? (t.exitPrice - t.entryPrice) * t.quantity * (t.contract.type === "CALL" ? 1 : -1)
          : 0;
      return sum + pnl;
    }, 0);

    // Calculate win rate
    const winners = completedTrades.filter((t) => {
      const pnl =
        t.exitPrice && t.entryPrice
          ? (t.exitPrice - t.entryPrice) * t.quantity * (t.contract.type === "CALL" ? 1 : -1)
          : 0;
      return pnl > 0;
    });
    const winRate =
      completedTrades.length > 0 ? (winners.length / completedTrades.length) * 100 : 0;

    // Calculate R multiples (if risk data available)
    const avgR =
      completedTrades.length > 0
        ? completedTrades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / completedTrades.length
        : 0;

    // Find best/worst trades
    const tradePnLs = completedTrades.map((t) => {
      const pnl =
        t.exitPrice && t.entryPrice
          ? (t.exitPrice - t.entryPrice) * t.quantity * (t.contract.type === "CALL" ? 1 : -1)
          : 0;
      return pnl;
    });
    const bestTrade = tradePnLs.length > 0 ? Math.max(...tradePnLs) : 0;
    const worstTrade = tradePnLs.length > 0 ? Math.min(...tradePnLs) : 0;

    return {
      totalPnL,
      winRate,
      avgR,
      bestTrade,
      worstTrade,
      totalTrades: challengeTrades.length,
      activeTrades: activeTrades.length,
      completedTrades: completedTrades.length,
    };
  }, [challenge, trades]);

  // Filter trades for this challenge
  const challengeTrades = useMemo(() => {
    if (!challenge) return { active: [], completed: [] };

    const filtered = trades.filter((t) => t.challenges.includes(challenge.id));
    return {
      active: filtered.filter((t) => t.state === "ENTERED" || t.state === "LOADED"),
      completed: filtered.filter((t) => t.state === "EXITED"),
    };
  }, [challenge, trades]);

  if (!challenge) return null;

  const progress =
    challenge.targetBalance > 0
      ? ((challenge.currentBalance - challenge.startingBalance) /
          (challenge.targetBalance - challenge.startingBalance)) *
        100
      : 0;

  return (
    <AppSheet open={open} onOpenChange={onOpenChange} title={challenge.name} snapPoint="full">
      <div className="flex flex-col h-full">
        {/* Stats Dashboard */}
        <div className="p-4 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
          {/* Challenge Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--text-muted)]">Progress</span>
              <span className="text-sm font-medium text-[var(--text-high)]">
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  progress >= 100 ? "bg-[var(--accent-positive)]" : "bg-[var(--brand-primary)]"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-muted)]">
              <span>${challenge.startingBalance.toFixed(2)}</span>
              <span className="font-medium text-[var(--text-high)]">
                ${challenge.currentBalance.toFixed(2)}
              </span>
              <span>${challenge.targetBalance.toFixed(2)}</span>
            </div>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Total P&L</div>
              <div
                className={cn(
                  "text-lg font-semibold",
                  stats.totalPnL >= 0
                    ? "text-[var(--accent-positive)]"
                    : "text-[var(--accent-negative)]"
                )}
              >
                {stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Win Rate</div>
              <div className="text-lg font-semibold text-[var(--text-high)]">
                {stats.winRate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {stats.completedTrades} trades
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Avg R</div>
              <div
                className={cn(
                  "text-lg font-semibold",
                  stats.avgR >= 0
                    ? "text-[var(--accent-positive)]"
                    : "text-[var(--accent-negative)]"
                )}
              >
                {stats.avgR >= 0 ? "+" : ""}
                {stats.avgR.toFixed(2)}R
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Best Trade</div>
              <div className="text-lg font-semibold text-[var(--accent-positive)]">
                +${stats.bestTrade.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Trades Lists */}
        <div className="flex-1 overflow-y-auto">
          {/* Active Trades */}
          {challengeTrades.active.length > 0 && (
            <div className="p-4 border-b border-[var(--border-hairline)]">
              <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--brand-primary)]" />
                Active Trades ({challengeTrades.active.length})
              </h3>
              <div className="space-y-2">
                {challengeTrades.active.map((trade) => (
                  <div
                    key={trade.id}
                    className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-[var(--text-high)]">{trade.ticker}</span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          trade.state === "ENTERED"
                            ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                            : "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                        )}
                      >
                        {trade.state}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {trade.contract.strike} {trade.contract.type} • {trade.contract.daysToExpiry}
                      DTE
                    </div>
                    {trade.entryPrice && (
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        Entry: ${trade.entryPrice.toFixed(2)} × {trade.quantity}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Trades */}
          {challengeTrades.completed.length > 0 && (
            <div className="p-4">
              <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-[var(--text-muted)]" />
                Completed Trades ({challengeTrades.completed.length})
              </h3>
              <div className="space-y-2">
                {challengeTrades.completed.map((trade) => {
                  const pnl =
                    trade.exitPrice && trade.entryPrice
                      ? (trade.exitPrice - trade.entryPrice) *
                        trade.quantity *
                        (trade.contract.type === "CALL" ? 1 : -1)
                      : 0;
                  const isProfit = pnl > 0;

                  return (
                    <div
                      key={trade.id}
                      className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-[var(--text-high)]">{trade.ticker}</span>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isProfit
                              ? "text-[var(--accent-positive)]"
                              : "text-[var(--accent-negative)]"
                          )}
                        >
                          {isProfit ? "+" : ""}${pnl.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        {trade.contract.strike} {trade.contract.type} •{" "}
                        {trade.contract.daysToExpiry}DTE
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-[var(--text-muted)]">
                        <span>Entry: ${trade.entryPrice?.toFixed(2)}</span>
                        <span>Exit: ${trade.exitPrice?.toFixed(2)}</span>
                      </div>
                      {trade.rMultiple !== undefined && (
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          {trade.rMultiple >= 0 ? "+" : ""}
                          {trade.rMultiple.toFixed(2)}R
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {challengeTrades.active.length === 0 && challengeTrades.completed.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                No trades associated with this challenge yet
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]">
          <div className="flex gap-2">
            <HDButton
              variant="primary"
              onClick={() => onShare(challenge)}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share to Discord
            </HDButton>
            <HDButton
              variant="secondary"
              onClick={() => {
                onEdit(challenge);
                onOpenChange(false);
              }}
            >
              <Edit className="w-4 h-4" />
            </HDButton>
            <HDButton
              variant="secondary"
              onClick={() => {
                onDelete(challenge.id);
                onOpenChange(false);
              }}
              className="text-[var(--accent-negative)]"
            >
              <Trash2 className="w-4 h-4" />
            </HDButton>
          </div>
        </div>
      </div>
    </AppSheet>
  );
}
