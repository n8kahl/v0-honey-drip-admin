/**
 * ActionRailManage - ActionRail for ENTERED Trade State (Manage Mode)
 *
 * Right panel variant for managing active trades:
 * - Position Tile (entry/current/remaining)
 * - Time/Theta Tile (decay tracking)
 * - AI Guidance Module (recommendations)
 * - Quick Actions (Trim, Move SL, Trail Stop)
 * - Exit Section (Take Profit, Full Exit)
 *
 * Only displayed when trade.state === "ENTERED"
 */

import React, { useState, useMemo, useEffect } from "react";
import type { Trade, DiscordChannel, Challenge } from "../../types";
import { cn } from "../../lib/utils";
import { useActiveTradeLiveModel } from "../../hooks/useActiveTradeLiveModel";
import { useMarketDataStore, type SymbolData } from "../../stores/marketDataStore";
import { formatTimeAgo } from "../../lib/utils/publicFormatters";
import { calculateRealizedPnL } from "../../lib/tradePnl";
import {
  fmtPrice,
  fmtPct,
  fmtDTE,
  getPnlStyle,
  chipStyle,
  getScoreStyle,
} from "../../ui/semantics";
import {
  Clock,
  Target,
  TrendingUp,
  Shield,
  Scissors,
  DollarSign,
  Bot,
  MessageSquare,
  Lock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

// ============================================================================
// Props
// ============================================================================

export interface ActionRailManageProps {
  trade: Trade;
  channels: DiscordChannel[];
  challenges: Challenge[];
  // Action callbacks
  onTrim: (percent: number) => void;
  onMoveSLToBreakeven: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
  onExit: (sendAlert: boolean) => void;
  onTakeProfit: (sendAlert: boolean) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeCandleTime(time: number): number {
  return time < 1_000_000_000_000 ? time * 1000 : time;
}

function getSessionRange(
  candles: Array<{ time: number; high: number; low: number }>
): { high: number; low: number } | null {
  if (!candles || candles.length === 0) return null;
  const lastTime = normalizeCandleTime(candles[candles.length - 1].time);
  const lastDateKey = new Date(lastTime).toDateString();
  let high = -Infinity;
  let low = Infinity;

  for (const candle of candles) {
    const timeMs = normalizeCandleTime(candle.time);
    if (new Date(timeMs).toDateString() !== lastDateKey) continue;
    high = Math.max(high, candle.high);
    low = Math.min(low, candle.low);
  }

  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return { high, low };
}

function getDteFromContract(contract: Trade["contract"]): number {
  if (contract?.expiry) {
    const expiryTime = new Date(contract.expiry).getTime();
    if (!Number.isNaN(expiryTime)) {
      return Math.max(0, Math.ceil((expiryTime - Date.now()) / (24 * 60 * 60 * 1000)));
    }
  }
  return contract?.daysToExpiry ?? 0;
}

function getTradeDirection(contract: Trade["contract"]): "bull" | "bear" {
  return contract?.type === "P" ? "bear" : "bull";
}

// ============================================================================
// Main Component
// ============================================================================

export function ActionRailManage({
  trade,
  channels,
  challenges,
  onTrim,
  onMoveSLToBreakeven,
  onTrailStop,
  onAdd,
  onExit,
  onTakeProfit,
}: ActionRailManageProps) {
  const [sendAlertOnExit, setSendAlertOnExit] = useState(true);
  const [showGuidanceDetail, setShowGuidanceDetail] = useState(true);
  const liveModel = useActiveTradeLiveModel(trade);
  const symbolData = useMarketDataStore((s) => s.symbols[trade.ticker]);
  const subscribe = useMarketDataStore((s) => s.subscribe);
  const subscribedSymbols = useMarketDataStore((s) => s.subscribedSymbols);
  const realizedPnL = useMemo(() => calculateRealizedPnL(trade), [trade]);

  useEffect(() => {
    if (trade?.ticker && !subscribedSymbols.has(trade.ticker)) {
      subscribe(trade.ticker);
    }
  }, [trade?.ticker, subscribe, subscribedSymbols]);

  if (!liveModel) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
        Loading live trade data...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-mode-enter">
      {/* Position Tile */}
      <PositionTile trade={trade} liveModel={liveModel} realizedPnL={realizedPnL} />

      {/* Time/Theta Tile */}
      <TimeThetaTile trade={trade} liveModel={liveModel} />

      {/* AI Guidance Module */}
      <AIGuidanceTile
        trade={trade}
        liveModel={liveModel}
        symbolData={symbolData}
        expanded={showGuidanceDetail}
        onToggle={() => setShowGuidanceDetail(!showGuidanceDetail)}
      />

      {/* Quick Actions Grid */}
      <QuickActionsGrid
        trade={trade}
        liveModel={liveModel}
        onTrim={onTrim}
        onMoveSLToBreakeven={onMoveSLToBreakeven}
        onTrailStop={onTrailStop}
        onAdd={onAdd}
      />

      {/* Exit Section */}
      <ExitSection
        trade={trade}
        sendAlert={sendAlertOnExit}
        onToggleSendAlert={() => setSendAlertOnExit(!sendAlertOnExit)}
        onTakeProfit={() => onTakeProfit(sendAlertOnExit)}
        onFullExit={() => onExit(sendAlertOnExit)}
      />
    </div>
  );
}

// ============================================================================
// Position Tile
// ============================================================================

function PositionTile({
  trade,
  liveModel,
  realizedPnL,
}: {
  trade: Trade;
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
  realizedPnL: ReturnType<typeof calculateRealizedPnL>;
}) {
  const contract = trade.contract;
  const entryPrice = liveModel.entryPrice;
  const currentPrice = liveModel.effectiveMid;
  const dte = getDteFromContract(contract);
  const dteInfo = fmtDTE(dte);

  // Calculate P&L
  const pnlDollar = liveModel.pnlDollars;
  const pnlPercent = liveModel.pnlPercent;
  const pnlStyle = getPnlStyle(pnlPercent);
  const realizedStyle = getPnlStyle(realizedPnL.realizedPercent);

  return (
    <div className="p-3 border-b border-[var(--border-hairline)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Position
          </span>
        </div>
        <span className={chipStyle("info")}>LOCKED</span>
      </div>

      {/* Contract */}
      <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-sm font-semibold text-[var(--text-high)]">
              {trade.ticker} ${contract?.strike}
              {contract?.type}
            </span>
            <span className={cn("text-xs font-medium ml-2", dteInfo.className)}>
              {dteInfo.text}
            </span>
          </div>
        </div>

        {/* Entry/Current Row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-[10px] text-[var(--text-faint)] uppercase">Entry</div>
            <div className="font-medium text-[var(--text-high)] tabular-nums">
              {fmtPrice(entryPrice)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-faint)] uppercase">Current</div>
            <div className={cn("font-medium tabular-nums", pnlStyle.className)}>
              {fmtPrice(currentPrice)}
            </div>
          </div>
        </div>

        {/* P&L Row */}
        <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-faint)] uppercase">P&L</span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums animate-metric-tick",
              pnlStyle.className
            )}
          >
            {fmtPct(pnlPercent)} ({pnlDollar >= 0 ? "+" : "-"}
            {fmtPrice(Math.abs(pnlDollar))})
          </span>
        </div>

        {/* Realized P&L */}
        <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-faint)] uppercase">Realized</span>
          <span className={cn("text-xs font-medium tabular-nums", realizedStyle.className)}>
            {fmtPct(realizedPnL.realizedPercent)} ({realizedPnL.realizedDollars >= 0 ? "+" : "-"}
            {fmtPrice(Math.abs(realizedPnL.realizedDollars))})
          </span>
        </div>

        {/* Remaining Position */}
        <div className="mt-2 pt-2 border-t border-[var(--border-hairline)]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-faint)]">Remaining</span>
            <span className="text-[var(--text-high)] font-medium">
              {Math.round(realizedPnL.remainingPercent)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand-primary)] rounded-full"
              style={{ width: `${realizedPnL.remainingPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Time/Theta Tile
// ============================================================================

function TimeThetaTile({
  trade,
  liveModel,
}: {
  trade: Trade;
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
}) {
  const contract = trade.contract;
  const theta = liveModel.theta || contract?.theta || 0;
  const dte = getDteFromContract(contract);

  const thetaPerHour = Math.abs(theta) / 6.5;
  const hoursHeld = liveModel.holdTimeMinutes / 60;
  const thetaBurned = thetaPerHour * hoursHeld;
  const timeLeft = liveModel.marketOpen ? liveModel.timeToCloseFormatted : "Market Closed";

  // Theta risk level
  const thetaRisk = useMemo(() => {
    if (dte === 0) return { level: "CRITICAL", className: "text-[var(--accent-negative)]" };
    if (dte <= 1) return { level: "HIGH", className: "text-[var(--accent-negative)]" };
    if (dte <= 3) return { level: "MEDIUM", className: "text-[var(--accent-warning)]" };
    return { level: "LOW", className: "text-[var(--accent-positive)]" };
  }, [dte]);

  return (
    <div className="p-3 border-b border-[var(--border-hairline)]">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
          Time & Theta
        </span>
      </div>

      <div className="space-y-2 text-xs">
        {/* Time Left */}
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-faint)]">Time to Close</span>
          <span className="text-[var(--text-high)] font-medium tabular-nums">{timeLeft}</span>
        </div>

        {/* Theta Rate */}
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-faint)]">Θ Decay</span>
          <span className="text-[var(--accent-negative)] font-medium tabular-nums">
            {thetaPerHour.toFixed(2)}/hr
          </span>
        </div>

        {/* Theta Burned */}
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-faint)]">Since Entry</span>
          <span className="text-[var(--accent-negative)] font-medium tabular-nums">
            -${thetaBurned.toFixed(2)}
          </span>
        </div>

        {/* Risk Level */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)]">
          <span className="text-[var(--text-faint)]">Risk Level</span>
          <span className={cn("font-semibold", thetaRisk.className)}>
            {thetaRisk.level === "CRITICAL" && <AlertTriangle className="w-3 h-3 inline mr-1" />}
            {thetaRisk.level}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AI Guidance Tile
// ============================================================================

interface AIGuidanceTileProps {
  trade: Trade;
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
  symbolData?: SymbolData;
  expanded: boolean;
  onToggle: () => void;
}

function AIGuidanceTile({ trade, liveModel, symbolData, expanded, onToggle }: AIGuidanceTileProps) {
  const direction = getTradeDirection(trade.contract);
  const mtfTrend = symbolData?.mtfTrend;
  const indicators = symbolData?.indicators;
  const candles1m = symbolData?.candles?.["1m"] ?? [];
  const sessionRange = useMemo(() => getSessionRange(candles1m), [candles1m]);
  const atr = indicators?.atr14 ?? 0;
  const dayRange = sessionRange ? sessionRange.high - sessionRange.low : 0;
  const atrRoom = atr > 0 ? Math.max(0, (atr - dayRange) / atr) : 0;

  const timeframes: Array<keyof NonNullable<typeof mtfTrend>> = ["1m", "5m", "15m", "60m"];
  const alignedCount = timeframes.reduce((count, key) => {
    const trend = mtfTrend?.[key];
    if (!trend) return count;
    if (direction === "bull" && trend === "bull") return count + 1;
    if (direction === "bear" && trend === "bear") return count + 1;
    return count;
  }, 0);
  const totalCount = timeframes.length;

  const rsi = indicators?.rsi14;
  const rsiState =
    rsi === undefined
      ? "—"
      : direction === "bull"
        ? rsi >= 70
          ? "overbought"
          : rsi <= 40
            ? "weak"
            : "ok"
        : rsi <= 30
          ? "oversold"
          : rsi >= 60
            ? "weak"
            : "ok";

  const thetaPerHour = Math.abs(liveModel.theta) / 6.5;
  const thetaBurnLabel = thetaPerHour > 0 ? `${thetaPerHour.toFixed(2)}/hr` : "—";

  const alignmentScore = alignedCount / totalCount;
  const guidance = useMemo(() => {
    let confidence = 50 + alignmentScore * 25;
    if (rsi !== undefined) {
      if (direction === "bull") {
        confidence += rsi >= 70 ? -8 : rsi <= 40 ? -6 : 8;
      } else {
        confidence += rsi <= 30 ? -8 : rsi >= 60 ? -6 : 8;
      }
    }
    confidence += liveModel.pnlPercent >= 0 ? 10 : -10;
    confidence += atrRoom > 0.3 ? 5 : atrRoom < 0.1 ? -5 : 0;
    confidence = clamp(confidence, 5, 95);

    let action: "HOLD" | "TRIM" | "ADD" | "TRAIL" | "EXIT" = "HOLD";
    if (liveModel.pnlPercent <= -20 || alignmentScore <= 0.25) {
      action = "EXIT";
    } else if (liveModel.pnlPercent >= 25 && alignmentScore >= 0.5) {
      action = "TRIM";
    } else if (liveModel.pnlPercent >= 10 && alignmentScore < 0.5) {
      action = "TRAIL";
    }

    const reasoningParts = [
      `${alignedCount}/${totalCount} MTF aligned`,
      rsi !== undefined ? `RSI ${rsi.toFixed(0)} (${rsiState})` : "RSI n/a",
      atr > 0 ? `ATR room ${atrRoom.toFixed(1)}x` : "ATR n/a",
      `P&L ${liveModel.pnlPercent.toFixed(1)}%`,
    ];

    return {
      action,
      confidence: Math.round(confidence),
      reasoning: `${reasoningParts.join(". ")}.`,
      metrics: [
        {
          label: "MTF aligned",
          value: `${alignedCount}/${totalCount} ${direction === "bull" ? "↑" : "↓"}`,
        },
        { label: "RSI(14)", value: rsi !== undefined ? `${rsi.toFixed(0)} (${rsiState})` : "—" },
        { label: "ATR room", value: atr > 0 ? `${atrRoom.toFixed(1)}x` : "—" },
        { label: "Theta burn", value: thetaBurnLabel },
      ],
    };
  }, [
    alignmentScore,
    alignedCount,
    totalCount,
    rsi,
    rsiState,
    direction,
    atr,
    atrRoom,
    liveModel.pnlPercent,
    thetaBurnLabel,
  ]);

  const actionColors = {
    HOLD: "text-[var(--accent-info)]",
    TRIM: "text-[var(--brand-primary)]",
    ADD: "text-[var(--accent-positive)]",
    TRAIL: "text-[var(--text-muted)]",
    EXIT: "text-[var(--accent-negative)]",
  };

  const confidenceStyle = getScoreStyle(guidance.confidence);

  // Use priceAsOf (reflects actual displayed data) instead of optionAsOf
  const lastUpdateMs = Math.max(
    liveModel.priceAsOf || 0,
    liveModel.underlyingAsOf || 0,
    symbolData?.lastUpdated || 0
  );
  const updatedLabel = lastUpdateMs > 0 ? formatTimeAgo(new Date(lastUpdateMs)) : "—";

  return (
    <div className="border-b border-[var(--border-hairline)]">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Guidance
          </span>
          <span className={cn("text-sm font-semibold", actionColors[guidance.action])}>
            {guidance.action}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium tabular-nums", confidenceStyle.className)}>
            {guidance.confidence}%
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-faint)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-faint)]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 animate-expand">
          {/* Reasoning */}
          <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)] mb-2">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              "{guidance.reasoning}"
            </p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-1.5">
            {guidance.metrics.map((metric, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-1.5 rounded bg-[var(--surface-3)] text-[10px]"
              >
                <span className="text-[var(--text-faint)]">{metric.label}</span>
                <span className="text-[var(--text-high)] font-medium">{metric.value}</span>
              </div>
            ))}
          </div>

          {/* Last Updated */}
          <div className="mt-2 text-[10px] text-[var(--text-faint)] text-center">
            Updated {updatedLabel}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Quick Actions Grid
// ============================================================================

interface QuickActionsGridProps {
  trade: Trade;
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
  onTrim: (percent: number) => void;
  onMoveSLToBreakeven: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
}

function QuickActionsGrid({
  trade,
  liveModel,
  onTrim,
  onMoveSLToBreakeven,
  onTrailStop,
  onAdd,
}: QuickActionsGridProps) {
  // Check if contract has expired - disable all actions
  const isExpired = liveModel.isExpired;

  // Check if SL can be moved to breakeven
  const entryPrice = liveModel.entryPrice || trade.entryPrice || trade.contract?.mid || 0;
  const currentPrice = liveModel.effectiveMid || trade.contract?.bid || 0;
  const canMoveToBE = !isExpired && currentPrice > entryPrice;

  // Common disabled styles
  const disabledClass =
    "bg-[var(--surface-2)]/50 border-[var(--border-hairline)]/50 cursor-not-allowed opacity-50";
  const enabledClass =
    "bg-[var(--surface-2)] border-[var(--border-hairline)] hover:bg-[var(--surface-3)] hover:border-[var(--brand-primary)]/30";

  return (
    <div className="p-3 border-b border-[var(--border-hairline)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Quick Actions
          </span>
        </div>
        {isExpired && (
          <span className="text-[10px] text-amber-400/80 italic">Contract expired</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Trim 25% */}
        <button
          onClick={() => !isExpired && onTrim(25)}
          disabled={isExpired}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded border transition-all btn-press",
            isExpired ? disabledClass : enabledClass
          )}
          title={isExpired ? "Cannot trim an expired contract" : "Trim 25% of position"}
        >
          <Scissors
            className={cn(
              "w-4 h-4 mb-1",
              isExpired ? "text-[var(--text-muted)]/50" : "text-[var(--brand-primary)]"
            )}
          />
          <span className="text-xs font-medium text-[var(--text-high)]">Trim 25%</span>
        </button>

        {/* Trim 50% */}
        <button
          onClick={() => !isExpired && onTrim(50)}
          disabled={isExpired}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded border transition-all btn-press",
            isExpired ? disabledClass : enabledClass
          )}
          title={isExpired ? "Cannot trim an expired contract" : "Trim 50% of position"}
        >
          <Scissors
            className={cn(
              "w-4 h-4 mb-1",
              isExpired ? "text-[var(--text-muted)]/50" : "text-[var(--brand-primary)]"
            )}
          />
          <span className="text-xs font-medium text-[var(--text-high)]">Trim 50%</span>
        </button>

        {/* Move SL to BE */}
        <button
          onClick={canMoveToBE ? onMoveSLToBreakeven : undefined}
          disabled={!canMoveToBE}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded border transition-all btn-press",
            canMoveToBE
              ? "bg-[var(--surface-2)] border-[var(--border-hairline)] hover:bg-[var(--surface-3)] hover:border-[var(--accent-positive)]/30"
              : disabledClass
          )}
          title={
            isExpired
              ? "Contract expired"
              : !canMoveToBE
                ? "Price must be above entry"
                : "Move stop loss to breakeven"
          }
        >
          <Shield
            className={cn(
              "w-4 h-4 mb-1",
              canMoveToBE ? "text-[var(--accent-positive)]" : "text-[var(--text-muted)]/50"
            )}
          />
          <span className="text-xs font-medium text-[var(--text-high)]">SL → BE</span>
        </button>

        {/* Trail Stop */}
        <button
          onClick={!isExpired ? onTrailStop : undefined}
          disabled={isExpired}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded border transition-all btn-press",
            isExpired
              ? disabledClass
              : "bg-[var(--surface-2)] border-[var(--border-hairline)] hover:bg-[var(--surface-3)] hover:border-[var(--text-muted)]/30"
          )}
          title={isExpired ? "Cannot trail stop on expired contract" : "Trail stop loss"}
        >
          <TrendingUp
            className={cn(
              "w-4 h-4 mb-1",
              isExpired ? "text-[var(--text-muted)]/50" : "text-[var(--text-muted)]"
            )}
          />
          <span className="text-xs font-medium text-[var(--text-high)]">Trail Stop</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Exit Section
// ============================================================================

interface ExitSectionProps {
  trade: Trade;
  sendAlert: boolean;
  onToggleSendAlert: () => void;
  onTakeProfit: () => void;
  onFullExit: () => void;
}

function ExitSection({
  trade,
  sendAlert,
  onToggleSendAlert,
  onTakeProfit,
  onFullExit,
}: ExitSectionProps) {
  return (
    <div className="p-3 mt-auto">
      {/* Alert Toggle */}
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={sendAlert}
          onChange={onToggleSendAlert}
          className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] focus:ring-offset-0"
        />
        <span className="text-xs text-[var(--text-muted)]">
          <MessageSquare className="w-3 h-3 inline mr-1" />
          Send Discord Alert
        </span>
      </label>

      {/* Exit Buttons */}
      <div className="space-y-2">
        {/* Take Profit */}
        <button
          onClick={onTakeProfit}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-medium text-sm bg-[var(--accent-positive)] text-white hover:bg-[var(--accent-positive)]/90 transition-all btn-press"
        >
          <Target className="w-4 h-4" />
          Take Profit
        </button>

        {/* Full Exit */}
        <button
          onClick={onFullExit}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-medium text-sm bg-[var(--accent-negative)] text-white hover:bg-[var(--accent-negative)]/90 transition-all btn-press"
        >
          <DollarSign className="w-4 h-4" />
          Full Exit
        </button>
      </div>
    </div>
  );
}

export default ActionRailManage;
