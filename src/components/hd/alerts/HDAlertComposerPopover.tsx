/**
 * HDAlertComposerPopover - Context-Aware Quick Alert Popover
 *
 * A streamlined floating popover for quick Discord alerts.
 * Auto-fills templates based on trade state and mode.
 *
 * Features:
 * - Mode-aware templates (entry, exit, update)
 * - Quick Send (text only) or Attach Chart
 * - Channel selection
 * - Minimal, focused UI
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../../ui/popover";
import { Checkbox } from "../../ui/checkbox";
import { cn, formatPrice } from "../../../lib/utils";
import {
  Megaphone,
  Send,
  Camera,
  X,
  MessageSquare,
  ChevronDown,
  CheckCircle2,
  Zap,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { Trade, DiscordChannel } from "../../../types";

/** Alert mode determines template and styling */
export type AlertMode = "entry" | "exit" | "update" | "load";

interface HDAlertComposerPopoverProps {
  /** Trade context (optional - for auto-filling) */
  trade?: Trade;
  /** Alert mode */
  mode: AlertMode;
  /** Available Discord channels */
  channels: DiscordChannel[];
  /** Callback when alert is sent */
  onSend: (
    channelIds: string[],
    message: string,
    options?: { includeChart?: boolean }
  ) => Promise<void>;
  /** Optional: Custom trigger element */
  trigger?: React.ReactNode;
  /** Optional: Controlled open state */
  open?: boolean;
  /** Optional: Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Additional class for positioning */
  className?: string;
}

/**
 * Generate auto-fill template based on mode and trade data
 */
function generateTemplate(mode: AlertMode, trade?: Trade): string {
  if (!trade) {
    switch (mode) {
      case "entry":
        return "BTO [Symbol] [Contract] @ [Price]";
      case "exit":
        return "STC [Symbol] [Result]";
      case "update":
        return "Update: [Message]";
      case "load":
        return "Watching [Symbol] [Contract]";
      default:
        return "";
    }
  }

  const symbol = trade.ticker;
  const contract = trade.contract;
  const contractStr = contract
    ? `${contract.strike}${contract.type === "C" ? "C" : "P"} ${new Date(contract.expiry).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`
    : "";
  const entryPrice = trade.entryPrice || contract?.mid || 0;
  const currentPrice = trade.currentPrice || contract?.mid || 0;
  const pnlPercent = trade.movePercent || 0;
  const pnlStr = pnlPercent >= 0 ? `+${pnlPercent.toFixed(1)}%` : `${pnlPercent.toFixed(1)}%`;

  switch (mode) {
    case "entry":
      return `BTO ${symbol} ${contractStr} @ $${formatPrice(entryPrice)}`;
    case "exit":
      return `STC ${symbol} ${contractStr} (${pnlStr})`;
    case "update":
      return `${symbol} update: Currently @ $${formatPrice(currentPrice)} (${pnlStr})`;
    case "load":
      return `Watching ${symbol} ${contractStr} @ $${formatPrice(contract?.mid || 0)}`;
    default:
      return "";
  }
}

/**
 * Get mode-specific styling
 */
function getModeStyle(mode: AlertMode) {
  switch (mode) {
    case "entry":
      return {
        icon: TrendingUp,
        color: "text-[var(--accent-positive)]",
        bg: "bg-[var(--accent-positive)]/10",
        border: "border-[var(--accent-positive)]/30",
        button: "bg-[var(--accent-positive)] text-white hover:bg-[var(--accent-positive)]/90",
      };
    case "exit":
      return {
        icon: TrendingDown,
        color: "text-[var(--accent-negative)]",
        bg: "bg-[var(--accent-negative)]/10",
        border: "border-[var(--accent-negative)]/30",
        button: "bg-[var(--accent-negative)] text-white hover:bg-[var(--accent-negative)]/90",
      };
    case "update":
      return {
        icon: MessageSquare,
        color: "text-[var(--brand-primary)]",
        bg: "bg-[var(--brand-primary)]/10",
        border: "border-[var(--brand-primary)]/30",
        button: "bg-[var(--brand-primary)] text-black hover:bg-[var(--brand-primary)]/90",
      };
    case "load":
      return {
        icon: Zap,
        color: "text-[var(--brand-primary)]",
        bg: "bg-[var(--brand-primary)]/10",
        border: "border-[var(--brand-primary)]/30",
        button: "bg-[var(--brand-primary)] text-black hover:bg-[var(--brand-primary)]/90",
      };
  }
}

export function HDAlertComposerPopover({
  trade,
  mode,
  channels,
  onSend,
  trigger,
  open: controlledOpen,
  onOpenChange,
  className,
}: HDAlertComposerPopoverProps) {
  // State
  const [internalOpen, setInternalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [includeChart, setIncludeChart] = useState(false);
  const [sending, setSending] = useState(false);
  const [showChannels, setShowChannels] = useState(false);

  // Controlled vs uncontrolled open state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  // Mode styling
  const modeStyle = useMemo(() => getModeStyle(mode), [mode]);
  const ModeIcon = modeStyle.icon;

  // Initialize message with template when popover opens
  useEffect(() => {
    if (isOpen) {
      setMessage(generateTemplate(mode, trade));

      // Select default channel if available
      const defaultChannel = channels.find((ch) => ch.isGlobalDefault);
      if (defaultChannel && selectedChannels.length === 0) {
        setSelectedChannels([defaultChannel.id]);
      }
    }
  }, [isOpen, mode, trade, channels]);

  // Toggle channel selection
  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  }, []);

  // Handle send
  const handleSend = useCallback(async () => {
    if (selectedChannels.length === 0 || !message.trim()) return;

    setSending(true);
    try {
      await onSend(selectedChannels, message.trim(), { includeChart });
      setIsOpen(false);
      // Reset state
      setMessage("");
      setIncludeChart(false);
    } catch (error) {
      console.error("[AlertComposerPopover] Send failed:", error);
    } finally {
      setSending(false);
    }
  }, [selectedChannels, message, includeChart, onSend, setIsOpen]);

  // Quick send (text only)
  const handleQuickSend = useCallback(() => {
    setIncludeChart(false);
    handleSend();
  }, [handleSend]);

  // Can send check
  const canSend = selectedChannels.length > 0 && message.trim().length > 0 && !sending;

  // Selected channel names for display
  const selectedChannelNames = useMemo(() => {
    return channels
      .filter((ch) => selectedChannels.includes(ch.id))
      .map((ch) => ch.name)
      .join(", ");
  }, [channels, selectedChannels]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-lg",
              "bg-[var(--surface-2)] border border-[var(--border-hairline)]",
              "text-[var(--text-muted)] hover:text-[var(--brand-primary)]",
              "hover:bg-[var(--surface-3)] hover:border-[var(--brand-primary)]/30",
              "transition-all btn-press",
              className
            )}
            title="Quick Alert"
          >
            <Megaphone className="w-4 h-4" />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-80 p-0 bg-[var(--surface-1)] border-[var(--border-hairline)]",
          "shadow-lg rounded-xl overflow-hidden"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "px-4 py-3 flex items-center justify-between border-b",
            modeStyle.bg,
            modeStyle.border
          )}
        >
          <div className="flex items-center gap-2">
            <ModeIcon className={cn("w-4 h-4", modeStyle.color)} />
            <span className={cn("text-sm font-semibold capitalize", modeStyle.color)}>
              {mode === "load" ? "Load Alert" : `${mode} Alert`}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Input */}
        <div className="p-4 space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your alert message..."
            className={cn(
              "w-full px-3 py-2 text-sm rounded-lg resize-none",
              "bg-[var(--surface-2)] border border-[var(--border-hairline)]",
              "text-[var(--text-high)] placeholder:text-[var(--text-faint)]",
              "focus:outline-none focus:border-[var(--brand-primary)]",
              "transition-colors"
            )}
            rows={3}
            autoFocus
          />

          {/* Channel Selection */}
          <div>
            <button
              onClick={() => setShowChannels(!showChannels)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg",
                "bg-[var(--surface-2)] border border-[var(--border-hairline)]",
                "text-sm text-[var(--text-high)] hover:bg-[var(--surface-3)]",
                "transition-colors"
              )}
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                {selectedChannels.length > 0 ? (
                  <span className="truncate max-w-[180px]">#{selectedChannelNames}</span>
                ) : (
                  <span className="text-[var(--text-muted)]">Select channel...</span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-[var(--text-muted)] transition-transform",
                  showChannels && "rotate-180"
                )}
              />
            </button>

            {showChannels && (
              <div className="mt-2 p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] max-h-32 overflow-y-auto">
                {channels.map((channel) => (
                  <label
                    key={channel.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer",
                      "hover:bg-[var(--surface-3)] transition-colors"
                    )}
                  >
                    <Checkbox
                      checked={selectedChannels.includes(channel.id)}
                      onCheckedChange={() => toggleChannel(channel.id)}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs text-[var(--text-high)]">#{channel.name}</span>
                    {channel.isGlobalDefault && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                        Default
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Options Row */}
          <div className="flex items-center gap-2">
            <label
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer",
                "text-xs font-medium transition-colors",
                includeChart
                  ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30"
                  : "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]"
              )}
            >
              <Checkbox
                checked={includeChart}
                onCheckedChange={(checked) => setIncludeChart(checked as boolean)}
                className="w-3 h-3"
              />
              <Camera className="w-3.5 h-3.5" />
              <span>Attach Chart</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-[var(--border-hairline)] bg-[var(--surface-0)]">
          <div className="flex items-center gap-2">
            {/* Quick Send - Text Only */}
            <button
              onClick={handleQuickSend}
              disabled={!canSend}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg",
                "text-sm font-semibold transition-all btn-press",
                canSend
                  ? modeStyle.button
                  : "bg-[var(--surface-3)] text-[var(--text-faint)] cursor-not-allowed"
              )}
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Quick Send
                </>
              )}
            </button>

            {/* Send with Chart */}
            {includeChart && (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
                  "text-sm font-semibold transition-all btn-press",
                  canSend
                    ? "bg-[var(--surface-2)] text-[var(--text-high)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]"
                    : "bg-[var(--surface-3)] text-[var(--text-faint)] cursor-not-allowed"
                )}
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Validation hint */}
          {selectedChannels.length === 0 && (
            <p className="text-[10px] text-[var(--accent-negative)] text-center mt-2">
              Select at least one channel
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default HDAlertComposerPopover;
