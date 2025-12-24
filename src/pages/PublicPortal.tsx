/**
 * PublicPortal.tsx - Public-facing engagement page
 *
 * High-energy showcase of real-time admin trades, alerts, challenges, pre-market analysis,
 * and economic calendar to drive Discord membership signups.
 *
 * IMPORTANT: This page uses PUBLIC API endpoints only - NO direct Supabase queries
 * for core trading data. This ensures proper separation and allows for caching.
 *
 * No authentication required.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ExternalLink,
  Zap,
  Calendar,
  Play,
  Trophy,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMemberStatus } from "@/hooks/useMemberStatus";
import { branding } from "@/lib/config/branding";

// Public components
import {
  DailyScorecard,
  type DailyStats,
  type AdminStats,
} from "@/components/public/DailyScorecard";
import { AlertFeed } from "@/components/public/AlertFeed";
import { LiveTradeCard } from "@/components/public/LiveTradeCard";
import { DemoViewToggle } from "@/components/public/MemberGate";
import { TradeDetailModal } from "@/components/public/TradeDetailModal";

// Types from canonical source
import type {
  PublicTrade,
  PublicTradeAlert,
  PublicChallenge,
  StatsRange,
  PublicPortalFreshness,
} from "@/types/public";

// External data fetchers (non-trade data)
import {
  fetchLatestPremarket,
  getWatchUrl,
  formatPublishedDate,
  type PremarketVideo,
} from "@/lib/youtube/client";
import {
  fetchEconomicCalendar,
  fetchEarningsCalendar,
  type EconomicEvent,
  type EarningsEvent,
} from "@/lib/calendar/EconomicCalendar";

// Supabase only for realtime subscription (not data fetching)
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// ============================================================================
// Constants
// ============================================================================

const ALERT_POLL_INTERVAL = 5000; // 5 seconds
const TRADES_POLL_INTERVAL = 10000; // 10 seconds
const CALENDAR_POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes
const PREMARKET_POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes
const STALENESS_THRESHOLD = 10000; // 10 seconds

// ============================================================================
// API Fetchers
// ============================================================================

async function fetchActiveTrades(): Promise<{
  activeTrades: PublicTrade[];
  loadedTrades: PublicTrade[];
}> {
  const response = await fetch("/api/public/trades/active");
  if (!response.ok) {
    throw new Error(`Failed to fetch trades: ${response.status}`);
  }
  const data = await response.json();

  // Split by state
  const activeTrades = (data.trades || []).filter((t: PublicTrade) => t.state === "ENTERED");
  const loadedTrades = (data.trades || []).filter((t: PublicTrade) => t.state === "LOADED");

  return { activeTrades, loadedTrades };
}

async function fetchAlerts(isMember: boolean): Promise<{
  alerts: PublicTradeAlert[];
  hasMore: boolean;
}> {
  const response = await fetch(`/api/public/alerts/recent?member=${isMember}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.status}`);
  }
  const data = await response.json();
  return {
    alerts: data.alerts || [],
    hasMore: data.has_more || false,
  };
}

async function fetchStats(range: StatsRange): Promise<DailyStats | null> {
  const response = await fetch(`/api/public/stats/summary?range=${range}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.status}`);
  }
  const data = await response.json();

  // Map to DailyStats format for backwards compatibility with DailyScorecard
  return {
    date: data.start_date,
    total_trades: data.total_trades,
    wins: data.wins,
    losses: data.losses,
    total_gain_percent: data.total_pnl_percent,
    avg_gain_percent: data.avg_pnl_percent,
    best_trade_percent: data.best_trade?.percent || 0,
    by_type: {
      Scalp: data.by_type?.Scalp || { count: 0, wins: 0, losses: 0 },
      Day: data.by_type?.Day || { count: 0, wins: 0, losses: 0 },
      Swing: data.by_type?.Swing || { count: 0, wins: 0, losses: 0 },
      LEAP: data.by_type?.LEAP || { count: 0, wins: 0, losses: 0 },
    },
  };
}

async function fetchLeaderboard(): Promise<AdminStats[]> {
  const response = await fetch("/api/public/stats/leaderboard");
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status}`);
  }
  const data = await response.json();
  return data.leaderboard || [];
}

async function fetchChallenges(): Promise<PublicChallenge[]> {
  const response = await fetch("/api/public/challenges/active");
  if (!response.ok) {
    throw new Error(`Failed to fetch challenges: ${response.status}`);
  }
  const data = await response.json();
  return data.challenges || [];
}

// ============================================================================
// Component
// ============================================================================

export function PublicPortal() {
  const { isMember, setIsMember } = useMemberStatus();
  const DISCORD_INVITE_URL =
    import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/honeydrip";

  // Core data state
  const [activeTrades, setActiveTrades] = useState<PublicTrade[]>([]);
  const [loadedTrades, setLoadedTrades] = useState<PublicTrade[]>([]);
  const [alerts, setAlerts] = useState<PublicTradeAlert[]>([]);
  const [alertsHasMore, setAlertsHasMore] = useState(false);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<AdminStats[]>([]);
  const [challenges, setChallenges] = useState<PublicChallenge[]>([]);
  const [statsRange, setStatsRange] = useState<StatsRange>("day");

  // External data state
  const [premarketVideo, setPremarketVideo] = useState<PremarketVideo | null>(null);
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);

  // Per-module freshness tracking
  const [freshness, setFreshness] = useState<PublicPortalFreshness>({
    alerts: { updatedAt: null, isLoading: true, error: null },
    trades: { updatedAt: null, isLoading: true, error: null },
    stats: { updatedAt: null, isLoading: true, error: null },
    challenges: { updatedAt: null, isLoading: true, error: null },
    calendar: { updatedAt: null, isLoading: true, error: null },
    premarket: { updatedAt: null, isLoading: true, error: null },
  });

  // Trade detail modal
  const [selectedTrade, setSelectedTrade] = useState<PublicTrade | null>(null);

  // Refs for cleanup
  const alertsPollRef = useRef<NodeJS.Timeout | null>(null);
  const tradesPollRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Data Fetching Functions
  // ============================================================================

  const loadTrades = useCallback(async () => {
    try {
      setFreshness((prev) => ({
        ...prev,
        trades: { ...prev.trades, isLoading: true },
      }));

      const { activeTrades, loadedTrades } = await fetchActiveTrades();
      setActiveTrades(activeTrades);
      setLoadedTrades(loadedTrades);

      setFreshness((prev) => ({
        ...prev,
        trades: { updatedAt: new Date(), isLoading: false, error: null },
      }));
    } catch (error) {
      console.error("[PublicPortal] Error fetching trades:", error);
      setFreshness((prev) => ({
        ...prev,
        trades: {
          ...prev.trades,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load trades",
        },
      }));
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      setFreshness((prev) => ({
        ...prev,
        alerts: { ...prev.alerts, isLoading: true },
      }));

      const { alerts, hasMore } = await fetchAlerts(isMember);
      setAlerts(alerts);
      setAlertsHasMore(hasMore);

      setFreshness((prev) => ({
        ...prev,
        alerts: { updatedAt: new Date(), isLoading: false, error: null },
      }));
    } catch (error) {
      console.error("[PublicPortal] Error fetching alerts:", error);
      setFreshness((prev) => ({
        ...prev,
        alerts: {
          ...prev.alerts,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load alerts",
        },
      }));
    }
  }, [isMember]);

  const loadStats = useCallback(async (range: StatsRange) => {
    try {
      setFreshness((prev) => ({
        ...prev,
        stats: { ...prev.stats, isLoading: true },
      }));

      const [statsData, leaderboardData] = await Promise.all([
        fetchStats(range),
        fetchLeaderboard(),
      ]);

      setStats(statsData);
      setLeaderboard(leaderboardData);

      setFreshness((prev) => ({
        ...prev,
        stats: { updatedAt: new Date(), isLoading: false, error: null },
      }));
    } catch (error) {
      console.error("[PublicPortal] Error fetching stats:", error);
      setFreshness((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load stats",
        },
      }));
    }
  }, []);

  const loadChallenges = useCallback(async () => {
    try {
      setFreshness((prev) => ({
        ...prev,
        challenges: { ...prev.challenges, isLoading: true },
      }));

      const challengesData = await fetchChallenges();
      setChallenges(challengesData);

      setFreshness((prev) => ({
        ...prev,
        challenges: { updatedAt: new Date(), isLoading: false, error: null },
      }));
    } catch (error) {
      console.error("[PublicPortal] Error fetching challenges:", error);
      setFreshness((prev) => ({
        ...prev,
        challenges: {
          ...prev.challenges,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load challenges",
        },
      }));
    }
  }, []);

  const loadPremarket = useCallback(async () => {
    try {
      setFreshness((prev) => ({
        ...prev,
        premarket: { ...prev.premarket, isLoading: true },
      }));

      const video = await fetchLatestPremarket();
      setPremarketVideo(video);

      setFreshness((prev) => ({
        ...prev,
        premarket: { updatedAt: new Date(), isLoading: false, error: null },
      }));
    } catch (error) {
      console.error("[PublicPortal] Error fetching premarket:", error);
      setFreshness((prev) => ({
        ...prev,
        premarket: {
          ...prev.premarket,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load premarket",
        },
      }));
    }
  }, []);

  const loadCalendarData = useCallback(async () => {
    try {
      setFreshness((prev) => ({
        ...prev,
        calendar: { ...prev.calendar, isLoading: true },
      }));

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const [econ, earn] = await Promise.all([
        fetchEconomicCalendar(startOfWeek, endOfWeek),
        fetchEarningsCalendar(now, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
      ]);

      const highImpactEvents = econ.filter((e) =>
        ["medium", "high"].includes(e.impact.toLowerCase())
      );
      setEconomicEvents(highImpactEvents.slice(0, 10));
      setEarnings(earn.slice(0, 8));

      setFreshness((prev) => ({
        ...prev,
        calendar: { updatedAt: new Date(), isLoading: false, error: null },
      }));
    } catch (error) {
      console.error("[PublicPortal] Error fetching calendar:", error);
      setFreshness((prev) => ({
        ...prev,
        calendar: {
          ...prev.calendar,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load calendar",
        },
      }));
    }
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial data load
  useEffect(() => {
    loadTrades();
    loadAlerts();
    loadStats(statsRange);
    loadChallenges();
    loadPremarket();
    loadCalendarData();
  }, []);

  // Reload alerts when member status changes
  useEffect(() => {
    loadAlerts();
  }, [isMember, loadAlerts]);

  // Reload stats when range changes
  useEffect(() => {
    loadStats(statsRange);
  }, [statsRange, loadStats]);

  // Setup realtime subscription for trades
  useEffect(() => {
    const tradesChannel = supabase
      .channel("public-trades")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trades",
          filter: "show_on_public=eq.true",
        },
        () => {
          loadTrades();
        }
      )
      .subscribe();

    // Also subscribe to trade_updates for alert feed
    const updatesChannel = supabase
      .channel("public-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_updates",
        },
        () => {
          loadAlerts();
        }
      )
      .subscribe();

    return () => {
      tradesChannel.unsubscribe();
      updatesChannel.unsubscribe();
    };
  }, [loadTrades, loadAlerts]);

  // Setup polling fallback for alerts (in case realtime fails)
  useEffect(() => {
    alertsPollRef.current = setInterval(loadAlerts, ALERT_POLL_INTERVAL);
    return () => {
      if (alertsPollRef.current) clearInterval(alertsPollRef.current);
    };
  }, [loadAlerts]);

  // Setup calendar refresh interval
  useEffect(() => {
    const calendarInterval = setInterval(loadCalendarData, CALENDAR_POLL_INTERVAL);
    const premarketInterval = setInterval(loadPremarket, PREMARKET_POLL_INTERVAL);

    return () => {
      clearInterval(calendarInterval);
      clearInterval(premarketInterval);
    };
  }, [loadCalendarData, loadPremarket]);

  // ============================================================================
  // Freshness Helpers
  // ============================================================================

  const getGlobalFreshness = useCallback(() => {
    const latestUpdate = [freshness.trades.updatedAt, freshness.alerts.updatedAt]
      .filter(Boolean)
      .reduce(
        (latest, current) => {
          if (!latest) return current;
          if (!current) return latest;
          return current > latest ? current : latest;
        },
        null as Date | null
      );

    if (!latestUpdate) return { isStale: true, timeAgo: "Loading..." };

    const diffMs = Date.now() - latestUpdate.getTime();
    const isStale = diffMs > STALENESS_THRESHOLD;

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return { isStale, timeAgo: `${seconds}s ago` };
    const minutes = Math.floor(seconds / 60);
    return { isStale, timeAgo: `${minutes}m ago` };
  }, [freshness]);

  const globalFreshness = getGlobalFreshness();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRangeChange = useCallback((range: StatsRange) => {
    setStatsRange(range);
  }, []);

  const handleViewTrade = useCallback(
    (tradeId: string) => {
      const trade =
        activeTrades.find((t) => t.id === tradeId) || loadedTrades.find((t) => t.id === tradeId);
      if (trade) setSelectedTrade(trade);
    },
    [activeTrades, loadedTrades]
  );

  const handleViewTradeFromAlert = useCallback(
    (tradeId: string) => {
      handleViewTrade(tradeId);
    },
    [handleViewTrade]
  );

  // ============================================================================
  // Render
  // ============================================================================

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
              <span className="text-[var(--brand-primary)]">{branding.appName.toUpperCase()}</span>{" "}
              LIVE
            </h1>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  globalFreshness.isStale ? "bg-amber-400" : "bg-[var(--accent-positive)]"
                )}
              />
              <span className="text-xs text-[var(--text-muted)]">
                Updated {globalFreshness.timeAgo}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DemoViewToggle isMember={isMember} setIsMember={setIsMember} />
            <Button
              size="lg"
              onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--bg-base)] font-bold text-lg px-8 py-6 shadow-glow-lg animate-pulse"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Join Discord for Live Alerts
            </Button>
          </div>
        </div>

        {/* Animated ticker tape */}
        {activeTrades.length > 0 && (
          <div className="mt-8 overflow-hidden">
            <div className="flex gap-4 animate-scroll whitespace-nowrap">
              {activeTrades.concat(activeTrades).map((trade, i) => (
                <div
                  key={`${trade.id}-${i}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]"
                >
                  <TrendingUp className="w-4 h-4 text-[var(--accent-positive)]" />
                  <span className="font-bold text-[var(--text-high)]">{trade.ticker}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    ${trade.contract?.strike ?? 0} {trade.contract?.type === "C" ? "CALL" : "PUT"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Alerts + Active Trades */}
          <section className="lg:col-span-4 space-y-6">
            {/* Alerts Feed */}
            <div>
              <AlertFeed
                alerts={alerts}
                isMember={isMember}
                hasMore={alertsHasMore}
                isLoading={freshness.alerts.isLoading}
                onViewTrade={handleViewTradeFromAlert}
                onJoinDiscord={() => window.open(DISCORD_INVITE_URL, "_blank")}
              />
              {freshness.alerts.error && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {freshness.alerts.error}
                </div>
              )}
            </div>

            {/* Active Trades */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[var(--text-high)] flex items-center gap-2">
                <Zap className="w-6 h-6 text-[var(--accent-positive)]" />
                Active Trades
                <span className="text-sm font-normal text-[var(--text-muted)]">
                  ({activeTrades.length})
                </span>
              </h2>
              {freshness.trades.error && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {freshness.trades.error}
                </div>
              )}
              {activeTrades.length === 0 && !freshness.trades.isLoading ? (
                <div className="p-8 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                  <p className="text-[var(--text-muted)]">
                    No active trades right now—watch loaded setups below.
                  </p>
                </div>
              ) : (
                activeTrades.map((trade) => (
                  <LiveTradeCard
                    key={trade.id}
                    trade={trade}
                    onViewDetails={(t) => setSelectedTrade(t)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Center Column: Stats + Loaded Trades */}
          <section className="lg:col-span-5 space-y-6">
            {/* Daily Scorecard with D/W/M Toggle */}
            <DailyScorecard
              stats={stats}
              leaderboard={leaderboard}
              isLoading={freshness.stats.isLoading}
              selectedRange={statsRange}
              onRangeChange={handleRangeChange}
            />
            {freshness.stats.error && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {freshness.stats.error}
              </div>
            )}

            {/* Loaded Trades */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[var(--text-high)]">
                Loaded Trades
                <span className="text-sm font-normal text-[var(--text-muted)] ml-2">
                  ({loadedTrades.length})
                </span>
              </h2>
              {loadedTrades.length === 0 && !freshness.trades.isLoading ? (
                <div className="p-6 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                  <p className="text-sm text-[var(--text-muted)]">
                    No loaded setups—active trades will appear here first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {loadedTrades.map((trade) => (
                    <LiveTradeCard
                      key={trade.id}
                      trade={trade}
                      compact
                      onViewDetails={(t) => setSelectedTrade(t)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Challenges + Calendar + Premarket */}
          <section className="lg:col-span-3 space-y-6">
            {/* Challenges */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[var(--text-high)] flex items-center gap-2">
                <Trophy className="w-6 h-6 text-[var(--brand-primary)]" />
                Active Challenges
              </h2>
              {challenges.length === 0 ? (
                <div className="p-6 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                  <p className="text-sm text-[var(--text-muted)]">No active challenges</p>
                </div>
              ) : (
                challenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))
              )}
            </div>

            {/* Economic Calendar */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--text-high)] flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                This Week
              </h2>
              <div className="space-y-2">
                {economicEvents.slice(0, 5).map((event, i) => (
                  <EconomicEventCard key={i} event={event} />
                ))}
                {economicEvents.length === 0 && (
                  <div className="p-4 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                    <p className="text-xs text-[var(--text-muted)]">No major events this week</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pre-Market Video */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--text-high)] flex items-center gap-2">
                <Play className="w-5 h-5" />
                Pre-Market
              </h2>
              {premarketVideo?.available ? (
                <div className="space-y-2">
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
                  <p className="text-xs text-[var(--text-faint)]">
                    {formatPublishedDate(premarketVideo.publishedAt!)}
                  </p>
                </div>
              ) : (
                <div className="p-6 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                  <p className="text-xs text-[var(--text-muted)]">
                    Pre-market analysis posted daily by 9am ET
                  </p>
                </div>
              )}
            </div>

            {/* Upcoming Earnings */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--text-high)]">Earnings</h2>
              <div className="space-y-2">
                {earnings.slice(0, 6).map((event, i) => (
                  <EarningsCard key={i} event={event} />
                ))}
                {earnings.length === 0 && (
                  <div className="p-4 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                    <p className="text-xs text-[var(--text-muted)]">No earnings this week</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Fixed CTA Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
          className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--bg-base)] font-bold shadow-glow-lg animate-pulse"
        >
          <ExternalLink className="w-5 h-5 mr-2" />
          Join Discord
        </Button>
      </div>

      {/* Trade Detail Modal */}
      <TradeDetailModal
        trade={selectedTrade}
        isOpen={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
      />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ChallengeCard({ challenge }: { challenge: PublicChallenge }) {
  const currentPnl = challenge.current_pnl ?? 0;
  const targetGain = challenge.target_balance - challenge.starting_balance;
  const progress = challenge.progress_percent ?? 0;
  const daysLeft = challenge.days_remaining ?? 0;
  const isProfit = currentPnl >= 0;

  return (
    <div className="p-4 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-[var(--text-high)]">{challenge.name}</h3>
        {challenge.scope === "honeydrip-wide" && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
            HD
          </span>
        )}
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span
            className={cn(
              "font-mono",
              isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {isProfit ? "+" : ""}${currentPnl.toFixed(0)}
          </span>
          <span className="text-[var(--text-muted)]">/ ${targetGain.toFixed(0)} goal</span>
        </div>
        <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              progress >= 100 ? "bg-[var(--accent-positive)]" : "bg-[var(--brand-primary)]"
            )}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-[var(--text-faint)]">
        {daysLeft > 0 ? `${daysLeft} days remaining` : "Challenge ended"}
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
          {event.impact === "HIGH" || event.impact === "CRITICAL" ? "🔴" : "🟡"}
        </span>
      </div>
      <p className="text-xs text-[var(--text-faint)] mt-1">
        {event.datetime.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

function EarningsCard({ event }: { event: EarningsEvent }) {
  return (
    <div className="p-2 bg-[var(--surface-1)] rounded border border-[var(--border-hairline)]">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[var(--text-high)]">{event.symbol}</span>
        <span className="text-xs text-[var(--text-muted)]">
          {event.datetime.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
      {event.estimate && (
        <p className="text-xs text-[var(--text-faint)] mt-1">Est: ${event.estimate}</p>
      )}
    </div>
  );
}

export default PublicPortal;
