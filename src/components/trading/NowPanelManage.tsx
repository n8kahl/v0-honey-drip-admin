/**
 * NowPanelManage - Live Trade Cockpit for ENTERED Trades
 *
 * The SINGLE SOURCE OF TRUTH for all live trade metrics.
 * Uses useActiveTradeLiveModel as the canonical data source.
 *
 * Displays:
 * - Live P&L (percentage and dollars) with animation
 * - R-Multiple calculation
 * - Live Greeks (Δ, Γ, Θ, IV)
 * - Live underlying price from Tradier
 * - Time to market close (ET timezone)
 * - Progress to target with visual bar
 * - Data freshness indicators
 * - Key levels, ATR, MTF status
 *
 * Only displayed when trade.state === "ENTERED"
 */

import React, { useMemo, useState, useEffect } from "react";
import type { Trade, Ticker } from "../../types";
import { useActiveTradeLiveModel } from "../../hooks/useActiveTradeLiveModel";
import { useMarketDataStore } from "../../stores/marketDataStore";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { getHealthStyle, getSourceBadgeStyle } from "../../lib/market/dataFreshness";
import { cn, formatPrice } from "../../lib/utils";
import { fmtDTE, getPnlStyle } from "../../ui/semantics";
import {
  Clock,
  Target,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Wifi,
  WifiOff,
  Zap,
  Shield,
} from "lucide-react";

// ============================================================================
// Props
// ============================================================================

interface NowPanelManageProps {
  trade: Trade;
  activeTicker: Ticker | null;
  watchlist?: Ticker[];
}

// ============================================================================
// Main Component
// ============================================================================

export function NowPanelManage({ trade }: NowPanelManageProps) {
  // Use canonical live model hook - SINGLE SOURCE OF TRUTH
  const liveModel = useActiveTradeLiveModel(trade);

  // Get additional context data
  const symbolData = useMarketDataStore((s) => s.symbols[trade.ticker]);
  const indicators = symbolData?.indicators;
  const mtfTrend = symbolData?.mtfTrend;
  const { keyLevels } = useKeyLevels(trade.ticker);

  // Get subscribe action from store
  const subscribe = useMarketDataStore((s) => s.subscribe);
  const subscribedSymbols = useMarketDataStore((s) => s.subscribedSymbols);

  // Auto-subscribe symbol when trade enters ENTERED state
  // This ensures market data (candles, indicators, MTF) are loaded
  useEffect(() => {
    if (trade?.ticker && trade.state === "ENTERED") {
      // Check if not already subscribed
      if (!subscribedSymbols.has(trade.ticker)) {
        console.log(`[NowPanelManage] Auto-subscribing ${trade.ticker} for live market data`);
        subscribe(trade.ticker);
      }
    }
  }, [trade?.ticker, trade?.state, subscribe, subscribedSymbols]);

  // Loading state if model not yet available
  if (!liveModel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
          <span className="text-sm text-[var(--text-muted)]">Loading live data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-mode-enter">
      {/* Position HUD - Top ~30% */}
      <PositionHUD trade={trade} liveModel={liveModel} />

      {/* Greeks Strip */}
      <GreeksStrip liveModel={liveModel} />

      {/* Levels / ATR / Positioning - Middle ~40% */}
      <LevelsATRPanel
        trade={trade}
        currentPrice={liveModel.underlyingPrice}
        keyLevels={keyLevels}
        indicators={indicators}
        mtfTrend={mtfTrend}
      />

      {/* Trade Tape - Bottom ~30% */}
      <TradeTapeSection trade={trade} />
    </div>
  );
}

// ============================================================================
// Position HUD - Large P&L Display + Progress + Data Health
// ============================================================================

interface PositionHUDProps {
  trade: Trade;
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
}

function PositionHUD({ trade, liveModel }: PositionHUDProps) {
  const contract = trade.contract;
  const dte = contract?.daysToExpiry ?? 0;
  const dteInfo = fmtDTE(dte);
  const pnlStyle = getPnlStyle(liveModel.pnlPercent);
  const healthStyle = getHealthStyle(liveModel.overallHealth);

  // Animate P&L changes
  const [prevPnl, setPrevPnl] = useState(liveModel.pnlPercent);
  const [pnlFlash, setPnlFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (liveModel.pnlPercent !== prevPnl) {
      setPnlFlash(liveModel.pnlPercent > prevPnl ? "up" : "down");
      setPrevPnl(liveModel.pnlPercent);
      const timeout = setTimeout(() => setPnlFlash(null), 500);
      return () => clearTimeout(timeout);
    }
  }, [liveModel.pnlPercent, prevPnl]);

  return (
    <div className="flex-shrink-0 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
      {/* Row 0: Data Health Indicator */}
      <div className="px-4 py-1.5 flex items-center justify-between bg-[var(--surface-2)] border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          {liveModel.overallHealth === "healthy" ? (
            <Wifi className="w-3.5 h-3.5 text-green-400" />
          ) : liveModel.overallHealth === "degraded" ? (
            <Wifi className="w-3.5 h-3.5 text-yellow-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
          )}
          <span
            className={cn("text-[10px] font-medium uppercase tracking-wide", healthStyle.className)}
          >
            {healthStyle.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[var(--text-faint)]">
          <span
            className={cn(
              "px-1.5 py-0.5 rounded border",
              getSourceBadgeStyle(liveModel.optionSource)
            )}
          >
            Options: {liveModel.optionSource === "websocket" ? "WS" : "REST"}
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded border",
              getSourceBadgeStyle(liveModel.greeksSource === "live" ? "rest" : "static")
            )}
          >
            Greeks: {liveModel.greeksSource === "live" ? "Live" : "Static"}
          </span>
        </div>
      </div>

      {/* Row 1: P&L Display + R-Multiple */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between">
          {/* P&L Display */}
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">
              Unrealized P&L
            </div>
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "text-3xl font-bold tabular-nums transition-all duration-200",
                  pnlStyle.className,
                  pnlFlash === "up" && "animate-pulse text-[var(--accent-positive)]",
                  pnlFlash === "down" && "animate-pulse text-[var(--accent-negative)]"
                )}
              >
                {liveModel.pnlPercent >= 0 ? "+" : ""}
                {liveModel.pnlPercent.toFixed(1)}%
              </span>
              <span className={cn("text-lg tabular-nums", pnlStyle.className)}>
                {liveModel.pnlDollars >= 0 ? "+" : ""}${Math.abs(liveModel.pnlDollars).toFixed(0)}
              </span>
            </div>
          </div>

          {/* R-Multiple + Time to Close */}
          <div className="text-right space-y-1">
            {liveModel.rMultiple !== null && (
              <div>
                <div className="text-[10px] text-[var(--text-faint)] uppercase">R-Multiple</div>
                <div
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    liveModel.rMultiple >= 0
                      ? "text-[var(--accent-positive)]"
                      : "text-[var(--accent-negative)]"
                  )}
                >
                  {liveModel.rMultiple >= 0 ? "+" : ""}
                  {liveModel.rMultiple.toFixed(2)}R
                </div>
              </div>
            )}
            <div className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
              <Clock className="w-3.5 h-3.5" />
              <span className="tabular-nums font-medium">{liveModel.holdTimeFormatted}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)] mb-1">
            <span>Progress to TP</span>
            <span className="tabular-nums">{Math.round(liveModel.progressToTarget)}%</span>
          </div>
          <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                liveModel.progressToTarget >= 100
                  ? "bg-[var(--accent-positive)]"
                  : liveModel.progressToTarget >= 50
                    ? "bg-[var(--brand-primary)]"
                    : "bg-[var(--text-muted)]"
              )}
              style={{ width: `${Math.min(100, Math.max(0, liveModel.progressToTarget))}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-[var(--text-faint)] mt-0.5">
            <span>Entry ${liveModel.entryPrice.toFixed(2)}</span>
            <span>TP ${liveModel.targetPrice.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Contract Description + Time to Close */}
      <div className="px-4 py-2 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-high)]">
              {trade.ticker} ${contract?.strike}
              {contract?.type}
            </span>
            <span className={cn("text-xs font-medium", dteInfo.className)}>{dteInfo.text}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3 h-3 text-[var(--text-faint)]" />
            <span className="text-[var(--text-muted)]">
              {liveModel.marketOpen ? (
                <>
                  Close in{" "}
                  <span className="font-medium text-[var(--text-high)]">
                    {liveModel.timeToCloseFormatted}
                  </span>
                </>
              ) : (
                <span className="text-[var(--accent-negative)]">Market Closed</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Entry vs Current (Live Pricing) */}
      <div className="px-4 py-2 border-t border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-4">
          <span>
            <span className="text-[var(--text-faint)]">Entry:</span>{" "}
            <span className="tabular-nums font-medium text-[var(--text-high)]">
              ${liveModel.entryPrice.toFixed(2)}
            </span>
          </span>
          <span className="text-[var(--text-faint)]">→</span>
          <span>
            <span className="text-[var(--text-faint)]">Live:</span>{" "}
            <span className={cn("tabular-nums font-medium", pnlStyle.className)}>
              ${liveModel.effectiveMid.toFixed(2)}
            </span>
            <span className="text-[var(--text-faint)] ml-1">
              ({liveModel.bid.toFixed(2)}/{liveModel.ask.toFixed(2)})
            </span>
          </span>
          <span className="text-[var(--text-faint)]">|</span>
          <span>
            <span className="text-[var(--text-faint)]">Underlying:</span>{" "}
            <span className="tabular-nums font-medium text-[var(--text-high)]">
              ${liveModel.underlyingPrice.toFixed(2)}
            </span>
            <span
              className={cn(
                "ml-1 tabular-nums",
                liveModel.underlyingChangePercent >= 0
                  ? "text-[var(--accent-positive)]"
                  : "text-[var(--accent-negative)]"
              )}
            >
              ({liveModel.underlyingChangePercent >= 0 ? "+" : ""}
              {liveModel.underlyingChangePercent.toFixed(2)}%)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Greeks Strip - Compact horizontal display
// ============================================================================

interface GreeksStripProps {
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
}

function GreeksStrip({ liveModel }: GreeksStripProps) {
  return (
    <div className="flex-shrink-0 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Delta */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-faint)]">Δ</span>
            <span className="text-xs font-medium text-[var(--text-high)] tabular-nums">
              {liveModel.delta.toFixed(2)}
            </span>
          </div>

          {/* Gamma */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-faint)]">Γ</span>
            <span className="text-xs font-medium text-[var(--text-high)] tabular-nums">
              {liveModel.gamma.toFixed(3)}
            </span>
          </div>

          {/* Theta */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-faint)]">Θ</span>
            <span className="text-xs font-medium text-[var(--accent-negative)] tabular-nums">
              {liveModel.theta.toFixed(2)}
            </span>
          </div>

          {/* IV */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-faint)]">IV</span>
            <span className="text-xs font-medium text-[var(--text-high)] tabular-nums">
              {(liveModel.iv * 100).toFixed(0)}%
            </span>
          </div>

          {/* Spread */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-faint)]">Spread</span>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                liveModel.spreadPercent > 5
                  ? "text-[var(--accent-negative)]"
                  : "text-[var(--text-high)]"
              )}
            >
              {liveModel.spreadPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Greeks source indicator */}
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
          {liveModel.greeksSource === "live" ? (
            <Zap className="w-3 h-3 text-green-400" />
          ) : (
            <span className="text-yellow-400">Static</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Levels / ATR / Positioning Panel
// ============================================================================

interface LevelsATRPanelProps {
  trade: Trade;
  currentPrice: number;
  keyLevels: any;
  indicators: any;
  mtfTrend: any;
}

function LevelsATRPanel({ currentPrice, keyLevels, indicators, mtfTrend }: LevelsATRPanelProps) {
  const [mtfExpanded, setMtfExpanded] = useState(true);

  // Build key levels array
  const levels = useMemo(() => {
    const result: { label: string; price: number; type: "support" | "resistance" | "neutral" }[] =
      [];

    if (keyLevels?.vwap) result.push({ label: "VWAP", price: keyLevels.vwap, type: "neutral" });
    if (keyLevels?.pdh) result.push({ label: "PDH", price: keyLevels.pdh, type: "resistance" });
    if (keyLevels?.pdl) result.push({ label: "PDL", price: keyLevels.pdl, type: "support" });
    if (keyLevels?.orh) result.push({ label: "ORH", price: keyLevels.orh, type: "resistance" });
    if (keyLevels?.orl) result.push({ label: "ORL", price: keyLevels.orl, type: "support" });

    return result.sort((a, b) => a.price - b.price);
  }, [keyLevels]);

  // Calculate ATR metrics
  const atrMetrics = useMemo(() => {
    const atr = indicators?.atr || 0;
    const dayHigh = keyLevels?.todayHigh || currentPrice;
    const dayLow = keyLevels?.todayLow || currentPrice;
    const dayRange = dayHigh - dayLow;
    const consumedPct = atr > 0 ? (dayRange / atr) * 100 : 0;
    const roomMultiple = atr > 0 ? Math.max(0, (atr - dayRange) / atr) : 0;

    return {
      atr,
      dayRange,
      consumedPct: Math.min(100, consumedPct),
      roomMultiple,
      isExhausted: consumedPct > 80,
    };
  }, [indicators, keyLevels, currentPrice]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Key Levels Panel */}
      <div className="p-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-1.5 mb-2">
          <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Key Levels
          </span>
        </div>

        {levels.length > 0 ? (
          <LevelBar levels={levels} currentPrice={currentPrice} />
        ) : (
          <div className="text-xs text-[var(--text-faint)] text-center py-2">
            No key levels available
          </div>
        )}
      </div>

      {/* ATR Remaining Room */}
      <div className="p-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              ATR Room
            </span>
          </div>
          {atrMetrics.isExhausted && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-warning)]/10 text-[var(--accent-warning)] border border-[var(--accent-warning)]/30">
              <AlertTriangle className="w-3 h-3" />
              Exhausted
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">
              ATR(14):{" "}
              <span className="text-[var(--text-high)] tabular-nums">
                {atrMetrics.atr.toFixed(2)}
              </span>
            </span>
            <span className="text-[var(--text-muted)]">
              Session:{" "}
              <span className="text-[var(--text-high)] tabular-nums">
                {atrMetrics.consumedPct.toFixed(0)}%
              </span>{" "}
              consumed
            </span>
          </div>

          <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                atrMetrics.consumedPct > 80
                  ? "bg-[var(--accent-negative)]"
                  : atrMetrics.consumedPct > 60
                    ? "bg-[var(--accent-warning)]"
                    : "bg-[var(--accent-positive)]"
              )}
              style={{ width: `${atrMetrics.consumedPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* MTF Status Ladder - Collapsible */}
      <div className="border-b border-[var(--border-hairline)]">
        <button
          onClick={() => setMtfExpanded(!mtfExpanded)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--surface-2)] transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              MTF Status
            </span>
            {mtfTrend && <MTFQuickStatus mtfTrend={mtfTrend} />}
          </div>
          {mtfExpanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-faint)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-faint)]" />
          )}
        </button>

        {mtfExpanded && mtfTrend && (
          <div className="px-3 pb-3">
            <MTFLadder mtfTrend={mtfTrend} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Level Bar Visualization
// ============================================================================

function LevelBar({
  levels,
  currentPrice,
}: {
  levels: { label: string; price: number; type: "support" | "resistance" | "neutral" }[];
  currentPrice: number;
}) {
  const minPrice = Math.min(...levels.map((l) => l.price), currentPrice) * 0.998;
  const maxPrice = Math.max(...levels.map((l) => l.price), currentPrice) * 1.002;
  const range = maxPrice - minPrice;

  const getPosition = (price: number) => ((price - minPrice) / range) * 100;

  return (
    <div className="relative h-8 bg-[var(--surface-2)] rounded mb-4">
      {levels.map((level, idx) => (
        <div
          key={idx}
          className="absolute top-0 bottom-0 flex flex-col items-center"
          style={{ left: `${getPosition(level.price)}%` }}
        >
          <div
            className={cn(
              "w-0.5 h-full",
              level.type === "support"
                ? "bg-[var(--accent-positive)]"
                : level.type === "resistance"
                  ? "bg-[var(--accent-negative)]"
                  : "bg-[var(--brand-primary)]"
            )}
          />
          <span className="absolute -bottom-4 text-[9px] text-[var(--text-faint)] whitespace-nowrap transform -translate-x-1/2">
            {level.label}
          </span>
        </div>
      ))}
      <div
        className="absolute top-0 bottom-0 flex items-center"
        style={{ left: `${getPosition(currentPrice)}%` }}
      >
        <div className="w-2 h-2 bg-[var(--text-high)] rounded-full transform -translate-x-1/2" />
      </div>
    </div>
  );
}

// ============================================================================
// MTF Components
// ============================================================================

function MTFQuickStatus({ mtfTrend }: { mtfTrend: Record<string, string> | undefined }) {
  // mtfTrend values are strings: "bull" | "bear" | "neutral"
  // Count bullish trends as "aligned up"
  const aligned = Object.values(mtfTrend || {}).filter((t) => t === "bull").length;
  const total = Object.keys(mtfTrend || {}).length || 5;

  return (
    <span className="text-[10px] text-[var(--text-faint)] tabular-nums">
      {aligned}/{total} ↑
    </span>
  );
}

function MTFLadder({ mtfTrend }: { mtfTrend: Record<string, string> | undefined }) {
  // Map store timeframe keys to display keys
  // Store uses "60m", UI might want "1h"
  const timeframes = [
    { key: "1m", label: "1m" },
    { key: "5m", label: "5m" },
    { key: "15m", label: "15m" },
    { key: "60m", label: "1h" },
  ] as const;

  // Convert string trend to direction and strength
  const getTrendInfo = (trend: string | undefined) => {
    switch (trend) {
      case "bull":
        return { direction: "up" as const, strength: 75 };
      case "bear":
        return { direction: "down" as const, strength: 25 };
      default:
        return { direction: "neutral" as const, strength: 50 };
    }
  };

  const getTrendArrow = (direction: "up" | "down" | "neutral") => {
    switch (direction) {
      case "up":
        return <ArrowUp className="w-3 h-3 text-[var(--accent-positive)]" />;
      case "down":
        return <ArrowDown className="w-3 h-3 text-[var(--accent-negative)]" />;
      default:
        return <ArrowRight className="w-3 h-3 text-[var(--text-faint)]" />;
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {timeframes.map(({ key, label }) => {
        // mtfTrend[key] is a string: "bull" | "bear" | "neutral"
        const trendString = mtfTrend?.[key];
        const { direction, strength } = getTrendInfo(trendString);

        return (
          <div
            key={key}
            className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)] text-center"
          >
            <div className="text-[10px] text-[var(--text-faint)] uppercase mb-1">{label}</div>
            <div className="flex items-center justify-center gap-1 mb-1">
              {getTrendArrow(direction)}
              <span className="text-xs font-medium text-[var(--text-high)] tabular-nums">
                {Math.round(strength)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Trade Tape Section
// ============================================================================

function TradeTapeSection({ trade }: { trade: Trade }) {
  const updates = trade.updates || [];

  return (
    <div className="flex-shrink-0 border-t border-[var(--border-hairline)]">
      <div className="p-3 flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Trade Tape
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-faint)]">{updates.length} events</span>
      </div>

      <div className="max-h-32 overflow-y-auto p-3 space-y-2">
        {updates.length === 0 ? (
          <div className="text-xs text-[var(--text-faint)] text-center py-4">
            No trade events yet
          </div>
        ) : (
          updates.map((update, idx) => <TapeEvent key={update.id || idx} update={update} />)
        )}

        <div className="flex items-center gap-2 p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
          <div className="w-2 h-2 rounded-full bg-[var(--accent-negative)] animate-pulse" />
          <span className="text-xs text-[var(--text-muted)]">NOW · Holding position</span>
        </div>
      </div>
    </div>
  );
}

function TapeEvent({ update }: { update: Trade["updates"][number] }) {
  const timestamp = update.timestamp
    ? new Date(update.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  const getEventIcon = () => {
    switch (update.type) {
      case "enter":
        return <CheckCircle2 className="w-3 h-3 text-[var(--accent-positive)]" />;
      case "trim":
        return <Target className="w-3 h-3 text-[var(--brand-primary)]" />;
      case "update-sl":
      case "trail-stop":
        return <Shield className="w-3 h-3 text-[var(--text-muted)]" />;
      case "exit":
        return <Zap className="w-3 h-3 text-[var(--accent-negative)]" />;
      default:
        return <Activity className="w-3 h-3 text-[var(--text-faint)]" />;
    }
  };

  const getEventLabel = () => {
    switch (update.type) {
      case "enter":
        return "ENTERED";
      case "trim":
        return "TRIMMED";
      case "update-sl":
        return "SL MOVED";
      case "trail-stop":
        return "TRAIL STOP";
      case "add":
        return "ADDED";
      case "exit":
        return "EXITED";
      default:
        return update.type?.toUpperCase() || "UPDATE";
    }
  };

  return (
    <div className="flex items-start gap-2 text-xs">
      {getEventIcon()}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--text-high)]">{getEventLabel()}</span>
          {update.price && (
            <span className="text-[var(--text-muted)] tabular-nums">
              @ ${update.price.toFixed(2)}
            </span>
          )}
          {update.pnlPercent !== undefined && update.pnlPercent !== null && (
            <span
              className={cn(
                "tabular-nums",
                update.pnlPercent >= 0
                  ? "text-[var(--accent-positive)]"
                  : "text-[var(--accent-negative)]"
              )}
            >
              ({update.pnlPercent >= 0 ? "+" : ""}
              {update.pnlPercent.toFixed(1)}%)
            </span>
          )}
        </div>
        {update.message && (
          <div className="text-[var(--text-faint)] truncate">{update.message}</div>
        )}
        <div className="text-[var(--text-faint)] tabular-nums">{timestamp}</div>
      </div>
    </div>
  );
}

export default NowPanelManage;
