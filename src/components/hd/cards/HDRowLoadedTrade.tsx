import { Trade } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { formatPrice, cn } from "../../../lib/utils";
import { X, Zap } from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

interface HDRowLoadedTradeProps {
  trade: Trade;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export function HDRowLoadedTrade({ trade, active, onClick, onRemove }: HDRowLoadedTradeProps) {
  // Get real-time data from marketDataStore
  const symbolData = useSymbolData(trade.ticker);
  const confluence = symbolData?.confluence;

  // Prefer live market data, fall back to contract data
  const currentPrice = symbolData?.lastPrice ?? trade.currentPrice ?? trade.contract.mid ?? 0;
  const daysToExpiry = trade.contract.daysToExpiry ?? 0;

  // Color code DTE
  const getDTEColor = () => {
    if (daysToExpiry === 0) return "text-red-500";
    if (daysToExpiry <= 3) return "text-orange-500";
    if (daysToExpiry <= 7) return "text-yellow-500";
    return "text-green-500";
  };

  const confluenceScore = confluence?.overall;

  return (
    <div
      className={cn(
        "w-full flex items-center justify-between p-3 border-b border-[var(--border-hairline)] group min-h-[52px]",
        "cursor-pointer hover:bg-[var(--surface-2)] transition-colors duration-150 ease-out touch-manipulation",
        active && "bg-blue-500/10 border-l-2 border-l-blue-500 shadow-sm"
      )}
      onClick={onClick}
      data-testid={`loaded-trade-${trade.id}`}
    >
      <div className="flex-1 flex items-center justify-between text-left gap-3">
        {/* Left: Contract Details */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-high)] font-medium">{trade.ticker}</span>
            <HDTagTradeType type={trade.tradeType} />
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {trade.contract.strike}
            {trade.contract.type} · {daysToExpiry}
            <span className={cn("ml-1 font-semibold", getDTEColor())}>DTE</span>
          </div>
        </div>

        {/* Right: Price and Confluence */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[var(--text-high)] font-mono text-sm">
            {formatPrice(currentPrice)}
          </span>
          <div className="flex items-center gap-2">
            {confluenceScore !== undefined && confluenceScore > 70 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30">
                    <Zap className="w-2.5 h-2.5 text-yellow-500" />
                    <span className="text-[9px] font-medium text-yellow-500">
                      {Math.round(confluenceScore)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-zinc-800 text-zinc-200 border border-zinc-700"
                >
                  <div className="text-xs">Confluence: {Math.round(confluenceScore)}%</div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Remove Button */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all touch-manipulation active:scale-95"
          title="Remove loaded trade"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
