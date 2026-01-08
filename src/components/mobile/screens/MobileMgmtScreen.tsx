/**
 * MobileMgmtScreen - Active Trades & Risk Management
 *
 * Portfolio management view showing:
 * - Active positions with P&L
 * - Portfolio risk metrics (Delta, Theta)
 * - Loaded strategies waiting for entry
 *
 * Part of the Opportunity Stack [MGMT] tab.
 */

import { useState, useMemo } from "react";
import { Trade } from "../../../types";
import { useTradeStore } from "../../../stores/tradeStore";
import { MobileActiveCard } from "../cards/MobileActiveCard";
import { MobileLoadedCard } from "../cards/MobileLoadedCard";
import { MobileTradeDetailSheet } from "../sheets/MobileTradeDetailSheet";
import { Shield, Zap, Clock } from "lucide-react";
import { HDInstitutionalRadar } from "../../hd/common/HDInstitutionalRadar";
import { cn } from "../../../lib/utils";
import { getPortfolioGreeks } from "../../../services/greeksMonitorService";

interface MobileMgmtScreenProps {
  enteredTrades: Trade[];
  loadedTrades: Trade[];
  onTrim: (trade: Trade) => void;
  onUpdateSL: (trade: Trade) => void;
  onExit: (trade: Trade) => void;
  onEnter: (trade: Trade) => void;
  onDismiss: (trade: Trade) => void;
}

export function MobileMgmtScreen({
  enteredTrades,
  loadedTrades,
  onTrim,
  onUpdateSL,
  onExit,
  onEnter,
  onDismiss,
}: MobileMgmtScreenProps) {
  const [detailTrade, setDetailTrade] = useState<Trade | null>(null);

  // Calculate aggregate portfolio metrics
  const portfolioStats = useMemo(() => {
    const greeks = getPortfolioGreeks();

    // Calculate net P&L from entered trades
    let totalPnL = 0;
    let totalCost = 0;

    enteredTrades.forEach((trade) => {
      const pnl = trade.movePercent ?? 0;
      totalPnL += pnl;

      // Estimate position cost (simplified)
      const entryPrice = trade.entryPrice ?? trade.contract?.mid ?? 0;
      totalCost += entryPrice * 100; // 1 contract = 100 shares
    });

    const avgPnL = enteredTrades.length > 0 ? totalPnL / enteredTrades.length : 0;

    return {
      positionCount: enteredTrades.length,
      loadedCount: loadedTrades.length,
      netPnL: avgPnL,
      totalDelta: greeks?.totalDelta ?? 0,
      thetaPerDay: greeks?.thetaPerDay ?? 0,
      isProfit: avgPnL >= 0,
    };
  }, [enteredTrades, loadedTrades]);

  const hasContent = enteredTrades.length > 0 || loadedTrades.length > 0;

  // Empty state - Institutional Radar
  if (!hasContent) {
    return (
      <div className="flex-1">
        <HDInstitutionalRadar
          message="Waiting for institutional flow..."
          subMessage="Load and enter trades from the SCAN tab"
          size="lg"
          className="h-full"
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {/* Portfolio Risk Header */}
        <div className="p-4 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[var(--brand-primary)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Portfolio Risk
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {portfolioStats.positionCount} position
              {portfolioStats.positionCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Net P&L - large display */}
          <div className="flex items-baseline gap-2 mb-4">
            <span
              className={cn(
                "text-3xl font-bold tabular-nums",
                portfolioStats.isProfit ? "text-yellow-500" : "text-[var(--accent-negative)]"
              )}
            >
              {portfolioStats.isProfit ? "+" : ""}
              {portfolioStats.netPnL.toFixed(1)}%
            </span>
            <span className="text-sm text-[var(--text-muted)]">Net P&L</span>
          </div>

          {/* Greeks row */}
          <div className="flex items-center gap-6">
            {/* Delta - Positive=Green, Negative=Red */}
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-[var(--text-muted)]">Δ</span>
              <span
                className={cn(
                  "text-sm font-mono font-bold tabular-nums",
                  portfolioStats.totalDelta >= 0
                    ? "text-[var(--accent-positive)]"
                    : "text-[var(--accent-negative)]"
                )}
              >
                {portfolioStats.totalDelta >= 0 ? "+" : ""}
                {portfolioStats.totalDelta.toFixed(2)}
              </span>
            </div>

            {/* Theta */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-[var(--text-muted)]">θ</span>
              <span className="text-sm font-mono font-bold text-amber-400">
                -${Math.abs(portfolioStats.thetaPerDay).toFixed(0)}/d
              </span>
            </div>
          </div>
        </div>

        {/* Active Positions Section */}
        {enteredTrades.length > 0 && (
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-yellow-500">
                Active Positions
              </span>
            </div>
            <div className="space-y-3">
              {enteredTrades.map((trade) => (
                <MobileActiveCard
                  key={trade.id}
                  trade={trade}
                  onTrim={() => onTrim(trade)}
                  onUpdateSL={() => onUpdateSL(trade)}
                  onExit={() => onExit(trade)}
                  onTap={() => setDetailTrade(trade)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loaded Strategies Section */}
        {loadedTrades.length > 0 && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                Pending Entry
              </span>
              <span className="text-xs text-[var(--text-muted)]">({loadedTrades.length})</span>
            </div>
            <div className="space-y-2">
              {loadedTrades.map((trade) => (
                <MobileLoadedCard
                  key={trade.id}
                  trade={trade}
                  onEnter={() => onEnter(trade)}
                  onDismiss={() => onDismiss(trade)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trade Detail Sheet */}
      <MobileTradeDetailSheet
        open={!!detailTrade}
        onOpenChange={(open) => !open && setDetailTrade(null)}
        trade={detailTrade}
      />
    </>
  );
}

export default MobileMgmtScreen;
