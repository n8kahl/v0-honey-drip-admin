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
        {confluenceScore !== undefined && confluenceScore >= 50 && (
          <div
            data-testid="confluence-badge"
            className={`flex items-center gap-1 px-2 py-1 rounded ${
              confluenceScore >= 80
                ? "bg-green-500/20 border border-green-500/30"
                : confluenceScore >= 70
                  ? "bg-yellow-500/20 border border-yellow-500/30"
                  : "bg-blue-500/20 border border-blue-500/30"
            }`}
          >
            <Zap
              className={`w-3 h-3 ${
                confluenceScore >= 80
                  ? "text-green-500"
                  : confluenceScore >= 70
                    ? "text-yellow-500"
                    : "text-blue-500"
              }`}
            />
            <span
              className={`text-xs font-medium ${
                confluenceScore >= 80
                  ? "text-green-500"
                  : confluenceScore >= 70
                    ? "text-yellow-500"
                    : "text-blue-500"
              }`}
            >
              {Math.round(confluenceScore)}
            </span>
            {symbolData.confluence?.highlights?.[0] && (
              <span className="text-[10px] text-[var(--text-med)] ml-1 truncate max-w-[80px]">
                {symbolData.confluence.highlights[0]}
              </span>
            )}
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
