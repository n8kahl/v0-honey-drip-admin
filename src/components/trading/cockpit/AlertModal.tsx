/**
 * AlertModal - Centered overlay for composing and sending Discord alerts
 *
 * Design Spec V2: Modal overlay with:
 * - Centered design with backdrop blur
 * - Trade summary card
 * - Auto-generated message based on action type
 * - Channel selection with memory
 * - Include toggles for prices, P&L, chart
 * - ESC or click outside to cancel
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../lib/utils";
import type { Trade, DiscordChannel, Challenge, AlertType } from "../../../types";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Textarea } from "../../ui/textarea";
import {
  X,
  Send,
  Target,
  Shield,
  DollarSign,
  TrendingUp,
  Clock,
  Hash,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface AlertModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The trade to alert about */
  trade: Trade | null;
  /** Type of alert (enter, exit, update, etc.) */
  alertType: AlertType;
  /** Additional options for the alert */
  alertOptions?: {
    updateKind?: "trim" | "generic" | "sl" | "take-profit";
    trimPercent?: number;
    isExpired?: boolean;
  };
  /** Available Discord channels */
  availableChannels: DiscordChannel[];
  /** Active challenges */
  challenges?: Challenge[];
  /** Callback when alert is sent */
  onSend: (channels: string[], challengeIds: string[], comment?: string) => void;
  /** Callback when modal is closed/cancelled */
  onClose: () => void;
}

// ============================================================================
// Alert Type Configuration
// ============================================================================

interface AlertConfig {
  title: string;
  icon: React.ReactNode;
  emoji: string;
  defaultMessage: string;
  color: string;
}

const ALERT_CONFIGS: Record<AlertType, AlertConfig> = {
  load: {
    title: "LOADED",
    icon: <Target className="w-5 h-5" />,
    emoji: "📋",
    defaultMessage: "Loading this setup for review.",
    color: "text-[var(--brand-primary)]",
  },
  enter: {
    title: "ENTERED",
    icon: <TrendingUp className="w-5 h-5" />,
    emoji: "🎯",
    defaultMessage: "Entering this position.",
    color: "text-emerald-400",
  },
  add: {
    title: "ADDED",
    icon: <TrendingUp className="w-5 h-5" />,
    emoji: "➕",
    defaultMessage: "Adding to position here.",
    color: "text-[var(--brand-primary)]",
  },
  exit: {
    title: "EXITED",
    icon: <DollarSign className="w-5 h-5" />,
    emoji: "🏁",
    defaultMessage: "Closing this position.",
    color: "text-amber-400",
  },
  update: {
    title: "UPDATE",
    icon: <Shield className="w-5 h-5" />,
    emoji: "📊",
    defaultMessage: "Quick update on this position.",
    color: "text-[var(--text-high)]",
  },
  "trail-stop": {
    title: "TRAIL STOP",
    icon: <Shield className="w-5 h-5" />,
    emoji: "🏃‍♂️",
    defaultMessage: "Enabling trailing stop.",
    color: "text-[var(--brand-primary)]",
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateDefaultMessage(
  trade: Trade | null,
  alertType: AlertType,
  alertOptions?: AlertModalProps["alertOptions"]
): string {
  if (!trade) return "";

  const config = ALERT_CONFIGS[alertType];
  let message = config.defaultMessage;

  // Customize based on update kind
  if (alertType === "update" && alertOptions?.updateKind) {
    switch (alertOptions.updateKind) {
      case "trim":
      case "take-profit":
        message = `Trimming ${alertOptions.trimPercent || 50}% to lock profit.`;
        break;
      case "sl":
        message = "Moving stop loss to break-even.";
        break;
      case "generic":
        message = "Quick update on this position.";
        break;
    }
  }

  // Add expired context
  if (alertOptions?.isExpired) {
    message = "Closing expired position.";
  }

  return message;
}

function formatTradeInfo(trade: Trade): string[] {
  const lines: string[] = [];

  // Contract info
  const contract = trade.contract;
  if (contract) {
    lines.push(`${trade.ticker} $${contract.strike}${contract.type} ${contract.expiry}`);
  }

  // Entry if available
  if (trade.entryPrice) {
    lines.push(`Entry: $${trade.entryPrice.toFixed(2)}`);
  }

  // Current/Exit price
  const currentPrice = trade.currentPrice || trade.exitPrice;
  if (currentPrice) {
    lines.push(`Current: $${currentPrice.toFixed(2)}`);
  }

  // P&L if available
  if (trade.entryPrice && currentPrice) {
    const pnl = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
    lines.push(`P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`);
  }

  return lines;
}

// ============================================================================
// Main Component
// ============================================================================

export function AlertModal({
  isOpen,
  trade,
  alertType,
  alertOptions,
  availableChannels,
  challenges = [],
  onSend,
  onClose,
}: AlertModalProps) {
  // State
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [includePrices, setIncludePrices] = useState(true);
  const [includePnL, setIncludePnL] = useState(true);
  const [includeChart, setIncludeChart] = useState(false);

  // Get alert config
  const config = ALERT_CONFIGS[alertType] || ALERT_CONFIGS.update;

  // Initialize on open
  useEffect(() => {
    if (isOpen && trade) {
      // Pre-select channels from trade
      setSelectedChannels(trade.discordChannels || []);
      setSelectedChallenges(trade.challenges || []);
      // Set default message
      setComment(generateDefaultMessage(trade, alertType, alertOptions));
      // Reset includes based on alert type
      setIncludePrices(alertType !== "load");
      setIncludePnL(alertType === "exit" || alertType === "update");
      setIncludeChart(false);
    }
  }, [isOpen, trade, alertType, alertOptions]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Toggle channel
  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  }, []);

  // Toggle challenge
  const toggleChallenge = useCallback((challengeId: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challengeId) ? prev.filter((id) => id !== challengeId) : [...prev, challengeId]
    );
  }, []);

  // Handle send
  const handleSend = useCallback(() => {
    if (selectedChannels.length === 0) return;
    onSend(selectedChannels, selectedChallenges, comment.trim() || undefined);
    onClose();
  }, [selectedChannels, selectedChallenges, comment, onSend, onClose]);

  // Trade info lines
  const tradeInfo = useMemo(() => {
    if (!trade) return [];
    return formatTradeInfo(trade);
  }, [trade]);

  // Don't render if not open
  if (!isOpen) return null;

  // Calculate P&L for display
  const pnlPercent =
    trade?.entryPrice && trade?.currentPrice
      ? ((trade.currentPrice - trade.entryPrice) / trade.entryPrice) * 100
      : null;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-[var(--surface-1)] rounded-xl border border-[var(--border-hairline)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3">
            <span className={cn("p-2 rounded-lg bg-[var(--surface-2)]", config.color)}>
              {config.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{config.emoji}</span>
                <span className="font-bold text-[var(--text-high)]">{config.title} ALERT</span>
              </div>
              {trade && (
                <div className="text-sm text-[var(--text-muted)]">
                  {trade.ticker} ${trade.contract?.strike}
                  {trade.contract?.type}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Trade Summary Card */}
          {trade && (
            <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[var(--text-high)]">
                    {trade.ticker} ${trade.contract?.strike}
                    {trade.contract?.type}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {trade.contract?.expiry} • {trade.tradeType}
                  </div>
                </div>
                {pnlPercent !== null && (
                  <div
                    className={cn(
                      "text-right",
                      pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    <div className="text-lg font-bold tabular-nums">
                      {pnlPercent >= 0 ? "+" : ""}
                      {pnlPercent.toFixed(1)}%
                    </div>
                    <div className="text-xs">P&L</div>
                  </div>
                )}
              </div>

              {/* Trade details */}
              <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-2 text-xs">
                {trade.entryPrice && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Entry:</span>
                    <span className="font-medium tabular-nums">${trade.entryPrice.toFixed(2)}</span>
                  </div>
                )}
                {trade.currentPrice && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Current:</span>
                    <span className="font-medium tabular-nums">
                      ${trade.currentPrice.toFixed(2)}
                    </span>
                  </div>
                )}
                {trade.stopLoss && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Stop:</span>
                    <span className="font-medium tabular-nums text-red-400">
                      ${trade.stopLoss.toFixed(2)}
                    </span>
                  </div>
                )}
                {trade.targetPrice && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Target:</span>
                    <span className="font-medium tabular-nums text-emerald-400">
                      ${trade.targetPrice.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide block mb-2">
              Message
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add context to this alert..."
              className="min-h-[80px] bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-high)] resize-none"
            />
          </div>

          {/* Channels */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide block mb-2">
              Discord Channels
            </label>
            <div className="space-y-2">
              {availableChannels.map((channel) => (
                <label
                  key={channel.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedChannels.includes(channel.id)}
                    onCheckedChange={() => toggleChannel(channel.id)}
                    className="border-[var(--border-hairline)]"
                  />
                  <Hash className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-high)]">{channel.name}</span>
                </label>
              ))}
              {availableChannels.length === 0 && (
                <div className="text-sm text-[var(--text-muted)] text-center py-3">
                  No channels configured
                </div>
              )}
            </div>
          </div>

          {/* Include toggles */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide block mb-2">
              Include
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includePrices}
                  onCheckedChange={(checked) => setIncludePrices(checked as boolean)}
                  className="border-[var(--border-hairline)]"
                />
                <span className="text-sm text-[var(--text-high)]">Prices</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includePnL}
                  onCheckedChange={(checked) => setIncludePnL(checked as boolean)}
                  className="border-[var(--border-hairline)]"
                />
                <span className="text-sm text-[var(--text-high)]">P&L</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includeChart}
                  onCheckedChange={(checked) => setIncludeChart(checked as boolean)}
                  className="border-[var(--border-hairline)]"
                />
                <span className="text-sm text-[var(--text-high)]">Chart</span>
              </label>
            </div>
          </div>

          {/* Challenges (if any) */}
          {challenges.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide block mb-2">
                Challenges
              </label>
              <div className="space-y-2">
                {challenges.map((challenge) => (
                  <label
                    key={challenge.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedChallenges.includes(challenge.id)}
                      onCheckedChange={() => toggleChallenge(challenge.id)}
                      className="border-[var(--border-hairline)]"
                    />
                    <span className="text-sm text-[var(--text-high)]">{challenge.name}</span>
                    {challenge.scope === "honeydrip-wide" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                        HD
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border-hairline)] flex items-center justify-between gap-3 bg-[var(--surface-0)]">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-[var(--border-hairline)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-high)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={selectedChannels.length === 0}
            className={cn(
              "flex-1 gap-2",
              selectedChannels.length === 0
                ? "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
                : "bg-[var(--brand-primary)] text-black hover:bg-[var(--brand-primary)]/90"
            )}
          >
            <Send className="w-4 h-4" />
            Send Alert
            {selectedChannels.length > 0 && (
              <span className="text-xs opacity-80">({selectedChannels.length} channels)</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  // Render in portal
  return createPortal(modal, document.body);
}

export default AlertModal;
