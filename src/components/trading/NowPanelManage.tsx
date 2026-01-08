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
import { useMarketDataStore, type Candle, type SymbolData } from "../../stores/marketDataStore";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { getHealthStyle, getSourceBadgeStyle } from "../../lib/market/dataFreshness";
import { cn, formatPrice } from "../../lib/utils";
import { rsiWilder, atrWilder } from "../../lib/indicators";
import { calculateRealizedPnL } from "../../lib/tradePnl";
import { fmtDTE, getPnlStyle, formatExpirationShort } from "../../ui/semantics";
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
  RefreshCw,
  Bell,
  Scissors,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { FlowDashboard } from "../hd/flow";

// ============================================================================
// Helper Functions
// ============================================================================

// Format price timestamp with age indicator (NEW - for P&L accuracy)
function formatTimestamp(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// Props
// ============================================================================

interface NowPanelManageProps {
  trade: Trade;
  activeTicker: Ticker | null;
  watchlist?: Ticker[];
  // Action callbacks (optional - absorbed from ActionRail)
  onTrim?: (percent: number) => void;
  onMoveSLToBreakeven?: () => void;
  onTrailStop?: () => void;
  onAdd?: () => void;
  onExit?: (sendAlert: boolean) => void;
  onTakeProfit?: (sendAlert: boolean) => void;
  onBroadcastUpdate?: (message: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function NowPanelManage({
  trade,
  onTrim,
  onMoveSLToBreakeven,
  onTrailStop,
  onAdd,
  onExit,
  onTakeProfit,
  onBroadcastUpdate,
}: NowPanelManageProps) {
  // Use canonical live model hook - SINGLE SOURCE OF TRUTH
  const liveModel = useActiveTradeLiveModel(trade);
  const realizedPnL = useMemo(() => calculateRealizedPnL(trade), [trade]);
  // Use trade state for "closed" status (not trim %, since position sizes aren't tracked)
  const isClosed = trade.state === "EXITED";

  // Get additional context data
  const symbolData = useMarketDataStore((s) => s.symbols[trade.ticker]);
  const indicators = symbolData?.indicators;
  const mtfTrend = symbolData?.mtfTrend;
  const strategySignals = symbolData?.strategySignals || [];
  const { keyLevels } = useKeyLevels(trade.ticker);

  // Get subscribe action from store
  const subscribe = useMarketDataStore((s) => s.subscribe);
  const subscribedSymbols = useMarketDataStore((s) => s.subscribedSymbols);

  // Macro Context for Global Market View
  const spx = useMarketDataStore((s) => s.symbols["SPX"]);
  const ndx = useMarketDataStore((s) => s.symbols["NDX"]);
  const vix = useMarketDataStore((s) => s.symbols["VIX"]);

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
      <PositionHUD
        trade={trade}
        liveModel={liveModel}
        realizedPnL={realizedPnL}
        isClosed={isClosed}
      />

      {/* Expired Contract Warning Banner */}
      {liveModel.isExpired && (
        <div className="mx-4 my-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-500">
              Contract Expired - Manual Exit Required
            </span>
          </div>
          <p className="text-xs text-amber-400/80 mt-1.5 ml-6">
            This contract has expired. Click &quot;Full Exit&quot; in the action panel to close this
            position and move it to history.
          </p>
        </div>
      )}

      {/* Greeks Strip */}
      <GreeksStrip liveModel={liveModel} />

      {/* Options Flow Dashboard */}
      <div className="px-4 py-2">
        <FlowDashboard
          symbol={trade.ticker}
          tradeDirection={trade.contract?.type === "C" ? "LONG" : "SHORT"}
          defaultExpanded={false}
          compact={false}
        />
      </div>

      {/* Levels / ATR / Positioning - Middle ~40% */}
      <LevelsATRPanel
        trade={trade}
        liveModel={liveModel}
        currentPrice={liveModel.underlyingPrice}
        keyLevels={keyLevels}
        indicators={indicators}
        mtfTrend={mtfTrend}
        strategySignals={strategySignals}
        candles={symbolData?.candles?.["1m"] ?? []}
        dailyCandles={symbolData?.candles?.["1D"] ?? []}
        symbolData={symbolData}
        spx={spx}
        ndx={ndx}
        vix={vix}
      />

      {/* Trade Tape - Bottom ~30% */}
      <TradeTapeSection trade={trade} />

      {/* Action Buttons - Absorbed from ActionRail */}
      {(onTrim || onExit || onTakeProfit) && (
        <QuickActionsSection
          trade={trade}
          liveModel={liveModel}
          onTrim={onTrim}
          onMoveSLToBreakeven={onMoveSLToBreakeven}
          onTrailStop={onTrailStop}
          onAdd={onAdd}
          onExit={onExit}
          onTakeProfit={onTakeProfit}
          onBroadcastUpdate={onBroadcastUpdate}
        />
      )}
    </div>
  );
}

// ============================================================================
// Position HUD - Large P&L Display + Progress + Data Health
// ============================================================================

interface PositionHUDProps {
  trade: Trade;
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
  realizedPnL: ReturnType<typeof calculateRealizedPnL>;
  isClosed: boolean;
}

function PositionHUD({ trade, liveModel, realizedPnL, isClosed }: PositionHUDProps) {
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
      <div className="px-4 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Check if contract has expired */}
          {contract?.expiry && new Date(contract.expiry) < new Date() ? (
            <>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap text-amber-400">
                EXPIRED
              </span>
            </>
          ) : liveModel.optionSource === "rest" &&
            (liveModel.overallHealth === "degraded" || liveModel.overallHealth === "stale") ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
              <span className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap text-yellow-400">
                {liveModel.optionIsStale ? "Greeks: Stale" : "Options: Greek"}
              </span>
            </>
          ) : liveModel.overallHealth === "healthy" ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-green-400" />
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide whitespace-nowrap",
                  healthStyle.className
                )}
              >
                {healthStyle.label}
              </span>
            </>
          ) : liveModel.overallHealth === "degraded" ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-yellow-400" />
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide whitespace-nowrap",
                  healthStyle.className
                )}
              >
                {healthStyle.label}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide whitespace-nowrap",
                  healthStyle.className
                )}
              >
                {healthStyle.label}
              </span>
            </>
          )}
        </div>
        {/* Don't show source badges for expired contracts */}
        {!(contract?.expiry && new Date(contract.expiry) < new Date()) && (
          <div className="flex items-center flex-wrap gap-2 text-[10px] text-[var(--text-faint)] ml-auto">
            <span
              className={cn(
                "px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0",
                getSourceBadgeStyle(liveModel.optionSource)
              )}
            >
              Options: {liveModel.optionSource === "websocket" ? "WS" : "REST"}
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0",
                getSourceBadgeStyle(liveModel.greeksSource === "live" ? "rest" : "static")
              )}
            >
              {liveModel.optionIsStale ? "Greeks: Stale" : "Options: Greeks"}
            </span>
          </div>
        )}
      </div>

      {/* Row 1: P&L Display + R-Multiple */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between">
          {/* P&L Display */}
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">
              {isClosed ? "Final P&L" : "Unrealized P&L"}
            </div>
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "text-3xl font-bold tabular-nums transition-all duration-200",
                  pnlFlash === "up" && "animate-pulse text-[var(--accent-positive)]",
                  pnlFlash === "down" && "animate-pulse text-[var(--accent-negative)]",
                  pnlStyle.className
                )}
              >
                {isClosed
                  ? `${realizedPnL.realizedPercent >= 0 ? "+" : ""}${realizedPnL.realizedPercent.toFixed(1)}%`
                  : `${liveModel.pnlPercent >= 0 ? "+" : ""}${liveModel.pnlPercent.toFixed(1)}%`}
              </span>
              <span className={cn("text-lg tabular-nums", pnlStyle.className)}>
                {isClosed
                  ? `${realizedPnL.realizedDollars >= 0 ? "+" : "-"}$${Math.abs(realizedPnL.realizedDollars).toFixed(0)}`
                  : `${liveModel.pnlDollars >= 0 ? "+" : ""}$${Math.abs(liveModel.pnlDollars).toFixed(0)}`}
              </span>
            </div>
            {!isClosed && realizedPnL.trimmedPercent > 0 && (
              <div className="mt-2 text-xs text-[var(--text-faint)] tabular-nums">
                Realized {realizedPnL.realizedPercent >= 0 ? "+" : ""}
                {realizedPnL.realizedPercent.toFixed(1)}% (
                {realizedPnL.realizedDollars >= 0 ? "+" : "-"}$
                {formatPrice(Math.abs(realizedPnL.realizedDollars))}) • Remaining{" "}
                {Math.round(realizedPnL.remainingPercent)}%
              </div>
            )}
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
            <span className={cn("text-xs font-medium flex items-center gap-1", dteInfo.className)}>
              {dteInfo.text}
              {contract?.expiry && (
                <>
                  <span className="text-[var(--text-faint)]">•</span>
                  <span className="text-[10px]">Exp: {formatExpirationShort(contract.expiry)}</span>
                </>
              )}
            </span>
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
            <span className="text-[var(--text-faint)]">{liveModel.priceLabel}:</span>{" "}
            <span className={cn("tabular-nums font-medium", pnlStyle.className)}>
              ${liveModel.effectiveMid.toFixed(2)}
            </span>
            {liveModel.bid > 0 && liveModel.ask > 0 && (
              <span className="text-[var(--text-faint)] ml-1">
                ({liveModel.bid.toFixed(2)}/{liveModel.ask.toFixed(2)})
              </span>
            )}
            {/* Show price source label for non-live prices */}
            {liveModel.priceSource !== "websocket" && (
              <span
                className={cn(
                  "ml-2 text-[10px]",
                  liveModel.priceSource === "snapshot"
                    ? "text-[var(--text-muted)]"
                    : liveModel.priceAge < 5000
                      ? "text-green-400"
                      : liveModel.priceAge < 30000
                        ? "text-yellow-400"
                        : "text-red-400"
                )}
              >
                {liveModel.priceLabel}
              </span>
            )}
          </span>
          <span className="text-[var(--text-faint)]">|</span>
          <span>
            <span className="text-[var(--text-faint)]">Underlying:</span>{" "}
            {liveModel.underlyingPrice !== null ? (
              <>
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
              </>
            ) : (
              <span className="tabular-nums text-[var(--text-muted)]">N/A</span>
            )}
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
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
  currentPrice: number | null;
  keyLevels: any;
  indicators: any;
  mtfTrend: any;
  strategySignals: any[];
  candles: Candle[];
  dailyCandles: Candle[];
  symbolData?: SymbolData;
  spx?: SymbolData;
  ndx?: SymbolData;
  vix?: SymbolData;
}

function normalizeCandleTime(time: number): number {
  return time < 1_000_000_000_000 ? time * 1000 : time;
}

function getSessionRange(
  candles: Candle[],
  fallback: number | null
): { high: number; low: number } {
  const safeFallback = fallback ?? 0;
  if (!candles || candles.length === 0) {
    return { high: safeFallback, low: safeFallback };
  }

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

  if (!Number.isFinite(high) || !Number.isFinite(low)) {
    return { high: safeFallback, low: safeFallback };
  }

  return { high, low };
}

function LevelsATRPanel({
  trade,
  liveModel,
  currentPrice,
  keyLevels,
  indicators,
  mtfTrend,
  strategySignals,
  candles,
  dailyCandles,
  symbolData,
  spx, // Destructured spx
  ndx, // Destructured ndx
  vix, // Destructured vix
}: LevelsATRPanelProps) {
  const [mtfExpanded, setMtfExpanded] = useState(true);

  // Build key levels array
  const levels = useMemo(() => {
    const result: { label: string; price: number; type: "support" | "resistance" | "neutral" }[] =
      [];

    if (keyLevels?.vwap) result.push({ label: "VWAP", price: keyLevels.vwap, type: "neutral" });
    if (keyLevels?.priorDayHigh)
      result.push({ label: "PDH", price: keyLevels.priorDayHigh, type: "resistance" });
    if (keyLevels?.priorDayLow)
      result.push({ label: "PDL", price: keyLevels.priorDayLow, type: "support" });
    if (keyLevels?.orbHigh)
      result.push({ label: "ORH", price: keyLevels.orbHigh, type: "resistance" });
    if (keyLevels?.orbLow) result.push({ label: "ORL", price: keyLevels.orbLow, type: "support" });

    // Enriched Levels
    if (keyLevels?.optionsFlow?.gammaWall) {
      result.push({
        label: "GEX Wall",
        price: keyLevels.optionsFlow.gammaWall,
        type: "neutral",
      });
    }

    if (keyLevels?.smcLevels) {
      keyLevels.smcLevels.slice(0, 5).forEach((sl: any) => {
        result.push({
          label: sl.label.split(" ")[0],
          price: sl.price,
          type: sl.type.includes("high") || sl.type.includes("bear") ? "resistance" : "support",
        });
      });
    }

    return result.sort((a, b) => a.price - b.price);
  }, [keyLevels]);

  // Calculate ATR metrics using DAILY ATR (not 1m ATR)
  const atrMetrics = useMemo(() => {
    // Calculate daily ATR from daily candles (proper ATR for session context)
    let dailyAtr = 0;
    if (dailyCandles && dailyCandles.length >= 15) {
      const highs = dailyCandles.map((c) => c.high);
      const lows = dailyCandles.map((c) => c.low);
      const closes = dailyCandles.map((c) => c.close);
      const atrArray = atrWilder(highs, lows, closes, 14);
      dailyAtr = atrArray[atrArray.length - 1] || 0;
    }

    // Fallback to indicators.atr14 scaled up if no daily data
    // (1m ATR * 20 ≈ rough daily range estimate)
    const atr = dailyAtr > 0 ? dailyAtr : (indicators?.atr14 || 0) * 20;

    const sessionRange = getSessionRange(candles, currentPrice);
    const dayHigh = sessionRange.high;
    const dayLow = sessionRange.low;
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
  }, [indicators, candles, dailyCandles, currentPrice]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Macro Indicators Bar (Global Market Sentiment) */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-medium">SPX</span>
          <span
            className={cn(
              "text-xs font-bold tabular-nums",
              (spx?.changePercent || 0) >= 0
                ? "text-[var(--accent-positive)]"
                : "text-[var(--accent-negative)]"
            )}
          >
            {(spx?.changePercent || 0) >= 0 ? "+" : ""}
            {(spx?.changePercent || 0).toFixed(2)}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-medium">NDX</span>
          <span
            className={cn(
              "text-xs font-bold tabular-nums",
              (ndx?.changePercent || 0) >= 0
                ? "text-[var(--accent-positive)]"
                : "text-[var(--accent-negative)]"
            )}
          >
            {(ndx?.changePercent || 0) >= 0 ? "+" : ""}
            {(ndx?.changePercent || 0).toFixed(2)}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-medium">VIX</span>
          <span
            className={cn(
              "text-xs font-bold tabular-nums",
              (vix?.price || 0) >= 20
                ? "text-[var(--accent-negative)]"
                : (vix?.price || 0) >= 15
                  ? "text-amber-400"
                  : "text-[var(--accent-positive)]"
            )}
          >
            {(vix?.price || 0).toFixed(1)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-medium">Bias</span>
          <span
            className={cn(
              "text-xs font-bold",
              (spx?.changePercent || 0) > 0.3
                ? "text-[var(--accent-positive)]"
                : (spx?.changePercent || 0) < -0.3
                  ? "text-[var(--accent-negative)]"
                  : "text-[var(--text-med)]"
            )}
          >
            {(spx?.changePercent || 0) > 0.3
              ? "BULL"
              : (spx?.changePercent || 0) < -0.3
                ? "BEAR"
                : "CHOP"}
          </span>
        </div>
      </div>

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

      {/* Symbol Signals (Strategy Alerts) */}
      {strategySignals.length > 0 && (
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Bell className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Strategy Signals
            </span>
          </div>
          <div className="space-y-1.5">
            {strategySignals.slice(0, 3).map((sig, idx) => (
              <div
                key={idx}
                className="flex gap-2 text-xs bg-[var(--surface-2)] p-2 rounded border border-[var(--border-hairline)]"
              >
                <span
                  className={cn(
                    "font-bold shrink-0",
                    sig.direction === "bullish"
                      ? "text-[var(--accent-positive)]"
                      : sig.direction === "bearish"
                        ? "text-[var(--accent-negative)]"
                        : "text-[var(--text-muted)]"
                  )}
                >
                  {sig.direction === "bullish" ? "↑" : sig.direction === "bearish" ? "↓" : "•"}
                </span>
                <span className="text-[var(--text-high)]">{sig.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <MTFLadder mtfTrend={mtfTrend} symbolData={symbolData} indicators={indicators} />
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
  currentPrice: number | null;
}) {
  // Use first level price as fallback when currentPrice is null
  const safePrice = currentPrice ?? levels[0]?.price ?? 0;
  const minPrice = Math.min(...levels.map((l) => l.price), safePrice) * 0.998;
  const maxPrice = Math.max(...levels.map((l) => l.price), safePrice) * 1.002;
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
      {currentPrice !== null && (
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ left: `${getPosition(currentPrice)}%` }}
        >
          <div className="w-2 h-2 bg-[var(--text-high)] rounded-full transform -translate-x-1/2" />
        </div>
      )}
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

interface MTFLadderProps {
  mtfTrend: Record<string, string> | undefined;
  symbolData?: SymbolData;
  indicators?: any;
}

function MTFLadder({ mtfTrend, symbolData, indicators }: MTFLadderProps) {
  // Map store timeframe keys to display keys
  // Store uses "60m", UI might want "1h"
  const timeframes = [
    { key: "1m", label: "1m" },
    { key: "5m", label: "5m" },
    { key: "15m", label: "15m" },
    { key: "60m", label: "1h" },
  ] as const;

  // DEBUG: Log what data we have
  console.log("[MTFLadder-Manage] Data check:", {
    hasSymbolData: !!symbolData,
    symbol: symbolData?.symbol,
    candle1m: symbolData?.candles?.["1m"]?.length || 0,
    candle5m: symbolData?.candles?.["5m"]?.length || 0,
    candle15m: symbolData?.candles?.["15m"]?.length || 0,
    candle60m: symbolData?.candles?.["60m"]?.length || 0,
    mtfTrend: mtfTrend,
  });

  // Calculate RSI for each timeframe from their respective candles (like SetupWorkspace)
  const perTfRsi = useMemo(() => {
    const result: Record<string, number | null> = {
      "1m": indicators?.rsi14 ?? null,
      "5m": null,
      "15m": null,
      "60m": null,
    };

    // Calculate RSI for higher timeframes if candles are available
    const timeframesToCalc = ["5m", "15m", "60m"] as const;
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
  }, [indicators?.rsi14, symbolData]);

  // Get trend direction from mtfTrend
  const getTrendArrow = (trend: string | undefined) => {
    switch (trend) {
      case "bull":
        return <ArrowUp className="w-3 h-3 text-[var(--accent-positive)]" />;
      case "bear":
        return <ArrowDown className="w-3 h-3 text-[var(--accent-negative)]" />;
      default:
        return <ArrowRight className="w-3 h-3 text-[var(--text-faint)]" />;
    }
  };

  // Get RSI color based on overbought/oversold levels
  const getRsiStyle = (rsi: number | null) => {
    if (rsi === null) return "text-[var(--text-muted)]";
    if (rsi >= 70) return "text-[var(--accent-negative)]"; // Overbought
    if (rsi <= 30) return "text-[var(--accent-positive)]"; // Oversold
    return "text-[var(--text-high)]";
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {timeframes.map(({ key, label }) => {
        // mtfTrend[key] is a string: "bull" | "bear" | "neutral"
        const trendString = mtfTrend?.[key];
        const rsi = perTfRsi[key];

        return (
          <div
            key={key}
            className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)] text-center"
          >
            <div className="text-[10px] text-[var(--text-faint)] uppercase mb-1">{label}</div>
            <div className="flex items-center justify-center gap-1 mb-1">
              {getTrendArrow(trendString)}
              <span className={cn("text-xs font-medium tabular-nums", getRsiStyle(rsi))}>
                {rsi !== null ? Math.round(rsi) : "—"}
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

// ============================================================================
// Quick Actions Section - Absorbed from ActionRail
// ============================================================================

interface QuickActionsSectionProps {
  trade: Trade;
  liveModel: NonNullable<ReturnType<typeof useActiveTradeLiveModel>>;
  onTrim?: (percent: number) => void;
  onMoveSLToBreakeven?: () => void;
  onTrailStop?: () => void;
  onAdd?: () => void;
  onExit?: (sendAlert: boolean) => void;
  onTakeProfit?: (sendAlert: boolean) => void;
  onBroadcastUpdate?: (message: string) => void;
}

function QuickActionsSection({
  trade,
  liveModel,
  onTrim,
  onMoveSLToBreakeven,
  onTrailStop,
  onAdd,
  onExit,
  onTakeProfit,
  onBroadcastUpdate,
}: QuickActionsSectionProps) {
  const [sendAlertOnExit, setSendAlertOnExit] = useState(true);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [showBroadcast, setShowBroadcast] = useState(false);

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

  const handleBroadcast = () => {
    if (onBroadcastUpdate && broadcastMessage.trim()) {
      onBroadcastUpdate(broadcastMessage.trim());
      setBroadcastMessage("");
      setShowBroadcast(false);
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-[var(--border-hairline)] bg-[var(--surface-1)]">
      {/* Quick Actions Grid */}
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

        <div className="grid grid-cols-4 gap-2">
          {/* Trim 25% */}
          <button
            onClick={() => !isExpired && onTrim?.(25)}
            disabled={isExpired || !onTrim}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded border transition-all btn-press",
              isExpired || !onTrim ? disabledClass : enabledClass
            )}
            title={isExpired ? "Cannot trim an expired contract" : "Trim 25% of position"}
          >
            <Scissors
              className={cn(
                "w-3.5 h-3.5 mb-0.5",
                isExpired || !onTrim ? "text-[var(--text-muted)]/50" : "text-[var(--brand-primary)]"
              )}
            />
            <span className="text-[10px] font-medium text-[var(--text-high)]">25%</span>
          </button>

          {/* Trim 50% */}
          <button
            onClick={() => !isExpired && onTrim?.(50)}
            disabled={isExpired || !onTrim}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded border transition-all btn-press",
              isExpired || !onTrim ? disabledClass : enabledClass
            )}
            title={isExpired ? "Cannot trim an expired contract" : "Trim 50% of position"}
          >
            <Scissors
              className={cn(
                "w-3.5 h-3.5 mb-0.5",
                isExpired || !onTrim ? "text-[var(--text-muted)]/50" : "text-[var(--brand-primary)]"
              )}
            />
            <span className="text-[10px] font-medium text-[var(--text-high)]">50%</span>
          </button>

          {/* Move SL to BE */}
          <button
            onClick={canMoveToBE ? onMoveSLToBreakeven : undefined}
            disabled={!canMoveToBE || !onMoveSLToBreakeven}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded border transition-all btn-press",
              canMoveToBE && onMoveSLToBreakeven
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
                "w-3.5 h-3.5 mb-0.5",
                canMoveToBE && onMoveSLToBreakeven
                  ? "text-[var(--accent-positive)]"
                  : "text-[var(--text-muted)]/50"
              )}
            />
            <span className="text-[10px] font-medium text-[var(--text-high)]">SL→BE</span>
          </button>

          {/* Trail Stop */}
          <button
            onClick={!isExpired ? onTrailStop : undefined}
            disabled={isExpired || !onTrailStop}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded border transition-all btn-press",
              isExpired || !onTrailStop
                ? disabledClass
                : "bg-[var(--surface-2)] border-[var(--border-hairline)] hover:bg-[var(--surface-3)] hover:border-[var(--text-muted)]/30"
            )}
            title={isExpired ? "Cannot trail stop on expired contract" : "Trail stop loss"}
          >
            <TrendingUp
              className={cn(
                "w-3.5 h-3.5 mb-0.5",
                isExpired || !onTrailStop
                  ? "text-[var(--text-muted)]/50"
                  : "text-[var(--text-muted)]"
              )}
            />
            <span className="text-[10px] font-medium text-[var(--text-high)]">Trail</span>
          </button>
        </div>
      </div>

      {/* Exit Section */}
      <div className="p-3">
        {/* Alert Toggle */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sendAlertOnExit}
            onChange={() => setSendAlertOnExit(!sendAlertOnExit)}
            className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--text-muted)]">
            <MessageSquare className="w-3 h-3 inline mr-1" />
            Send Discord Alert on Exit
          </span>
        </label>

        {/* Exit Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Take Profit */}
          <button
            onClick={() => onTakeProfit?.(sendAlertOnExit)}
            disabled={!onTakeProfit}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 rounded font-medium text-sm transition-all btn-press",
              onTakeProfit
                ? "bg-[var(--accent-positive)] text-white hover:bg-[var(--accent-positive)]/90"
                : disabledClass
            )}
          >
            <Target className="w-3.5 h-3.5" />
            Take Profit
          </button>

          {/* Full Exit */}
          <button
            onClick={() => onExit?.(sendAlertOnExit)}
            disabled={!onExit}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 rounded font-medium text-sm transition-all btn-press",
              onExit
                ? "bg-[var(--accent-negative)] text-white hover:bg-[var(--accent-negative)]/90"
                : disabledClass
            )}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Full Exit
          </button>
        </div>

        {/* Broadcast Update Button */}
        {onBroadcastUpdate && (
          <div className="mt-3 pt-3 border-t border-[var(--border-hairline)]">
            {!showBroadcast ? (
              <button
                onClick={() => setShowBroadcast(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded font-medium text-sm bg-[var(--surface-2)] text-[var(--text-high)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)] transition-all btn-press"
              >
                <Bell className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                Broadcast Update
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter your update message..."
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded resize-none focus:outline-none focus:border-[var(--brand-primary)]"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBroadcast(false)}
                    className="flex-1 py-1.5 rounded text-xs font-medium bg-[var(--surface-3)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBroadcast}
                    disabled={!broadcastMessage.trim()}
                    className={cn(
                      "flex-1 py-1.5 rounded text-xs font-medium transition-colors",
                      broadcastMessage.trim()
                        ? "bg-[var(--brand-primary)] text-black hover:opacity-90"
                        : "bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed"
                    )}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default NowPanelManage;
