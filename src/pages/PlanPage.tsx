"use client";

/**
 * PlanPage - Mission Playbook for Day Traders
 *
 * Replaces the Radar tab with an action-oriented planning interface.
 *
 * Two modes:
 * - Session Mode (market hours): Real-time strategy status per symbol
 * - Playbook Mode (off-hours): Pre-planned setups with decision trees
 *
 * Key features:
 * - Letter grades (A+/A/B/C) instead of 0-100 scores
 * - Per-symbol strategy breakdown (ACTIVE/FORMING/WAITING)
 * - Pre-calculated trigger levels for market open
 * - Bull/Bear/Neutral cases for each setup
 */

import { Suspense, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/layouts/AppLayout";
import { SymbolStrategyRow } from "../components/plan/SymbolStrategyRow";
import { HDWeeklyCalendar } from "../components/hd/dashboard/HDWeeklyCalendar";
import { HDEconomicEventWarning } from "../components/hd/dashboard/HDEconomicEventWarning";
import { useAuth } from "../contexts/AuthContext";
import { useMarketSession } from "../hooks/useMarketSession";
import { useCompositeSignals } from "../hooks/useCompositeSignals";
import { useSetupGradingBatch } from "../hooks/useSetupGrading";
import { useMarketStore } from "../stores";
import { cn } from "../lib/utils";
import {
  ClipboardList,
  Activity,
  Moon,
  Sun,
  Minus,
  Calendar,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { CompositeSignal } from "../lib/composite/CompositeSignal";

/**
 * Get the last trading session date (Friday if weekend, yesterday if weekday)
 */
function getLastSessionDate(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Sunday = 0, Saturday = 6
  if (dayOfWeek === 0) {
    // Sunday: go back 2 days to Friday
    return new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  } else if (dayOfWeek === 6) {
    // Saturday: go back 1 day to Friday
    return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  } else {
    // Weekday: go back 1 day
    return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Format date for display (e.g., "Friday, Nov 29")
 */
function formatSessionDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

type PlanMode = "auto" | "session" | "playbook";

export default function PlanPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";
  const { session, loading: sessionLoading } = useMarketSession();
  const [mode, setMode] = useState<PlanMode>("auto");

  // Get watchlist symbols
  const watchlist = useMarketStore((s) => s.watchlist);
  const watchlistSymbols = useMemo(() => watchlist.map((t) => t.symbol), [watchlist]);

  // Determine effective mode early so we can use it for data fetching
  const isOffHours = session === "CLOSED" || session === "PRE" || session === "POST";
  const effectiveMode = mode === "auto" ? (isOffHours ? "playbook" : "session") : mode;

  // Get last session date for weekend display
  const lastSessionDate = useMemo(() => getLastSessionDate(), []);
  const lastSessionDateFormatted = useMemo(
    () => formatSessionDate(lastSessionDate),
    [lastSessionDate]
  );

  // Calculate date range for fetching signals
  // In playbook mode (off-hours): fetch signals from last 3 days to get Friday's signals
  const fromDate = useMemo(() => {
    if (effectiveMode === "playbook") {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);
      return threeDaysAgo;
    }
    return undefined;
  }, [effectiveMode]);

  // Load composite signals
  // In playbook mode: fetch all signals (including expired) from last 3 days
  // In session mode: only fetch ACTIVE signals
  const {
    signals: allSignals,
    activeSignals,
    loading: signalsLoading,
  } = useCompositeSignals({
    userId,
    autoSubscribe: true,
    filters:
      effectiveMode === "playbook"
        ? {
            status: ["ACTIVE", "EXPIRED"], // Include expired for weekend review
            fromDate,
          }
        : undefined, // Default behavior for session mode
  });

  // In playbook mode, use all signals (including expired); in session mode, only active
  const signalsToDisplay = effectiveMode === "playbook" ? allSignals : activeSignals;

  // Grade all signals
  const gradedSignals = useSetupGradingBatch(signalsToDisplay);

  // Group signals by symbol
  const signalsBySymbol = useMemo(() => {
    const grouped: Record<string, CompositeSignal[]> = {};

    // Initialize with all watchlist symbols
    for (const symbol of watchlistSymbols) {
      grouped[symbol] = [];
    }

    // Add signals to their symbols
    for (const signal of signalsToDisplay) {
      if (!grouped[signal.symbol]) {
        grouped[signal.symbol] = [];
      }
      grouped[signal.symbol].push(signal);
    }

    return grouped;
  }, [signalsToDisplay, watchlistSymbols]);

  // Get symbols with signals (sorted by number of active signals)
  const symbolsWithSignals = useMemo(() => {
    return Object.entries(signalsBySymbol)
      .map(([symbol, signals]) => ({
        symbol,
        signals,
        activeCount: signals.filter((s) => s.status === "ACTIVE").length,
      }))
      .sort((a, b) => b.activeCount - a.activeCount);
  }, [signalsBySymbol]);

  // Count by tier
  const tierCounts = useMemo(() => {
    const counts = { aTier: 0, bTier: 0, cTier: 0 };
    for (const { grading } of gradedSignals) {
      if (grading.tier <= 3) counts.aTier++;
      else if (grading.tier <= 5) counts.bTier++;
      else counts.cTier++;
    }
    return counts;
  }, [gradedSignals]);

  // Handle strategy click - navigate to trading workspace
  const handleStrategyClick = (signal: CompositeSignal) => {
    // Navigate to live tab with this symbol/signal context
    navigate(`/?symbol=${signal.symbol}&signal=${signal.id}`);
  };

  const isLoading = sessionLoading || signalsLoading;

  return (
    <AppLayout>
      <Suspense fallback={<PlanLoading />}>
        <div className="p-4 max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-[var(--brand-primary)]" />
              <div>
                <h1 className="text-xl font-bold text-[var(--text-high)]">Plan</h1>
                <p className="text-sm text-[var(--text-muted)]">
                  {effectiveMode === "session"
                    ? "Live strategy status per symbol"
                    : "Pre-planned setups for next session"}
                </p>
              </div>
            </div>

            {/* Mode Toggle */}
            <ModeToggle mode={mode} setMode={setMode} isOffHours={isOffHours} session={session} />
          </div>

          {/* Signal Summary Bar */}
          {!isLoading && signalsToDisplay.length > 0 && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">
                  {effectiveMode === "playbook" ? "Setups from Last Session:" : "Active Signals:"}
                </span>
                <span className="font-bold text-[var(--text-high)]">{signalsToDisplay.length}</span>
              </div>

              {/* Last session date (playbook mode) */}
              {effectiveMode === "playbook" && (
                <>
                  <div className="h-4 w-px bg-[var(--border-hairline)]" />
                  <div className="flex items-center gap-1.5 text-purple-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{lastSessionDateFormatted}</span>
                  </div>
                </>
              )}

              <div className="h-4 w-px bg-[var(--border-hairline)]" />

              {/* Grade breakdown */}
              <div className="flex items-center gap-3">
                {tierCounts.aTier > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500/20 text-green-400">
                      A
                    </span>
                    <span className="text-sm text-[var(--text-high)]">{tierCounts.aTier}</span>
                  </div>
                )}
                {tierCounts.bTier > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-500/20 text-yellow-400">
                      B
                    </span>
                    <span className="text-sm text-[var(--text-high)]">{tierCounts.bTier}</span>
                  </div>
                )}
                {tierCounts.cTier > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-500/20 text-zinc-400">
                      C
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">{tierCounts.cTier}</span>
                  </div>
                )}
              </div>

              <div className="flex-1" />

              {/* Session bias indicator */}
              <SessionBiasIndicator session={session} />
            </div>
          )}

          {/* Upcoming Events Banner */}
          <HDEconomicEventWarning compact />

          {/* Content */}
          {isLoading ? (
            <PlanLoading />
          ) : effectiveMode === "session" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Main content - symbol strategy rows */}
              <div className="lg:col-span-8">
                <div className="rounded-lg border border-[var(--border-hairline)] overflow-hidden bg-[var(--surface-1)]">
                  {/* Section header */}
                  <div className="px-4 py-3 bg-[var(--brand-primary)]">
                    <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                      Session Strategy Status
                    </h2>
                  </div>

                  {/* Symbol rows */}
                  {symbolsWithSignals.length > 0 ? (
                    symbolsWithSignals.map(({ symbol, signals }) => (
                      <SymbolStrategyRow
                        key={symbol}
                        symbol={symbol}
                        signals={signals}
                        onStrategyClick={handleStrategyClick}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-[var(--text-muted)]">
                        No signals detected. Add symbols to your watchlist or wait for setups to
                        form.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-4 space-y-4">
                {/* Top A+ Setups */}
                {tierCounts.aTier > 0 && (
                  <div className="rounded-lg border border-[var(--border-hairline)] overflow-hidden bg-[var(--surface-1)]">
                    <div className="px-4 py-3 bg-green-500/20 border-b border-[var(--border-hairline)]">
                      <h3 className="text-sm font-bold text-green-400 uppercase tracking-wide">
                        A-Tier Setups ({tierCounts.aTier})
                      </h3>
                    </div>
                    <div className="p-3 space-y-2">
                      {gradedSignals
                        .filter((g) => g.grading.tier <= 3)
                        .slice(0, 5)
                        .map(({ signal, grading }) => (
                          <button
                            key={signal.id}
                            onClick={() => handleStrategyClick(signal)}
                            className="w-full flex items-center justify-between p-2 rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 text-[10px] font-bold rounded",
                                  grading.bgColor,
                                  grading.color
                                )}
                              >
                                {grading.grade}
                              </span>
                              <span className="text-sm font-medium text-[var(--text-high)]">
                                {signal.symbol}
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {signal.direction === "LONG" ? "↑" : "↓"}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-[var(--text-muted)]">
                              R:R {signal.riskReward?.toFixed(1) ?? "-"}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Weekly Calendar */}
                <HDWeeklyCalendar maxEvents={6} />
              </div>
            </div>
          ) : (
            /* Playbook Mode - Show setup tiers */
            <PlaybookView
              gradedSignals={gradedSignals}
              onStrategyClick={handleStrategyClick}
              tierCounts={tierCounts}
              lastSessionDate={lastSessionDateFormatted}
              hasNoSignals={signalsToDisplay.length === 0}
            />
          )}
        </div>
      </Suspense>
    </AppLayout>
  );
}

// Playbook view for off-hours
function PlaybookView({
  gradedSignals,
  onStrategyClick,
  tierCounts,
  lastSessionDate,
  hasNoSignals,
}: {
  gradedSignals: Array<{ signal: CompositeSignal; grading: any }>;
  onStrategyClick: (signal: CompositeSignal) => void;
  tierCounts: { aTier: number; bTier: number; cTier: number };
  lastSessionDate: string;
  hasNoSignals: boolean;
}) {
  // Show empty state when no signals found
  if (hasNoSignals) {
    return (
      <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] p-8">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Moon className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-high)] mb-2">
            No Signals from Last Session
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            The composite scanner didn't detect any setups during the {lastSessionDate} session, or
            signals have expired.
          </p>

          {/* What to do next */}
          <div className="bg-[var(--surface-2)] rounded-lg p-4 text-left space-y-3">
            <h4 className="text-sm font-medium text-[var(--text-high)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Prep for Next Session
            </h4>
            <ul className="text-xs text-[var(--text-muted)] space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span>Review your watchlist for Monday's potential setups</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <span>Check the Weekly Calendar for economic events</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span>Mark key support/resistance levels on your charts</span>
              </li>
            </ul>
          </div>

          <p className="text-xs text-[var(--text-muted)] mt-4">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Signals are generated during market hours (9:30am - 4:00pm ET)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* A-Tier Column */}
      <div className="rounded-lg border border-[var(--border-hairline)] overflow-hidden bg-[var(--surface-1)]">
        <div className="px-4 py-3 bg-green-500/20 border-b border-[var(--border-hairline)]">
          <h3 className="text-sm font-bold text-green-400 uppercase tracking-wide">
            A-Tier ({tierCounts.aTier})
          </h3>
          <p className="text-xs text-green-400/70 mt-0.5">Size Up / Full Size</p>
        </div>
        <div className="p-3 space-y-2">
          {gradedSignals
            .filter((g) => g.grading.tier <= 3)
            .map(({ signal, grading }) => (
              <SetupCardCompact
                key={signal.id}
                signal={signal}
                grading={grading}
                onClick={() => onStrategyClick(signal)}
              />
            ))}
          {tierCounts.aTier === 0 && (
            <p className="text-sm text-[var(--text-muted)] italic text-center py-4">
              No A-tier setups
            </p>
          )}
        </div>
      </div>

      {/* B-Tier Column */}
      <div className="rounded-lg border border-[var(--border-hairline)] overflow-hidden bg-[var(--surface-1)]">
        <div className="px-4 py-3 bg-yellow-500/20 border-b border-[var(--border-hairline)]">
          <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-wide">
            B-Tier ({tierCounts.bTier})
          </h3>
          <p className="text-xs text-yellow-400/70 mt-0.5">Reduced / Small</p>
        </div>
        <div className="p-3 space-y-2">
          {gradedSignals
            .filter((g) => g.grading.tier === 4 || g.grading.tier === 5)
            .map(({ signal, grading }) => (
              <SetupCardCompact
                key={signal.id}
                signal={signal}
                grading={grading}
                onClick={() => onStrategyClick(signal)}
              />
            ))}
          {tierCounts.bTier === 0 && (
            <p className="text-sm text-[var(--text-muted)] italic text-center py-4">
              No B-tier setups
            </p>
          )}
        </div>
      </div>

      {/* C-Tier / Skip Column */}
      <div className="rounded-lg border border-[var(--border-hairline)] overflow-hidden bg-[var(--surface-1)]">
        <div className="px-4 py-3 bg-zinc-500/20 border-b border-[var(--border-hairline)]">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
            Skip ({tierCounts.cTier})
          </h3>
          <p className="text-xs text-zinc-400/70 mt-0.5">Insufficient confluence</p>
        </div>
        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
          {gradedSignals
            .filter((g) => g.grading.tier === 6)
            .map(({ signal, grading }) => (
              <SetupCardCompact
                key={signal.id}
                signal={signal}
                grading={grading}
                onClick={() => onStrategyClick(signal)}
                muted
              />
            ))}
          {tierCounts.cTier === 0 && (
            <p className="text-sm text-[var(--text-muted)] italic text-center py-4">
              No C-tier setups
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact setup card for tier lists
function SetupCardCompact({
  signal,
  grading,
  onClick,
  muted = false,
}: {
  signal: CompositeSignal;
  grading: any;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left",
        muted
          ? "bg-[var(--surface-2)] opacity-50 hover:opacity-70"
          : "bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "px-1.5 py-0.5 text-[10px] font-bold rounded",
            grading.bgColor,
            grading.color
          )}
        >
          {grading.grade}
        </span>
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-[var(--text-high)]">{signal.symbol}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {signal.direction === "LONG" ? "↑" : "↓"}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono">
            Entry: ${signal.entryPrice?.toFixed(2) ?? "-"}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs font-mono text-[var(--text-muted)]">
          R:R {signal.riskReward?.toFixed(1) ?? "-"}
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">{grading.sizeLabel}</div>
      </div>
    </button>
  );
}

// Session bias indicator
function SessionBiasIndicator({ session }: { session: string }) {
  // Simple bias based on session
  // In production, this would use ES futures, VIX, etc.
  const bias = session === "OPEN" ? "neutral" : "prep";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-muted)]">Bias:</span>
      {bias === "neutral" ? (
        <div className="flex items-center gap-1 text-zinc-400">
          <Minus className="w-3 h-3" />
          <span className="text-xs font-medium">Neutral</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-purple-400">
          <Moon className="w-3 h-3" />
          <span className="text-xs font-medium">Prep Mode</span>
        </div>
      )}
    </div>
  );
}

// Mode toggle component
function ModeToggle({
  mode,
  setMode,
  isOffHours,
  session,
}: {
  mode: PlanMode;
  setMode: (mode: PlanMode) => void;
  isOffHours: boolean;
  session: string;
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
      <button
        onClick={() => setMode("auto")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors",
          mode === "auto"
            ? "bg-[var(--brand-primary)] text-black"
            : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
        )}
        title="Auto-switch based on market hours"
      >
        <Activity className="w-4 h-4" />
        Auto
      </button>
      <button
        onClick={() => setMode("session")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors",
          mode === "session"
            ? "bg-green-500 text-white"
            : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
        )}
        title="Live session view"
      >
        <Sun className="w-4 h-4" />
        Session
      </button>
      <button
        onClick={() => setMode("playbook")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors",
          mode === "playbook"
            ? "bg-purple-500 text-white"
            : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
        )}
        title="Playbook prep view"
      >
        <Moon className="w-4 h-4" />
        Playbook
      </button>

      {/* Session indicator */}
      <div
        className={cn(
          "ml-2 px-2 py-1 rounded text-xs font-bold",
          session === "OPEN" && "bg-green-500/20 text-green-400",
          session === "PRE" && "bg-yellow-500/20 text-yellow-400",
          session === "POST" && "bg-blue-500/20 text-blue-400",
          session === "CLOSED" && "bg-red-500/20 text-red-400"
        )}
      >
        {session}
      </div>
    </div>
  );
}

// Loading state
function PlanLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--text-muted)]">Loading plan...</p>
      </div>
    </div>
  );
}
