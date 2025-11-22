import { useState } from "react";
import { Challenge, DiscordChannel } from "../../../types";
import { AppSheet } from "../../ui/AppSheet";
import { HDButton } from "../common/HDButton";
import { Loader2, Check } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useDiscord } from "../../../hooks/useDiscord";

interface HDChallengeShareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge | null;
  stats: {
    totalPnL: number;
    winRate: number;
    completedTrades: number;
    activeTrades: number;
  };
  availableChannels: DiscordChannel[];
}

export function HDChallengeShare({
  open,
  onOpenChange,
  challenge,
  stats,
  availableChannels,
}: HDChallengeShareProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [shareResult, setShareResult] = useState<{ success: number; failed: number } | null>(null);
  const { sending, sendChallengeProgressAlert } = useDiscord();

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const handleShare = async () => {
    if (!challenge || selectedChannels.length === 0) return;

    const channels = availableChannels.filter((ch) => selectedChannels.includes(ch.id));

    try {
      const result = await sendChallengeProgressAlert(channels, challenge, stats);
      setShareResult(result);

      // Close after 2 seconds if successful
      if (result.failed === 0) {
        setTimeout(() => {
          onOpenChange(false);
          setSelectedChannels([]);
          setShareResult(null);
        }, 2000);
      }
    } catch (error) {
      console.error("[HDChallengeShare] Failed to share challenge:", error);
    }
  };

  if (!challenge) return null;

  return (
    <AppSheet
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setSelectedChannels([]);
          setShareResult(null);
        }
      }}
      title="Share to Discord"
      snapPoint="medium"
    >
      <div className="flex flex-col h-full">
        {/* Challenge Preview */}
        <div className="p-4 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
          <div className="text-sm font-medium text-[var(--text-high)] mb-1">{challenge.name}</div>
          <div className="text-xs text-[var(--text-muted)]">
            Progress:{" "}
            {(
              ((challenge.currentBalance - challenge.startingBalance) /
                (challenge.targetBalance - challenge.startingBalance)) *
              100
            ).toFixed(1)}
            % • {stats.completedTrades} trades completed
          </div>
        </div>

        {/* Channel Selection */}
        <div className="flex-1 overflow-y-auto p-4">
          {availableChannels.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-muted)] mb-2">
                No Discord channels configured
              </p>
              <p className="text-xs text-[var(--text-faint)]">
                Add Discord channels in Settings to share progress
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Select channels to share this challenge update:
              </p>
              {availableChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => toggleChannel(channel.id)}
                  className={cn(
                    "w-full p-3 rounded-lg border transition-all text-left",
                    selectedChannels.includes(channel.id)
                      ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]"
                      : "bg-[var(--surface-2)] border-[var(--border-hairline)] hover:bg-[var(--surface-3)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-high)]">
                        {channel.name}
                      </div>
                      {channel.description && (
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {channel.description}
                        </div>
                      )}
                    </div>
                    {selectedChannels.includes(channel.id) && (
                      <Check className="w-4 h-4 text-[var(--brand-primary)]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Share Result */}
        {shareResult && (
          <div className="px-4 pb-2">
            <div
              className={cn(
                "p-3 rounded-lg text-sm",
                shareResult.failed === 0
                  ? "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]"
                  : "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]"
              )}
            >
              {shareResult.failed === 0
                ? `✅ Shared to ${shareResult.success} channel${shareResult.success > 1 ? "s" : ""}`
                : `⚠️ Sent to ${shareResult.success}, failed ${shareResult.failed}`}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]">
          <div className="flex gap-2">
            <HDButton
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={sending}
            >
              Cancel
            </HDButton>
            <HDButton
              variant="primary"
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2"
              disabled={sending || selectedChannels.length === 0 || availableChannels.length === 0}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                "Share Update"
              )}
            </HDButton>
          </div>
        </div>
      </div>
    </AppSheet>
  );
}
