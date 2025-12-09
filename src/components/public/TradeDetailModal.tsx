/**
 * TradeDetailModal.tsx - Trade Deep Dive Modal
 *
 * Shows full trade details including:
 * - Contract info and P&L
 * - Progress to target visualization
 * - Complete update timeline
 * - Share options
 */

import { useEffect, useState } from "react";
import {
  X,
  Share2,
  Target,
  Clock,
  Flame,
  TrendingUp,
  BarChart3,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TradeTimeline, type TimelineUpdate } from "./TradeTimeline";
import type { PublicTrade } from "./LiveTradeCard";

// ============================================================================
// Types
// ============================================================================

interface TradeDetailModalProps {
  trade: PublicTrade | null;
  isOpen: boolean;
  onClose: () => void;
  onShare?: (trade: PublicTrade) => void;
}

interface TradeWithTimeline extends PublicTrade {
  timeline?: TimelineUpdate[];
}

// ============================================================================
// Trade Type Config
// ============================================================================

const TRADE_TYPE_CONFIG = {
  Scalp: { icon: Flame, color: "text-orange-400", label: "SCALP" },
  Day: { icon: Target, color: "text-blue-400", label: "DAY TRADE" },
  Swing: { icon: TrendingUp, color: "text-purple-400", label: "SWING" },
  LEAP: { icon: BarChart3, color: "text-emerald-400", label: "LEAP" },
};

// ============================================================================
// Component
// ============================================================================

export function TradeDetailModal({
  trade,
  isOpen,
  onClose,
  onShare,
}: TradeDetailModalProps) {
  const [tradeDetail, setTradeDetail] = useState<TradeWithTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch full trade details with timeline
  useEffect(() => {
    if (!trade || !isOpen) {
      setTradeDetail(null);
      return;
    }

    async function fetchTradeDetail() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/public/trades/${trade.id}`);
        if (res.ok) {
          const data = await res.json();
          setTradeDetail(data);
        } else {
          // Fallback to basic trade data
          setTradeDetail(trade);
        }
      } catch (error) {
        console.error("[TradeDetailModal] Error fetching details:", error);
        setTradeDetail(trade);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTradeDetail();
  }, [trade, isOpen]);

  if (!trade) return null;

  const typeConfig = TRADE_TYPE_CONFIG[trade.trade_type] || TRADE_TYPE_CONFIG.Scalp;
  const TypeIcon = typeConfig.icon;

  const pnl = trade.pnl_percent ?? 0;
  const isPositive = pnl >= 0;

  // Contract display
  const contract = trade.contract;
  const contractDisplay = contract
    ? `$${contract.strike} ${contract.type?.toUpperCase() || ""}`
    : "";
  const expirationDisplay = contract?.expiration
    ? formatExpiration(contract.expiration)
    : "";

  // Progress calculation
  const progress = trade.progress_to_target ?? 0;

  // Share URL
  const shareUrl = trade.share_token
    ? `${window.location.origin}/public/t/${trade.share_token}`
    : `${window.location.origin}/public/trade/${trade.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-base)] border-[var(--border-hairline)]">
        <DialogHeader className="pb-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl font-bold text-[var(--text-high)]">
                {trade.ticker}
              </DialogTitle>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold",
                  typeConfig.color,
                  "bg-[var(--surface-2)]"
                )}
              >
                <TypeIcon className="w-3 h-3" />
                {typeConfig.label}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            {contractDisplay} {expirationDisplay && `· ${expirationDisplay}`}
          </p>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* P&L Hero */}
          <div className="text-center py-6 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
            <div
              className={cn(
                "text-5xl font-bold font-mono mb-2",
                isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
              )}
            >
              {isPositive ? "+" : ""}
              {pnl.toFixed(1)}%
            </div>
            <div className="text-sm text-[var(--text-muted)]">Current P&L</div>
          </div>

          {/* Price Info Grid */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-xs text-[var(--text-faint)] mb-1">Entry</div>
              <div className="font-mono font-semibold text-[var(--text-high)]">
                ${trade.entry_price?.toFixed(2) || "-"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-xs text-[var(--text-faint)] mb-1">Current</div>
              <div className="font-mono font-semibold text-[var(--text-high)]">
                ${(trade.current_price || trade.exit_price)?.toFixed(2) || "-"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-xs text-[var(--text-faint)] mb-1">Target</div>
              <div className="font-mono font-semibold text-[var(--accent-positive)]">
                ${trade.target_price?.toFixed(2) || "-"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-xs text-[var(--text-faint)] mb-1">Stop</div>
              <div className="font-mono font-semibold text-[var(--accent-negative)]">
                ${trade.stop_loss?.toFixed(2) || "-"}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {trade.target_price && trade.entry_price && trade.state === "ENTERED" && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[var(--text-muted)]">
                <span>Progress to Target</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    isPositive ? "bg-[var(--accent-positive)]" : "bg-[var(--accent-negative)]"
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Admin & Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-[var(--brand-primary)]" />
              <div>
                <div className="font-semibold text-[var(--text-high)]">
                  {trade.admin_name || "Admin"}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Called by</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-[var(--text-high)]">
                <Clock className="w-4 h-4" />
                {trade.time_in_trade || "Just now"}
              </div>
              <div className="text-xs text-[var(--text-muted)]">In trade</div>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="font-semibold text-[var(--text-high)] mb-3">Trade Timeline</h4>
            {isLoading ? (
              <div className="p-4 text-center text-[var(--text-muted)]">
                Loading timeline...
              </div>
            ) : tradeDetail?.timeline && tradeDetail.timeline.length > 0 ? (
              <div className="p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <TradeTimeline updates={tradeDetail.timeline} />
              </div>
            ) : (
              <div className="p-4 text-center text-[var(--text-muted)] bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
                No updates yet
              </div>
            )}
          </div>

          {/* Share Section */}
          <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <h4 className="font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Share This Trade
            </h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="flex-1"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-[var(--accent-positive)]" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const text = `${trade.ticker} ${contractDisplay} ${isPositive ? "+" : ""}${pnl.toFixed(0)}% - Called by ${trade.admin_name || "Admin"} on HONEYDRIP\n${shareUrl}`;
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
                    "_blank"
                  );
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Tweet
              </Button>
              {onShare && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onShare(trade)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  More
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatExpiration(expiration: string): string {
  try {
    const date = new Date(expiration);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "0DTE";
    if (diffDays === 1) return "1DTE";
    if (diffDays <= 7) return `${diffDays}DTE`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return expiration;
  }
}

export default TradeDetailModal;
