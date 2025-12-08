import { Trade } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { Scissors, Shield, LogOut } from "lucide-react";

interface MobileActiveCardProps {
  trade: Trade;
  onTrim: () => void;
  onUpdateSL: () => void;
  onExit: () => void;
  onTap?: () => void;
}

export function MobileActiveCard({
  trade,
  onTrim,
  onUpdateSL,
  onExit,
  onTap,
}: MobileActiveCardProps) {
  const contract = trade.contract;
  const entryPrice = trade.entryPrice || contract?.mid || 0;
  const currentPrice = trade.currentPrice || contract?.mid || 0;
  const pnlPercent =
    trade.movePercent || (entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0);
  const isProfit = pnlPercent >= 0;

  // Calculate DTE
  const dte = contract?.expiration
    ? Math.max(
        0,
        Math.floor((new Date(contract.expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  // P&L bar width (capped at 100%)
  const pnlBarWidth = Math.min(Math.abs(pnlPercent), 100);

  return (
    <div
      onClick={onTap}
      className="bg-[var(--surface-1)] rounded-xl border border-[var(--border-hairline)] overflow-hidden"
    >
      {/* Header row: Contract info */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-high)] font-semibold text-base">{trade.ticker}</span>
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
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {isProfit ? "+" : ""}
            {pnlPercent.toFixed(1)}%
          </span>
        </div>

        {/* Price row */}
        <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-muted)]">
          <span className="tabular-nums">${formatPrice(entryPrice)}</span>
          <span>→</span>
          <span
            className={cn(
              "tabular-nums font-medium",
              isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            ${formatPrice(currentPrice)}
          </span>
        </div>

        {/* P&L visual bar */}
        <div className="mt-3 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              isProfit ? "bg-[var(--accent-positive)]" : "bg-[var(--accent-negative)]"
            )}
            style={{ width: `${pnlBarWidth}%` }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-[var(--border-hairline)]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTrim();
          }}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors min-h-[48px]"
        >
          <Scissors className="w-4 h-4" />
          <span className="text-sm font-medium">Trim</span>
        </button>
        <div className="w-px bg-[var(--border-hairline)]" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdateSL();
          }}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[var(--text-med)] hover:bg-[var(--surface-2)] transition-colors min-h-[48px]"
        >
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">SL</span>
        </button>
        <div className="w-px bg-[var(--border-hairline)]" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[var(--accent-negative)] hover:bg-[var(--surface-2)] transition-colors min-h-[48px]"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Exit</span>
        </button>
      </div>
    </div>
  );
}
