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
  TrendingDown,
  Shield,
  Scissors,
  ArrowUpRight,
  DollarSign,
  Bot,
  MessageSquare,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Minus,
  ChevronDown,
  ChevronUp,
  Send,
  Hash,
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
  const [showGuidanceDetail, setShowGuidanceDetail] = useState(false);

  return (
    <div className="flex flex-col h-full animate-mode-enter">
      {/* Position Tile */}
      <PositionTile trade={trade} />

      {/* Time/Theta Tile */}
      <TimeThetaTile trade={trade} />

      {/* AI Guidance Module */}
      <AIGuidanceTile
        trade={trade}
        expanded={showGuidanceDetail}
        onToggle={() => setShowGuidanceDetail(!showGuidanceDetail)}
      />

      {/* Quick Actions Grid */}
      <QuickActionsGrid
        trade={trade}
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

function PositionTile({ trade }: { trade: Trade }) {
  const contract = trade.contract;
  const entryPrice = trade.entryPrice || contract?.mid || 0;
  const currentPrice = contract?.bid || contract?.mid || 0;
  const dte = contract?.daysToExpiry ?? 0;
  const dteInfo = fmtDTE(dte);

  // Calculate P&L
  const pnlDollar = currentPrice - entryPrice;
  const pnlPercent = entryPrice > 0 ? (pnlDollar / entryPrice) * 100 : 0;
  const pnlStyle = getPnlStyle(pnlPercent);

  // Remaining position (mock - would come from trade.quantity)
  const remainingPercent = 100; // Would track actual remaining after trims

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
            {pnlPercent >= 0 ? "+" : ""}
            {fmtPct(pnlPercent)} ({pnlDollar >= 0 ? "+" : ""}
            {fmtPrice(pnlDollar)})
          </span>
        </div>

        {/* Remaining Position */}
        <div className="mt-2 pt-2 border-t border-[var(--border-hairline)]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-faint)]">Remaining</span>
            <span className="text-[var(--text-high)] font-medium">{remainingPercent}%</span>
          </div>
          <div className="mt-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand-primary)] rounded-full"
              style={{ width: `${remainingPercent}%` }}
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

function TimeThetaTile({ trade }: { trade: Trade }) {
  const contract = trade.contract;
  const theta = contract?.theta || 0;
  const dte = contract?.daysToExpiry ?? 0;

  // Calculate time left to market close (mock)
  const [timeLeft, setTimeLeft] = useState("5h 32m");

  // Calculate theta burned since entry (mock)
  const entryTime = trade.entryTime ? new Date(trade.entryTime).getTime() : Date.now();
  const hoursHeld = (Date.now() - entryTime) / (1000 * 60 * 60);
  const thetaBurned = Math.abs(theta) * hoursHeld;

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
            {theta.toFixed(2)}/hr
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
  expanded: boolean;
  onToggle: () => void;
}

function AIGuidanceTile({ trade, expanded, onToggle }: AIGuidanceTileProps) {
  // Mock guidance data - would come from useAIGuidance hook
  const guidance = useMemo(
    () => ({
      action: "HOLD" as const,
      confidence: 78,
      reasoning: "Momentum intact. RSI not overbought. ATR room remains. Wait for TP2.",
      metrics: [
        { label: "MTF aligned", value: "3/4 ↑" },
        { label: "RSI(14)", value: "68 (<70)" },
        { label: "ATR room", value: "0.8×" },
        { label: "Theta burn", value: "Low" },
      ],
    }),
    [trade]
  );

  const actionColors = {
    HOLD: "text-[var(--accent-info)]",
    TRIM: "text-[var(--brand-primary)]",
    ADD: "text-[var(--accent-positive)]",
    TRAIL: "text-[var(--text-muted)]",
    EXIT: "text-[var(--accent-negative)]",
  };

  const confidenceStyle = getScoreStyle(guidance.confidence);

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
            Updated 2 minutes ago
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
  onTrim: (percent: number) => void;
  onMoveSLToBreakeven: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
}

function QuickActionsGrid({
  trade,
  onTrim,
  onMoveSLToBreakeven,
  onTrailStop,
  onAdd,
}: QuickActionsGridProps) {
  // Check if SL can be moved to breakeven
  const entryPrice = trade.entryPrice || trade.contract?.mid || 0;
  const currentPrice = trade.contract?.bid || 0;
  const canMoveToBE = currentPrice > entryPrice;

  return (
    <div className="p-3 border-b border-[var(--border-hairline)]">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
          Quick Actions
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Trim 25% */}
        <button
          onClick={() => onTrim(25)}
          className="flex flex-col items-center justify-center p-2.5 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)] hover:border-[var(--brand-primary)]/30 transition-all btn-press"
        >
          <Scissors className="w-4 h-4 text-[var(--brand-primary)] mb-1" />
          <span className="text-xs font-medium text-[var(--text-high)]">Trim 25%</span>
        </button>

        {/* Trim 50% */}
        <button
          onClick={() => onTrim(50)}
          className="flex flex-col items-center justify-center p-2.5 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)] hover:border-[var(--brand-primary)]/30 transition-all btn-press"
        >
          <Scissors className="w-4 h-4 text-[var(--brand-primary)] mb-1" />
          <span className="text-xs font-medium text-[var(--text-high)]">Trim 50%</span>
        </button>

        {/* Move SL to BE */}
        <button
          onClick={onMoveSLToBreakeven}
          disabled={!canMoveToBE}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded border transition-all btn-press",
            canMoveToBE
              ? "bg-[var(--surface-2)] border-[var(--border-hairline)] hover:bg-[var(--surface-3)] hover:border-[var(--accent-positive)]/30"
              : "bg-[var(--surface-2)]/50 border-[var(--border-hairline)]/50 cursor-not-allowed opacity-50"
          )}
        >
          <Shield className="w-4 h-4 text-[var(--accent-positive)] mb-1" />
          <span className="text-xs font-medium text-[var(--text-high)]">SL → BE</span>
        </button>

        {/* Trail Stop */}
        <button
          onClick={onTrailStop}
          className="flex flex-col items-center justify-center p-2.5 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)] hover:border-[var(--text-muted)]/30 transition-all btn-press"
        >
          <TrendingUp className="w-4 h-4 text-[var(--text-muted)] mb-1" />
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
