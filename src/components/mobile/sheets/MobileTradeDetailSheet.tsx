import { useState } from "react";
import { Drawer } from "vaul";
import { Trade, AlertType } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  ChevronDown,
  ChevronRight,
  Activity,
  Layers,
  Zap,
  Wifi,
  WifiOff,
  Scissors,
  DollarSign,
  Clock,
} from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";
import { getEntryPriceFromUpdates } from "../../../lib/tradePnl";
import { useKeyLevels } from "../../../hooks/useKeyLevels";
import useActiveTradeLiveModel from "../../../hooks/useActiveTradeLiveModel";
import { Button } from "../../ui/button";

interface MobileTradeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
  onAction?: (
    alertType: AlertType,
    alertOptions?: { updateKind?: string; trimPercent?: number }
  ) => void;
}

export function MobileTradeDetailSheet({
  open,
  onOpenChange,
  trade,
  onAction,
}: MobileTradeDetailSheetProps) {
  // Collapsible section states
  const [showKeyLevels, setShowKeyLevels] = useState(false);
  const [showGreeks, setShowGreeks] = useState(false);
  const [showConfluence, setShowConfluence] = useState(false);

  // Get key levels from useKeyLevels (enriched with SMC/Options Flow)
  const { keyLevels } = useKeyLevels(trade?.ticker || "");

  // Get live confluence from market data store
  const symbolData = useSymbolData(trade?.ticker || "");
  const liveConfluence = symbolData?.confluence;

  // Get FULL live model (includes progress, R-multiple, underlying, Greeks, etc.)
  const liveModel = useActiveTradeLiveModel(trade);

  if (!trade || !liveModel) return null;

  const contract = trade.contract;
  const entryPrice = liveModel.entryPrice;
  const currentPrice = liveModel.effectiveMid;
  const pnlPercent = liveModel.pnlPercent;
  const pnlDollars = liveModel.pnlDollars;
  const isPositive = pnlPercent >= 0;

  // Data freshness
  const isStale = liveModel.priceIsStale;
  const source = liveModel.optionSource;

  // Calculate DTE
  const dte = contract?.expiry
    ? Math.max(
        0,
        Math.ceil((new Date(contract.expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  // Transform enriched KeyLevels into displayable list
  const levels: any[] = [];
  if (keyLevels) {
    if (keyLevels.vwap) levels.push({ source: "VWAP", price: keyLevels.vwap, type: "neutral" });
    if (keyLevels.priorDayHigh)
      levels.push({ source: "PDH", price: keyLevels.priorDayHigh, type: "resistance" });
    if (keyLevels.priorDayLow)
      levels.push({ source: "PDL", price: keyLevels.priorDayLow, type: "support" });
    if (keyLevels.optionsFlow?.gammaWall)
      levels.push({ source: "GEX Wall", price: keyLevels.optionsFlow.gammaWall, type: "neutral" });

    if (keyLevels.smcLevels) {
      keyLevels.smcLevels.forEach((sl: any) => {
        levels.push({
          source: sl.label.split(" ")[0],
          price: sl.price,
          type: sl.type.includes("high") || sl.type.includes("bear") ? "resistance" : "support",
        });
      });
    }
  }

  // Get trade's confluence (stored on trade object) or use live
  const confluence = trade.confluence || liveConfluence;

  // Calculate confluence metrics
  const trendScore = confluence?.trend ?? liveConfluence?.trend ?? 50;
  const volPercentile = confluence?.volatility ?? liveConfluence?.volatility ?? 50;
  const liqScore = confluence?.volume ?? liveConfluence?.volume ?? 50;

  // Trend chip logic (matching desktop)
  const direction = contract?.type === "C" ? "call" : "put";
  const getTrendLabel = () => {
    if (trendScore >= 70) return direction === "call" ? "Bullish" : "Bearish";
    if (trendScore >= 40) return "Mixed";
    return direction === "call" ? "Bearish" : "Bullish";
  };

  const getTrendBg = () => {
    if (trendScore >= 70)
      return "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/20";
    if (trendScore >= 40) return "bg-[var(--surface-2)] border-[var(--border-hairline)]";
    return "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/20";
  };

  const getTrendText = () => {
    if (trendScore >= 70) return "text-[var(--accent-positive)]";
    if (trendScore >= 40) return "text-[var(--text-med)]";
    return "text-[var(--accent-negative)]";
  };

  // Volatility chip logic
  const getVolatilityLabel = () => {
    if (volPercentile >= 70) return "Elevated";
    if (volPercentile >= 30) return "Normal";
    return "Calm";
  };

  const getVolatilityBg = () => {
    if (volPercentile >= 70) return "bg-amber-500/10 border-amber-500/30";
    if (volPercentile <= 30) return "bg-blue-500/10 border-blue-500/20";
    return "bg-[var(--surface-2)] border-[var(--border-hairline)]";
  };

  const getVolatilityText = () => {
    if (volPercentile >= 70) return "text-amber-400";
    if (volPercentile <= 30) return "text-blue-400";
    return "text-[var(--text-med)]";
  };

  // Liquidity chip logic
  const getLiquidityLabel = () => {
    if (liqScore >= 70) return "Good";
    if (liqScore >= 40) return "Fair";
    return "Thin";
  };

  const getLiquidityBg = () => {
    if (liqScore >= 70) return "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/20";
    if (liqScore >= 40) return "bg-amber-500/10 border-amber-500/30";
    return "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30";
  };

  const getLiquidityText = () => {
    if (liqScore >= 70) return "text-[var(--accent-positive)]";
    if (liqScore >= 40) return "text-amber-400";
    return "text-[var(--accent-negative)]";
  };

  // Alignment check
  const isAligned = direction === "call" ? trendScore >= 60 : trendScore <= 40;

  // Coaching message (matching desktop)
  const getCoachingMessage = () => {
    if (isPositive && !isAligned) {
      return "Profitable but momentum not aligned - consider taking gains";
    }
    if (!isPositive && !isAligned) {
      return "Risk elevated: momentum and P&L both unfavorable";
    }
    if (isAligned && liqScore >= 60) {
      return "Strong setup: momentum aligned with good liquidity";
    }
    return null;
  };

  const coachingMessage = getCoachingMessage();

  // Get nearest resistance and support from key levels (BUG FIX: was using undefined symbolLevels)
  const nearestResistance = levels
    .filter((l) => l.type === "resistance" && l.price > (currentPrice || 0))
    .sort((a, b) => a.price - b.price)[0];

  const nearestSupport = levels
    .filter((l) => l.type === "support" && l.price < (currentPrice || 0))
    .sort((a, b) => b.price - a.price)[0];

  // Quick action button states
  const isExpired = liveModel.isExpired;
  const hasPosition = trade.state === "ENTERED";
  const canMoveToBE = !isExpired && currentPrice > entryPrice;

  // Progress bar color logic
  const getProgressColor = () => {
    if (liveModel.progressToTarget >= 100) return "bg-[var(--accent-positive)]";
    if (liveModel.progressToTarget >= 50) return "bg-[var(--brand-primary)]";
    if (liveModel.progressToTarget >= 0) return "bg-[var(--text-muted)]";
    return "bg-[var(--accent-negative)]";
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-base)] rounded-t-2xl max-h-[90vh]">
          <div className="mx-auto w-12 h-1.5 bg-[var(--border-hairline)] rounded-full my-3" />

          <div className="px-4 pb-safe overflow-y-auto max-h-[calc(90vh-24px)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-high)]">
                  {trade.ticker} ${contract?.strike}
                  {contract?.type}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[var(--text-muted)] text-sm">
                    {dte !== null ? `${dte}DTE` : ""} · {trade.tradeType}
                  </span>
                  {/* Live data indicator */}
                  {source === "websocket" && !isStale ? (
                    <span className="flex items-center gap-1 text-green-500 text-xs">
                      <Wifi className="w-3 h-3" /> Live
                    </span>
                  ) : isStale ? (
                    <span className="flex items-center gap-1 text-amber-500 text-xs">
                      <WifiOff className="w-3 h-3" /> Stale
                    </span>
                  ) : null}
                  {/* Underlying price */}
                  {liveModel.underlyingPrice !== null && (
                    <span className="text-xs text-[var(--text-med)]">
                      {trade.ticker}{" "}
                      <span className="tabular-nums font-mono">
                        ${liveModel.underlyingPrice.toFixed(2)}
                      </span>
                      {liveModel.underlyingChangePercent !== 0 && (
                        <span
                          className={cn(
                            "ml-1",
                            liveModel.underlyingChangePercent >= 0
                              ? "text-[var(--accent-positive)]"
                              : "text-[var(--accent-negative)]"
                          )}
                        >
                          {liveModel.underlyingChangePercent >= 0 ? "+" : ""}
                          {liveModel.underlyingChangePercent.toFixed(2)}%
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Expired Warning */}
            {isExpired && (
              <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-amber-500">
                    ⚠️ Contract Expired - Manual Exit Required
                  </span>
                </div>
              </div>
            )}

            {/* Progress to TP Bar */}
            <div className="mb-4 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-faint)] mb-1.5">
                <span>Progress to TP</span>
                <span className="tabular-nums font-medium text-[var(--text-high)]">
                  {Math.round(liveModel.progressToTarget)}%
                </span>
              </div>
              <div className="h-2.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    getProgressColor()
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, liveModel.progressToTarget))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text-faint)] mt-1">
                <span>SL ${liveModel.stopLoss.toFixed(2)}</span>
                <span>TP ${liveModel.targetPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Large P&L Display */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4 mb-4">
              <div className="text-center mb-3">
                <div
                  className={cn(
                    "text-3xl font-bold tabular-nums font-mono",
                    isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {pnlPercent.toFixed(1)}%
                </div>
                <div
                  className={cn(
                    "text-lg tabular-nums font-mono",
                    isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                  )}
                >
                  ({pnlDollars >= 0 ? "+" : ""}${pnlDollars.toFixed(0)})
                </div>
              </div>

              {/* Entry/Current Row */}
              <div className="flex items-center justify-center gap-3 text-sm mb-2">
                <span className="text-[var(--text-muted)]">Entry</span>
                <span className="text-[var(--text-high)] tabular-nums font-mono">
                  ${entryPrice.toFixed(2)}
                </span>
                <span className="text-[var(--text-faint)]">→</span>
                <span
                  className={cn(
                    "tabular-nums font-mono",
                    isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                  )}
                >
                  ${currentPrice.toFixed(2)}
                </span>
              </div>

              {/* R-Multiple + Hold Time */}
              <div className="flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
                {liveModel.rMultiple !== null && (
                  <div className="flex items-center gap-1">
                    <span>R:</span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        liveModel.rMultiple >= 0
                          ? "text-[var(--accent-positive)]"
                          : "text-[var(--accent-negative)]"
                      )}
                    >
                      {liveModel.rMultiple >= 0 ? "+" : ""}
                      {liveModel.rMultiple.toFixed(2)}R
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span className="tabular-nums">{liveModel.holdTimeFormatted}</span>
                </div>
              </div>
            </div>

            {/* Coaching Message */}
            {coachingMessage && (
              <div
                className={cn(
                  "px-3 py-2 rounded-lg border text-xs font-medium mb-4",
                  coachingMessage.includes("Strong")
                    ? "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30 text-[var(--accent-positive)]"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                )}
              >
                {coachingMessage.includes("Strong") ? "✓" : "⚠"} {coachingMessage}
              </div>
            )}

            {/* Quick Actions Section */}
            {hasPosition && onAction && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isExpired}
                    onClick={() => onAction("update", { updateKind: "trim", trimPercent: 25 })}
                    className="flex items-center gap-1.5"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    Trim 25%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isExpired}
                    onClick={() => onAction("update", { updateKind: "trim", trimPercent: 50 })}
                    className="flex items-center gap-1.5"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    Trim 50%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canMoveToBE}
                    onClick={() => onAction("update", { updateKind: "sl" })}
                    className="flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    SL → BE
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isExpired}
                    onClick={() => onAction("trail-stop")}
                    className="flex items-center gap-1.5"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Trail Stop
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full mt-2 flex items-center justify-center gap-1.5"
                  onClick={() => onAction("exit")}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Full Exit
                </Button>
              </div>
            )}

            {/* Collapsible Sections */}
            <div className="space-y-2 mb-4">
              {/* Key Levels Collapsible */}
              <CollapsibleSection
                title="Key Levels"
                icon={<Layers className="w-3.5 h-3.5 text-[var(--brand-primary)]" />}
                open={showKeyLevels}
                onToggle={() => setShowKeyLevels(!showKeyLevels)}
                badge={levels.length > 0 ? `${levels.length}` : undefined}
              >
                {levels.length === 0 ? (
                  <p className="text-[var(--text-muted)] text-sm text-center py-2">
                    Add {trade.ticker} to watchlist for key levels
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-hairline)]">
                    {levels
                      .sort((a, b) => b.price - a.price)
                      .slice(0, 8)
                      .map((level, idx) => (
                        <KeyLevelRow
                          key={`${level.source}-${idx}`}
                          level={level}
                          currentPrice={currentPrice}
                          icon={
                            level.type === "resistance" ? (
                              <TrendingUp className="w-4 h-4 text-red-400" />
                            ) : level.type === "support" ? (
                              <TrendingDown className="w-4 h-4 text-green-400" />
                            ) : (
                              <Activity className="w-4 h-4 text-yellow-400" />
                            )
                          }
                        />
                      ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Greeks Collapsible */}
              {contract && (contract.delta !== undefined || contract.theta !== undefined) && (
                <CollapsibleSection
                  title="Greeks"
                  icon={<Zap className="w-3.5 h-3.5 text-[var(--brand-primary)]" />}
                  open={showGreeks}
                  onToggle={() => setShowGreeks(!showGreeks)}
                >
                  <div className="grid grid-cols-4 gap-2 text-center py-2">
                    {contract.delta !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Δ</span>
                        <span className="text-[var(--text-high)] tabular-nums font-mono text-sm">
                          {(contract.delta * 100).toFixed(0)}
                        </span>
                      </div>
                    )}
                    {contract.gamma !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Γ</span>
                        <span className="text-[var(--text-high)] tabular-nums font-mono text-sm">
                          {contract.gamma.toFixed(3)}
                        </span>
                      </div>
                    )}
                    {contract.theta !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Θ</span>
                        <span className="text-[var(--accent-negative)] tabular-nums font-mono text-sm">
                          {contract.theta.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {contract.iv !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">IV</span>
                        <span className="text-[var(--text-high)] tabular-nums font-mono text-sm">
                          {(contract.iv * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Confluence Collapsible */}
              <CollapsibleSection
                title="Confluence"
                icon={<Zap className="w-3.5 h-3.5 text-[var(--brand-primary)]" />}
                open={showConfluence}
                onToggle={() => setShowConfluence(!showConfluence)}
                badge={isAligned ? "✓" : "⚠"}
              >
                <div className="grid grid-cols-3 gap-2 py-2">
                  {/* Trend chip */}
                  <div className={cn("rounded-lg border p-2", getTrendBg())}>
                    <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-0.5">
                      Trend
                    </div>
                    <div className={cn("text-xs font-medium", getTrendText())}>
                      {getTrendLabel()}
                    </div>
                  </div>

                  {/* Volatility chip */}
                  <div className={cn("rounded-lg border p-2", getVolatilityBg())}>
                    <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-0.5">
                      Vol
                    </div>
                    <div className={cn("text-xs font-medium", getVolatilityText())}>
                      {getVolatilityLabel()}
                    </div>
                  </div>

                  {/* Liquidity chip */}
                  <div className={cn("rounded-lg border p-2", getLiquidityBg())}>
                    <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-0.5">
                      Liq
                    </div>
                    <div className={cn("text-xs font-medium", getLiquidityText())}>
                      {getLiquidityLabel()}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </div>

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

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {title}
          </span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-faint)]">
              {badge}
            </span>
          )}
        </div>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-[var(--text-faint)] transition-transform",
            open && "rotate-90"
          )}
        />
      </button>
      {open && <div className="px-3 pb-3 border-t border-[var(--border-hairline)]">{children}</div>}
    </div>
  );
}

// Key Level Row Component
function KeyLevelRow({
  level,
  currentPrice,
  icon,
}: {
  level: any;
  currentPrice: number;
  icon: React.ReactNode;
}) {
  const distance = ((level.price - currentPrice) / currentPrice) * 100;
  const isAbove = level.price > currentPrice;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[var(--text-med)] text-sm">{level.source}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-high)] tabular-nums font-mono text-sm">
          ${level.price.toFixed(2)}
        </span>
        <span
          className={cn(
            "text-xs font-mono tabular-nums",
            isAbove ? "text-red-400" : "text-green-400"
          )}
        >
          {isAbove ? "+" : ""}
          {distance.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
