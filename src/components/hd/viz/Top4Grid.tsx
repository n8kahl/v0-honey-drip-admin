/**
 * Top4Grid - 2x2 Decision Grid (Plan Spec)
 *
 * Box 1: Ticker + Price + Health (symbol-scoped)
 * Box 2: Confluence Summary (bias + confidence + top 3 drivers; expandable)
 * Box 3: Events (always visible - earnings/economic)
 * Box 4: ATR/Range/MTF with A/B/C tabs
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "../../../lib/utils";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  ExternalLink,
  BarChart3,
  Layers,
  Zap,
} from "lucide-react";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type { Candle, Indicators, MTFTrend, Timeframe } from "../../../stores/marketDataStore";
import { DecisionVizSparkline } from "./DecisionVizSparkline";
import { DecisionVizRange } from "./DecisionVizRange";
import { DecisionVizMTF } from "./DecisionVizMTF";
import { chipStyle, getScoreStyle } from "../../../ui/semantics";

// ============================================================================
// Types
// ============================================================================

export type DataHealth = "live" | "delayed" | "stale";

type VizTab = "sparkline" | "range" | "mtf";

interface EconomicEvent {
  id: string;
  name: string;
  datetime: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  affectsSymbols: string[];
}

export interface Top4GridProps {
  symbol: string;
  candles: Candle[];
  dailyCandles?: Candle[];  // Daily candles for proper ATR(14) calculation
  keyLevels: KeyLevels | null;
  indicators: Indicators;
  mtfTrend: Record<Timeframe, MTFTrend>;
  dataHealth: DataHealth;
  currentPrice: number;
  changePercent: number;
  onRetry?: () => void;
  // Confluence data (optional)
  confluenceScore?: number;
  confluenceDirection?: "LONG" | "SHORT" | "NEUTRAL";
  confluenceDrivers?: Array<{ label: string; value: string; weight?: number }>;
}

// ============================================================================
// Helper: Time until event
// ============================================================================

function getTimeUntil(eventTime: string) {
  const now = new Date();
  const event = new Date(eventTime);
  const diffMs = event.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let text: string;
  if (hours < 1) {
    text = `${minutes}m`;
  } else if (hours < 24) {
    text = `${hours}h ${minutes}m`;
  } else {
    const days = Math.floor(hours / 24);
    text = days === 1 ? "tomorrow" : `${days}d`;
  }

  return {
    hours,
    minutes,
    text,
    isImminent: hours < 1 && minutes > 0,
    isSoon: hours < 24 && hours >= 1,
  };
}

// ============================================================================
// Component
// ============================================================================

export function Top4Grid({
  symbol,
  candles,
  dailyCandles,
  keyLevels,
  indicators,
  mtfTrend,
  dataHealth,
  currentPrice,
  changePercent,
  onRetry,
  confluenceScore = 65,
  confluenceDirection = "NEUTRAL",
  confluenceDrivers,
}: Top4GridProps) {
  // Tab state for Box 4
  const [activeTab, setActiveTab] = useState<VizTab>("sparkline");

  // Events state for Box 3
  const [events, setEvents] = useState<
    Array<EconomicEvent & { timeUntil: ReturnType<typeof getTimeUntil> }>
  >([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsExpanded, setEventsExpanded] = useState(false);

  // Confluence evidence expanded state
  const [confluenceExpanded, setConfluenceExpanded] = useState(false);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const response = await fetch("/api/calendar/events?impact=CRITICAL,HIGH");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      if (!data.success || !data.events) {
        setEvents([]);
        return;
      }
      const now = new Date();
      const upcoming = (data.events as EconomicEvent[])
        .filter((event) => {
          const eventDate = new Date(event.datetime);
          const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursUntil < 0 || hoursUntil > 48) return false;
          const isRelevant =
            event.affectsSymbols?.some((s) => s.toUpperCase() === symbol.toUpperCase()) ||
            event.affectsSymbols?.includes("ALL") ||
            event.impact === "CRITICAL";
          return isRelevant;
        })
        .map((event) => ({ ...event, timeUntil: getTimeUntil(event.datetime) }))
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
      setEvents(upcoming);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Data health styling
  const healthBadge = useMemo(() => {
    switch (dataHealth) {
      case "live":
        return {
          label: "Live",
          className: "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]",
          dot: "bg-[var(--accent-positive)]",
        };
      case "delayed":
        return {
          label: "Delayed",
          className: "bg-[var(--data-stale)]/20 text-[var(--data-stale)]",
          dot: "bg-[var(--data-stale)]",
        };
      case "stale":
        return {
          label: "Stale",
          className: "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] animate-pulse",
          dot: "bg-[var(--accent-negative)]",
        };
    }
  }, [dataHealth]);

  // Confluence styling
  const confluenceStyle = useMemo(() => getScoreStyle(confluenceScore), [confluenceScore]);

  // Default confluence drivers from indicators
  const defaultDrivers = useMemo(() => {
    const drivers: Array<{ label: string; value: string }> = [];
    if (indicators.rsi14 !== undefined) {
      drivers.push({ label: "RSI(14)", value: indicators.rsi14.toFixed(0) });
    }
    if (indicators.atr14 !== undefined) {
      drivers.push({ label: "ATR(14)", value: indicators.atr14.toFixed(2) });
    }
    // MTF alignment
    const bullCount = Object.values(mtfTrend).filter((t) => t === "bull").length;
    const bearCount = Object.values(mtfTrend).filter((t) => t === "bear").length;
    drivers.push({ label: "MTF", value: `${bullCount}↑ ${bearCount}↓` });
    return drivers;
  }, [indicators, mtfTrend]);

  const displayDrivers = confluenceDrivers || defaultDrivers;

  // TradingView URL
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${symbol}`;

  return (
    <div className="grid grid-cols-2 gap-3 p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
      {/* ================================================================== */}
      {/* BOX 1: Ticker + Price + Health */}
      {/* ================================================================== */}
      <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-base)]">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[var(--text-high)] tracking-tight">
              {symbol}
            </span>
            <span
              className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", healthBadge.className)}
            >
              {healthBadge.label}
            </span>
          </div>
          <a
            href={tradingViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-faint)] hover:text-[var(--brand-primary)] transition-colors"
            title="Open in TradingView"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-[var(--text-high)] tabular-nums">
            ${currentPrice.toFixed(2)}
          </span>
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              changePercent > 0 && "text-[var(--accent-positive)]",
              changePercent < 0 && "text-[var(--accent-negative)]",
              changePercent === 0 && "text-[var(--text-muted)]"
            )}
          >
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </div>

        {/* Session info */}
        <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--text-faint)]">
          <div className={cn("w-1.5 h-1.5 rounded-full", healthBadge.dot)} />
          <span>Last update: {dataHealth === "live" ? "real-time" : dataHealth}</span>
        </div>

        {/* Key levels mini-chips */}
        {keyLevels && (
          <div className="flex flex-wrap gap-1 mt-2">
            {keyLevels.vwap && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                VWAP ${keyLevels.vwap.toFixed(2)}
              </span>
            )}
            {keyLevels.priorDayHigh && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                PDH ${keyLevels.priorDayHigh.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* BOX 2: Confluence Summary */}
      {/* ================================================================== */}
      <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-base)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Confluence
            </span>
          </div>
          <button
            onClick={() => setConfluenceExpanded(!confluenceExpanded)}
            className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
          >
            {confluenceExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Bias + Score */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1.5">
            {confluenceDirection === "LONG" && (
              <TrendingUp className="w-4 h-4 text-[var(--accent-positive)]" />
            )}
            {confluenceDirection === "SHORT" && (
              <TrendingDown className="w-4 h-4 text-[var(--accent-negative)]" />
            )}
            {confluenceDirection === "NEUTRAL" && (
              <Minus className="w-4 h-4 text-[var(--text-muted)]" />
            )}
            <span
              className={cn(
                "text-sm font-semibold",
                confluenceDirection === "LONG" && "text-[var(--accent-positive)]",
                confluenceDirection === "SHORT" && "text-[var(--accent-negative)]",
                confluenceDirection === "NEUTRAL" && "text-[var(--text-muted)]"
              )}
            >
              {confluenceDirection === "LONG"
                ? "Bullish"
                : confluenceDirection === "SHORT"
                  ? "Bearish"
                  : "Neutral"}
            </span>
          </div>
          <div
            className={cn(
              "px-2 py-0.5 rounded text-xs font-bold tabular-nums",
              confluenceStyle.bgClassName,
              confluenceStyle.className
            )}
          >
            {confluenceScore}
          </div>
        </div>

        {/* Top 3 numeric drivers as chips */}
        <div className="flex flex-wrap gap-1.5">
          {displayDrivers.slice(0, 3).map((driver, idx) => (
            <span key={idx} className={chipStyle("neutral")}>
              <span className="text-[var(--text-faint)]">{driver.label}</span>{" "}
              <span className="font-medium">{driver.value}</span>
            </span>
          ))}
        </div>

        {/* Expanded evidence */}
        {confluenceExpanded && (
          <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] animate-expand">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Evidence
            </div>
            <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
              {/* MTF Summary */}
              <div className="flex items-center justify-between">
                <span>Multi-timeframe trend</span>
                <span className="font-medium">
                  {Object.values(mtfTrend).filter((t) => t === "bull").length}/4 bullish
                </span>
              </div>
              {indicators.rsi14 !== undefined && (
                <div className="flex items-center justify-between">
                  <span>RSI(14)</span>
                  <span
                    className={cn(
                      "font-medium",
                      indicators.rsi14 >= 70 && "text-[var(--accent-negative)]",
                      indicators.rsi14 <= 30 && "text-[var(--accent-positive)]"
                    )}
                  >
                    {indicators.rsi14.toFixed(0)}{" "}
                    {indicators.rsi14 >= 70 ? "(OB)" : indicators.rsi14 <= 30 ? "(OS)" : ""}
                  </span>
                </div>
              )}
              {keyLevels?.vwap && currentPrice > 0 && (
                <div className="flex items-center justify-between">
                  <span>VWAP distance</span>
                  <span className="font-medium">
                    {(((currentPrice - keyLevels.vwap) / keyLevels.vwap) * 100).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* BOX 3: Events (Earnings / Economic) */}
      {/* ================================================================== */}
      <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-base)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Events
            </span>
            {!eventsLoading && (
              <span className="text-[10px] text-[var(--text-faint)]">{events.length}</span>
            )}
          </div>
          {events.length > 1 && (
            <button
              onClick={() => setEventsExpanded(!eventsExpanded)}
              className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
            >
              {eventsExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {eventsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="text-xs text-[var(--text-faint)]">No events in next 48h</div>
        ) : (
          <div className="space-y-1.5">
            {/* Show first event always, more if expanded */}
            {events.slice(0, eventsExpanded ? events.length : 2).map((event) => (
              <div
                key={event.id}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  event.timeUntil.isImminent && "text-[var(--accent-negative)]"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "w-3 h-3 flex-shrink-0",
                    event.impact === "CRITICAL" ? "text-[var(--accent-negative)]" : "text-amber-400"
                  )}
                />
                <span className="truncate font-medium">{event.name}</span>
                <span
                  className={cn(
                    "px-1 py-0.5 rounded text-[8px] font-medium shrink-0",
                    event.impact === "CRITICAL"
                      ? "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                      : "bg-amber-500/20 text-amber-400"
                  )}
                >
                  {event.impact}
                </span>
                <span className="text-[var(--text-faint)] shrink-0">
                  {event.timeUntil.isImminent ? (
                    <span className="animate-pulse">{event.timeUntil.text}</span>
                  ) : (
                    event.timeUntil.text
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* BOX 4: ATR/Range/MTF with A/B/C Tabs */}
      {/* ================================================================== */}
      <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-base)]">
        {/* Tab header */}
        <div className="flex items-center gap-1 mb-3">
          <button
            onClick={() => setActiveTab("sparkline")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
              activeTab === "sparkline"
                ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            )}
          >
            <Activity className="w-3 h-3" />
            <span>A</span>
          </button>
          <button
            onClick={() => setActiveTab("range")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
              activeTab === "range"
                ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            )}
          >
            <BarChart3 className="w-3 h-3" />
            <span>B</span>
          </button>
          <button
            onClick={() => setActiveTab("mtf")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
              activeTab === "mtf"
                ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            )}
          >
            <Layers className="w-3 h-3" />
            <span>C</span>
          </button>
          <span className="ml-auto text-[9px] text-[var(--text-faint)]">
            {activeTab === "sparkline" && "Sparkline"}
            {activeTab === "range" && "Range + ATR"}
            {activeTab === "mtf" && "MTF Ladder"}
          </span>
        </div>

        {/* Tab content */}
        <div className="animate-fade-in-up min-h-[120px]">
          {activeTab === "sparkline" && (
            <DecisionVizSparkline
              candles={candles}
              keyLevels={keyLevels}
              currentPrice={currentPrice}
            />
          )}
          {activeTab === "range" && (
            <DecisionVizRange
              candles={candles}
              dailyCandles={dailyCandles}
              keyLevels={keyLevels}
              indicators={indicators}
              currentPrice={currentPrice}
            />
          )}
          {activeTab === "mtf" && (
            <DecisionVizMTF mtfTrend={mtfTrend} indicators={indicators} candles={candles} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Top4Grid;
