import { Trade } from "../../../types";
import { HDTagTradeType } from "../../hd/common/HDTagTradeType";
import { cn, formatPrice } from "../../../lib/utils";
import { Share2, Trophy } from "lucide-react";

interface MobileExitedCardProps {
  trade: Trade;
  onShare: () => void;
  onTap?: () => void;
}

export function MobileExitedCard({ trade, onShare, onTap }: MobileExitedCardProps) {
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
    <div
      onClick={onTap}
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      onKeyDown={
        onTap
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onTap();
            }
          : undefined
      }
      className={cn(
        // Match HDRowLoadedTrade styling - flat row with bottom border
        "w-full p-3 border-b border-[var(--border-hairline)] min-h-[52px]",
        "hover:bg-[var(--surface-2)] transition-colors duration-150",
        onTap && "cursor-pointer"
      )}
    >
      {/* Main row: Contract info + P&L */}
      <div className="flex items-center justify-between">
        {/* Left: Ticker, Trade Type, Contract, Time */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--text-high)] font-medium">{trade.ticker}</span>
          <HDTagTradeType type={trade.tradeType} />
          <span className="text-[var(--text-muted)] text-xs">
            {contract?.strike}
            {contract?.type}
          </span>
          {exitTime && <span className="text-[var(--text-muted)] text-xs">{exitTime}</span>}
        </div>

        {/* Right: P&L */}
        <span
          className={cn(
            "font-mono text-sm font-semibold tabular-nums min-w-[60px] text-right",
            isWin ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          {isWin ? "+" : ""}
          {pnlPercent.toFixed(1)}%
        </span>
      </div>

      {/* Price detail row */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="font-mono">${formatPrice(entryPrice)}</span>
          <span>→</span>
          <span
            className={cn(
              "font-mono",
              isWin ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            ${formatPrice(exitPrice)}
          </span>
        </div>

        {/* Share button - inline */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click when Share button clicked
            onShare();
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium transition-colors min-h-[32px]",
            isWin
              ? "text-[var(--accent-positive)] bg-[var(--accent-positive)]/10 hover:bg-[var(--accent-positive)]/20 border border-[var(--accent-positive)]/30"
              : "text-[var(--text-muted)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border-hairline)]"
          )}
        >
          {isWin ? (
            <>
              <Trophy className="w-3 h-3" />
              Share
            </>
          ) : (
            <>
              <Share2 className="w-3 h-3" />
              Share
            </>
          )}
        </button>
      </div>
    </div>
  );
}
