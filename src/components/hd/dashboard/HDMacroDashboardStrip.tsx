/**
 * HDMacroDashboardStrip - Compact macro market context strip
 *
 * Shows at-a-glance market context:
 * - VIX level with regime classification
 * - Major index performance (SPY, QQQ, IWM)
 * - Market breadth indicators
 * - Risk on/off sentiment
 * - Session timing
 */

import { cn } from "../../../lib/utils";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Zap,
  BarChart3,
} from "lucide-react";
import { useMacroContext } from "../../../hooks/useIndicesAdvanced";
import { useMarketDataStore } from "../../../stores/marketDataStore";

interface HDMacroDashboardStripProps {
  className?: string;
  compact?: boolean;
}

interface VIXContext {
  level: "low" | "normal" | "elevated" | "high" | "extreme";
  label: string;
  color: string;
  bgColor: string;
  description: string;
}

function getVIXContext(vix: number): VIXContext {
  if (vix < 12) {
    return {
      level: "low",
      label: "Low",
      color: "text-[var(--accent-positive)]",
      bgColor: "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30",
      description: "Complacency - expect mean reversion",
    };
  } else if (vix < 18) {
    return {
      level: "normal",
      label: "Normal",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/30",
      description: "Standard conditions - trade normally",
    };
  } else if (vix < 25) {
    return {
      level: "elevated",
      label: "Elevated",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10 border-amber-500/30",
      description: "Increased uncertainty - size down",
    };
  } else if (vix < 35) {
    return {
      level: "high",
      label: "High",
      color: "text-orange-400",
      bgColor: "bg-orange-500/10 border-orange-500/30",
      description: "Fear in market - quick trades only",
    };
  } else {
    return {
      level: "extreme",
      label: "Extreme",
      color: "text-[var(--accent-negative)]",
      bgColor: "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30",
      description: "Crisis conditions - defend positions",
    };
  }
}

interface MarketBias {
  direction: "bullish" | "bearish" | "neutral";
  strength: "strong" | "moderate" | "weak";
  label: string;
  color: string;
}

function getMarketBias(spyChange: number, qqqChange: number, iwmChange: number): MarketBias {
  const avgChange = (spyChange + qqqChange + iwmChange) / 3;
  const allPositive = spyChange > 0 && qqqChange > 0 && iwmChange > 0;
  const allNegative = spyChange < 0 && qqqChange < 0 && iwmChange < 0;

  if (allPositive) {
    if (avgChange > 1) {
      return {
        direction: "bullish",
        strength: "strong",
        label: "Risk On",
        color: "text-[var(--accent-positive)]",
      };
    }
    return {
      direction: "bullish",
      strength: "moderate",
      label: "Bullish",
      color: "text-[var(--accent-positive)]",
    };
  } else if (allNegative) {
    if (avgChange < -1) {
      return {
        direction: "bearish",
        strength: "strong",
        label: "Risk Off",
        color: "text-[var(--accent-negative)]",
      };
    }
    return {
      direction: "bearish",
      strength: "moderate",
      label: "Bearish",
      color: "text-[var(--accent-negative)]",
    };
  } else if (Math.abs(avgChange) < 0.3) {
    return {
      direction: "neutral",
      strength: "weak",
      label: "Mixed",
      color: "text-[var(--text-muted)]",
    };
  } else if (avgChange > 0) {
    return {
      direction: "bullish",
      strength: "weak",
      label: "Leaning Bullish",
      color: "text-[var(--accent-positive)]/70",
    };
  } else {
    return {
      direction: "bearish",
      strength: "weak",
      label: "Leaning Bearish",
      color: "text-[var(--accent-negative)]/70",
    };
  }
}

interface IndexData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function HDMacroDashboardStrip({ className, compact = false }: HDMacroDashboardStripProps) {
  // Get macro context from hook
  const { macro, isLoading } = useMacroContext(30000); // 30s refresh

  // Get individual index data from store
  const spyData = useMarketDataStore((state) => state.symbols["SPY"]);
  const qqqData = useMarketDataStore((state) => state.symbols["QQQ"]);
  const iwmData = useMarketDataStore((state) => state.symbols["IWM"]);

  // Extract VIX from macro context
  const vixValue = macro?.vix?.value ?? 16;
  const vixContext = getVIXContext(vixValue);

  // Calculate market bias
  const spyChange = spyData?.change ?? 0;
  const qqqChange = qqqData?.change ?? 0;
  const iwmChange = iwmData?.change ?? 0;
  const marketBias = getMarketBias(spyChange, qqqChange, iwmChange);

  // Helper for index display
  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-[var(--accent-positive)]";
    if (change < 0) return "text-[var(--accent-negative)]";
    return "text-[var(--text-muted)]";
  };

  if (compact) {
    // Ultra-compact mode - single row
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]",
          className
        )}
      >
        {/* VIX Badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px]",
            vixContext.bgColor
          )}
        >
          <Activity className={cn("w-3 h-3", vixContext.color)} />
          <span className={cn("font-semibold tabular-nums", vixContext.color)}>
            VIX {vixValue.toFixed(1)}
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-[var(--border-hairline)]" />

        {/* Index Strip */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-[var(--text-muted)]">SPY</span>
          <span className={cn("tabular-nums font-medium", getChangeColor(spyChange))}>
            {formatChange(spyChange)}
          </span>
          <span className="text-[var(--text-faint)]">|</span>
          <span className="text-[var(--text-muted)]">QQQ</span>
          <span className={cn("tabular-nums font-medium", getChangeColor(qqqChange))}>
            {formatChange(qqqChange)}
          </span>
          <span className="text-[var(--text-faint)]">|</span>
          <span className="text-[var(--text-muted)]">IWM</span>
          <span className={cn("tabular-nums font-medium", getChangeColor(iwmChange))}>
            {formatChange(iwmChange)}
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-[var(--border-hairline)]" />

        {/* Bias Badge */}
        <div className={cn("flex items-center gap-1 text-[10px] font-medium", marketBias.color)}>
          {marketBias.direction === "bullish" ? (
            <TrendingUp className="w-3 h-3" />
          ) : marketBias.direction === "bearish" ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <BarChart3 className="w-3 h-3" />
          )}
          <span>{marketBias.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-[var(--text-high)] font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" />
          Macro Context
        </h4>
        <div
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
            marketBias.color
          )}
        >
          {marketBias.direction === "bullish" ? (
            <Shield className="w-3 h-3" />
          ) : marketBias.direction === "bearish" ? (
            <AlertTriangle className="w-3 h-3" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          <span>{marketBias.label}</span>
        </div>
      </div>

      {/* VIX Section */}
      <div className={cn("p-2.5 rounded-[var(--radius)] border", vixContext.bgColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={cn("w-4 h-4", vixContext.color)} />
            <div>
              <div className={cn("text-sm font-bold tabular-nums", vixContext.color)}>
                VIX {vixValue.toFixed(2)}
              </div>
              <div className="text-[9px] text-[var(--text-muted)]">
                {vixContext.label} Volatility
              </div>
            </div>
          </div>
          <div
            className={cn(
              "px-2 py-1 rounded text-[10px] font-medium",
              vixContext.bgColor,
              vixContext.color
            )}
          >
            {vixContext.level.toUpperCase()}
          </div>
        </div>
        <p className="text-[10px] text-[var(--text-med)] mt-2">{vixContext.description}</p>
      </div>

      {/* Index Performance Grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* SPY */}
        <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-2 border border-[var(--border-hairline)]">
          <div className="text-[10px] text-[var(--text-muted)] mb-0.5">SPY</div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-[var(--text-high)] tabular-nums">
              ${spyData?.price?.toFixed(2) ?? "—"}
            </span>
            <span className={cn("text-[10px] tabular-nums font-medium", getChangeColor(spyChange))}>
              {formatChange(spyChange)}
            </span>
          </div>
        </div>

        {/* QQQ */}
        <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-2 border border-[var(--border-hairline)]">
          <div className="text-[10px] text-[var(--text-muted)] mb-0.5">QQQ</div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-[var(--text-high)] tabular-nums">
              ${qqqData?.price?.toFixed(2) ?? "—"}
            </span>
            <span className={cn("text-[10px] tabular-nums font-medium", getChangeColor(qqqChange))}>
              {formatChange(qqqChange)}
            </span>
          </div>
        </div>

        {/* IWM */}
        <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-2 border border-[var(--border-hairline)]">
          <div className="text-[10px] text-[var(--text-muted)] mb-0.5">IWM</div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-[var(--text-high)] tabular-nums">
              ${iwmData?.price?.toFixed(2) ?? "—"}
            </span>
            <span className={cn("text-[10px] tabular-nums font-medium", getChangeColor(iwmChange))}>
              {formatChange(iwmChange)}
            </span>
          </div>
        </div>
      </div>

      {/* Market Regime from macro context */}
      {macro && (
        <div className="flex items-center justify-between px-2.5 py-2 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] text-[10px]">
          <div>
            <span className="text-[var(--text-muted)]">Regime: </span>
            <span className="text-[var(--text-high)] font-medium">
              {macro.marketRegime ?? "Unknown"}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Bias: </span>
            <span className={cn("font-medium", marketBias.color)}>
              {macro.riskBias ?? marketBias.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
