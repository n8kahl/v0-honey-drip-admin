import { Ticker } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { Plus } from "lucide-react";

interface MobileWatchlistCardProps {
  ticker: Ticker;
  onLoad: () => void;
}

export function MobileWatchlistCard({ ticker, onLoad }: MobileWatchlistCardProps) {
  const changePercent = ticker.changePercent || 0;
  const isPositive = changePercent >= 0;

  return (
    <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--border-hairline)] px-4 py-3 flex items-center justify-between">
      {/* Left: Symbol and price */}
      <div className="flex items-center gap-4">
        <div>
          <span className="text-[var(--text-high)] font-semibold block">{ticker.symbol}</span>
          <span className="text-[var(--text-muted)] text-xs">{ticker.name || ticker.symbol}</span>
        </div>
      </div>

      {/* Middle: Price and change */}
      <div className="flex-1 text-right mr-4">
        <span className="text-[var(--text-high)] tabular-nums block">
          ${formatPrice(ticker.last || 0)}
        </span>
        <span
          className={cn(
            "text-xs tabular-nums",
            isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          {isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Right: Load button */}
      <button
        onClick={onLoad}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--brand-primary)] text-black font-medium text-sm min-h-[40px] min-w-[72px] justify-center"
      >
        <Plus className="w-4 h-4" />
        Load
      </button>
    </div>
  );
}
