import { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "../../ui/drawer";
import { Trade, AlertType, DiscordChannel, Challenge } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { Check, ChevronDown } from "lucide-react";

interface MobileAlertSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
  alertType: AlertType;
  alertOptions?: { updateKind?: "trim" | "generic" | "sl" };
  channels: DiscordChannel[];
  challenges: Challenge[];
  onSend: (channels: string[], challenges: string[], comment?: string) => void;
}

export function MobileAlertSheet({
  open,
  onOpenChange,
  trade,
  alertType,
  alertOptions,
  channels,
  challenges,
  onSend,
}: MobileAlertSheetProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [showChannels, setShowChannels] = useState(false);
  const [comment, setComment] = useState("");

  // Get alert title
  const alertTitle = useMemo(() => {
    if (alertType === "load") return "Load Alert";
    if (alertType === "enter") return "Entry Alert";
    if (alertType === "exit") return "Exit Alert";
    if (alertType === "update" && alertOptions?.updateKind === "trim") return "Trim Alert";
    if (alertType === "update" && alertOptions?.updateKind === "sl") return "Update Stop Loss";
    return "Alert";
  }, [alertType, alertOptions]);

  // Generate default message
  const defaultMessage = useMemo(() => {
    if (!trade) return "";
    const contract = trade.contract;
    const pnl = trade.movePercent;
    const currentPrice = trade.currentPrice || contract?.mid || 0;

    if (alertType === "update" && alertOptions?.updateKind === "trim") {
      return `Trimming ${trade.ticker} ${contract?.strike}${contract?.type?.[0]} at $${formatPrice(currentPrice)}${pnl ? ` (${pnl > 0 ? "+" : ""}${pnl.toFixed(1)}%)` : ""}`;
    }
    if (alertType === "update" && alertOptions?.updateKind === "sl") {
      return `Moving stop loss on ${trade.ticker} to $${formatPrice(trade.stopLoss || 0)}`;
    }
    if (alertType === "exit") {
      return `Exiting ${trade.ticker} ${contract?.strike}${contract?.type?.[0]} at $${formatPrice(currentPrice)}${pnl ? `. Final P&L: ${pnl > 0 ? "+" : ""}${pnl.toFixed(1)}%` : ""}`;
    }
    if (alertType === "enter") {
      return `Entering ${trade.ticker} ${contract?.strike}${contract?.type?.[0]} at $${formatPrice(currentPrice)}`;
    }
    if (alertType === "load") {
      return `Watching ${trade.ticker} ${contract?.strike}${contract?.type?.[0]}`;
    }
    return "";
  }, [trade, alertType, alertOptions]);

  // Initialize state when sheet opens
  useEffect(() => {
    if (open && trade) {
      setComment(defaultMessage);
      // Default to trade's channels or global defaults
      const tradeChannels = Array.isArray(trade.discordChannels) ? trade.discordChannels : [];
      if (tradeChannels.length > 0) {
        setSelectedChannels(tradeChannels);
      } else {
        const defaultChannel = channels.find((c) => c.isGlobalDefault);
        setSelectedChannels(defaultChannel ? [defaultChannel.id] : []);
      }
    }
  }, [open, trade, channels, defaultMessage]);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const handleSend = () => {
    onSend(selectedChannels, [], comment || undefined);
  };

  if (!trade) return null;

  const contract = trade.contract;
  const pnl = trade.movePercent || 0;
  const isProfit = pnl >= 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[var(--surface-1)] border-[var(--border-hairline)]">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="text-[var(--text-high)]">{alertTitle}</DrawerTitle>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-[var(--text-med)]">
              {trade.ticker} {contract?.strike}
              {contract?.type?.[0]}
            </span>
            {trade.movePercent !== undefined && (
              <span
                className={cn(
                  "font-semibold",
                  isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                )}
              >
                {isProfit ? "+" : ""}
                {pnl.toFixed(1)}%
              </span>
            )}
          </div>
        </DrawerHeader>

        <div className="px-4 py-2 space-y-4">
          {/* Comment textarea */}
          <div>
            <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide block mb-2">
              Message
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full px-3 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50"
            />
          </div>

          {/* Channel selector */}
          <div>
            <button
              onClick={() => setShowChannels(!showChannels)}
              className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  Channels
                </span>
                <span className="text-sm text-[var(--text-high)]">
                  {selectedChannels.length > 0
                    ? `${selectedChannels.length} selected`
                    : "None selected"}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-[var(--text-muted)] transition-transform",
                  showChannels && "rotate-180"
                )}
              />
            </button>

            {showChannels && (
              <div className="mt-2 space-y-1">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => toggleChannel(channel.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                      selectedChannels.includes(channel.id)
                        ? "bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30"
                        : "bg-[var(--surface-2)] border border-transparent"
                    )}
                  >
                    <span className="text-sm text-[var(--text-high)]">#{channel.name}</span>
                    {selectedChannels.includes(channel.id) && (
                      <Check className="w-4 h-4 text-[var(--brand-primary)]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <button
            onClick={handleSend}
            disabled={selectedChannels.length === 0}
            className={cn(
              "w-full py-4 rounded-xl font-semibold text-base transition-colors min-h-[56px]",
              selectedChannels.length > 0
                ? "bg-[var(--brand-primary)] text-black hover:bg-[var(--brand-primary)]/90"
                : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
            )}
          >
            Send Alert {selectedChannels.length > 0 && `(${selectedChannels.length})`}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full py-3 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors min-h-[48px]"
          >
            Cancel
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
