import { Ticker } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { Plus, Zap } from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";

interface MobileWatchlistCardProps {
  ticker: Ticker;
  onLoad: () => void;
  active?: boolean;
}

export function MobileWatchlistCard({ ticker, onLoad, active }: MobileWatchlistCardProps) {
  const changePercent = ticker.changePercent || 0;
  const isPositive = changePercent >= 0;

  // Get live confluence from market data store
  const symbolData = useSymbolData(ticker.symbol);
  const confluenceScore = symbolData?.confluence?.overall;

  return (
    <div
      className={cn(
        // Match HDRowWatchlist styling - flat row with bottom border
        "w-full p-3 border-b border-[var(--border-hairline)] min-h-[52px]",
        "flex items-center justify-between",
        "hover:bg-[var(--surface-2)] transition-colors duration-150",
        active && "bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)]"
      )}
    >
      {/* Left: Symbol */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[var(--text-high)] font-medium">{ticker.symbol}</span>
        {confluenceScore !== undefined && confluenceScore > 70 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30">
            <Zap className="w-2.5 h-2.5 text-yellow-500" />
            <span className="text-[9px] font-medium text-yellow-500">
              {Math.round(confluenceScore)}
            </span>
          </div>
        )}
      </div>

      {/* Middle: Price and change */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <span className="text-[var(--text-high)] font-mono text-sm block">
            ${formatPrice(ticker.last || 0)}
          </span>
          <span
            className={cn(
              "text-xs font-mono",
              isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </div>

        {/* Load button */}
        <button
          onClick={onLoad}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius)] bg-[var(--brand-primary)] text-black font-medium text-xs min-h-[36px] min-w-[64px] justify-center hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Load
        </button>
      </div>
    </div>
  );
}
