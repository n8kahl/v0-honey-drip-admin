/**
 * HDMarketHorizon - Animated market regime hero header
 *
 * Shows current market state with VIX-driven animations and forward-looking session bias
 */

import { useMemo } from "react";
import { cn } from "../../../../lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { HDMarketCountdown } from "../HDMarketCountdown";
import type { MarketRegimeState, MarketHorizonData } from "../../../../types/radar-visuals";

export interface HDMarketHorizonProps {
  vix: number;
  regime: MarketRegimeState;
  horizonData: MarketHorizonData;
  className?: string;
}

export function HDMarketHorizon({ vix, regime, horizonData, className }: HDMarketHorizonProps) {
  // Regime icon mapping
  const RegimeIcon = useMemo(() => {
    switch (regime) {
      case "volatile":
        return AlertTriangle;
      case "trend_up":
        return TrendingUp;
      case "trend_down":
        return TrendingDown;
      default:
        return Activity;
    }
  }, [regime]);

  // VIX level category
  const vixLevel = useMemo(() => {
    if (vix < 13) return { label: "Low Vol", color: "text-green-400", bg: "bg-green-500/20" };
    if (vix < 18) return { label: "Normal", color: "text-blue-400", bg: "bg-blue-500/20" };
    if (vix < 25) return { label: "Elevated", color: "text-yellow-400", bg: "bg-yellow-500/20" };
    return { label: "High Vol", color: "text-red-400", bg: "bg-red-500/20" };
  }, [vix]);

  // Animation speed based on regime
  const animationClass = useMemo(() => {
    if (regime === "volatile") return "animate-pulse"; // Fast pulse
    if (regime === "calm") return "animate-[pulse_5s_ease-in-out_infinite]"; // Slow breathing
    return "animate-[pulse_3.5s_ease-in-out_infinite]"; // Medium
  }, [regime]);

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl overflow-hidden border border-[var(--border-hairline)]",
        className
      )}
    >
      {/* Animated gradient background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r transition-all duration-1000",
          horizonData.themeGradientFrom,
          horizonData.themeGradientTo,
          animationClass
        )}
        style={{
          // Respect reduced motion preferences
          animationPlayState: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "paused"
            : "running",
        }}
      />

      {/* Semi-transparent overlay for readability */}
      <div className="absolute inset-0 bg-[var(--surface-1)] opacity-80" />

      {/* Content */}
      <div className="relative px-6 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Regime Information */}
          <div className="space-y-4">
            {/* Regime Header */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  "bg-[var(--surface-2)] border border-[var(--border-hairline)]"
                )}
              >
                <RegimeIcon className="w-6 h-6 text-[var(--brand-primary)]" />
              </div>
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                  Market Regime
                </div>
                <h2 className="text-2xl font-bold text-[var(--text-high)]">
                  {horizonData.headline}
                </h2>
              </div>
            </div>

            {/* Subtitle */}
            <p className="text-sm text-[var(--text-muted)]">{horizonData.subtitle}</p>

            {/* Session Bias (Forward-Looking) */}
            <div
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                "bg-[var(--surface-2)]/50 border-[var(--border-hairline)]"
              )}
            >
              <Activity className="w-4 h-4 text-[var(--brand-primary)] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                  Next Session Bias
                </div>
                <p className="text-sm text-[var(--text-high)]">{horizonData.sessionBias}</p>
              </div>
            </div>
          </div>

          {/* Right: VIX + Countdown */}
          <div className="space-y-4">
            {/* VIX Gauge */}
            <div
              className={cn(
                "rounded-xl p-4 border",
                "bg-[var(--surface-2)]/50 border-[var(--border-hairline)]"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-xs font-medium text-[var(--text-muted)] uppercase">
                    VIX Index
                  </span>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    vixLevel.bg,
                    vixLevel.color
                  )}
                >
                  {vixLevel.label}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold font-mono text-[var(--text-high)]">
                  {vix.toFixed(2)}
                </span>
                {regime === "volatile" && (
                  <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
                )}
              </div>

              {/* VIX Bar */}
              <div className="relative h-2 bg-[var(--surface-1)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                    vix < 13 && "bg-green-500",
                    vix >= 13 && vix < 18 && "bg-blue-500",
                    vix >= 18 && vix < 25 && "bg-yellow-500",
                    vix >= 25 && "bg-red-500"
                  )}
                  style={{ width: `${Math.min((vix / 50) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-1">
                <span>0</span>
                <span>13</span>
                <span>18</span>
                <span>25</span>
                <span>50+</span>
              </div>
            </div>

            {/* Market Countdown (Compact Mode) */}
            <HDMarketCountdown compact />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HDMarketHorizon;
