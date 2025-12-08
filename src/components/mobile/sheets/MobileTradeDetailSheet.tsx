import { Drawer } from "vaul";
import { Trade } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { TrendingUp, TrendingDown, Target, Shield, Info, ChevronDown } from "lucide-react";

interface MobileTradeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
}

export function MobileTradeDetailSheet({ open, onOpenChange, trade }: MobileTradeDetailSheetProps) {
  if (!trade) return null;

  const contract = trade.contract;
  const entryPrice = trade.entryPrice || contract?.mid || 0;
  const currentPrice = trade.currentPrice || contract?.mid || 0;
  const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  const isPositive = pnlPercent >= 0;

  // Calculate DTE
  const dte = contract?.expiry
    ? Math.max(
        0,
        Math.ceil((new Date(contract.expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  // Get confluence factors
  const confluence = trade.confluence;
  const factors = confluence?.factors || {};

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-base)] rounded-t-2xl max-h-[85vh]">
          <div className="mx-auto w-12 h-1.5 bg-[var(--border-hairline)] rounded-full my-3" />

          <div className="px-4 pb-safe overflow-y-auto max-h-[calc(85vh-24px)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-high)]">
                  {trade.ticker} ${contract?.strike}
                  {contract?.type}
                </h2>
                <span className="text-[var(--text-muted)] text-sm">
                  {dte !== null ? `${dte}DTE` : ""} · {trade.tradeType}
                </span>
              </div>
              <div
                className={cn(
                  "text-xl font-bold tabular-nums",
                  isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                )}
              >
                {isPositive ? "+" : ""}
                {pnlPercent.toFixed(1)}%
              </div>
            </div>

            {/* Price Section */}
            <div className="bg-[var(--surface-1)] rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide block mb-1">
                    Entry
                  </span>
                  <span className="text-[var(--text-high)] text-lg tabular-nums">
                    ${formatPrice(entryPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide block mb-1">
                    Current
                  </span>
                  <span className="text-[var(--text-high)] text-lg tabular-nums">
                    ${formatPrice(currentPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Levels */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
                Key Levels
              </h3>
              <div className="bg-[var(--surface-1)] rounded-xl divide-y divide-[var(--border-hairline)]">
                {trade.targetPrice && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[var(--accent-positive)]" />
                      <span className="text-[var(--text-med)]">Target</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[var(--text-high)] tabular-nums">
                        ${formatPrice(trade.targetPrice)}
                      </span>
                      {entryPrice > 0 && (
                        <span className="text-[var(--accent-positive)] text-xs ml-2">
                          +{(((trade.targetPrice - entryPrice) / entryPrice) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {trade.stopLoss && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[var(--accent-negative)]" />
                      <span className="text-[var(--text-med)]">Stop Loss</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[var(--text-high)] tabular-nums">
                        ${formatPrice(trade.stopLoss)}
                      </span>
                      {entryPrice > 0 && (
                        <span className="text-[var(--accent-negative)] text-xs ml-2">
                          {(((trade.stopLoss - entryPrice) / entryPrice) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Greeks (if available) */}
            {contract && (contract.delta !== undefined || contract.theta !== undefined) && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
                  Greeks
                </h3>
                <div className="bg-[var(--surface-1)] rounded-xl p-4">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {contract.delta !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Delta</span>
                        <span className="text-[var(--text-high)] tabular-nums">
                          {(contract.delta * 100).toFixed(0)}
                        </span>
                      </div>
                    )}
                    {contract.gamma !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Gamma</span>
                        <span className="text-[var(--text-high)] tabular-nums">
                          {contract.gamma.toFixed(3)}
                        </span>
                      </div>
                    )}
                    {contract.theta !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Theta</span>
                        <span className="text-[var(--accent-negative)] tabular-nums">
                          {contract.theta.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {contract.iv !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">IV</span>
                        <span className="text-[var(--text-high)] tabular-nums">
                          {(contract.iv * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Confluence (if available) */}
            {confluence && Object.keys(factors).length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
                  Confluence ({confluence.score}/100)
                </h3>
                <div className="bg-[var(--surface-1)] rounded-xl divide-y divide-[var(--border-hairline)]">
                  {factors.mtfAlignment && (
                    <div className="flex items-center justify-between px-4 py-2">
                      <span className="text-[var(--text-med)] text-sm">MTF Alignment</span>
                      <span
                        className={cn(
                          "text-sm",
                          factors.mtfAlignment.status === "bullish"
                            ? "text-[var(--accent-positive)]"
                            : factors.mtfAlignment.status === "bearish"
                              ? "text-[var(--accent-negative)]"
                              : "text-[var(--text-muted)]"
                        )}
                      >
                        {factors.mtfAlignment.label}
                      </span>
                    </div>
                  )}
                  {factors.flowPressure && (
                    <div className="flex items-center justify-between px-4 py-2">
                      <span className="text-[var(--text-med)] text-sm">Flow Pressure</span>
                      <span
                        className={cn(
                          "text-sm",
                          factors.flowPressure.status === "bullish"
                            ? "text-[var(--accent-positive)]"
                            : factors.flowPressure.status === "bearish"
                              ? "text-[var(--accent-negative)]"
                              : "text-[var(--text-muted)]"
                        )}
                      >
                        {factors.flowPressure.label}
                      </span>
                    </div>
                  )}
                  {factors.ivPercentile && (
                    <div className="flex items-center justify-between px-4 py-2">
                      <span className="text-[var(--text-med)] text-sm">IV Percentile</span>
                      <span className="text-[var(--text-high)] text-sm">
                        {factors.ivPercentile.label}
                      </span>
                    </div>
                  )}
                  {factors.regime && (
                    <div className="flex items-center justify-between px-4 py-2">
                      <span className="text-[var(--text-med)] text-sm">Market Regime</span>
                      <span className="text-[var(--text-high)] text-sm">
                        {factors.regime.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Setup Type */}
            {trade.setupType && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
                  Setup
                </h3>
                <div className="bg-[var(--surface-1)] rounded-xl px-4 py-3">
                  <span className="text-[var(--brand-primary)]">
                    {trade.setupType.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-3 text-[var(--text-muted)] text-sm flex items-center justify-center gap-1"
            >
              <ChevronDown className="w-4 h-4" />
              Close
            </button>

            <div className="h-4" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
