/**
 * NowPanelTrade - Trade Details View
 *
 * Displayed when focus.kind === "trade".
 * Shows different views based on trade state:
 * - LOADED: TradeDecisionCard (readiness, metrics, checklist)
 * - ENTERED: PositionSnapshot (P&L, risk box, signals)
 * - EXITED: TradeRecap (final P&L, summary)
 */

import React, { useMemo } from "react";
import type { Trade, TradeState, Ticker } from "../../types";
import { HDLiveChartContextAware } from "../hd/charts/HDLiveChartContextAware";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { buildChartLevelsForTrade } from "../../lib/riskEngine/chartLevels";
import { cn } from "../../lib/utils";
import {
  fmtPrice,
  fmtPct,
  fmtDelta,
  fmtDTE,
  fmtSpread,
  getStateStyle,
  getScoreStyle,
  getPnlStyle,
  chipStyle,
} from "../../ui/semantics";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Share2,
  Copy,
} from "lucide-react";

interface NowPanelTradeProps {
  trade: Trade;
  tradeState: TradeState;
  activeTicker: Ticker | null;
  watchlist?: Ticker[];
}

export function NowPanelTrade({
  trade,
  tradeState,
  activeTicker,
  watchlist = [],
}: NowPanelTradeProps) {
  // Get current price
  const currentPrice = useMemo(() => {
    const fromWatchlist = watchlist.find((t) => t.symbol === trade.ticker);
    return fromWatchlist?.last || activeTicker?.last || 0;
  }, [trade.ticker, watchlist, activeTicker]);

  // Get key levels
  const { keyLevels } = useKeyLevels(trade.ticker);
  const chartLevels = useMemo(
    () => buildChartLevelsForTrade(trade, keyLevels || undefined),
    [trade, keyLevels]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-crossfade">
      {/* Chart Section - Sticky Top */}
      <div className="flex-shrink-0 h-[40%] min-h-[240px] border-b border-[var(--border-hairline)]">
        <HDLiveChartContextAware
          ticker={trade.ticker}
          currentTrade={trade}
          tradeState={tradeState}
          activeTicker={activeTicker}
          hasLoadedContract={!!trade.contract}
          levels={chartLevels}
          keyLevels={keyLevels || undefined}
        />
      </div>

      {/* Content Section - State-dependent */}
      <div className="flex-1 overflow-y-auto">
        {tradeState === "LOADED" && (
          <TradeDecisionCard trade={trade} currentPrice={currentPrice} />
        )}
        {tradeState === "ENTERED" && (
          <PositionSnapshot trade={trade} currentPrice={currentPrice} />
        )}
        {tradeState === "EXITED" && (
          <TradeRecap trade={trade} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LOADED State: Trade Decision Card
// ============================================================================

interface TradeDecisionCardProps {
  trade: Trade;
  currentPrice: number;
}

function TradeDecisionCard({ trade, currentPrice }: TradeDecisionCardProps) {
  const contract = trade.contract;
  const dte = fmtDTE(contract?.daysToExpiry);
  const spread = contract ? fmtSpread(contract.bid, contract.ask) : null;

  // Use confluence score if available, otherwise default
  const readinessScore = trade.confluence?.score || 75;
  const scoreStyle = getScoreStyle(readinessScore);

  return (
    <div className="animate-fade-in-up">
      {/* Contract Header */}
      <div className="p-4 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-semibold text-[var(--text-high)]">
                {trade.ticker}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                {contract?.strike}
                {contract?.type}
              </span>
              <span className={cn("text-xs", dte.className)}>{dte.text}</span>
            </div>
            <div className="text-sm text-[var(--text-muted)] tabular-nums">
              {fmtPrice(contract?.mid)} · Underlying @ {fmtPrice(currentPrice)}
            </div>
          </div>

          {/* Readiness Score */}
          <div
            className={cn(
              "flex flex-col items-center justify-center w-16 h-16 rounded-lg",
              scoreStyle.bgClassName
            )}
          >
            <span className={cn("text-2xl font-bold tabular-nums", scoreStyle.className)}>
              {readinessScore}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] uppercase">
              {scoreStyle.label}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Chips */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <div className="flex flex-wrap gap-2">
          {contract?.delta && (
            <MetricChip label="Δ" value={fmtDelta(contract.delta)} />
          )}
          {spread && (
            <MetricChip
              label="Spread"
              value={spread.percent}
              kind={spread.isWide ? "warn" : "neutral"}
            />
          )}
          {contract?.iv && (
            <MetricChip
              label="IV"
              value={`${(contract.iv * 100).toFixed(0)}%`}
            />
          )}
          {contract?.volume && (
            <MetricChip
              label="Vol"
              value={contract.volume > 1000 ? `${(contract.volume / 1000).toFixed(1)}K` : contract.volume.toString()}
              kind={contract.volume > 500 ? "success" : "neutral"}
            />
          )}
          {trade.confluence?.direction && (
            <MetricChip
              label="Trend"
              value={trade.confluence.direction}
              kind={trade.confluence.direction === "LONG" ? "success" : "fail"}
            />
          )}
        </div>
      </div>

      {/* Entry Checklist Summary */}
      <div className="p-4">
        <ChecklistSummary trade={trade} />
      </div>
    </div>
  );
}

// ============================================================================
// ENTERED State: Position Snapshot
// ============================================================================

interface PositionSnapshotProps {
  trade: Trade;
  currentPrice: number;
}

function PositionSnapshot({ trade, currentPrice }: PositionSnapshotProps) {
  // Calculate P&L
  const entryPrice = trade.entryPrice || trade.contract?.mid || 0;
  const currentContractPrice = trade.contract?.mid || 0;
  const pnlDollar = currentContractPrice - entryPrice;
  const pnlPercent = entryPrice > 0 ? (pnlDollar / entryPrice) * 100 : 0;
  const pnlStyle = getPnlStyle(pnlPercent);

  return (
    <div className="animate-fade-in-up">
      {/* Large P&L Display */}
      <div className="p-6 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] text-center">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">
          Unrealized P&L
        </div>
        <div
          className={cn(
            "text-4xl font-bold tabular-nums animate-metric-tick",
            pnlStyle.className
          )}
        >
          {fmtPct(pnlPercent)}
        </div>
        <div className={cn("text-lg tabular-nums mt-1", pnlStyle.className)}>
          {pnlDollar >= 0 ? "+" : ""}
          {fmtPrice(pnlDollar)}
        </div>
      </div>

      {/* Risk Box */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Position
        </div>
        <div className="grid grid-cols-2 gap-3">
          <RiskBoxCell label="Entry" value={fmtPrice(trade.entryPrice)} />
          <RiskBoxCell label="Current" value={fmtPrice(currentContractPrice)} />
          <RiskBoxCell
            label="Target"
            value={fmtPrice(trade.targetPrice)}
            kind="success"
          />
          <RiskBoxCell
            label="Stop"
            value={fmtPrice(trade.stopLoss)}
            kind="fail"
          />
        </div>
      </div>

      {/* Greeks Bar */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Greeks
        </div>
        <div className="flex items-center justify-between">
          <GreekCell label="Δ" value={trade.contract?.delta} />
          <GreekCell label="Γ" value={trade.contract?.gamma} decimals={4} />
          <GreekCell label="Θ" value={trade.contract?.theta} negative />
          <GreekCell label="IV" value={trade.contract?.iv} percent />
        </div>
      </div>

      {/* Trade Updates Timeline - Compact */}
      {trade.updates && trade.updates.length > 0 && (
        <div className="p-4">
          <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
            Recent Activity
          </div>
          <div className="space-y-2">
            {trade.updates.slice(-3).map((update, idx) => (
              <div
                key={update.id || idx}
                className="flex items-center gap-2 text-xs text-[var(--text-muted)]"
              >
                <Clock className="w-3 h-3 text-[var(--text-faint)]" />
                <span className="capitalize">{update.type}</span>
                {update.price && (
                  <span className="tabular-nums">@ {fmtPrice(update.price)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXITED State: Trade Recap
// ============================================================================

interface TradeRecapProps {
  trade: Trade;
}

function TradeRecap({ trade }: TradeRecapProps) {
  const entryPrice = trade.entryPrice || 0;
  const exitPrice = trade.exitPrice || 0;
  const pnlDollar = exitPrice - entryPrice;
  const pnlPercent = entryPrice > 0 ? (pnlDollar / entryPrice) * 100 : 0;
  const pnlStyle = getPnlStyle(pnlPercent);
  const isWin = pnlPercent > 0;

  return (
    <div className="animate-fade-in-up">
      {/* Final P&L */}
      <div
        className={cn(
          "p-8 text-center",
          isWin ? "bg-[var(--accent-positive)]/5" : "bg-[var(--accent-negative)]/5"
        )}
      >
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
          {isWin ? "Winner" : "Loss"}
        </div>
        <div
          className={cn("text-5xl font-bold tabular-nums", pnlStyle.className)}
        >
          {fmtPct(pnlPercent)}
        </div>
        <div className="text-sm text-[var(--text-muted)] mt-2">
          {trade.ticker} · {trade.contract?.strike}
          {trade.contract?.type}
        </div>
      </div>

      {/* Entry/Exit Summary */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded bg-[var(--surface-2)]">
            <div className="text-xs text-[var(--text-muted)] mb-1">Entry</div>
            <div className="text-lg font-medium tabular-nums text-[var(--text-high)]">
              {fmtPrice(entryPrice)}
            </div>
          </div>
          <div className="text-center p-3 rounded bg-[var(--surface-2)]">
            <div className="text-xs text-[var(--text-muted)] mb-1">Exit</div>
            <div className="text-lg font-medium tabular-nums text-[var(--text-high)]">
              {fmtPrice(exitPrice)}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 flex gap-3">
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[var(--brand-primary)] text-black font-medium text-sm hover:bg-[var(--brand-primary-hover)] transition-colors btn-press">
          <Share2 className="w-4 h-4" />
          Share Recap
        </button>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[var(--surface-2)] text-[var(--text-high)] font-medium text-sm hover:bg-[var(--surface-3)] transition-colors btn-press">
          <Copy className="w-4 h-4" />
          Duplicate
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function MetricChip({
  label,
  value,
  kind = "neutral",
}: {
  label: string;
  value: string;
  kind?: "success" | "warn" | "fail" | "neutral";
}) {
  return (
    <span className={cn(chipStyle(kind), "hover-lift-sm")}>
      <span className="text-[var(--text-faint)]">{label}</span>{" "}
      <span className="font-medium">{value}</span>
    </span>
  );
}

function RiskBoxCell({
  label,
  value,
  kind,
}: {
  label: string;
  value: string;
  kind?: "success" | "fail";
}) {
  const colorClass =
    kind === "success"
      ? "text-[var(--accent-positive)]"
      : kind === "fail"
      ? "text-[var(--accent-negative)]"
      : "text-[var(--text-high)]";

  return (
    <div className="p-2.5 rounded bg-[var(--surface-2)]">
      <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className={cn("text-sm font-medium tabular-nums", colorClass)}>
        {value}
      </div>
    </div>
  );
}

function GreekCell({
  label,
  value,
  decimals = 2,
  negative = false,
  percent = false,
}: {
  label: string;
  value?: number;
  decimals?: number;
  negative?: boolean;
  percent?: boolean;
}) {
  const formatted =
    value != null
      ? percent
        ? `${(value * 100).toFixed(0)}%`
        : value.toFixed(decimals)
      : "—";

  const colorClass = negative
    ? "text-[var(--accent-negative)]"
    : "text-[var(--text-high)]";

  return (
    <div className="text-center">
      <div className="text-[10px] text-[var(--text-faint)]">{label}</div>
      <div className={cn("text-sm font-medium tabular-nums", colorClass)}>
        {formatted}
      </div>
    </div>
  );
}

function ChecklistSummary({ trade }: { trade: Trade }) {
  // Mock checklist items - would come from trade.setupConditions in real impl
  const items = [
    { label: "Trend aligned", passed: true },
    { label: "Volume confirmed", passed: true },
    { label: "Spread acceptable", passed: true },
    { label: "IV favorable", passed: false },
    { label: "Key level proximity", passed: true },
    { label: "Time window", passed: true },
  ];

  const passedCount = items.filter((i) => i.passed).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
          Entry Checklist
        </span>
        <span className="text-xs text-[var(--text-faint)]">
          {passedCount}/{items.length} passed
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, idx) => (
          <span
            key={idx}
            className={cn(
              chipStyle(item.passed ? "success" : "warn"),
              "text-[10px]"
            )}
          >
            {item.passed ? (
              <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            ) : (
              <AlertTriangle className="w-3 h-3 mr-1 inline" />
            )}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default NowPanelTrade;
