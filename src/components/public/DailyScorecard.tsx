/**
 * DailyScorecard.tsx - Today's Group Performance Display
 *
 * Shows combined gains, win/loss record, trade type breakdown,
 * and admin leaderboard cards. Now supports D/W/M range toggle.
 */

import { TrendingUp, TrendingDown, Target, Flame, BarChart3, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicStatsSummary, AdminStats, StatsRange, PublicTradeType } from "@/types/public";
import { formatPct, formatWinRate, formatWinLossRecord } from "@/lib/utils/publicFormatters";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Re-export types for backwards compatibility
export type { AdminStats } from "@/types/public";

// Legacy type alias for backwards compatibility
export interface DailyStats {
  date: string;
  total_trades: number;
  wins: number;
  losses: number;
  total_gain_percent: number;
  avg_gain_percent: number;
  best_trade_percent: number;
  by_type: Record<PublicTradeType, { count: number; wins: number; losses: number }>;
}

interface DailyScorecardProps {
  stats: DailyStats | null;
  leaderboard: AdminStats[];
  isLoading?: boolean;
  // New props for D/W/M toggle
  selectedRange?: StatsRange;
  onRangeChange?: (range: StatsRange) => void;
}

// Range labels for toggle buttons
const RANGE_LABELS: Record<StatsRange, string> = {
  day: "Today",
  week: "7 Days",
  month: "30 Days",
};

// ============================================================================
// Component
// ============================================================================

export function DailyScorecard({
  stats,
  leaderboard,
  isLoading,
  selectedRange = "day",
  onRangeChange,
}: DailyScorecardProps) {
  if (isLoading) {
    return <DailyScorecardSkeleton />;
  }

  const totalGain = stats?.total_gain_percent ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const isPositive = totalGain >= 0;

  // Get trade type counts
  const scalps = stats?.by_type?.Scalp?.count ?? 0;
  const dayTrades = stats?.by_type?.Day?.count ?? 0;
  const swings = stats?.by_type?.Swing?.count ?? 0;
  const leaps = stats?.by_type?.LEAP?.count ?? 0;

  // Range title based on selection
  const rangeTitle =
    selectedRange === "day"
      ? "Today's Group Performance"
      : selectedRange === "week"
        ? "Last 7 Days Performance"
        : "Last 30 Days Performance";

  return (
    <section className="relative overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-gradient-to-br from-[var(--surface-1)] via-[var(--bg-base)] to-[var(--surface-1)]">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--brand-primary)_0%,transparent_50%)] opacity-5" />

      <div className="relative p-6 lg:p-8">
        {/* Header with Range Toggle */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {rangeTitle}
              </h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-[var(--text-faint)]" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Win Rate:</strong> Percentage of exited trades with positive P&L
                      <br />
                      <strong>P&L:</strong> ((exit - entry) / entry) × 100
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* D/W/M Toggle */}
            {onRangeChange && (
              <div className="flex rounded-lg bg-[var(--surface-2)] p-1">
                {(["day", "week", "month"] as StatsRange[]).map((range) => (
                  <button
                    key={range}
                    data-testid={`stats-toggle-${range}`}
                    onClick={() => onRangeChange(range)}
                    className={cn(
                      "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                      selectedRange === range
                        ? "bg-[var(--brand-primary)] text-black"
                        : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
                    )}
                  >
                    {RANGE_LABELS[range]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          {/* Combined Gains */}
          <div className="col-span-2 lg:col-span-1 flex flex-col items-center justify-center p-4 rounded-lg bg-[var(--surface-2)]/50">
            <span
              className={cn(
                "text-4xl lg:text-5xl font-bold font-mono",
                isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
              )}
            >
              {isPositive ? "+" : ""}
              {totalGain.toFixed(0)}%
            </span>
            <span className="text-sm text-[var(--text-muted)] mt-1">Combined Gains</span>
          </div>

          {/* Win/Loss */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-[var(--surface-2)]/50">
            <div className="flex items-center gap-2">
              <span className="text-2xl lg:text-3xl font-bold text-[var(--accent-positive)]">
                {wins}
              </span>
              <span className="text-xl text-[var(--text-muted)]">/</span>
              <span className="text-2xl lg:text-3xl font-bold text-[var(--accent-negative)]">
                {losses}
              </span>
            </div>
            <span className="text-sm text-[var(--text-muted)] mt-1">Wins / Losses</span>
          </div>

          {/* Trade Types */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-[var(--surface-2)]/50">
            <div className="flex items-center gap-3">
              {scalps > 0 && (
                <div className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-lg font-bold text-[var(--text-high)]">{scalps}</span>
                </div>
              )}
              {dayTrades > 0 && (
                <div className="flex items-center gap-1">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-lg font-bold text-[var(--text-high)]">{dayTrades}</span>
                </div>
              )}
            </div>
            <span className="text-sm text-[var(--text-muted)] mt-1">Scalps / Day</span>
          </div>

          {/* Swings/Leaps */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-[var(--surface-2)]/50">
            <div className="flex items-center gap-3">
              {swings > 0 && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className="text-lg font-bold text-[var(--text-high)]">{swings}</span>
                </div>
              )}
              {leaps > 0 && (
                <div className="flex items-center gap-1">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span className="text-lg font-bold text-[var(--text-high)]">{leaps}</span>
                </div>
              )}
              {swings === 0 && leaps === 0 && (
                <span className="text-lg font-bold text-[var(--text-muted)]">0</span>
              )}
            </div>
            <span className="text-sm text-[var(--text-muted)] mt-1">Swings / LEAPs</span>
          </div>
        </div>

        {/* Admin Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {leaderboard.slice(0, 4).map((admin, index) => (
              <AdminCard key={admin.admin_id} admin={admin} rank={index + 1} />
            ))}

            {/* Group Total Card (if multiple admins) */}
            {leaderboard.length > 1 && (
              <div className="col-span-2 lg:col-span-4 flex justify-center mt-2">
                <div className="inline-flex items-center gap-4 px-6 py-3 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30">
                  <span className="text-sm font-medium text-[var(--text-muted)]">GROUP TOTAL</span>
                  <span
                    className={cn(
                      "text-xl font-bold font-mono",
                      isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {totalGain.toFixed(0)}%
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {wins}W/{losses}L
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!stats && leaderboard.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[var(--text-muted)]">No trades yet today. Check back soon!</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Admin Card
// ============================================================================

interface AdminCardProps {
  admin: AdminStats;
  rank: number;
}

function AdminCard({ admin, rank }: AdminCardProps) {
  const isPositive = admin.total_gain_percent >= 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center p-4 rounded-lg border transition-all hover:scale-[1.02]",
        rank === 1
          ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/40"
          : "bg-[var(--surface-1)] border-[var(--border-hairline)]"
      )}
    >
      {/* Admin Avatar/Name */}
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-4 h-4 text-[var(--brand-primary)]" />
        <span className="font-semibold text-[var(--text-high)] truncate max-w-[100px]">
          {admin.admin_name}
        </span>
      </div>

      {/* Gain */}
      <span
        className={cn(
          "text-2xl font-bold font-mono",
          isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
        )}
      >
        {isPositive ? "+" : ""}
        {admin.total_gain_percent.toFixed(0)}%
      </span>

      {/* Win/Loss */}
      <span className="text-xs text-[var(--text-muted)] mt-1">
        {admin.wins}W/{admin.losses}L
      </span>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function DailyScorecardSkeleton() {
  return (
    <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-6 lg:p-8">
      <div className="animate-pulse">
        <div className="h-6 w-48 bg-[var(--surface-2)] rounded mx-auto mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[var(--surface-2)] rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-[var(--surface-2)] rounded-lg" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default DailyScorecard;
