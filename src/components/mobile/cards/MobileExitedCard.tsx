import { Trade } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { Share2, Trophy } from "lucide-react";

interface MobileExitedCardProps {
  trade: Trade;
  onShare: () => void;
}

export function MobileExitedCard({ trade, onShare }: MobileExitedCardProps) {
  const contract = trade.contract;
  const entryPrice = trade.entryPrice || 0;
  const exitPrice = trade.exitPrice || trade.currentPrice || 0;
  const pnlPercent = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
  const isWin = pnlPercent > 0;

  // Format exit time
  const exitTime = trade.exitTime
    ? new Date(trade.exitTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--border-hairline)] overflow-hidden">
      {/* Main content */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-high)] font-semibold">{trade.ticker}</span>
            <span className="text-[var(--text-muted)] text-sm">
              {contract?.strike}
              {contract?.type?.[0]}
            </span>
            {exitTime && <span className="text-[var(--text-muted)] text-xs">{exitTime}</span>}
          </div>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              isWin ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {isWin ? "+" : ""}
            {pnlPercent.toFixed(1)}%
          </span>
        </div>

        {/* Price details */}
        <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-muted)]">
          <span className="tabular-nums">${formatPrice(entryPrice)}</span>
          <span>→</span>
          <span
            className={cn(
              "tabular-nums",
              isWin ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            ${formatPrice(exitPrice)}
          </span>
        </div>
      </div>

      {/* Share button */}
      <div className="border-t border-[var(--border-hairline)]">
        <button
          onClick={onShare}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 transition-colors min-h-[48px]",
            isWin
              ? "text-[var(--accent-positive)] hover:bg-[var(--accent-positive)]/10"
              : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
          )}
        >
          {isWin ? (
            <>
              <Trophy className="w-4 h-4" />
              <span className="text-sm font-medium">Share Win</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span className="text-sm font-medium">Share</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
