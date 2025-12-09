/**
 * PublicPortal.tsx - Public-facing engagement page
 *
 * High-energy showcase of real-time admin trades, challenges, pre-market analysis,
 * and economic calendar to drive Discord membership signups.
 *
 * No authentication required.
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
} from "../lib/youtube/client";
import {
  fetchEconomicCalendar,
  fetchEarningsCalendar,
  type EconomicEvent,
  type EarningsEvent,
} from "../lib/calendar/EconomicCalendar";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Types - matching actual database schema
interface PublicTrade {
  id: string;
  ticker: string;
  contract: {
    strike?: number;
    type?: "C" | "P";
    expiry?: string;
  } | null;
  trade_type: string;
  state: string;
  entry_price: number | null;
  current_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  public_comment: string | null;
  admin_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Challenge {
  id: string;
  name: string;
  target_amount: number;
  current_pnl: number;
  start_date: string;
  end_date: string;
}

export function PublicPortal() {
  const { isMember, setIsMember } = useMemberStatus();
  const DISCORD_INVITE_URL = import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/honeydrip";

  // State
  const [activeTrades, setActiveTrades] = useState<PublicTrade[]>([]);
  const [loadedTrades, setLoadedTrades] = useState<PublicTrade[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [premarketVideo, setPremarketVideo] = useState<PremarketVideo | null>(null);
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch public trades
  const fetchPublicTrades = async () => {
    try {
      const { data, error } = await supabase
        .from("trades")
        .select("id, ticker, contract, trade_type, state, entry_price, current_price, target_price, stop_loss, public_comment, admin_name, created_at, updated_at")
        .eq("show_on_public", true)
        .in("state", ["ENTERED", "LOADED"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const entered = data?.filter((t) => t.state === "ENTERED") || [];
      const loaded = data?.filter((t) => t.state === "LOADED") || [];

      setActiveTrades(entered as PublicTrade[]);
      setLoadedTrades(loaded as PublicTrade[]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("[v0] Error fetching public trades:", error);
    }
  };

  // Fetch active challenges
  const fetchChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("is_active", true)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChallenges(data || []);
    } catch (error) {
      console.error("[v0] Error fetching challenges:", error);
    }
  };

  // Fetch pre-market video
  const fetchPremarket = async () => {
    const video = await fetchLatestPremarket();
    setPremarketVideo(video);
  };

  // Fetch calendar data
  const fetchCalendarData = async () => {
    try {
      // Get current week date range
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7); // Next Sunday

      const [econ, earn] = await Promise.all([
        fetchEconomicCalendar(startOfWeek, endOfWeek),
        fetchEarningsCalendar(now, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
      ]);

      // Filter medium+ impact events for current week
      const highImpactEvents = econ.filter((e) =>
        ["medium", "high"].includes(e.impact.toLowerCase())
      );
      setEconomicEvents(highImpactEvents.slice(0, 10));

      // Get next 3 days of earnings
      const upcomingEarnings = earn.slice(0, 8);
      setEarnings(upcomingEarnings);
    } catch (error) {
      console.error("[v0] Error fetching calendar data:", error);
    }
  };

  // Setup real-time subscription
  useEffect(() => {
    // Initial fetch
    fetchPublicTrades();
    fetchChallenges();
    fetchPremarket();
    fetchCalendarData();

    // Setup subscription for trades
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
          fetchPublicTrades();
        }
      )
      .subscribe();

    // Refresh calendar every 30 minutes
    const calendarInterval = setInterval(fetchCalendarData, 30 * 60 * 1000);

    // Refresh pre-market every 15 minutes
    const premarketInterval = setInterval(fetchPremarket, 15 * 60 * 1000);

    return () => {
      tradesChannel.unsubscribe();
      clearInterval(calendarInterval);
      clearInterval(premarketInterval);
    };
  }, []);

  // Check staleness (5 second threshold)
  const isStale = Date.now() - lastUpdated.getTime() > 5000;

  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

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
              size="lg"
              onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--bg-base)] font-bold text-lg px-8 py-6 shadow-glow-lg animate-pulse"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Join Discord for Live Alerts
            </Button>
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
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Staleness indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isStale ? "bg-amber-400 animate-pulse" : "bg-[var(--accent-positive)] animate-pulse"
              )}
            />
            <span className="text-sm text-[var(--text-muted)]">
              {isStale ? "Reconnecting..." : "Live"} · Last updated {getTimeSinceUpdate()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Trades - Span 4 */}
          <section className="lg:col-span-4 space-y-4">
            <h2 className="text-2xl font-bold text-[var(--text-high)] flex items-center gap-2">
              <Zap className="w-6 h-6 text-[var(--accent-positive)]" />
              Active Trades
              <span className="text-sm font-normal text-[var(--text-muted)]">
                ({activeTrades.length})
              </span>
            </h2>
            {activeTrades.length === 0 ? (
              <div className="p-8 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                <p className="text-[var(--text-muted)]">
                  No active trades right now. Check back soon!
                </p>
              </div>
            ) : (
              activeTrades.map((trade) => <PublicTradeCard key={trade.id} trade={trade} />)
            )}
          </section>

          {/* Loaded Trades - Span 3 */}
          <section className="lg:col-span-3 space-y-4">
            <h2 className="text-2xl font-bold text-[var(--text-high)]">
              Queued Setups
              <span className="text-sm font-normal text-[var(--text-muted)] ml-2">
                ({loadedTrades.length})
              </span>
            </h2>
            {loadedTrades.length === 0 ? (
              <div className="p-6 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                <p className="text-sm text-[var(--text-muted)]">No queued setups</p>
              </div>
            ) : (
              loadedTrades.map((trade) => <LoadedTradeCard key={trade.id} trade={trade} />)
            )}
          </section>

          {/* Challenges + Calendar - Span 3 */}
          <section className="lg:col-span-3 space-y-6">
            {/* Challenges */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[var(--text-high)]">Active Challenges</h2>
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
              </div>
            </div>
          </section>

          {/* Pre-Market + Earnings - Span 2 */}
          <section className="lg:col-span-2 space-y-6">
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
    </div>
  );
}

// Trade card components
function PublicTradeCard({ trade }: { trade: PublicTrade }) {
  const entryPrice = trade.entry_price ?? 0;
  const currentPrice = trade.current_price ?? entryPrice; // Fall back to entry if no current
  const strike = trade.contract?.strike ?? 0;
  const contractType = trade.contract?.type === "C" ? "CALL" : trade.contract?.type === "P" ? "PUT" : "";
  const pnl = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  const pnlColor = pnl >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]";

  return (
    <div className="p-4 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] hover:scale-[1.02] transition-transform">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xl font-bold text-[var(--text-high)]">{trade.ticker}</h3>
          <p className="text-sm text-[var(--text-muted)]">
            ${strike} {contractType}
          </p>
          {trade.admin_name && (
            <p className="text-xs text-[var(--text-faint)]">by {trade.admin_name}</p>
          )}
        </div>
        <div className={cn("text-right", pnlColor)}>
          <p className="text-3xl font-bold font-mono">
            {pnl >= 0 ? "+" : ""}
            {pnl.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-[var(--text-faint)]">Entry:</span>
          <span className="ml-1 font-mono text-[var(--text-high)]">
            ${entryPrice.toFixed(2)}
          </span>
        </div>
        {trade.target_price && (
          <div>
            <span className="text-[var(--text-faint)]">Target:</span>
            <span className="ml-1 font-mono text-[var(--accent-positive)]">
              ${trade.target_price.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {trade.public_comment && (
        <div className="mt-3 p-3 bg-[var(--surface-2)] rounded border-l-2 border-[var(--brand-primary)]">
          <p className="text-sm text-[var(--text-muted)] italic">{trade.public_comment}</p>
        </div>
      )}
    </div>
  );
}

function LoadedTradeCard({ trade }: { trade: PublicTrade }) {
  const strike = trade.contract?.strike ?? 0;
  const contractType = trade.contract?.type === "C" ? "CALL" : trade.contract?.type === "P" ? "PUT" : "";
  return (
    <div className="p-3 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
      <h4 className="font-bold text-[var(--text-high)]">{trade.ticker}</h4>
      <p className="text-xs text-[var(--text-muted)]">
        ${strike} {contractType}
      </p>
      {trade.admin_name && (
        <p className="text-xs text-[var(--text-faint)]">by {trade.admin_name}</p>
      )}
      {trade.public_comment && (
        <p className="text-xs text-[var(--text-muted)] mt-2 italic line-clamp-2">
          {trade.public_comment}
        </p>
      )}
    </div>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const currentPnl = challenge.current_pnl ?? 0;
  const targetAmount = challenge.target_amount ?? 0;
  const progress = targetAmount > 0 ? (currentPnl / targetAmount) * 100 : 0;
  const daysLeft = Math.ceil(
    (new Date(challenge.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="p-4 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
      <h3 className="font-bold text-[var(--text-high)] mb-2">{challenge.name}</h3>
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--text-muted)]">${currentPnl.toFixed(0)}</span>
          <span className="text-[var(--text-muted)]">${targetAmount.toFixed(0)}</span>
        </div>
        <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent-positive)] transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-[var(--text-faint)]">{daysLeft} days remaining</p>
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
          {event.datetime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
      {event.estimate && (
        <p className="text-xs text-[var(--text-faint)] mt-1">Est: ${event.estimate}</p>
      )}
    </div>
  );
}

export default PublicPortal;
