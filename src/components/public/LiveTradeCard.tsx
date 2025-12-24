/**
 * LiveTradeCard.tsx - Individual Trade Card Display
 *
 * Shows trade with type badge, admin attribution, P&L,
 * progress bar to target, and action buttons.
 */

import { Flame, Target, TrendingUp, BarChart3, Clock, Share2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PublicTrade, PublicTradeType } from "@/types/public";
import {
  formatContractLabel,
  formatExpiry,
  formatPct,
  formatPrice,
} from "@/lib/utils/publicFormatters";

// Re-export PublicTrade for backwards compatibility
export type { PublicTrade } from "@/types/public";

interface LiveTradeCardProps {
  trade: PublicTrade;
  onViewDetails?: (trade: PublicTrade) => void;
  onShare?: (trade: PublicTrade) => void;
  compact?: boolean;
}

// ============================================================================
// Trade Type Config
// ============================================================================

const TRADE_TYPE_CONFIG: Record<
  PublicTradeType,
  {
    icon: typeof Flame;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
  }
> = {
  Scalp: {
    icon: Flame,
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    borderColor: "border-orange-400/30",
    label: "SCALP",
  },
  Day: {
    icon: Target,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/30",
    label: "DAY",
  },
  Swing: {
    icon: TrendingUp,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/30",
    label: "SWING",
  },
  LEAP: {
    icon: BarChart3,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/30",
    label: "LEAP",
  },
};

// ============================================================================
// Component
// ============================================================================

export function LiveTradeCard({
  trade,
  onViewDetails,
  onShare,
  compact = false,
}: LiveTradeCardProps) {
  const pnl = trade.pnl_percent ?? 0;
  const isPositive = pnl >= 0;
  const isHot = pnl >= 50; // "Hot" trade indicator

  const typeConfig = TRADE_TYPE_CONFIG[trade.trade_type] || TRADE_TYPE_CONFIG.Scalp;
  const TypeIcon = typeConfig.icon;

  // Format contract display using canonical formatters
  const contractDisplay = formatContractLabel(trade.contract);

  // Format expiration - use expiry (canonical) or fall back to expiration
  const expirationDisplay = formatExpiry(trade.contract?.expiry);

  // Progress bar percentage
  const progress = Math.min(100, Math.max(0, trade.progress_to_target ?? 0));

  return (
    <div
      className={cn(
        "group relative rounded-lg border transition-all hover:scale-[1.01]",
        "bg-[var(--surface-1)] border-[var(--border-hairline)]",
        isHot && "ring-1 ring-[var(--brand-primary)]/50",
        compact ? "p-3" : "p-4"
      )}
    >
      {/* Hot indicator */}
      {isHot && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--brand-primary)] text-[10px] font-bold text-black">
          <Flame className="w-3 h-3" />
          HOT
        </div>
      )}

      {/* Header: Ticker + Type Badge */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-[var(--text-high)]">{trade.ticker}</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold",
                typeConfig.bgColor,
                typeConfig.color,
                "border",
                typeConfig.borderColor
              )}
            >
              <TypeIcon className="w-3 h-3" />
              {typeConfig.label}
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {contractDisplay} {expirationDisplay && `· ${expirationDisplay}`}
          </p>
        </div>

        {/* P&L Display */}
        <div
          className={cn(
            "text-right",
            isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          <p className={cn("font-bold font-mono", compact ? "text-2xl" : "text-3xl")}>
            {isPositive ? "+" : ""}
            {pnl.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Price Info */}
      {!compact && (
        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <span className="text-[var(--text-faint)]">Entry:</span>
            <span className="ml-1 font-mono text-[var(--text-high)]">
              ${trade.entry_price?.toFixed(2) || "-"}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-faint)]">Current:</span>
            <span className="ml-1 font-mono text-[var(--text-high)]">
              ${(trade.current_price || trade.exit_price)?.toFixed(2) || "-"}
            </span>
          </div>
        </div>
      )}

      {/* Progress Bar (for ENTERED trades with target) */}
      {trade.state === "ENTERED" && trade.target_price && trade.entry_price && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
            <span>
              Target: +
              {(((trade.target_price - trade.entry_price) / trade.entry_price) * 100).toFixed(0)}%
            </span>
            <span>
              Stop: -
              {Math.abs(
                (((trade.stop_loss || trade.entry_price) - trade.entry_price) / trade.entry_price) *
                  100
              ).toFixed(0)}
              %
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                isPositive ? "bg-[var(--accent-positive)]" : "bg-[var(--accent-negative)]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-xs text-[var(--text-faint)]">
              {progress.toFixed(0)}% to target
            </span>
          </div>
        </div>
      )}

      {/* Admin + Time */}
      <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="font-medium">{trade.admin_name || "Admin"}</span>
          {trade.time_in_trade && (
            <>
              <span className="text-[var(--text-faint)]">·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {trade.time_in_trade}
              </span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onViewDetails(trade)}
            >
              <Eye className="w-3 h-3 mr-1" />
              View
            </Button>
          )}
          {onShare && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onShare(trade)}
            >
              <Share2 className="w-3 h-3 mr-1" />
              Share
            </Button>
          )}
        </div>
      </div>

      {/* Public Comment */}
      {trade.public_comment && !compact && (
        <div className="mt-3 p-3 bg-[var(--surface-2)] rounded border-l-2 border-[var(--brand-primary)]">
          <p className="text-sm text-[var(--text-muted)] italic">"{trade.public_comment}"</p>
        </div>
      )}
    </div>
  );
}

// Helper functions moved to @/lib/utils/publicFormatters.ts

// ============================================================================
// Compact Variant for Carousel
// ============================================================================

export function LiveTradeCardCompact({
  trade,
  onViewDetails,
}: Omit<LiveTradeCardProps, "compact">) {
  return <LiveTradeCard trade={trade} onViewDetails={onViewDetails} compact />;
}

export default LiveTradeCard;
