/**
 * HDEntryChecklist - Pre-entry confirmation checklist for options day traders
 *
 * Provides visual checkmarks/warnings for key entry conditions:
 * - Trend alignment across timeframes
 * - VWAP position (above/below)
 * - Volume confirmation
 * - RSI not overbought/oversold
 * - Upcoming economic events
 * - IV percentile status
 */

import { cn } from "../../../lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Calendar,
  Gauge,
} from "lucide-react";
import { useMarketDataStore } from "../../../stores/marketDataStore";
import type { Contract } from "../../../types";

interface ChecklistItem {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn" | "neutral";
  detail?: string;
  secondary?: string;
  icon: React.ReactNode;
}

interface HDEntryChecklistProps {
  ticker: string;
  direction: "call" | "put";
  contract?: Contract;
  className?: string;
  compact?: boolean;
}

export function HDEntryChecklist({
  ticker,
  direction,
  contract,
  className,
  compact = false,
}: HDEntryChecklistProps) {
  // Get market data from store
  const symbolData = useMarketDataStore((state) => state.symbols[ticker]);
  const confluence = symbolData?.confluence;
  const indicators = symbolData?.indicators;

  // Build checklist items
  const items: ChecklistItem[] = [];

  // Common derived data
  const primaryTimeframe = symbolData?.primaryTimeframe;
  const candles = primaryTimeframe ? (symbolData?.candles[primaryTimeframe] ?? []) : [];
  const lastCandle = candles[candles.length - 1];

  const recentVolumes = candles.slice(-20).map((c) => c.volume);
  const avgVolume =
    recentVolumes.length > 0
      ? recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length
      : undefined;

  const bullCount = symbolData?.mtfTrend
    ? Object.values(symbolData.mtfTrend).filter((t) => t === "bull").length
    : 0;
  const bearCount = symbolData?.mtfTrend
    ? Object.values(symbolData.mtfTrend).filter((t) => t === "bear").length
    : 0;

  // 1. Trend Alignment Check
  const trendScore = confluence?.trend ?? 50;
  const isBullishTrend = trendScore >= 60;
  const isBearishTrend = trendScore <= 40;
  const trendAligned = direction === "call" ? isBullishTrend : isBearishTrend;

  items.push({
    id: "trend",
    label: "Trend Alignment",
    status: trendAligned ? "pass" : !isBullishTrend && !isBearishTrend ? "warn" : "fail",
    detail: trendAligned
      ? `MTF trend aligned with ${direction}s (${trendScore.toFixed(0)}%)`
      : `MTF trend not aligned (${trendScore.toFixed(0)}%)`,
    icon: trendAligned ? (
      <TrendingUp className="w-3.5 h-3.5" />
    ) : (
      <TrendingDown className="w-3.5 h-3.5" />
    ),
    secondary:
      bullCount + bearCount > 0 ? `${bullCount} TF bull / ${bearCount} TF bear` : undefined,
  });

  // 2. VWAP Position Check
  const vwap = indicators?.vwap;
  const currentPrice = symbolData?.price ?? 0;

  if (vwap && currentPrice > 0) {
    const aboveVwap = currentPrice > vwap;
    const vwapAligned = direction === "call" ? aboveVwap : !aboveVwap;
    const vwapDistance = (Math.abs(currentPrice - vwap) / currentPrice) * 100;

    items.push({
      id: "vwap",
      label: "VWAP Position",
      status: vwapAligned ? "pass" : vwapDistance < 0.5 ? "warn" : "fail",
      detail: `Price ${aboveVwap ? "above" : "below"} VWAP (${vwapDistance.toFixed(2)}%)`,
      secondary:
        primaryTimeframe && vwap
          ? `${primaryTimeframe} close ${aboveVwap ? ">" : "<"} VWAP ${vwap.toFixed(2)}`
          : undefined,
      icon: <Activity className="w-3.5 h-3.5" />,
    });
  }

  // 3. Volume Confirmation Check
  const volumeScore = confluence?.volume ?? 50;
  const hasVolume = volumeScore >= 50;

  items.push({
    id: "volume",
    label: "Volume Confirmation",
    status: volumeScore >= 60 ? "pass" : volumeScore >= 40 ? "warn" : "fail",
    detail: hasVolume
      ? `Above average volume (${volumeScore.toFixed(0)}%)`
      : `Below average volume (${volumeScore.toFixed(0)}%)`,
    secondary:
      avgVolume && lastCandle
        ? `${(lastCandle.volume / avgVolume).toFixed(2)}× vs 20-bar avg (${avgVolume.toFixed(0)})`
        : undefined,
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  });

  // 4. RSI Check - Not overbought/oversold
  const rsi = indicators?.rsi14 ?? 50;
  const isOverbought = rsi > 70;
  const isOversold = rsi < 30;
  const rsiExtreme = isOverbought || isOversold;

  // For calls, we don't want overbought; for puts, we don't want oversold
  const rsiBad = direction === "call" ? isOverbought : isOversold;

  items.push({
    id: "rsi",
    label: "RSI Status",
    status: rsiBad ? "fail" : rsiExtreme ? "warn" : "pass",
    detail: isOverbought
      ? `Overbought (RSI ${rsi.toFixed(0)}) - risky for calls`
      : isOversold
        ? `Oversold (RSI ${rsi.toFixed(0)}) - risky for puts`
        : `Neutral zone (RSI ${rsi.toFixed(0)})`,
    secondary:
      primaryTimeframe && direction
        ? `${primaryTimeframe} RSI ${rsi.toFixed(1)} • Favoring ${direction === "call" ? "bulls" : "bears"} if mid > 50`
        : undefined,
    icon: <Gauge className="w-3.5 h-3.5" />,
  });

  // 5. IV Percentile Check
  const ivPercentile = confluence?.volatility ?? 50;
  const ivElevated = ivPercentile > 70;
  const ivCheap = ivPercentile < 30;

  const ivValue = contract?.iv ? (contract.iv * 100).toFixed(1) : undefined;

  items.push({
    id: "iv",
    label: "IV Percentile",
    status: ivElevated ? "warn" : ivCheap ? "pass" : "neutral",
    detail: ivElevated
      ? `Elevated IV (${ivPercentile.toFixed(0)}%) - premium rich`
      : ivCheap
        ? `Low IV (${ivPercentile.toFixed(0)}%) - cheap premium`
        : `Normal IV (${ivPercentile.toFixed(0)}%)`,
    secondary: ivValue ? `IV ${ivValue}% • IV rank ${ivPercentile.toFixed(0)}%` : undefined,
    icon: <Activity className="w-3.5 h-3.5" />,
  });

  // 6. DTE/Time Decay Check
  const dte = contract?.daysToExpiry ?? 0;
  const dteWarning = dte === 0 || (dte === 1 && new Date().getHours() >= 14);
  const theta = contract?.theta;

  items.push({
    id: "dte",
    label: "Time Decay",
    status: dteWarning ? "warn" : dte <= 3 ? "neutral" : "pass",
    detail:
      dte === 0
        ? "0DTE - Rapid theta decay, quick scalps only"
        : dte === 1
          ? "1DTE - Elevated theta, be quick"
          : `${dte}DTE - Normal decay curve`,
    secondary:
      theta !== undefined
        ? `Theta ${theta.toFixed(2)} / contract`
        : dte > 0
          ? `Expires in ${dte} day${dte === 1 ? "" : "s"}`
          : undefined,
    icon: <Clock className="w-3.5 h-3.5" />,
  });

  // 7. Liquidity Check
  const volume = contract?.volume ?? 0;
  const openInterest = contract?.openInterest ?? 0;
  const spreadPct =
    contract && contract.mid > 0 ? ((contract.ask - contract.bid) / contract.mid) * 100 : 0;

  const hasGoodLiquidity = volume > 100 && openInterest > 500 && spreadPct < 3;
  const hasOkLiquidity = volume > 50 || openInterest > 100;

  items.push({
    id: "liquidity",
    label: "Contract Liquidity",
    status: hasGoodLiquidity ? "pass" : hasOkLiquidity ? "warn" : "fail",
    detail: hasGoodLiquidity
      ? `Good liquidity (Vol: ${volume}, OI: ${openInterest})`
      : `Check liquidity (Spread: ${spreadPct.toFixed(1)}%)`,
    secondary:
      contract?.bid !== undefined && contract?.ask !== undefined
        ? `Bid ${contract.bid.toFixed(2)} x Ask ${contract.ask.toFixed(
            2
          )} • Mid ${contract.mid.toFixed(2)}`
        : undefined,
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  });

  // Calculate overall score
  const passCount = items.filter((i) => i.status === "pass").length;
  const failCount = items.filter((i) => i.status === "fail").length;
  const warnCount = items.filter((i) => i.status === "warn").length;

  const overallStatus =
    failCount >= 2 ? "fail" : failCount === 1 || warnCount >= 3 ? "warn" : "pass";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "text-[var(--accent-positive)]";
      case "fail":
        return "text-[var(--accent-negative)]";
      case "warn":
        return "text-amber-400";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "pass":
        return "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/20";
      case "fail":
        return "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/20";
      case "warn":
        return "bg-amber-500/10 border-amber-500/20";
      default:
        return "bg-[var(--surface-3)] border-[var(--border-hairline)]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "fail":
        return <XCircle className="w-3.5 h-3.5" />;
      case "warn":
        return <AlertTriangle className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  if (compact) {
    // Compact mode - just show pass/warn/fail counts
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-1.5 text-[var(--accent-positive)]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{passCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{warnCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--accent-negative)]">
          <XCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{failCount}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with overall status */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-[var(--text-high)] font-semibold uppercase tracking-wide">
          Entry Checklist
        </h3>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius)] border text-xs font-medium",
            getStatusBg(overallStatus),
            getStatusColor(overallStatus)
          )}
        >
          {getStatusIcon(overallStatus)}
          <span>
            {overallStatus === "pass" ? "Ready" : overallStatus === "fail" ? "Caution" : "Review"}
          </span>
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius)] border",
              getStatusBg(item.status)
            )}
          >
            <div className={cn("flex-shrink-0", getStatusColor(item.status))}>
              {getStatusIcon(item.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("flex-shrink-0", getStatusColor(item.status))}>
                  {item.icon}
                </span>
                <span className="text-xs text-[var(--text-high)] font-medium">{item.label}</span>
              </div>
              {(item.detail || item.secondary) && (
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--text-muted)] flex-wrap justify-between">
                  {item.detail && <span className="min-w-0 truncate">{item.detail}</span>}
                  {item.secondary && (
                    <span className="shrink-0 text-[10px] text-[var(--text-muted)]/90">
                      {item.secondary}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="pt-2 border-t border-[var(--border-hairline)] text-[10px] text-[var(--text-muted)]">
        {passCount}/{items.length} conditions met •{" "}
        {failCount > 0 ? `${failCount} concerns` : "Looking good"}
      </div>
    </div>
  );
}
