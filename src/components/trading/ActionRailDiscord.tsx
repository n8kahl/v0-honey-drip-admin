/**
 * ActionRailDiscord - Discord Controls
 *
 * Compact Discord controls with:
 * - Selected channel chips
 * - Quick send button
 * - Expandable full composer
 */

import React, { useState, useEffect } from "react";
import type { Trade, AlertType, DiscordChannel, Challenge } from "../../types";
import type { PriceOverrides } from "../hd/alerts/HDAlertComposer";
import { HDAlertComposer } from "../hd/alerts/HDAlertComposer";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settingsStore";
import { MessageSquare, ChevronDown, ChevronUp, Send, Hash } from "lucide-react";

interface ActionRailDiscordProps {
  trade: Trade | null;
  channels: DiscordChannel[];
  challenges: Challenge[];
  showAlert: boolean;
  alertType: AlertType;
  alertOptions?: { updateKind?: "trim" | "generic" | "sl" | "take-profit"; trimPercent?: number };
  expanded: boolean;
  onToggleExpanded: () => void;
  onSendAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onEnterAndAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onCancelAlert: () => void;
}

export function ActionRailDiscord({
  trade,
  channels,
  challenges,
  showAlert,
  alertType,
  alertOptions,
  expanded,
  onToggleExpanded,
  onSendAlert,
  onEnterAndAlert,
  onCancelAlert,
}: ActionRailDiscordProps) {
  // Get default channels based on alert type
  const getDefaultChannels = useSettingsStore((s) => s.getDefaultChannels);

  // Track selected channels
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  // Initialize with trade's channels or defaults
  useEffect(() => {
    if (trade?.discordChannels && trade.discordChannels.length > 0) {
      setSelectedChannels(trade.discordChannels);
    } else {
      const defaults = getDefaultChannels(alertType === "enter" ? "enter" : "load");
      setSelectedChannels(defaults.map((c) => c.id));
    }
  }, [trade?.id, alertType, getDefaultChannels]);

  // Toggle channel selection
  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  // Quick send with selected channels
  const handleQuickSend = () => {
    if (selectedChannels.length === 0) {
      onToggleExpanded(); // Open composer if no channels selected
      return;
    }
    onSendAlert(selectedChannels, [], undefined, undefined);
  };

  const hasChannelsSelected = selectedChannels.length > 0;

  return (
    <div className="border-b border-[var(--border-hairline)]">
      {/* Compact Header */}
      <div className="px-4 py-2.5 bg-[var(--surface-2)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Discord
            </span>
          </div>

          <button
            onClick={onToggleExpanded}
            className="flex items-center gap-1 text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
          >
            {expanded ? "Collapse" : "Expand"}
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Compact View - Channel Chips + Quick Send */}
      {!expanded && (
        <div className="p-3 space-y-3 animate-fade-in-up">
          {/* Channel Chips */}
          <div className="flex flex-wrap gap-1.5">
            {channels.slice(0, 6).map((channel) => (
              <button
                key={channel.id}
                onClick={() => toggleChannel(channel.id)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all hover-lift-sm",
                  selectedChannels.includes(channel.id)
                    ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30"
                    : "bg-[var(--surface-3)] text-[var(--text-muted)] border border-[var(--border-hairline)]"
                )}
              >
                <Hash className="w-3 h-3" />
                {channel.name}
              </button>
            ))}
            {channels.length > 6 && (
              <button
                onClick={onToggleExpanded}
                className="px-2 py-1 rounded text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] bg-[var(--surface-2)]"
              >
                +{channels.length - 6} more
              </button>
            )}
          </div>

          {/* Quick Send Button */}
          {trade && (
            <button
              onClick={handleQuickSend}
              disabled={!hasChannelsSelected}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2 rounded font-medium text-sm transition-all btn-press",
                hasChannelsSelected
                  ? "bg-[var(--brand-primary)] text-black hover:bg-[var(--brand-primary-hover)]"
                  : "bg-[var(--surface-3)] text-[var(--text-faint)] cursor-not-allowed"
              )}
            >
              <Send className="w-4 h-4" />
              {hasChannelsSelected
                ? `Send to ${selectedChannels.length} channel${selectedChannels.length > 1 ? "s" : ""}`
                : "Select channels"}
            </button>
          )}
        </div>
      )}

      {/* Expanded View - Full Composer */}
      {expanded && trade && (
        <div className="animate-fade-in-up">
          <HDAlertComposer
            trade={trade}
            alertType={alertType}
            alertOptions={alertOptions}
            availableChannels={channels}
            challenges={challenges}
            onSend={onSendAlert}
            onEnterAndAlert={onEnterAndAlert}
            onCancel={() => {
              onCancelAlert();
              onToggleExpanded();
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ActionRailDiscord;
