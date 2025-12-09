/**
 * PublicPortal.tsx - Public-facing Engagement Page (Redesigned)
 *
 * High-energy showcase of real-time admin trades, daily performance,
 * challenges, and alerts to drive Discord membership signups.
 *
 * Features:
 * - Daily group performance scorecard with admin leaderboard
 * - Live trades grouped by type (Scalps, Day, Swing, LEAP)
 * - Alert feed with member gating
 * - Recent big wins carousel
 * - Challenge progress
 * - Demo toggle for public/member view
 */

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Zap, Calendar, Play, Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMemberStatus } from "@/hooks/useMemberStatus";
import { branding } from "@/lib/config/branding";

// Components
import { DailyScorecard, type DailyStats, type AdminStats } from "@/components/public/DailyScorecard";
import { TradeTypeSection } from "@/components/public/TradeTypeSection";
import { AlertFeed, type TradeAlert } from "@/components/public/AlertFeed";
import { DemoViewToggle, GatedSection } from "@/components/public/MemberGate";
import { TradeDetailModal } from "@/components/public/TradeDetailModal";
import type { PublicTrade } from "@/components/public/LiveTradeCard";

// Existing components
import {
  fetchLatestPremarket,
  getWatchUrl,
  formatPublishedDate,
  type PremarketVideo,
} from "@/lib/youtube/client";
import {
  fetchEconomicCalendar,
  type EconomicEvent,
} from "@/lib/calendar/EconomicCalendar";

// ============================================================================
// API Functions
// ============================================================================

const API_BASE = "/api/public";

async function fetchActiveTrades(): Promise<{
  trades: PublicTrade[];
  grouped: { scalps: PublicTrade[]; day_trades: PublicTrade[]; swings: PublicTrade[]; leaps: PublicTrade[] };
  total: number;
}> {
  const res = await fetch(`${API_BASE}/trades/active`);
  if (!res.ok) throw new Error("Failed to fetch trades");
  return res.json();
}

async function fetchTodayStats(): Promise<DailyStats> {
  const res = await fetch(`${API_BASE}/stats/today`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchLeaderboard(): Promise<{ leaderboard: AdminStats[] }> {
  const res = await fetch(`${API_BASE}/stats/leaderboard`);
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
}

async function fetchRecentAlerts(isMember: boolean): Promise<{
  alerts: TradeAlert[];
  has_more: boolean;
}> {
  const res = await fetch(`${API_BASE}/alerts/recent?member=${isMember}`);
  if (!res.ok) throw new Error("Failed to fetch alerts");
  return res.json();
}

async function fetchRecentWins(): Promise<{ wins: PublicTrade[] }> {
  const res = await fetch(`${API_BASE}/wins/recent`);
  if (!res.ok) throw new Error("Failed to fetch wins");
  return res.json();
}

async function fetchChallenges(): Promise<{ challenges: any[] }> {
  const res = await fetch(`${API_BASE}/challenges/active`);
  if (!res.ok) throw new Error("Failed to fetch challenges");
  return res.json();
}

// ============================================================================
// Main Component
// ============================================================================

export function PublicPortal() {
  const { isMember, setIsMember } = useMemberStatus();
  const DISCORD_INVITE_URL = import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/honeydrip";

  // State
  const [activeTrades, setActiveTrades] = useState<PublicTrade[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<AdminStats[]>([]);
  const [alerts, setAlerts] = useState<TradeAlert[]>([]);
  const [alertsHasMore, setAlertsHasMore] = useState(false);
  const [recentWins, setRecentWins] = useState<PublicTrade[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [premarketVideo, setPremarketVideo] = useState<PremarketVideo | null>(null);
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Trade detail modal state
  const [selectedTrade, setSelectedTrade] = useState<PublicTrade | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleViewDetails = (trade: PublicTrade) => {
    setSelectedTrade(trade);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedTrade(null);
  };

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      const [tradesData, statsData, leaderboardData, alertsData, winsData, challengesData] =
        await Promise.allSettled([
          fetchActiveTrades(),
          fetchTodayStats(),
          fetchLeaderboard(),
          fetchRecentAlerts(isMember),
          fetchRecentWins(),
          fetchChallenges(),
        ]);

      if (tradesData.status === "fulfilled") {
        setActiveTrades(tradesData.value.trades);
      }
      if (statsData.status === "fulfilled") {
        setDailyStats(statsData.value);
      }
      if (leaderboardData.status === "fulfilled") {
        setLeaderboard(leaderboardData.value.leaderboard);
      }
      if (alertsData.status === "fulfilled") {
        setAlerts(alertsData.value.alerts);
        setAlertsHasMore(alertsData.value.has_more);
      }
      if (winsData.status === "fulfilled") {
        setRecentWins(winsData.value.wins);
      }
      if (challengesData.status === "fulfilled") {
        setChallenges(challengesData.value.challenges);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error("[PublicPortal] Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isMember]);

  // Fetch pre-market and calendar
  const fetchSidebarData = useCallback(async () => {
    try {
      const [premarketData, calendarData] = await Promise.allSettled([
        fetchLatestPremarket(),
        (async () => {
          const now = new Date();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 7);
          return fetchEconomicCalendar(startOfWeek, endOfWeek);
        })(),
      ]);

      if (premarketData.status === "fulfilled") {
        setPremarketVideo(premarketData.value);
      }
      if (calendarData.status === "fulfilled") {
        const highImpact = calendarData.value.filter((e) =>
          ["medium", "high"].includes(e.impact.toLowerCase())
        );
        setEconomicEvents(highImpact.slice(0, 8));
      }
    } catch (error) {
      console.error("[PublicPortal] Error fetching sidebar data:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllData();
    fetchSidebarData();

    // Poll for updates every 30 seconds
    const pollInterval = setInterval(fetchAllData, 30000);

    return () => clearInterval(pollInterval);
  }, [fetchAllData, fetchSidebarData]);

  // Refetch alerts when member status changes
  useEffect(() => {
    fetchRecentAlerts(isMember).then((data) => {
      setAlerts(data.alerts);
      setAlertsHasMore(data.has_more);
    });
  }, [isMember]);

  // Time since last update
  const getTimeSinceUpdate = () => {
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const isStale = Date.now() - lastUpdated.getTime() > 60000; // 1 minute

  return (
    <div className="min-h-screen bg-[var(--bg-base)] overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-hairline)] bg-[var(--bg-base)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-base)]/80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={branding.logoUrl}
              alt={branding.appName}
              className="w-8 h-8 rounded object-contain"
            />
            <h1 className="text-xl font-bold text-[var(--text-high)]">
              <span className="text-[var(--brand-primary)]">{branding.appName.toUpperCase()}</span> LIVE
            </h1>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  isStale ? "bg-amber-400" : "bg-[var(--accent-positive)]"
                )}
              />
              <span className="text-xs text-[var(--text-muted)]">
                Updated {getTimeSinceUpdate()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DemoViewToggle isMember={isMember} setIsMember={setIsMember} />
            <Button
              onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-black font-semibold"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Join Discord
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Daily Scorecard */}
        <section className="mb-8">
          <DailyScorecard
            stats={dailyStats}
            leaderboard={leaderboard}
            isLoading={isLoading}
          />
        </section>

        {/* Main Grid: Trades + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Trades Section - 8 cols */}
          <div className="lg:col-span-8 space-y-6">
            {/* Live Now Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[var(--accent-positive)]" />
                <h2 className="text-xl font-bold text-[var(--text-high)]">Live Now</h2>
                <span className="text-sm text-[var(--text-muted)]">
                  {activeTrades.length} Active
                </span>
              </div>
            </div>

            {/* Trades by Type */}
            <TradeTypeSection
              trades={activeTrades}
              onViewDetails={handleViewDetails}
              onShare={(trade) => {
                // TODO: Open share modal
                console.log("Share trade:", trade.id);
              }}
            />

            {/* Alert Feed */}
            <section className="mt-6">
              <AlertFeed
                alerts={alerts}
                isMember={isMember}
                hasMore={alertsHasMore}
                onJoinDiscord={() => window.open(DISCORD_INVITE_URL, "_blank")}
              />
            </section>

            {/* Recent Big Wins */}
            {recentWins.length > 0 && (
              <section className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-[var(--brand-primary)]" />
                  <h2 className="text-xl font-bold text-[var(--text-high)]">Recent Big Wins</h2>
                  <span className="text-sm text-[var(--text-muted)]">Last 7 Days</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-[var(--surface-2)] scrollbar-track-transparent">
                  {recentWins.map((trade) => (
                    <BigWinCard key={trade.id} trade={trade} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar - 4 cols */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Active Challenges */}
            {challenges.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[var(--brand-primary)]" />
                  Active Challenges
                </h3>
                <div className="space-y-3">
                  {challenges.map((challenge) => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              </section>
            )}

            {/* 30-Day Performance - Gated for non-members */}
            {!isMember ? (
              <GatedSection
                title="30-Day Performance"
                description="Members see detailed performance breakdowns by trade type"
              />
            ) : (
              <section>
                <h3 className="text-lg font-semibold text-[var(--text-high)] mb-3">
                  30-Day Performance
                </h3>
                {/* TODO: Add PerformanceByType component */}
                <div className="p-4 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] text-center text-sm text-[var(--text-muted)]">
                  Performance stats coming soon
                </div>
              </section>
            )}

            {/* Pre-Market Video */}
            {premarketVideo?.available && (
              <section>
                <h3 className="text-lg font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Pre-Market Analysis
                </h3>
                <a
                  href={getWatchUrl(premarketVideo.videoId!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="relative rounded-lg overflow-hidden border border-[var(--border-hairline)] hover:border-[var(--brand-primary)] transition-all">
                    <img
                      src={premarketVideo.thumbnail}
                      alt={premarketVideo.title}
                      className="w-full aspect-video object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs text-white font-medium line-clamp-2">
                        {premarketVideo.title}
                      </p>
                    </div>
                  </div>
                </a>
                <p className="text-xs text-[var(--text-faint)] mt-2">
                  {formatPublishedDate(premarketVideo.publishedAt!)}
                </p>
              </section>
            )}

            {/* Economic Calendar */}
            {economicEvents.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  This Week
                </h3>
                <div className="space-y-2">
                  {economicEvents.map((event, i) => (
                    <EconomicEventCard key={i} event={event} />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>

      {/* Fixed CTA (mobile) */}
      <div className="fixed bottom-4 left-4 right-4 lg:hidden z-50">
        <Button
          onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
          className="w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-black font-bold shadow-glow-lg"
        >
          <ExternalLink className="w-5 h-5 mr-2" />
          Join Discord for Live Alerts
        </Button>
      </div>

      {/* Trade Detail Modal */}
      <TradeDetailModal
        trade={selectedTrade}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
      />
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function BigWinCard({ trade }: { trade: PublicTrade }) {
  const pnl = trade.pnl_percent ?? 0;
  const contract = trade.contract;
  const contractDisplay = contract
    ? `$${contract.strike}${contract.type === "call" ? "C" : "P"}`
    : "";

  return (
    <div className="flex-shrink-0 w-40 p-3 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] hover:scale-[1.02] transition-transform">
      <div className="font-bold text-[var(--text-high)]">{trade.ticker}</div>
      <div className="text-xs text-[var(--text-muted)]">{contractDisplay}</div>
      <div className="text-2xl font-bold font-mono text-[var(--accent-positive)] mt-1">
        +{pnl.toFixed(0)}%
      </div>
      <div className="text-xs text-[var(--text-faint)] mt-1">
        {trade.admin_name || "Admin"} · {trade.trade_type}
      </div>
    </div>
  );
}

function ChallengeCard({ challenge }: { challenge: any }) {
  const progress = Math.min(100, Math.max(0, challenge.progress_percent || 0));

  return (
    <div className="p-4 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
      <h4 className="font-semibold text-[var(--text-high)] mb-2">{challenge.name}</h4>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[var(--text-muted)]">
          ${(challenge.current_pnl || 0).toFixed(0)}
        </span>
        <span className="text-[var(--text-muted)]">
          ${(challenge.target_amount || 0).toFixed(0)}
        </span>
      </div>
      <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent-positive)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-[var(--text-faint)] mt-2">
        {challenge.days_remaining} days remaining · {progress.toFixed(0)}% complete
      </p>
    </div>
  );
}

function EconomicEventCard({ event }: { event: EconomicEvent }) {
  const impactColor =
    event.impact === "HIGH" || event.impact === "CRITICAL" ? "text-red-400" : "text-amber-400";

  return (
    <div className="p-2 bg-[var(--surface-1)] rounded border border-[var(--border-hairline)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--text-high)] flex-1 line-clamp-1">{event.name}</p>
        <span className={cn("text-xs font-bold", impactColor)}>
          {event.impact === "HIGH" || event.impact === "CRITICAL" ? "HIGH" : "MED"}
        </span>
      </div>
      <p className="text-xs text-[var(--text-faint)] mt-1">
        {event.datetime.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

export default PublicPortal;
