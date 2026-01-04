/**
 * ChallengeActiveTradeRow - Live P&L Trade Row for Challenge Dialog
 *
 * Renders a single ENTERED trade with real-time P&L from useActiveTradeLiveModel.
 * Reports P&L updates to parent via onLivePnLUpdate callback for aggregation.
 */

import { useEffect } from "react";
import type { Trade } from "../../../types";
import { formatPrice, cn } from "../../../lib/utils";
import { useActiveTradeLiveModel } from "../../../hooks/useActiveTradeLiveModel";
import type { LivePnLEntry } from "../../../hooks/useChallengeStats";

interface ChallengeActiveTradeRowProps {
  trade: Trade;
  onTradeClick?: (trade: Trade) => void;
  onLivePnLUpdate?: (entry: LivePnLEntry) => void;
}

export function ChallengeActiveTradeRow({
  trade,
  onTradeClick,
  onLivePnLUpdate,
}: ChallengeActiveTradeRowProps) {
  // Get live trade data using the canonical hook
  const liveModel = useActiveTradeLiveModel(trade);

  // Report P&L updates to parent for aggregation
  useEffect(() => {
    if (liveModel && onLivePnLUpdate) {
      onLivePnLUpdate({
        tradeId: trade.id,
        pnlPercent: liveModel.pnlPercent,
        pnlDollars: liveModel.pnlDollars,
        effectiveMid: liveModel.effectiveMid,
      });
    }
  }, [trade.id, liveModel?.pnlPercent, liveModel?.pnlDollars, onLivePnLUpdate]);

  // Fallback values if liveModel is null (shouldn't happen for ENTERED trades)
  const pnl = liveModel?.pnlPercent ?? 0;
  const isPositive = pnl >= 0;
  const effectiveMid = liveModel?.effectiveMid ?? trade.currentPrice ?? 0;

  return (
    <button
      onClick={() => onTradeClick?.(trade)}
      className="w-full text-left p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border-2 border-[var(--brand-primary)]/30 hover:border-[var(--brand-primary)] transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[var(--text-high)] font-medium">
              {trade.ticker} ${trade.contract?.strike}
              {trade.contract?.type}
            </span>
            <span className="text-xs text-[var(--text-muted)]">{trade.contract?.expiry}</span>
            <span className="px-2 py-0.5 rounded text-micro uppercase tracking-wide bg-[var(--surface-1)] text-[var(--text-muted)]">
              {trade.tradeType}
            </span>
            {/* Live indicator */}
            <span className="flex items-center gap-1 text-micro text-[var(--brand-primary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            {trade.entryPrice && <span>Entry: ${formatPrice(trade.entryPrice)}</span>}
            {effectiveMid > 0 && <span>Current: ${formatPrice(effectiveMid)}</span>}
          </div>
          <div className="text-micro text-[var(--brand-primary)] mt-1">
            Click to manage in Live view
          </div>
        </div>

        <div
          className={cn(
            "px-4 py-2 rounded-[var(--radius)] font-bold text-lg tabular-nums ml-4",
            isPositive
              ? "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]"
              : "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]"
          )}
        >
          {isPositive ? "+" : ""}
          {pnl.toFixed(1)}%
        </div>
      </div>
    </button>
  );
}

export default ChallengeActiveTradeRow;
