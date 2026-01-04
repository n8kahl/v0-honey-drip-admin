/**
 * SetupWorkspace - Stacked 4-Zone Layout for Setup/Load Mode
 *
 * ZONE 1: HeaderRow (2 cards side-by-side)
 *   - Card A: Ticker/Price/Health
 *   - Card B: Confluence Summary (uses advanced calculation)
 *
 * ZONE 2: EventsStrip (thin row, always visible)
 *
 * ZONE 3: DecisionViz (3-column grid showing all visualizations)
 *
 * ZONE 4: SelectedContractStrip + CompactChain
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  AlertTriangle,
  Calendar,
  Loader2,
  Activity,
  BarChart3,
  Layers,
  Zap,
  Info,
} from "lucide-react";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type {
  Candle,
  Indicators,
  MTFTrend,
  Timeframe,
  ConfluenceScore,
  SymbolData,
} from "../../../stores/marketDataStore";
import { DecisionVizSparkline } from "./DecisionVizSparkline";
import { DecisionVizRange } from "./DecisionVizRange";
import { chipStyle, getScoreStyle, fmtPrice } from "../../../ui/semantics";
import { calculateAdvancedConfluence } from "../../../lib/market/confluenceCalculations";
import { rsiWilder } from "../../../lib/indicators";

// ============================================================================
// Types
// ============================================================================

export type DataHealth = "live" | "delayed" | "stale";

interface EconomicEvent {
  id: string;
  name: string;
  datetime: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  affectsSymbols: string[];
}

export interface SetupWorkspaceProps {
  symbol: string;
  candles: Candle[];
  keyLevels: KeyLevels | null;
  indicators: Indicators;
  mtfTrend: Record<Timeframe, MTFTrend>;
  dataHealth: DataHealth;
  currentPrice: number;
  changePercent: number;
  symbolData?: SymbolData | null;
  onRetry?: () => void;
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
// MTF Ladder Component (improved)
// ============================================================================

interface MTFLadderProps {
  mtfTrend: Record<Timeframe, MTFTrend>;
  indicators: Indicators;
  candles: Candle[];
  symbolData?: SymbolData | null;
}

function MTFLadder({ mtfTrend, indicators, candles, symbolData }: MTFLadderProps) {
  // Determine if market is currently open (9:30 AM - 4:00 PM ET, Mon-Fri)
  const isMarketOpen = useMemo(() => {
    const nowET = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const dateET = new Date(nowET);
    const hour = dateET.getHours();
    const minute = dateET.getMinutes();
    const day = dateET.getDay();

    // Mon-Fri (1-5), 9:30 AM - 4:00 PM
    const isWeekday = day >= 1 && day <= 5;
    const isMarketHours = (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;

    return isWeekday && isMarketHours;
  }, []);

  // Check which timeframes have data
  const availableTimeframes = useMemo(() => {
    const tfs: { tf: Timeframe; label: string; hasData: boolean; reason?: string }[] = [
      { tf: "1m", label: "1m", hasData: false },
      { tf: "5m", label: "5m", hasData: false },
      { tf: "15m", label: "15m", hasData: false },
      { tf: "60m", label: "1h", hasData: false },
    ];

    // Check candle data availability
    const now = Date.now();

    // During market hours: 1 hour staleness threshold
    // After hours/weekends: 72 hours threshold (covers full weekend from Friday close)
    const staleThreshold = isMarketOpen ? 60 * 60 * 1000 : 72 * 60 * 60 * 1000;

    // DEBUG: Log what data we have
    console.log("[MTFLadder] Checking data availability:", {
      symbolDataExists: !!symbolData,
      candlesKeys: symbolData?.candles ? Object.keys(symbolData.candles) : [],
      candle1mCount: symbolData?.candles?.["1m"]?.length || 0,
      candle5mCount: symbolData?.candles?.["5m"]?.length || 0,
      candle15mCount: symbolData?.candles?.["15m"]?.length || 0,
      candle60mCount: symbolData?.candles?.["60m"]?.length || 0,
      isMarketOpen,
      staleThresholdHours: staleThreshold / (60 * 60 * 1000),
    });

    for (const item of tfs) {
      const tfCandles = symbolData?.candles?.[item.tf];
      if (tfCandles && tfCandles.length > 0) {
        const lastCandle = tfCandles[tfCandles.length - 1];
        const candleAge = now - lastCandle.time;
        const candleAgeHours = candleAge / (60 * 60 * 1000);
        console.log(
          `[MTFLadder] ${item.tf}: ${tfCandles.length} candles, last candle age: ${candleAgeHours.toFixed(2)}h`
        );
        if (candleAge < staleThreshold) {
          item.hasData = true;
        } else {
          item.reason = "stale";
          console.log(
            `[MTFLadder] ${item.tf}: STALE - age ${candleAgeHours.toFixed(2)}h > threshold ${staleThreshold / (60 * 60 * 1000)}h`
          );
        }
      } else if (mtfTrend[item.tf] && mtfTrend[item.tf] !== "neutral") {
        // Have trend but no candles
        item.hasData = true;
      } else {
        item.reason = "no data";
        console.log(
          `[MTFLadder] ${item.tf}: NO DATA - candles: ${tfCandles?.length || 0}, trend: ${mtfTrend[item.tf]}`
        );
      }
    }

    return tfs;
  }, [mtfTrend, symbolData, isMarketOpen]);

  // Check if any data at all
  const hasAnyData = availableTimeframes.some((tf) => tf.hasData);

  // Loading state
  const isLoading = !symbolData && candles.length === 0;

  // Calculate overall alignment - MUST be before any early returns to follow React hooks rules
  const alignment = useMemo(() => {
    const trends = Object.values(mtfTrend);
    const bullCount = trends.filter((t) => t === "bull").length;
    const bearCount = trends.filter((t) => t === "bear").length;

    if (bullCount >= 4) return { label: "Strong Bullish", style: "text-[var(--accent-positive)]" };
    if (bearCount >= 4) return { label: "Strong Bearish", style: "text-[var(--accent-negative)]" };
    if (bullCount >= 3) return { label: "Bullish Bias", style: "text-[var(--accent-positive)]" };
    if (bearCount >= 3) return { label: "Bearish Bias", style: "text-[var(--accent-negative)]" };
    return { label: "Mixed", style: "text-[var(--data-stale)]" };
  }, [mtfTrend]);

  // Calculate RSI for each timeframe from their respective candles
  const perTfRsi = useMemo(() => {
    const result: Record<Timeframe, number | null> = {
      "1m": indicators.rsi14 ?? null,
      "5m": null,
      "15m": null,
      "60m": null,
      "1D": null,
    };

    // Calculate RSI for higher timeframes if candles are available
    const timeframesToCalc: Timeframe[] = ["5m", "15m", "60m"];
    for (const tf of timeframesToCalc) {
      const tfCandles = symbolData?.candles?.[tf];
      if (tfCandles && tfCandles.length >= 15) {
        const closes = tfCandles.map((c) => c.close);
        const rsiArray = rsiWilder(closes, 14);
        const lastRsi = rsiArray[rsiArray.length - 1];
        if (!isNaN(lastRsi)) {
          result[tf] = lastRsi;
        }
      }
    }

    return result;
  }, [indicators.rsi14, symbolData]);

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
            Multi-Timeframe Analysis
          </span>
        </div>
        <div className="border border-[var(--border-hairline)] rounded overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-[var(--border-hairline)] last:border-b-0"
            >
              <div className="h-3 bg-[var(--surface-2)] rounded animate-shimmer" />
              <div className="h-3 bg-[var(--surface-2)] rounded animate-shimmer" />
              <div className="h-3 bg-[var(--surface-2)] rounded animate-shimmer" />
              <div className="h-3 bg-[var(--surface-2)] rounded animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-[var(--text-muted)]">
        <Info className="w-3.5 h-3.5 mr-2" />
        MTF data unavailable (market closed or bars missing)
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
          Multi-Timeframe Analysis
        </span>
        <span className={cn("text-[10px] font-medium", alignment.style)}>{alignment.label}</span>
      </div>

      {/* Table */}
      <div className="border border-[var(--border-hairline)] rounded overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-[var(--surface-2)] text-[9px] text-[var(--text-faint)] uppercase tracking-wide font-medium">
          <div>TF</div>
          <div>Trend</div>
          <div>Strength</div>
          <div>RSI</div>
        </div>

        {/* Data Rows - only show available */}
        {availableTimeframes
          .filter((tf) => tf.hasData)
          .map((row) => {
            const trend = mtfTrend[row.tf] || "neutral";
            const strength = getStrength(row.tf, mtfTrend);

            return (
              <div
                key={row.tf}
                className="grid grid-cols-4 gap-2 px-3 py-1.5 border-t border-[var(--border-hairline)] text-[10px]"
              >
                <div className="text-[var(--text-high)] font-medium">{row.label}</div>
                <div
                  className={cn(
                    "flex items-center gap-1",
                    trend === "bull" && "text-[var(--accent-positive)]",
                    trend === "bear" && "text-[var(--accent-negative)]",
                    trend === "neutral" && "text-[var(--text-muted)]"
                  )}
                >
                  {trend === "bull" && <TrendingUp className="w-3 h-3" />}
                  {trend === "bear" && <TrendingDown className="w-3 h-3" />}
                  {trend === "neutral" && <Minus className="w-3 h-3" />}
                  <span>{trend === "bull" ? "Bull" : trend === "bear" ? "Bear" : "Flat"}</span>
                </div>
                <div
                  className={cn(
                    strength === "Strong" && "text-[var(--accent-positive)]",
                    strength === "Moderate" && "text-[var(--brand-primary)]",
                    strength === "Weak" && "text-[var(--text-faint)]"
                  )}
                >
                  {strength}
                </div>
                <div className="text-[var(--text-muted)] tabular-nums">
                  {perTfRsi[row.tf] !== null ? perTfRsi[row.tf]!.toFixed(0) : "—"}
                </div>
              </div>
            );
          })}

        {/* Show unavailable reason */}
        {availableTimeframes.filter((tf) => !tf.hasData).length > 0 && (
          <div className="px-3 py-1.5 border-t border-[var(--border-hairline)] text-[9px] text-[var(--text-faint)]">
            {availableTimeframes
              .filter((tf) => !tf.hasData)
              .map((tf) => tf.label)
              .join(", ")}{" "}
            unavailable
          </div>
        )}
      </div>
    </div>
  );
}

function getStrength(tf: Timeframe, mtfTrend: Record<Timeframe, MTFTrend>): string {
  const currentTrend = mtfTrend[tf];
  if (currentTrend === "neutral") return "Weak";

  const timeframes: Timeframe[] = ["1m", "5m", "15m", "60m"];
  let alignedCount = 0;
  for (const otherTf of timeframes) {
    if (otherTf !== tf && mtfTrend[otherTf] === currentTrend) {
      alignedCount++;
    }
  }

  if (alignedCount >= 3) return "Strong";
  if (alignedCount >= 1) return "Moderate";
  return "Weak";
}

// ============================================================================
// Main Component
// ============================================================================

export function SetupWorkspace({
  symbol,
  candles,
  keyLevels,
  indicators,
  mtfTrend,
  dataHealth,
  currentPrice,
  changePercent,
  symbolData,
  onRetry,
}: SetupWorkspaceProps) {
  // Events state
  const [events, setEvents] = useState<
    Array<EconomicEvent & { timeUntil: ReturnType<typeof getTimeUntil> }>
  >([]);
  const [eventsLoading, setEventsLoading] = useState(true);

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
          return (
            event.affectsSymbols?.some((s) => s.toUpperCase() === symbol.toUpperCase()) ||
            event.affectsSymbols?.includes("ALL") ||
            event.impact === "CRITICAL"
          );
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

  // Calculate advanced confluence
  const confluence = useMemo((): ConfluenceScore => {
    if (symbolData) {
      return calculateAdvancedConfluence(symbol, symbolData, indicators, mtfTrend);
    }
    // Fallback to basic calculation
    const bullCount = Object.values(mtfTrend).filter((t) => t === "bull").length;
    const bearCount = Object.values(mtfTrend).filter((t) => t === "bear").length;
    const trendAlignment = bullCount >= 3 || bearCount >= 3;
    const aboveVWAP = indicators.vwap ? currentPrice > indicators.vwap : false;
    const rsiConfirm = indicators.rsi14 ? indicators.rsi14 > 30 && indicators.rsi14 < 70 : false;

    let overall = 50;
    if (trendAlignment) overall += 20;
    if (aboveVWAP) overall += 10;
    if (rsiConfirm) overall += 10;

    return {
      overall,
      trend: trendAlignment ? 80 : 50,
      momentum: rsiConfirm ? 70 : 50,
      volatility: 50,
      volume: 50,
      technical: aboveVWAP ? 70 : 50,
      components: {
        trendAlignment,
        aboveVWAP,
        rsiConfirm,
        volumeConfirm: false,
        supportResistance: false,
      },
      lastUpdated: Date.now(),
    };
  }, [symbol, symbolData, indicators, mtfTrend, currentPrice]);

  // Derive direction from confluence
  const direction = useMemo(() => {
    if (confluence.trend >= 70) return "LONG";
    if (confluence.trend <= 30) return "SHORT";
    return "NEUTRAL";
  }, [confluence.trend]);

  // Health badge styling
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
          className: "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]",
          dot: "bg-[var(--accent-negative)]",
        };
    }
  }, [dataHealth]);

  // Confluence styling
  const confluenceStyle = useMemo(() => getScoreStyle(confluence.overall), [confluence.overall]);

  // Invalidation level
  const invalidationLevel = useMemo(() => {
    if (keyLevels?.vwap && direction === "LONG") {
      return keyLevels.vwap;
    }
    if (keyLevels?.priorDayLow && direction === "SHORT") {
      return keyLevels.priorDayLow;
    }
    if (indicators.ema20) {
      return indicators.ema20;
    }
    return null;
  }, [keyLevels, indicators, direction]);

  // TradingView URL
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${symbol}`;

  return (
    <div className="flex flex-col gap-2 p-3 animate-crossfade">
      {/* ================================================================== */}
      {/* ZONE 1: HeaderRow (2 cards side-by-side) */}
      {/* ================================================================== */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card A: Ticker + Price + Health */}
        <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-[var(--text-high)] tracking-tight">
                {symbol}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-medium",
                  healthBadge.className
                )}
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
            <span className="text-2xl font-semibold text-[var(--text-high)] tabular-nums">
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

          {/* Key levels mini-chips */}
          {keyLevels && (
            <div className="flex flex-wrap gap-1 mt-2">
              {keyLevels.vwap && (
                <span className="px-1.5 py-0.5 text-[8px] rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                  VWAP {fmtPrice(keyLevels.vwap)}
                </span>
              )}
              {keyLevels.priorDayHigh && (
                <span className="px-1.5 py-0.5 text-[8px] rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                  PDH {fmtPrice(keyLevels.priorDayHigh)}
                </span>
              )}
              {keyLevels.priorDayLow && (
                <span className="px-1.5 py-0.5 text-[8px] rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                  PDL {fmtPrice(keyLevels.priorDayLow)}
                </span>
              )}
              {keyLevels.orbHigh && (
                <span className="px-1.5 py-0.5 text-[8px] rounded bg-amber-500/20 text-amber-400">
                  ORH {fmtPrice(keyLevels.orbHigh)}
                </span>
              )}
              {keyLevels.orbLow && (
                <span className="px-1.5 py-0.5 text-[8px] rounded bg-amber-500/20 text-amber-400">
                  ORL {fmtPrice(keyLevels.orbLow)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card B: Confluence Summary */}
        <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Confluence
            </span>
          </div>

          {/* Bias + Score */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1">
              {direction === "LONG" && (
                <TrendingUp className="w-4 h-4 text-[var(--accent-positive)]" />
              )}
              {direction === "SHORT" && (
                <TrendingDown className="w-4 h-4 text-[var(--accent-negative)]" />
              )}
              {direction === "NEUTRAL" && <Minus className="w-4 h-4 text-[var(--text-muted)]" />}
              <span
                className={cn(
                  "text-sm font-semibold",
                  direction === "LONG" && "text-[var(--accent-positive)]",
                  direction === "SHORT" && "text-[var(--accent-negative)]",
                  direction === "NEUTRAL" && "text-[var(--text-muted)]"
                )}
              >
                {direction === "LONG" ? "Bullish" : direction === "SHORT" ? "Bearish" : "Neutral"}
              </span>
            </div>
            <div
              className={cn(
                "px-2 py-0.5 rounded text-xs font-bold tabular-nums",
                confluenceStyle.bgClassName,
                confluenceStyle.className
              )}
            >
              {confluence.overall}
            </div>
          </div>

          {/* Top 3 drivers with threshold context */}
          <div className="flex flex-wrap gap-1">
            {indicators.rsi14 !== undefined && (
              <span className={chipStyle("neutral")}>
                RSI {indicators.rsi14.toFixed(0)}
                {indicators.rsi14 >= 70 ? " (OB)" : indicators.rsi14 <= 30 ? " (OS)" : ""}
              </span>
            )}
            {indicators.vwap && currentPrice > 0 && (
              <span className={chipStyle(currentPrice > indicators.vwap ? "success" : "fail")}>
                {currentPrice > indicators.vwap ? "Above" : "Below"} VWAP
              </span>
            )}
            {confluence.components.trendAlignment && (
              <span className={chipStyle("success")}>MTF Aligned</span>
            )}
          </div>

          {/* Invalidation level */}
          {invalidationLevel && (
            <div className="mt-1 text-[9px] text-[var(--text-faint)]">
              Invalidation: ${invalidationLevel.toFixed(2)}
            </div>
          )}

          {/* Component breakdown - always visible */}
          <div className="mt-2 pt-2 border-t border-[var(--border-hairline)]">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Trend</span>
                <span
                  className={cn(
                    "font-medium",
                    confluence.trend >= 60
                      ? "text-[var(--accent-positive)]"
                      : confluence.trend <= 40
                        ? "text-[var(--accent-negative)]"
                        : "text-[var(--text-muted)]"
                  )}
                >
                  {confluence.trend}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Momentum</span>
                <span className="font-medium text-[var(--text-high)]">{confluence.momentum}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Technical</span>
                <span className="font-medium text-[var(--text-high)]">{confluence.technical}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Volume</span>
                <span className="font-medium text-[var(--text-high)]">{confluence.volume}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ZONE 2: EventsStrip (thin row) */}
      {/* ================================================================== */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--border-hairline)] bg-[var(--surface-1)]">
        <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
        <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
          Events
        </span>

        {eventsLoading ? (
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : events.length === 0 ? (
          <span className="text-[10px] text-[var(--text-faint)]">No events in next 48h</span>
        ) : (
          <div className="flex-1 flex items-center gap-3 overflow-x-auto">
            {events.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] whitespace-nowrap",
                  event.timeUntil.isImminent && "text-[var(--accent-negative)]"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "w-3 h-3 flex-shrink-0",
                    event.impact === "CRITICAL" ? "text-[var(--accent-negative)]" : "text-amber-400"
                  )}
                />
                <span className="font-medium">{event.name}</span>
                <span
                  className={cn(
                    "px-1 py-0.5 rounded text-[8px] font-medium",
                    event.impact === "CRITICAL"
                      ? "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                      : "bg-amber-500/20 text-amber-400"
                  )}
                >
                  {event.timeUntil.text}
                </span>
              </div>
            ))}
            {events.length > 3 && (
              <span className="text-[10px] text-[var(--text-faint)]">
                +{events.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* ZONE 3: DecisionViz (3-column grid showing all at once) */}
      {/* ================================================================== */}
      <div className="grid grid-cols-3 gap-3">
        {/* A: Price Position / Sparkline */}
        <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3 h-3 text-[var(--brand-primary)]" />
            <span className="text-[9px] uppercase text-[var(--text-muted)] font-medium tracking-wide">
              A: Price Position
            </span>
          </div>
          <DecisionVizSparkline
            candles={candles}
            keyLevels={keyLevels}
            currentPrice={currentPrice}
          />
        </div>

        {/* B: Range + ATR */}
        <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3 h-3 text-[var(--brand-primary)]" />
            <span className="text-[9px] uppercase text-[var(--text-muted)] font-medium tracking-wide">
              B: Range + ATR
            </span>
          </div>
          <DecisionVizRange
            candles={candles}
            dailyCandles={symbolData?.candles["1D"]}
            keyLevels={keyLevels}
            indicators={indicators}
            currentPrice={currentPrice}
          />
        </div>

        {/* C: MTF Ladder */}
        <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers className="w-3 h-3 text-[var(--brand-primary)]" />
            <span className="text-[9px] uppercase text-[var(--text-muted)] font-medium tracking-wide">
              C: MTF
            </span>
          </div>
          <MTFLadder
            mtfTrend={mtfTrend}
            indicators={indicators}
            candles={candles}
            symbolData={symbolData}
          />
        </div>
      </div>
    </div>
  );
}

export default SetupWorkspace;
