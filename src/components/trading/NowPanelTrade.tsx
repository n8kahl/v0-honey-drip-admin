/**
 * NowPanelTrade - Trade Details View
 *
 * Displayed when focus.kind === "trade".
 * Shows different views based on trade state:
 * - WATCHING: TradePreviewCard (contract preview, suggested levels, greeks)
 * - LOADED: TradeDecisionCard (readiness, metrics, checklist)
 * - ENTERED: Routes to NowPanelManage (handled in NowPanel.tsx)
 * - EXITED: TradeRecap (final P&L, summary)
 */

import React, { useMemo, useState } from "react";
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
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { DiscordChannel, Challenge } from "../../types";

interface NowPanelTradeProps {
  trade: Trade;
  tradeState: TradeState;
  activeTicker: Ticker | null;
  watchlist?: Ticker[];
  // Alert settings for LOADED state
  channels?: DiscordChannel[];
  challenges?: Challenge[];
  selectedChannels?: string[];
  selectedChallenges?: string[];
  onChannelsChange?: (channels: string[]) => void;
  onChallengesChange?: (challenges: string[]) => void;
  onEnterAndAlert?: (channelIds: string[], challengeIds: string[]) => void;
}

export function NowPanelTrade({
  trade,
  tradeState,
  activeTicker,
  watchlist = [],
  channels = [],
  challenges = [],
  selectedChannels = [],
  selectedChallenges = [],
  onChannelsChange,
  onChallengesChange,
  onEnterAndAlert,
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
    <div className="h-full flex flex-col overflow-hidden min-h-0 animate-crossfade">
      {/* Chart Section - Fixed height to leave room for content */}
      <div className="flex-shrink-0 h-[240px] min-h-[180px] border-b border-[var(--border-hairline)]">
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

      {/* Content Section - State-dependent, scrollable with more space */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tradeState === "WATCHING" && (
          <TradePreviewCard trade={trade} currentPrice={currentPrice} />
        )}
        {tradeState === "LOADED" && (
          <TradeDecisionCard
            trade={trade}
            currentPrice={currentPrice}
            channels={channels}
            challenges={challenges}
            selectedChannels={selectedChannels}
            selectedChallenges={selectedChallenges}
            onChannelsChange={onChannelsChange}
            onChallengesChange={onChallengesChange}
            onEnterAndAlert={onEnterAndAlert}
          />
        )}
        {/* Note: ENTERED state routes to NowPanelManage - handled in NowPanel.tsx */}
        {tradeState === "EXITED" && <TradeRecap trade={trade} />}
      </div>
    </div>
  );
}

// ============================================================================
// WATCHING State: Trade Preview Card
// ============================================================================

interface TradePreviewCardProps {
  trade: Trade;
  currentPrice: number;
}

function TradePreviewCard({ trade, currentPrice }: TradePreviewCardProps) {
  const contract = trade.contract;
  const dte = fmtDTE(contract?.daysToExpiry);
  const spread = contract ? fmtSpread(contract.bid, contract.ask) : null;

  // Calculate suggested levels based on contract
  const suggestedTarget = trade.targetPrice || (contract?.mid ? contract.mid * 1.5 : 0);
  const suggestedStop = trade.stopLoss || (contract?.mid ? contract.mid * 0.5 : 0);
  const riskReward =
    suggestedStop > 0
      ? ((suggestedTarget - (contract?.mid || 0)) / ((contract?.mid || 0) - suggestedStop)).toFixed(
          1
        )
      : "—";

  return (
    <div className="animate-fade-in-up">
      {/* Preview Header */}
      <div className="p-4 border-b border-[var(--border-hairline)] bg-gradient-to-r from-[var(--brand-primary)]/5 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-xs font-medium text-[var(--brand-primary)] uppercase tracking-wide">
            Contract Preview
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-semibold text-[var(--text-high)]">{trade.ticker}</span>
              <span className="text-sm text-[var(--text-muted)]">
                {contract?.strike}
                {contract?.type}
              </span>
              <span className={cn("text-xs", dte.className)}>{dte.text}</span>
            </div>
            <div className="text-sm text-[var(--text-muted)] tabular-nums">
              Bid {fmtPrice(contract?.bid)} · Ask {fmtPrice(contract?.ask)} · Mid{" "}
              {fmtPrice(contract?.mid)}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Contract Details
        </div>
        <div className="grid grid-cols-2 gap-3">
          <RiskBoxCell label="Underlying" value={fmtPrice(currentPrice)} />
          <RiskBoxCell label="Option Mid" value={fmtPrice(contract?.mid)} />
          {contract?.delta && <RiskBoxCell label="Delta" value={fmtDelta(contract.delta)} />}
          {spread && (
            <RiskBoxCell
              label="Spread"
              value={spread.percent}
              kind={spread.isWide ? "fail" : undefined}
            />
          )}
        </div>
      </div>

      {/* Suggested Levels */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Suggested Levels
        </div>
        <div className="grid grid-cols-3 gap-3">
          <RiskBoxCell label="Target" value={fmtPrice(suggestedTarget)} kind="success" />
          <RiskBoxCell label="Stop" value={fmtPrice(suggestedStop)} kind="fail" />
          <RiskBoxCell label="R:R" value={riskReward} />
        </div>
      </div>

      {/* Greeks Preview */}
      {(contract?.delta || contract?.gamma || contract?.theta || contract?.iv) && (
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Greeks
          </div>
          <div className="flex items-center justify-between">
            <GreekCell label="Δ" value={contract?.delta} />
            <GreekCell label="Γ" value={contract?.gamma} decimals={4} />
            <GreekCell label="Θ" value={contract?.theta} negative />
            <GreekCell label="IV" value={contract?.iv} percent />
          </div>
        </div>
      )}

      {/* Volume & Open Interest */}
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {contract?.volume !== undefined && (
            <MetricChip
              label="Vol"
              value={
                contract.volume > 1000
                  ? `${(contract.volume / 1000).toFixed(1)}K`
                  : contract.volume.toString()
              }
              kind={contract.volume > 500 ? "success" : "neutral"}
            />
          )}
          {contract?.openInterest !== undefined && (
            <MetricChip
              label="OI"
              value={
                contract.openInterest > 1000
                  ? `${(contract.openInterest / 1000).toFixed(1)}K`
                  : contract.openInterest.toString()
              }
            />
          )}
          {trade.tradeType && <MetricChip label="Type" value={trade.tradeType} />}
        </div>
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
  // Alert settings
  channels?: DiscordChannel[];
  challenges?: Challenge[];
  selectedChannels?: string[];
  selectedChallenges?: string[];
  onChannelsChange?: (channels: string[]) => void;
  onChallengesChange?: (challenges: string[]) => void;
  onEnterAndAlert?: (channelIds: string[], challengeIds: string[]) => void;
}

function TradeDecisionCard({
  trade,
  currentPrice,
  channels = [],
  challenges = [],
  selectedChannels = [],
  selectedChallenges = [],
  onChannelsChange,
  onChallengesChange,
  onEnterAndAlert,
}: TradeDecisionCardProps) {
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const contract = trade.contract;
  const dte = fmtDTE(contract?.daysToExpiry);
  const spread = contract ? fmtSpread(contract.bid, contract.ask) : null;

  // Use confluence score if available, otherwise default
  const readinessScore = trade.confluence?.score || 75;
  const scoreStyle = getScoreStyle(readinessScore);

  // Toggle channel selection
  const toggleChannel = (channelId: string) => {
    if (!onChannelsChange) return;
    const newChannels = selectedChannels.includes(channelId)
      ? selectedChannels.filter((id) => id !== channelId)
      : [...selectedChannels, channelId];
    onChannelsChange(newChannels);
  };

  // Toggle challenge selection
  const toggleChallenge = (challengeId: string) => {
    if (!onChallengesChange) return;
    const newChallenges = selectedChallenges.includes(challengeId)
      ? selectedChallenges.filter((id) => id !== challengeId)
      : [...selectedChallenges, challengeId];
    onChallengesChange(newChallenges);
  };

  return (
    <div className="animate-fade-in-up">
      {/* Contract Header */}
      <div className="p-4 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-semibold text-[var(--text-high)]">{trade.ticker}</span>
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
          {contract?.delta && <MetricChip label="Δ" value={fmtDelta(contract.delta)} />}
          {spread && (
            <MetricChip
              label="Spread"
              value={spread.percent}
              kind={spread.isWide ? "warn" : "neutral"}
            />
          )}
          {contract?.iv && <MetricChip label="IV" value={`${(contract.iv * 100).toFixed(0)}%`} />}
          {contract?.volume && (
            <MetricChip
              label="Vol"
              value={
                contract.volume > 1000
                  ? `${(contract.volume / 1000).toFixed(1)}K`
                  : contract.volume.toString()
              }
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

      {/* Take Profit / Stop Loss Levels */}
      {(trade.targetPrice || trade.stopLoss) && (
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Risk Levels
          </div>
          <div className="grid grid-cols-3 gap-3">
            <RiskBoxCell
              label="Target"
              value={fmtPrice(trade.targetPrice)}
              subValue={
                contract?.mid && trade.targetPrice
                  ? fmtPct(((trade.targetPrice - contract.mid) / contract.mid) * 100)
                  : undefined
              }
              kind="success"
            />
            <RiskBoxCell
              label="Stop"
              value={fmtPrice(trade.stopLoss)}
              subValue={
                contract?.mid && trade.stopLoss
                  ? fmtPct(((trade.stopLoss - contract.mid) / contract.mid) * 100)
                  : undefined
              }
              kind="fail"
            />
            <RiskBoxCell
              label="R:R"
              value={
                trade.stopLoss && trade.targetPrice && contract?.mid
                  ? `${((trade.targetPrice - contract.mid) / (contract.mid - trade.stopLoss)).toFixed(1)}:1`
                  : "—"
              }
            />
          </div>
        </div>
      )}

      {/* Entry Checklist Summary */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <ChecklistSummary trade={trade} />
      </div>

      {/* Alert Settings Section - Collapsible */}
      {(channels.length > 0 || challenges.length > 0 || onEnterAndAlert) && (
        <div className="border-b border-[var(--border-hairline)]">
          <button
            onClick={() => setShowAlertSettings(!showAlertSettings)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--surface-2)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--brand-primary)]" />
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Alert Settings
              </span>
              {selectedChannels.length > 0 && (
                <span className="text-[10px] text-[var(--text-faint)] px-1.5 py-0.5 bg-[var(--surface-2)] rounded">
                  {selectedChannels.length} channel{selectedChannels.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {showAlertSettings ? (
              <ChevronUp className="w-4 h-4 text-[var(--text-faint)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-faint)]" />
            )}
          </button>

          {showAlertSettings && (
            <div className="px-4 pb-4 space-y-4 animate-expand">
              {/* Discord Channels */}
              {channels.length > 0 && (
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide mb-2">
                    Discord Channels
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => toggleChannel(channel.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all btn-press",
                          selectedChannels.includes(channel.id)
                            ? "bg-[var(--brand-primary)] text-black"
                            : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                        )}
                      >
                        #{channel.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Challenges */}
              {challenges.length > 0 && (
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide mb-2">
                    Challenges
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {challenges.map((challenge) => (
                      <button
                        key={challenge.id}
                        onClick={() => toggleChallenge(challenge.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all btn-press",
                          selectedChallenges.includes(challenge.id)
                            ? "bg-[var(--accent-info)] text-white"
                            : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                        )}
                      >
                        {challenge.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Enter Trade Button */}
      {onEnterAndAlert && (
        <div className="p-4">
          <button
            onClick={() => onEnterAndAlert(selectedChannels, selectedChallenges)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm bg-[var(--brand-primary)] text-black hover:opacity-90 transition-all btn-press"
          >
            <Zap className="w-4 h-4" />
            Enter Trade{selectedChannels.length > 0 ? " & Alert" : ""}
          </button>
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
        <div className={cn("text-5xl font-bold tabular-nums", pnlStyle.className)}>
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
  subValue,
  kind,
}: {
  label: string;
  value: string;
  subValue?: string;
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
      <div className={cn("text-sm font-medium tabular-nums", colorClass)}>{value}</div>
      {subValue && <div className={cn("text-xs tabular-nums mt-0.5", colorClass)}>{subValue}</div>}
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
    value != null ? (percent ? `${(value * 100).toFixed(0)}%` : value.toFixed(decimals)) : "—";

  const colorClass = negative ? "text-[var(--accent-negative)]" : "text-[var(--text-high)]";

  return (
    <div className="text-center">
      <div className="text-[10px] text-[var(--text-faint)]">{label}</div>
      <div className={cn("text-sm font-medium tabular-nums", colorClass)}>{formatted}</div>
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
            className={cn(chipStyle(item.passed ? "success" : "warn"), "text-[10px]")}
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
