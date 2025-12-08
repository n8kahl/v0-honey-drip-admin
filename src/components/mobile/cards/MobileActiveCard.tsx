import { Trade } from "../../../types";
import { HDTagTradeType } from "../../hd/common/HDTagTradeType";
import { cn, formatPrice } from "../../../lib/utils";
import { Scissors, Shield, LogOut, Zap } from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";

interface MobileActiveCardProps {
  trade: Trade;
  onTrim: () => void;
  onUpdateSL: () => void;
  onExit: () => void;
  onTap?: () => void;
  active?: boolean;
}

export function MobileActiveCard({
  trade,
  onTrim,
  onUpdateSL,
  onExit,
  onTap,
  active,
}: MobileActiveCardProps) {
  const contract = trade.contract;
  const entryPrice = trade.entryPrice || contract?.mid || 0;
  const currentPrice = trade.currentPrice || contract?.mid || 0;
  const pnlPercent =
    trade.movePercent || (entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0);
  const isProfit = pnlPercent >= 0;

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
      onClick={onTap}
      className={cn(
        // Match HDRowLoadedTrade styling - flat row with bottom border
        "w-full p-3 border-b border-[var(--border-hairline)] min-h-[52px]",
        "cursor-pointer hover:bg-[var(--surface-2)] transition-colors duration-150 touch-manipulation",
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
            <span className={cn("text-xs font-semibold", getDTEColor())}>{dte}DTE</span>
          )}
        </div>

        {/* Right: Price + Confluence + P&L */}
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-high)] font-mono text-sm">
            ${formatPrice(currentPrice)}
          </span>
          {confluenceScore !== undefined && confluenceScore > 70 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30">
              <Zap className="w-2.5 h-2.5 text-yellow-500" />
              <span className="text-[9px] font-medium text-yellow-500">
                {Math.round(confluenceScore)}
              </span>
            </div>
          )}
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums min-w-[60px] text-right",
              isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {isProfit ? "+" : ""}
            {pnlPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Price detail row */}
      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
        <span className="font-mono">${formatPrice(entryPrice)}</span>
        <span>→</span>
        <span
          className={cn(
            "font-mono",
            isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          ${formatPrice(currentPrice)}
        </span>
      </div>

      {/* Action buttons - compact row */}
      <div className="flex items-center gap-1 mt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTrim();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius)] text-[var(--brand-primary)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors min-h-[40px] border border-[var(--border-hairline)]"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Trim</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdateSL();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius)] text-[var(--text-med)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors min-h-[40px] border border-[var(--border-hairline)]"
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">SL</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius)] text-[var(--accent-negative)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors min-h-[40px] border border-[var(--border-hairline)]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Exit</span>
        </button>
      </div>
    </div>
  );
}
