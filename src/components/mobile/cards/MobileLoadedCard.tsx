import { Trade } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { Play, X } from "lucide-react";

interface MobileLoadedCardProps {
  trade: Trade;
  onEnter: () => void;
  onDismiss: () => void;
}

export function MobileLoadedCard({ trade, onEnter, onDismiss }: MobileLoadedCardProps) {
  const contract = trade.contract;
  const mid = contract?.mid || 0;

  // Calculate DTE
  const dte = contract?.expiration
    ? Math.max(
        0,
        Math.floor((new Date(contract.expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  return (
    <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--border-hairline)] overflow-hidden">
      {/* Info row */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-high)] font-semibold">{trade.ticker}</span>
          <span className="text-[var(--text-med)] text-sm">
            {contract?.strike}
            {contract?.type?.[0]}
          </span>
          {dte !== null && (
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                dte === 0
                  ? "bg-red-500/20 text-red-400"
                  : dte <= 2
                    ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)]"
              )}
            >
              {dte}DTE
            </span>
          )}
        </div>
        <span className="text-[var(--text-med)] text-sm tabular-nums">${formatPrice(mid)}</span>
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-[var(--border-hairline)]">
        <button
          onClick={onEnter}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[var(--accent-positive)] hover:bg-[var(--surface-2)] transition-colors min-h-[48px]"
        >
          <Play className="w-4 h-4" />
          <span className="text-sm font-medium">Enter</span>
        </button>
        <div className="w-px bg-[var(--border-hairline)]" />
        <button
          onClick={onDismiss}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors min-h-[48px]"
        >
          <X className="w-4 h-4" />
          <span className="text-sm font-medium">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
