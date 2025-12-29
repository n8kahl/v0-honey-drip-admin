import { Trade } from "../../../types";
import { HDTagTradeType } from "../../hd/common/HDTagTradeType";
import { cn, formatPrice } from "../../../lib/utils";
import { Play, X, Zap, Wifi, WifiOff } from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { formatExpirationShort } from "../../../ui/semantics";

interface MobileLoadedCardProps {
  trade: Trade;
  onEnter: () => void;
  onDismiss: () => void;
  active?: boolean;
}

export function MobileLoadedCard({ trade, onEnter, onDismiss, active }: MobileLoadedCardProps) {
  const contract = trade.contract;

  // Get LIVE price data via WebSocket/REST transport (matches desktop pattern)
  const contractTicker = contract?.id || contract?.ticker || contract?.symbol || null;
  const {
    currentPrice: liveCurrentPrice,
    source,
    asOf,
  } = useActiveTradePnL(trade.id, contractTicker, contract?.mid || 0);

  // Use live data if available, fallback to stale contract data
  const mid = liveCurrentPrice > 0 ? liveCurrentPrice : contract?.mid || 0;

  // Data freshness check (stale if >10s old)
  const isStale = Date.now() - asOf > 10000;

  // Get live confluence from market data store
  const symbolData = useSymbolData(trade.ticker);
  const confluenceScore = symbolData?.confluence?.overall;

  // Calculate DTE
  const dte = contract?.expiry
    ? Math.max(
        0,
        Math.ceil((new Date(contract.expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : (contract?.daysToExpiry ?? null);

  // DTE color coding (match desktop)
  const getDTEColor = () => {
    if (dte === null) return "text-[var(--text-muted)]";
    if (dte === 0) return "text-red-500";
    if (dte <= 3) return "text-orange-500";
    if (dte <= 7) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div
      className={cn(
        // Match HDRowLoadedTrade styling - flat row with bottom border
        "w-full p-3 border-b border-[var(--border-hairline)] min-h-[52px]",
        "hover:bg-[var(--surface-2)] transition-colors duration-150",
        active && "bg-blue-500/10 border-l-2 border-l-blue-500"
      )}
    >
      {/* Main row: Contract info + Price */}
      <div className="flex items-center justify-between">
        {/* Left: Ticker, Trade Type, Contract, DTE */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--text-high)] font-medium">{trade.ticker}</span>
          <HDTagTradeType type={trade.tradeType} />
          <span className="text-[var(--text-muted)] text-xs">
            {contract?.strike}
            {contract?.type}
          </span>
          {dte !== null && (
            <div className="flex items-center gap-1">
              <span className={cn("text-xs font-semibold", getDTEColor())}>{dte}DTE</span>
              {contract?.expiry && (
                <>
                  <span className="text-[9px] text-[var(--text-faint)]">•</span>
                  <span className="text-[9px] text-[var(--text-faint)]">
                    {formatExpirationShort(contract.expiry)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Live indicator + Price + Confluence */}
        <div className="flex items-center gap-3">
          {/* Live data indicator */}
          {source === "websocket" && !isStale ? (
            <Wifi className="w-3 h-3 text-green-500" />
          ) : isStale ? (
            <WifiOff className="w-3 h-3 text-amber-500" />
          ) : null}
          <span className="text-[var(--text-high)] font-mono text-sm">${formatPrice(mid)}</span>
          {confluenceScore !== undefined && confluenceScore > 70 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30">
              <Zap className="w-2.5 h-2.5 text-yellow-500" />
              <span className="text-[9px] font-medium text-yellow-500">
                {Math.round(confluenceScore)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons - compact row */}
      <div className="flex items-center gap-1 mt-2">
        <button
          onClick={onEnter}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius)] text-[var(--accent-positive)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors min-h-[40px] border border-[var(--border-hairline)]"
        >
          <Play className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Enter</span>
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius)] text-[var(--text-muted)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors min-h-[40px] border border-[var(--border-hairline)]"
        >
          <X className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
