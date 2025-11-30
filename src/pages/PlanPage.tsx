"use client";

/**
 * PlanPage - Mission Playbook for Day Traders
 *
 * Two modes:
 * - Session Mode (market hours): Real-time strategy status per symbol
 * - Playbook Mode (off-hours): Analyze current market, generate Monday setups
 *
 * Key features:
 * - Uses useOffHoursData to analyze watchlist symbols
 * - Shows key levels (PDH/PDL, Week H/L, VWAP, pivots)
 * - Generates setup scenarios (breakout, breakdown, bounce)
 * - Countdown to next market session
 */

import { Suspense, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/layouts/AppLayout";
import { SymbolStrategyRow } from "../components/plan/SymbolStrategyRow";
import { HDWeeklyCalendar } from "../components/hd/dashboard/HDWeeklyCalendar";
import { HDEconomicEventWarning } from "../components/hd/dashboard/HDEconomicEventWarning";
import { useAuth } from "../contexts/AuthContext";
import { useMarketSession } from "../hooks/useMarketSession";
import {
  useOffHoursData,
  type SetupScenario,
  type SymbolKeyLevels,
} from "../hooks/useOffHoursData";
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
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { CompositeSignal } from "../lib/composite/CompositeSignal";

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

  // Determine effective mode
  const isOffHours = session === "CLOSED" || session === "PRE" || session === "POST";
  const effectiveMode = mode === "auto" ? (isOffHours ? "playbook" : "session") : mode;

  // Off-hours data for playbook mode (key levels, setup scenarios)
  const {
    futures,
    keyLevelsBySymbol,
    setupScenarios,
    countdown,
    loading: offHoursLoading,
    error: offHoursError,
    refresh: refreshOffHours,
  } = useOffHoursData();

  // Composite signals for session mode
  const {
    signals: allSignals,
    activeSignals,
    loading: signalsLoading,
  } = useCompositeSignals({
    userId,
    autoSubscribe: true,
  });

  const signalsToDisplay = effectiveMode === "session" ? activeSignals : [];
  const gradedSignals = useSetupGradingBatch(signalsToDisplay);

  // Group signals by symbol for session mode
  const signalsBySymbol = useMemo(() => {
    const grouped: Record<string, CompositeSignal[]> = {};
    for (const symbol of watchlistSymbols) {
      grouped[symbol] = [];
    }
    for (const signal of signalsToDisplay) {
      if (!grouped[signal.symbol]) {
        grouped[signal.symbol] = [];
      }
      grouped[signal.symbol].push(signal);
    }
    return grouped;
  }, [signalsToDisplay, watchlistSymbols]);

  const symbolsWithSignals = useMemo(() => {
    return Object.entries(signalsBySymbol)
      .map(([symbol, signals]) => ({
        symbol,
        signals,
        activeCount: signals.filter((s) => s.status === "ACTIVE").length,
      }))
      .sort((a, b) => b.activeCount - a.activeCount);
  }, [signalsBySymbol]);

  const tierCounts = useMemo(() => {
    const counts = { aTier: 0, bTier: 0, cTier: 0 };
    for (const { grading } of gradedSignals) {
      if (grading.tier <= 3) counts.aTier++;
      else if (grading.tier <= 5) counts.bTier++;
      else counts.cTier++;
    }
    return counts;
  }, [gradedSignals]);

  const handleStrategyClick = (signal: CompositeSignal) => {
    navigate(`/?symbol=${signal.symbol}&signal=${signal.id}`);
  };

  const handleSymbolClick = (symbol: string) => {
    navigate(`/?symbol=${symbol}`);
  };

  const isLoading =
    sessionLoading || (effectiveMode === "playbook" ? offHoursLoading : signalsLoading);

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
                    : "Analyze market & prep for next session"}
                </p>
              </div>
            </div>

            {/* Mode Toggle */}
            <ModeToggle mode={mode} setMode={setMode} isOffHours={isOffHours} session={session} />
          </div>

          {/* Upcoming Events Banner */}
          <HDEconomicEventWarning compact />

          {/* Content */}
          {isLoading ? (
            <PlanLoading />
          ) : effectiveMode === "session" ? (
            /* Session Mode - Live signals */
            <SessionView
              symbolsWithSignals={symbolsWithSignals}
              gradedSignals={gradedSignals}
              tierCounts={tierCounts}
              onStrategyClick={handleStrategyClick}
            />
          ) : (
            /* Playbook Mode - Weekend Analysis */
            <PlaybookView
              futures={futures}
              keyLevelsBySymbol={keyLevelsBySymbol}
              setupScenarios={setupScenarios}
              countdown={countdown}
              error={offHoursError}
              onRefresh={refreshOffHours}
              onSymbolClick={handleSymbolClick}
            />
          )}
        </div>
      </Suspense>
    </AppLayout>
  );
}

// Session view for market hours
function SessionView({
  symbolsWithSignals,
  gradedSignals,
  tierCounts,
  onStrategyClick,
}: {
  symbolsWithSignals: Array<{ symbol: string; signals: CompositeSignal[]; activeCount: number }>;
  gradedSignals: Array<{ signal: CompositeSignal; grading: any }>;
  tierCounts: { aTier: number; bTier: number; cTier: number };
  onStrategyClick: (signal: CompositeSignal) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-8">
        <div className="rounded-lg border border-[var(--border-hairline)] overflow-hidden bg-[var(--surface-1)]">
          <div className="px-4 py-3 bg-[var(--brand-primary)]">
            <h2 className="text-sm font-bold text-black uppercase tracking-wide">
              Session Strategy Status
            </h2>
          </div>
          {symbolsWithSignals.length > 0 ? (
            symbolsWithSignals.map(({ symbol, signals }) => (
              <SymbolStrategyRow
                key={symbol}
                symbol={symbol}
                signals={signals}
                onStrategyClick={onStrategyClick}
              />
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-[var(--text-muted)]">
                No signals detected. Add symbols to your watchlist or wait for setups to form.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-4 space-y-4">
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
                    onClick={() => onStrategyClick(signal)}
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
        <HDWeeklyCalendar maxEvents={6} />
      </div>
    </div>
  );
}

// Playbook view for off-hours - THIS IS THE KEY CHANGE
function PlaybookView({
  futures,
  keyLevelsBySymbol,
  setupScenarios,
  countdown,
  error,
  onRefresh,
  onSymbolClick,
}: {
  futures: any;
  keyLevelsBySymbol: Map<string, SymbolKeyLevels>;
  setupScenarios: SetupScenario[];
  countdown: { nextSessionLabel: string; timeRemaining: string };
  error: string | null;
  onRefresh: () => void;
  onSymbolClick: (symbol: string) => void;
}) {
  // Group scenarios by confidence
  const highConfidence = setupScenarios.filter((s) => s.confidence === "high");
  const mediumConfidence = setupScenarios.filter((s) => s.confidence === "medium");
  const lowConfidence = setupScenarios.filter((s) => s.confidence === "low");

  const hasData = keyLevelsBySymbol.size > 0;

  return (
    <div className="space-y-6">
      {/* Market Status Bar */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-purple-400" />
          <div>
            <div className="text-sm font-medium text-[var(--text-high)]">
              {countdown.nextSessionLabel}
            </div>
            <div className="text-lg font-bold text-purple-400 font-mono">
              {countdown.timeRemaining}
            </div>
          </div>
        </div>

        <div className="h-10 w-px bg-[var(--border-hairline)]" />

        {/* Futures snapshot */}
        {futures && (
          <>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs text-[var(--text-muted)]">ES</div>
                <div
                  className={cn(
                    "text-sm font-bold",
                    futures.es.change >= 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {futures.es.change >= 0 ? "+" : ""}
                  {futures.es.changePercent.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">NQ</div>
                <div
                  className={cn(
                    "text-sm font-bold",
                    futures.nq.change >= 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {futures.nq.change >= 0 ? "+" : ""}
                  {futures.nq.changePercent.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">VIX</div>
                <div
                  className={cn(
                    "text-sm font-bold",
                    futures.vix.level === "low"
                      ? "text-green-400"
                      : futures.vix.level === "normal"
                        ? "text-yellow-400"
                        : futures.vix.level === "elevated"
                          ? "text-orange-400"
                          : "text-red-400"
                  )}
                >
                  {futures.vix.value.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="h-10 w-px bg-[var(--border-hairline)]" />
          </>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">
            {keyLevelsBySymbol.size} symbols analyzed
          </span>
          <span className="text-[var(--brand-primary)]">•</span>
          <span className="text-sm text-[var(--text-muted)]">
            {setupScenarios.length} setups found
          </span>
        </div>

        <div className="flex-1" />

        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors text-sm text-[var(--text-high)]"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* No data state */}
      {!hasData && !error && (
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] p-8">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-high)] mb-2">
              Add Symbols to Your Watchlist
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Add SPY, QQQ, or your favorite tickers to see key levels and potential setups for
              Monday.
            </p>
          </div>
        </div>
      )}

      {/* Main content grid */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Setup Scenarios */}
          <div className="lg:col-span-8 space-y-4">
            {/* High Confidence Setups */}
            <SetupTierCard
              title="High Confidence Setups"
              subtitle="Strong technical confluence"
              scenarios={highConfidence}
              color="green"
              onSymbolClick={onSymbolClick}
            />

            {/* Medium Confidence */}
            <SetupTierCard
              title="Medium Confidence"
              subtitle="Watch for confirmation"
              scenarios={mediumConfidence}
              color="yellow"
              onSymbolClick={onSymbolClick}
            />

            {/* Low Confidence - collapsed */}
            {lowConfidence.length > 0 && (
              <SetupTierCard
                title="Low Confidence"
                subtitle="Needs more confluence"
                scenarios={lowConfidence}
                color="zinc"
                onSymbolClick={onSymbolClick}
                collapsed
              />
            )}
          </div>

          {/* Right Column - Symbol Key Levels */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-lg border border-[var(--border-hairline)] overflow-hidden bg-[var(--surface-1)]">
              <div className="px-4 py-3 bg-blue-500/20 border-b border-[var(--border-hairline)]">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wide">
                  Key Levels by Symbol
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-hairline)] max-h-[500px] overflow-y-auto">
                {Array.from(keyLevelsBySymbol.entries()).map(([symbol, data]) => (
                  <SymbolKeyLevelsCard
                    key={symbol}
                    symbol={symbol}
                    data={data}
                    onClick={() => onSymbolClick(symbol)}
                  />
                ))}
              </div>
            </div>

            <HDWeeklyCalendar maxEvents={6} />
          </div>
        </div>
      )}
    </div>
  );
}

// Setup tier card component
function SetupTierCard({
  title,
  subtitle,
  scenarios,
  color,
  onSymbolClick,
  collapsed = false,
}: {
  title: string;
  subtitle: string;
  scenarios: SetupScenario[];
  color: "green" | "yellow" | "zinc";
  onSymbolClick: (symbol: string) => void;
  collapsed?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  const colorClasses = {
    green: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/20" },
    yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/20" },
    zinc: { bg: "bg-zinc-500/20", text: "text-zinc-400", border: "border-zinc-500/20" },
  };

  const colors = colorClasses[color];

  if (scenarios.length === 0) {
    return null;
  }

  return (
    <div className={cn("rounded-lg border overflow-hidden bg-[var(--surface-1)]", colors.border)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn("w-full px-4 py-3 flex items-center justify-between", colors.bg)}
      >
        <div>
          <h3 className={cn("text-sm font-bold uppercase tracking-wide", colors.text)}>
            {title} ({scenarios.length})
          </h3>
          <p className={cn("text-xs mt-0.5 opacity-70", colors.text)}>{subtitle}</p>
        </div>
        <ChevronRight
          className={cn("w-5 h-5 transition-transform", colors.text, isExpanded && "rotate-90")}
        />
      </button>

      {isExpanded && (
        <div className="p-3 space-y-2">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onClick={() => onSymbolClick(scenario.symbol)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual scenario card
function ScenarioCard({ scenario, onClick }: { scenario: SetupScenario; onClick: () => void }) {
  const isLong = scenario.direction === "long";

  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors text-left"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-high)]">{scenario.symbol}</span>
          <span
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold",
              isLong ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}
          >
            {isLong ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {scenario.type.replace("_", " ").toUpperCase()}
          </span>
        </div>
        <div className="text-xs font-mono text-[var(--text-muted)]">
          R:R {scenario.riskReward.toFixed(1)}
        </div>
      </div>

      <div className="text-xs text-[var(--text-muted)] mb-2">
        <span className="font-medium text-[var(--text-high)]">Trigger:</span> {scenario.trigger}
      </div>

      <div className="flex items-center gap-4 text-xs font-mono">
        <div>
          <span className="text-[var(--text-muted)]">Entry:</span>{" "}
          <span className="text-[var(--text-high)]">${scenario.entry.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Stop:</span>{" "}
          <span className="text-red-400">${scenario.stop.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Target:</span>{" "}
          <span className="text-green-400">${scenario.targets[0]?.toFixed(2) ?? "-"}</span>
        </div>
      </div>
    </button>
  );
}

// Symbol key levels card
function SymbolKeyLevelsCard({
  symbol,
  data,
  onClick,
}: {
  symbol: string;
  data: SymbolKeyLevels;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 hover:bg-[var(--surface-2)] transition-colors text-left"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-high)]">{symbol}</span>
          <span
            className={cn(
              "text-xs font-medium",
              data.trend === "bullish"
                ? "text-green-400"
                : data.trend === "bearish"
                  ? "text-red-400"
                  : "text-zinc-400"
            )}
          >
            {data.trend === "bullish" ? (
              <TrendingUp className="w-3 h-3 inline" />
            ) : data.trend === "bearish" ? (
              <TrendingDown className="w-3 h-3 inline" />
            ) : null}{" "}
            {data.trend}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono text-[var(--text-high)]">
            ${data.currentPrice.toFixed(2)}
          </div>
          <div
            className={cn(
              "text-xs font-mono",
              data.changePercent >= 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {data.changePercent >= 0 ? "+" : ""}
            {data.changePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Key levels */}
      <div className="flex flex-wrap gap-1">
        {data.levels.slice(0, 4).map((level, i) => (
          <span
            key={i}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-mono",
              level.type === "resistance"
                ? "bg-red-500/10 text-red-400"
                : level.type === "support"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-blue-500/10 text-blue-400"
            )}
          >
            {level.source.split(" ")[0]}: {level.price.toFixed(2)}
          </span>
        ))}
      </div>
    </button>
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
        <p className="text-[var(--text-muted)]">Analyzing market data...</p>
      </div>
    </div>
  );
}
