import { Drawer } from "vaul";
import { Trade } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  ChevronDown,
  Activity,
  Layers,
  Zap,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useOffHoursData, type KeyLevel } from "../../../hooks/useOffHoursData";
import { useSymbolData } from "../../../stores/marketDataStore";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";

interface MobileTradeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
}

export function MobileTradeDetailSheet({ open, onOpenChange, trade }: MobileTradeDetailSheetProps) {
  // Get key levels from useOffHoursData
  const { keyLevelsBySymbol } = useOffHoursData();

  // Get live confluence from market data store
  const symbolData = useSymbolData(trade?.ticker || "");
  const liveConfluence = symbolData?.confluence;

  // Get LIVE price data via WebSocket/REST transport (matches desktop pattern)
  const contract = trade?.contract;
  const entryPrice = trade?.entryPrice || contract?.mid || 0;
  const contractTicker = contract?.id || null;
  const {
    pnlPercent: livePnlPercent,
    currentPrice: liveCurrentPrice,
    source,
    asOf,
  } = useActiveTradePnL(contractTicker, entryPrice);

  if (!trade) return null;

  // Use live data if available, fallback to stale trade data
  const currentPrice =
    liveCurrentPrice > 0 ? liveCurrentPrice : trade.currentPrice || contract?.mid || 0;
  const pnlPercent =
    liveCurrentPrice > 0
      ? livePnlPercent
      : entryPrice > 0
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : 0;
  const isPositive = pnlPercent >= 0;

  // Data freshness check (stale if >10s old)
  const isStale = Date.now() - asOf > 10000;

  // Calculate DTE
  const dte = contract?.expiry
    ? Math.max(
        0,
        Math.ceil((new Date(contract.expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  // Get key levels for this symbol
  const symbolLevels = keyLevelsBySymbol.get(trade.ticker);
  const levels = symbolLevels?.levels || [];

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

  // Get nearest resistance and support from key levels
  const nearestResistance = levels
    .filter((l) => l.type === "resistance" && l.price > (symbolLevels?.currentPrice || 0))
    .sort((a, b) => a.price - b.price)[0];

  const nearestSupport = levels
    .filter((l) => l.type === "support" && l.price < (symbolLevels?.currentPrice || 0))
    .sort((a, b) => b.price - a.price)[0];

  const pivotLevel = levels.find((l) => l.type === "pivot");
  const vwapLevel = levels.find((l) => l.type === "vwap");

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
                <div className="flex items-center gap-2">
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
                </div>
              </div>
              <div
                className={cn(
                  "text-xl font-bold tabular-nums font-mono",
                  isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                )}
              >
                {isPositive ? "+" : ""}
                {pnlPercent.toFixed(1)}%
              </div>
            </div>

            {/* Coaching Message */}
            {coachingMessage && (
              <div
                className={cn(
                  "px-3 py-2 rounded-[var(--radius)] border text-xs font-medium mb-4",
                  coachingMessage.includes("Strong")
                    ? "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30 text-[var(--accent-positive)]"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                )}
              >
                {coachingMessage.includes("Strong") ? "\u2713" : "\u26A0"} {coachingMessage}
              </div>
            )}

            {/* Price Section */}
            <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide block mb-1">
                    Entry
                  </span>
                  <span className="text-[var(--text-high)] text-lg tabular-nums font-mono">
                    ${formatPrice(entryPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide block mb-1">
                    Current
                  </span>
                  <span className="text-[var(--text-high)] text-lg tabular-nums font-mono">
                    ${formatPrice(currentPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Confluence Section (matching desktop HDConfluenceDetailPanel) */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                Confluence
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {/* Trend chip */}
                <div className={cn("rounded-[var(--radius)] border p-2.5", getTrendBg())}>
                  <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-1">
                    Trend
                  </div>
                  <div className={cn("text-xs font-medium", getTrendText())}>{getTrendLabel()}</div>
                </div>

                {/* Volatility chip */}
                <div className={cn("rounded-[var(--radius)] border p-2.5", getVolatilityBg())}>
                  <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-1">
                    Volatility
                  </div>
                  <div className={cn("text-xs font-medium", getVolatilityText())}>
                    {getVolatilityLabel()}
                  </div>
                </div>

                {/* Liquidity chip */}
                <div className={cn("rounded-[var(--radius)] border p-2.5", getLiquidityBg())}>
                  <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-1">
                    Liquidity
                  </div>
                  <div className={cn("text-xs font-medium", getLiquidityText())}>
                    {getLiquidityLabel()}
                  </div>
                </div>
              </div>

              {/* Compact Metrics Row (matching desktop) */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] px-1 mt-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--text-faint)]">IV</span>
                  <span className={cn("font-medium tabular-nums", getVolatilityText())}>
                    {volPercentile.toFixed(0)}%
                  </span>
                </div>
                {contract?.volume !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--text-faint)]">Vol</span>
                    <span className="text-[var(--text-med)] tabular-nums font-mono">
                      {contract.volume.toLocaleString()}
                    </span>
                  </div>
                )}
                {contract?.openInterest !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--text-faint)]">OI</span>
                    <span className="text-[var(--text-med)] tabular-nums font-mono">
                      {contract.openInterest.toLocaleString()}
                    </span>
                  </div>
                )}
                {isAligned ? (
                  <div className="flex items-center gap-1 text-[var(--accent-positive)]">
                    <span>{"\u2713"}</span>
                    <span>Aligned</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-amber-400">
                    <span>{"\u26A0"}</span>
                    <span>Not aligned</span>
                  </div>
                )}
              </div>
            </div>

            {/* TP/SL Levels */}
            {(trade.targetPrice || trade.stopLoss) && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
                  Trade Levels
                </h3>
                <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
                  {trade.targetPrice && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-[var(--accent-positive)]" />
                        <span className="text-[var(--text-med)]">Target</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[var(--text-high)] tabular-nums font-mono">
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
                        <span className="text-[var(--text-high)] tabular-nums font-mono">
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
            )}

            {/* Key Levels Section */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                Key Levels
              </h3>
              {levels.length === 0 ? (
                <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4">
                  <p className="text-[var(--text-muted)] text-sm text-center">
                    Add {trade.ticker} to watchlist for key levels
                  </p>
                </div>
              ) : (
                <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
                  {/* Prior Day High */}
                  {nearestResistance && (
                    <KeyLevelRow
                      level={nearestResistance}
                      currentPrice={symbolLevels?.currentPrice || 0}
                      icon={<TrendingUp className="w-4 h-4 text-red-400" />}
                    />
                  )}
                  {/* VWAP */}
                  {vwapLevel && (
                    <KeyLevelRow
                      level={vwapLevel}
                      currentPrice={symbolLevels?.currentPrice || 0}
                      icon={<Activity className="w-4 h-4 text-yellow-400" />}
                    />
                  )}
                  {/* Pivot */}
                  {pivotLevel && pivotLevel !== vwapLevel && (
                    <KeyLevelRow
                      level={pivotLevel}
                      currentPrice={symbolLevels?.currentPrice || 0}
                      icon={<Activity className="w-4 h-4 text-yellow-400" />}
                    />
                  )}
                  {/* Prior Day Low */}
                  {nearestSupport && (
                    <KeyLevelRow
                      level={nearestSupport}
                      currentPrice={symbolLevels?.currentPrice || 0}
                      icon={<TrendingDown className="w-4 h-4 text-green-400" />}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Greeks (if available) */}
            {contract && (contract.delta !== undefined || contract.theta !== undefined) && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
                  Greeks
                </h3>
                <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {contract.delta !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Delta</span>
                        <span className="text-[var(--text-high)] tabular-nums font-mono">
                          {(contract.delta * 100).toFixed(0)}
                        </span>
                      </div>
                    )}
                    {contract.gamma !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Gamma</span>
                        <span className="text-[var(--text-high)] tabular-nums font-mono">
                          {contract.gamma.toFixed(3)}
                        </span>
                      </div>
                    )}
                    {contract.theta !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Theta</span>
                        <span className="text-[var(--accent-negative)] tabular-nums font-mono">
                          {contract.theta.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {contract.iv !== undefined && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">IV</span>
                        <span className="text-[var(--text-high)] tabular-nums font-mono">
                          {(contract.iv * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Setup Type */}
            {trade.setupType && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
                  Setup
                </h3>
                <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] px-4 py-3">
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

// Key Level Row Component
function KeyLevelRow({
  level,
  currentPrice,
  icon,
}: {
  level: KeyLevel;
  currentPrice: number;
  icon: React.ReactNode;
}) {
  const distance = ((level.price - currentPrice) / currentPrice) * 100;
  const isAbove = level.price > currentPrice;

  return (
    <div className="flex items-center justify-between px-4 py-2.5">
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
