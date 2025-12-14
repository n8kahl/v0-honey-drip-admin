/**
 * WinsPage - Public Wins/Losses Feed
 *
 * End-of-day published results showing:
 * - Both wins and losses with % P/L
 * - Admin attribution (name + avatar)
 * - Masked/blurred entry details (teaser)
 * - Strong CTA to join Discord/live portal
 *
 * No authentication required - fully public.
 */

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Trophy,
  Calendar,
  User,
  Lock,
  ChevronRight,
  Filter,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { branding } from "@/lib/config/branding";
import { getPublicWins } from "@/lib/api/tradeThreadApi";
import type { PublicTradeOutcome, TradeThreadOutcome } from "@/types/tradeThreads";

export function WinsPage() {
  const DISCORD_INVITE_URL =
    import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/honeydrip";

  // State
  const [outcomes, setOutcomes] = useState<PublicTradeOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TradeThreadOutcome | "all">("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
  });

  const fetchOutcomes = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);

    const currentPage = resetPage ? 1 : page;

    try {
      const data = await getPublicWins({
        page: currentPage,
        pageSize: 20,
        outcome: filter === "all" ? undefined : filter,
      });

      if (resetPage) {
        setOutcomes(data.outcomes);
      } else {
        setOutcomes((prev) => [...prev, ...data.outcomes]);
      }

      setTotal(data.total);
      setHasMore(data.hasMore);

      // Calculate stats from all data
      const wins = data.outcomes.filter((o) => o.outcome === "win").length;
      const losses = data.outcomes.filter((o) => o.outcome === "loss").length;
      const winPnls = data.outcomes
        .filter((o) => o.outcome === "win")
        .map((o) => o.pnlPercent);
      const lossPnls = data.outcomes
        .filter((o) => o.outcome === "loss")
        .map((o) => o.pnlPercent);

      setStats({
        totalTrades: data.total,
        wins,
        losses,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        avgWin:
          winPnls.length > 0 ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : 0,
        avgLoss:
          lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : 0,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load trades");
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchOutcomes(true);
  }, [filter]);

  useEffect(() => {
    if (page > 1) {
      fetchOutcomes();
    }
  }, [page]);

  const handleFilterChange = (newFilter: TradeThreadOutcome | "all") => {
    setFilter(newFilter);
    setPage(1);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      setPage((p) => p + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-primary)]/20 via-transparent to-[var(--accent-positive)]/10" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />

        <div className="relative max-w-6xl mx-auto px-4 py-12 lg:py-20">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <img
                src={branding.logoUrl}
                alt={branding.appName}
                className="w-10 h-10 rounded-lg object-contain"
              />
              <span className="text-xl font-bold text-[var(--text-high)]">
                {branding.appName}
              </span>
            </div>
            <Button
              onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--bg-base)] font-bold"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Join Discord
            </Button>
          </div>

          <div className="text-center">
            <h1 className="text-4xl lg:text-6xl font-bold mb-4">
              <span className="text-[var(--brand-primary)]">Real</span>{" "}
              <span className="text-[var(--text-high)]">Results</span>
            </h1>
            <p className="text-xl text-[var(--text-muted)] max-w-2xl mx-auto">
              Transparent trading. Every win. Every loss. No cherry-picking.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <StatCard
              icon={<Trophy className="w-5 h-5" />}
              label="Win Rate"
              value={`${stats.winRate.toFixed(0)}%`}
              color="text-[var(--brand-primary)]"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Total Wins"
              value={stats.wins.toString()}
              color="text-[var(--accent-positive)]"
            />
            <StatCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Total Losses"
              value={stats.losses.toString()}
              color="text-[var(--accent-negative)]"
            />
            <StatCard
              icon={<Calendar className="w-5 h-5" />}
              label="Total Trades"
              value={stats.totalTrades.toString()}
              color="text-[var(--text-muted)]"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">Filter:</span>
            <div className="flex gap-1">
              {(["all", "win", "loss"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                    filter === f
                      ? "bg-[var(--brand-primary)] text-[var(--bg-base)]"
                      : "bg-[var(--surface-1)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  {f === "all" ? "All" : f === "win" ? "Wins" : "Losses"}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => fetchOutcomes(true)}
            disabled={loading}
            className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-high)]"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-[var(--accent-negative)]/10 border border-[var(--accent-negative)]/20 text-[var(--accent-negative)] mb-6">
            {error}
          </div>
        )}

        {/* Trade Cards */}
        {loading && outcomes.length === 0 ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <TradeCardSkeleton key={i} />
            ))}
          </div>
        ) : outcomes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--text-muted)]">No trades published yet. Check back later!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {outcomes.map((outcome) => (
              <PublicTradeCard key={outcome.id} outcome={outcome} />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loading}
              className="border-[var(--border-hairline)]"
            >
              {loading ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}

        {/* CTA Section */}
        <section className="mt-16 p-8 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)]/20 to-[var(--accent-positive)]/10 border border-[var(--brand-primary)]/20">
          <div className="text-center">
            <h2 className="text-2xl lg:text-3xl font-bold text-[var(--text-high)] mb-4">
              Want Live Alerts?
            </h2>
            <p className="text-[var(--text-muted)] mb-6 max-w-xl mx-auto">
              Get real-time entry alerts, stop loss updates, and take profit signals.
              Join our Discord community and never miss a trade.
            </p>
            <Button
              size="lg"
              onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--bg-base)] font-bold text-lg px-8 py-6 shadow-glow-lg"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Join Discord for Live Alerts
            </Button>
            <p className="text-xs text-[var(--text-faint)] mt-4">
              Free to join. Upgrade for premium features.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-hairline)] mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-[var(--text-muted)]">
          <p>
            Past performance does not guarantee future results. Trading involves risk.
          </p>
          <p className="mt-2">
            &copy; {new Date().getFullYear()} {branding.appName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)]">
      <div className={cn("flex items-center gap-2 mb-2", color)}>{icon}</div>
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

function PublicTradeCard({ outcome }: { outcome: PublicTradeOutcome }) {
  const DISCORD_INVITE_URL =
    import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/honeydrip";

  const isWin = outcome.outcome === "win";
  const isLoss = outcome.outcome === "loss";

  // Parse contract details from contractId
  const symbol = outcome.symbol;
  const tradeType = outcome.tradeType || "Trade";

  return (
    <div
      className={cn(
        "p-5 rounded-xl border-2 transition-all hover:scale-[1.01]",
        isWin
          ? "bg-[var(--accent-positive)]/5 border-[var(--accent-positive)]/30"
          : isLoss
            ? "bg-[var(--accent-negative)]/5 border-[var(--accent-negative)]/30"
            : "bg-[var(--surface-1)] border-[var(--border-hairline)]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Trade Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-[var(--text-high)]">{symbol}</h3>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-semibold uppercase",
                isWin
                  ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                  : isLoss
                    ? "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)]"
              )}
            >
              {outcome.outcome}
            </span>
            {tradeType && (
              <span className="px-2 py-0.5 rounded bg-[var(--surface-1)] text-xs text-[var(--text-muted)]">
                {tradeType}
              </span>
            )}
          </div>

          {/* Admin Attribution */}
          <div className="flex items-center gap-2 mb-3">
            {outcome.adminAvatarUrl ? (
              <img
                src={outcome.adminAvatarUrl}
                alt={outcome.adminName || "Admin"}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[var(--brand-primary)]/20 flex items-center justify-center">
                <User className="w-3 h-3 text-[var(--brand-primary)]" />
              </div>
            )}
            <span className="text-sm text-[var(--text-muted)]">
              {outcome.adminName || "Admin"}
            </span>
            <span className="text-xs text-[var(--text-faint)]">
              •{" "}
              {outcome.publishedAt
                ? new Date(outcome.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "Today"}
            </span>
          </div>

          {/* Masked Entry Details */}
          <div className="relative">
            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Lock className="w-4 h-4" />
                <span className="blur-sm select-none">Entry: $2.45 • Stop: $2.10 • Target: $3.50</span>
              </div>
            </div>
            <button
              onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
              className="absolute inset-0 flex items-center justify-center bg-[var(--bg-base)]/80 rounded-lg opacity-0 hover:opacity-100 transition-opacity"
            >
              <span className="flex items-center gap-1 text-sm font-medium text-[var(--brand-primary)]">
                Members get live entries
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          </div>

          {/* Public Comment */}
          {outcome.publicComment && (
            <p className="mt-3 text-sm text-[var(--text-muted)] italic">
              "{outcome.publicComment}"
            </p>
          )}
        </div>

        {/* Right: P/L Display */}
        <div className="text-right">
          <div
            className={cn(
              "text-3xl lg:text-4xl font-bold font-mono",
              isWin
                ? "text-[var(--accent-positive)]"
                : isLoss
                  ? "text-[var(--accent-negative)]"
                  : "text-[var(--text-high)]"
            )}
          >
            {outcome.pnlPercent >= 0 ? "+" : ""}
            {outcome.pnlPercent.toFixed(1)}%
          </div>
          <div className="flex items-center justify-end gap-1 mt-1">
            {isWin ? (
              <TrendingUp className="w-4 h-4 text-[var(--accent-positive)]" />
            ) : isLoss ? (
              <TrendingDown className="w-4 h-4 text-[var(--accent-negative)]" />
            ) : null}
            <span className="text-sm text-[var(--text-faint)]">
              {outcome.tradeOpenedAt &&
                outcome.tradeClosedAt &&
                `${Math.ceil(
                  (new Date(outcome.tradeClosedAt).getTime() -
                    new Date(outcome.tradeOpenedAt).getTime()) /
                    3600000
                )}h hold`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeCardSkeleton() {
  return (
    <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-6 w-16 bg-[var(--surface-2)] rounded" />
            <div className="h-5 w-12 bg-[var(--surface-2)] rounded-full" />
          </div>
          <div className="h-4 w-32 bg-[var(--surface-2)] rounded" />
          <div className="h-10 w-full bg-[var(--surface-2)] rounded" />
        </div>
        <div className="h-10 w-20 bg-[var(--surface-2)] rounded" />
      </div>
    </div>
  );
}

export default WinsPage;
