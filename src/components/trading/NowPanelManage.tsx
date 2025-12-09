/**
 * NowPanelManage - Management Cockpit for ENTERED Trades
 *
 * Replaces the basic PositionSnapshot with a full management cockpit:
 * - Position HUD (P&L, progress, Greeks)
 * - Levels/ATR/Positioning panel
 * - Trade Tape timeline
 *
 * Only displayed when trade.state === "ENTERED"
 */

import React, { useMemo, useState, useEffect } from "react";
import type { Trade, Ticker } from "../../types";
import { useMarketDataStore } from "../../stores/marketDataStore";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { cn } from "../../lib/utils";
import {
  fmtPrice,
  fmtPct,
  fmtDelta,
  fmtDTE,
  getPnlStyle,
  chipStyle,
  getScoreStyle,
} from "../../ui/semantics";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Target,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Shield,
  Zap,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
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

export function NowPanelManage({ trade, activeTicker, watchlist = [] }: NowPanelManageProps) {
  // Get real-time data from market data store
  const symbolData = useMarketDataStore((s) => s.symbols[trade.ticker]);
  const indicators = symbolData?.indicators;
  const mtfTrend = symbolData?.mtfTrend;

  // Get key levels
  const { keyLevels } = useKeyLevels(trade.ticker);

  // Calculate current underlying price
  const currentPrice = useMemo(() => {
    const fromWatchlist = watchlist.find((t) => t.symbol === trade.ticker);
    // Get latest close from candles if available
    const latestCandle = symbolData?.candles?.["1m"]?.slice(-1)[0];
    return fromWatchlist?.last || activeTicker?.last || latestCandle?.close || 0;
  }, [trade.ticker, watchlist, activeTicker, symbolData]);

  // Calculate P&L
  const pnlCalcs = useMemo(() => {
    const entryPrice = trade.entryPrice || trade.contract?.mid || 0;
    const currentContractPrice = trade.contract?.bid || trade.contract?.mid || entryPrice;
    const pnlDollar = currentContractPrice - entryPrice;
    const pnlPercent = entryPrice > 0 ? (pnlDollar / entryPrice) * 100 : 0;
    const pnlStyle = getPnlStyle(pnlPercent);

    // Calculate progress to targets
    const tp1 = trade.targetPrice || entryPrice * 1.2;
    const tp1Progress =
      entryPrice > 0
        ? Math.min(
            100,
            Math.max(0, ((currentContractPrice - entryPrice) / (tp1 - entryPrice)) * 100)
          )
        : 0;

    return {
      entryPrice,
      currentContractPrice,
      pnlDollar,
      pnlPercent,
      pnlStyle,
      tp1,
      tp1Progress,
    };
  }, [trade]);

  // Hold time calculation
  const [holdTime, setHoldTime] = useState("");
  useEffect(() => {
    const entryTime = trade.entryTime ? new Date(trade.entryTime).getTime() : Date.now();

    const updateHoldTime = () => {
      const elapsed = Date.now() - entryTime;
      const minutes = Math.floor(elapsed / 60000);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) {
        setHoldTime(`${hours}h ${minutes % 60}m`);
      } else {
        setHoldTime(`${minutes}m`);
      }
    };

    updateHoldTime();
    const interval = setInterval(updateHoldTime, 60000);
    return () => clearInterval(interval);
  }, [trade.entryTime]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-mode-enter">
      {/* Position HUD - Top ~25% */}
      <PositionHUD
        trade={trade}
        pnlCalcs={pnlCalcs}
        holdTime={holdTime}
        currentPrice={currentPrice}
      />

      {/* Levels / ATR / Positioning - Middle ~40% */}
      <LevelsATRPanel
        trade={trade}
        currentPrice={currentPrice}
        keyLevels={keyLevels}
        indicators={indicators}
        mtfTrend={mtfTrend}
      />

      {/* Trade Tape - Bottom ~35% */}
      <TradeTapeSection trade={trade} />
    </div>
  );
}

// ============================================================================
// Position HUD - Large P&L Display + Progress
// ============================================================================

interface PositionHUDProps {
  trade: Trade;
  pnlCalcs: {
    entryPrice: number;
    currentContractPrice: number;
    pnlDollar: number;
    pnlPercent: number;
    pnlStyle: ReturnType<typeof getPnlStyle>;
    tp1: number;
    tp1Progress: number;
  };
  holdTime: string;
  currentPrice: number;
}

function PositionHUD({ trade, pnlCalcs, holdTime, currentPrice }: PositionHUDProps) {
  const contract = trade.contract;
  const dte = contract?.daysToExpiry ?? 0;
  const dteInfo = fmtDTE(dte);

  return (
    <div className="flex-shrink-0 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
      {/* Row 1: P&L + Hold Time */}
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
                  "text-3xl font-bold tabular-nums animate-metric-tick",
                  pnlCalcs.pnlStyle.className
                )}
              >
                {pnlCalcs.pnlPercent >= 0 ? "+" : ""}
                {fmtPct(pnlCalcs.pnlPercent)}
              </span>
              <span className={cn("text-lg tabular-nums", pnlCalcs.pnlStyle.className)}>
                {pnlCalcs.pnlDollar >= 0 ? "+" : ""}
                {fmtPrice(pnlCalcs.pnlDollar)}
              </span>
            </div>
          </div>

          {/* Hold Time */}
          <div className="text-right">
            <div className="text-xs text-[var(--text-faint)] uppercase mb-1">Hold</div>
            <div className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
              <Clock className="w-3.5 h-3.5" />
              <span className="tabular-nums font-medium">{holdTime}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)] mb-1">
            <span>Progress to TP1</span>
            <span className="tabular-nums">{Math.round(pnlCalcs.tp1Progress)}%</span>
          </div>
          <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-positive)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, pnlCalcs.tp1Progress)}%` }}
            />
            {/* Milestone markers */}
            <div className="relative h-0">
              <div
                className="absolute w-0.5 h-2 bg-[var(--border)] -top-2"
                style={{ left: "33%" }}
              />
              <div
                className="absolute w-0.5 h-2 bg-[var(--border)] -top-2"
                style={{ left: "66%" }}
              />
              <div
                className="absolute w-0.5 h-2 bg-[var(--border)] -top-2"
                style={{ left: "100%" }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-[var(--text-faint)] mt-0.5">
            <span>Entry</span>
            <span>TP1</span>
            <span>TP2</span>
            <span>TP3</span>
          </div>
        </div>
      </div>

      {/* Row 2: Contract + Greeks Strip */}
      <div className="px-4 py-2 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]">
        <div className="flex items-center justify-between">
          {/* Contract Description */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-high)]">
              {trade.ticker} ${contract?.strike}
              {contract?.type}
            </span>
            <span className={cn("text-xs font-medium", dteInfo.className)}>{dteInfo.text}</span>
          </div>

          {/* Greeks Chips */}
          <div className="flex items-center gap-2">
            {contract?.delta && (
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                Δ {fmtDelta(contract.delta)}
              </span>
            )}
            {contract?.gamma && (
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                Γ {contract.gamma.toFixed(3)}
              </span>
            )}
            {contract?.theta && (
              <span className="text-xs text-[var(--accent-negative)] tabular-nums">
                Θ {contract.theta.toFixed(2)}
              </span>
            )}
            {contract?.iv && (
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                IV {(contract.iv * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Entry vs Current */}
      <div className="px-4 py-2 border-t border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-3">
          <span>
            <span className="text-[var(--text-faint)]">Entry:</span>{" "}
            <span className="tabular-nums font-medium text-[var(--text-high)]">
              {fmtPrice(pnlCalcs.entryPrice)}
            </span>
          </span>
          <span className="text-[var(--text-faint)]">|</span>
          <span>
            <span className="text-[var(--text-faint)]">Current:</span>{" "}
            <span className="tabular-nums font-medium text-[var(--text-high)]">
              {fmtPrice(contract?.bid || 0)} / {fmtPrice(contract?.ask || 0)}
            </span>
          </span>
          <span className="text-[var(--text-faint)]">|</span>
          <span>
            <span className="text-[var(--text-faint)]">Underlying:</span>{" "}
            <span className="tabular-nums font-medium text-[var(--text-high)]">
              {fmtPrice(currentPrice)}
            </span>
          </span>
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

function LevelsATRPanel({
  trade,
  currentPrice,
  keyLevels,
  indicators,
  mtfTrend,
}: LevelsATRPanelProps) {
  const [mtfExpanded, setMtfExpanded] = useState(false);
  const [gammaExpanded, setGammaExpanded] = useState(false);

  // Build key levels array
  const levels = useMemo(() => {
    const result: { label: string; price: number; type: "support" | "resistance" | "neutral" }[] =
      [];

    if (keyLevels?.vwap) {
      result.push({ label: "VWAP", price: keyLevels.vwap, type: "neutral" });
    }
    if (keyLevels?.pdh) {
      result.push({ label: "PDH", price: keyLevels.pdh, type: "resistance" });
    }
    if (keyLevels?.pdl) {
      result.push({ label: "PDL", price: keyLevels.pdl, type: "support" });
    }
    if (keyLevels?.orh) {
      result.push({ label: "ORH", price: keyLevels.orh, type: "resistance" });
    }
    if (keyLevels?.orl) {
      result.push({ label: "ORL", price: keyLevels.orl, type: "support" });
    }

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
      {/* Key Levels Panel - Always Visible */}
      <div className="p-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-1.5 mb-2">
          <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Key Levels
          </span>
        </div>

        {/* Level Bar Visualization */}
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
            <span className={chipStyle("warn")}>
              <AlertTriangle className="w-3 h-3 mr-1" />
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

          {/* ATR Progress Bar */}
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

          <div className="text-xs text-[var(--text-faint)]">
            Room remaining:{" "}
            <span className="text-[var(--text-muted)] tabular-nums">
              {atrMetrics.roomMultiple.toFixed(1)}× ATR
            </span>
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
          <div className="px-3 pb-3 animate-expand">
            <MTFLadder mtfTrend={mtfTrend} indicators={indicators} />
          </div>
        )}
      </div>

      {/* Gamma Walls / Dealer Position - Collapsible */}
      <div className="border-b border-[var(--border-hairline)]">
        <button
          onClick={() => setGammaExpanded(!gammaExpanded)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--surface-2)] transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Positioning
            </span>
          </div>
          {gammaExpanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-faint)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-faint)]" />
          )}
        </button>

        {gammaExpanded && (
          <div className="px-3 pb-3 animate-expand">
            <GammaPositionPanel currentPrice={currentPrice} />
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
    <div className="relative h-8 bg-[var(--surface-2)] rounded">
      {/* Level markers */}
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

      {/* Current price marker */}
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

function MTFQuickStatus({ mtfTrend }: { mtfTrend: any }) {
  const aligned = Object.values(mtfTrend || {}).filter((t: any) => t?.direction === "up").length;
  const total = Object.keys(mtfTrend || {}).length || 4;

  return (
    <span className="text-[10px] text-[var(--text-faint)] tabular-nums">
      {aligned}/{total} ↑
    </span>
  );
}

function MTFLadder({ mtfTrend, indicators }: { mtfTrend: any; indicators: any }) {
  const timeframes = ["1m", "5m", "15m", "1h"] as const;

  const getTrendArrow = (direction: string) => {
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
      {timeframes.map((tf) => {
        const trend = mtfTrend?.[tf] || {};
        const strength = trend.strength || 50;
        const direction = trend.direction || "neutral";

        return (
          <div
            key={tf}
            className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)] text-center"
          >
            <div className="text-[10px] text-[var(--text-faint)] uppercase mb-1">{tf}</div>
            <div className="flex items-center justify-center gap-1 mb-1">
              {getTrendArrow(direction)}
              <span className="text-xs font-medium text-[var(--text-high)] tabular-nums">
                {Math.round(strength)}
              </span>
            </div>
            <div className="text-[9px] text-[var(--text-faint)]">
              RSI {indicators?.rsi?.toFixed(0) || "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Gamma Position Panel (Placeholder)
// ============================================================================

function GammaPositionPanel({ currentPrice }: { currentPrice: number }) {
  // This would integrate with GammaExposureEngine in a full implementation
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-muted)]">Dealer Position:</span>
        <span className={chipStyle("neutral")}>LONG_GAMMA</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-muted)]">Support Wall:</span>
        <span className="text-[var(--text-high)] tabular-nums">
          ${(currentPrice * 0.98).toFixed(2)} (-2.0%)
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-muted)]">Resistance Wall:</span>
        <span className="text-[var(--text-high)] tabular-nums">
          ${(currentPrice * 1.02).toFixed(2)} (+2.0%)
        </span>
      </div>
      <div className="p-2 rounded bg-[var(--surface-3)] text-[var(--text-faint)]">
        <Zap className="w-3 h-3 inline mr-1" />
        Pin expected near current price range
      </div>
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

      {/* Timeline */}
      <div className="max-h-40 overflow-y-auto p-3 space-y-2">
        {updates.length === 0 ? (
          <div className="text-xs text-[var(--text-faint)] text-center py-4">
            No trade events yet
          </div>
        ) : (
          updates.map((update, idx) => <TapeEvent key={update.id || idx} update={update} />)
        )}

        {/* Live indicator */}
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
              @ {fmtPrice(update.price)}
            </span>
          )}
          {update.pnlPercent && (
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
