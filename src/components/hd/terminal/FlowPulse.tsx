/**
 * FlowPulse - Institutional "Tug of War" Flow Visualization
 *
 * Displays a horizontal bar showing put vs call premium flow.
 * Left side: Put Premium (Red) | Right side: Call Premium (Green)
 * Center marker shows the zero line (balanced flow).
 * Overlay shows institutional conviction score and bias.
 */

import { cn } from "@/lib/utils";
import type { SymbolFeatures } from "@/lib/strategy/engine";

interface FlowPulseProps {
  flow?: SymbolFeatures["flow"];
  compact?: boolean;
  showLabels?: boolean;
}

function getBiasColor(bias?: "bullish" | "bearish" | "neutral"): string {
  switch (bias) {
    case "bullish":
      return "text-emerald-400";
    case "bearish":
      return "text-red-400";
    default:
      return "text-zinc-400";
  }
}

function getBiasGradient(bias?: "bullish" | "bearish" | "neutral"): string {
  switch (bias) {
    case "bullish":
      return "from-emerald-500/80 to-emerald-600/80";
    case "bearish":
      return "from-red-500/80 to-red-600/80";
    default:
      return "from-zinc-500/80 to-zinc-600/80";
  }
}

export function FlowPulse({ flow, compact = false, showLabels = true }: FlowPulseProps) {
  // Extract flow metrics with defaults
  const score = flow?.flowScore ?? flow?.institutionalConviction ?? 0;
  const bias = flow?.flowBias ?? "neutral";
  const buyPressure = flow?.buyPressure ?? 50; // 0-100, 50 = balanced
  const putCallRatio = flow?.putCallRatio ?? 1; // 1 = balanced, <1 = call heavy, >1 = put heavy
  const aggressiveness = flow?.aggressiveness ?? "NORMAL";

  // Calculate position on the bar (0 = full put, 100 = full call)
  // buyPressure already represents this well, but we can also factor in putCallRatio
  // Normalize putCallRatio: 0.5 -> 75 (call heavy), 1.0 -> 50 (balanced), 2.0 -> 25 (put heavy)
  const ratioPosition = putCallRatio > 0 ? Math.max(0, Math.min(100, 100 - putCallRatio * 50)) : 50;

  // Blend buyPressure and ratioPosition for final position
  const position = (buyPressure + ratioPosition) / 2;

  // Determine if flow is significant
  const isSignificant = score > 60;
  const isStrong = score > 80;

  return (
    <div className={cn("w-full", compact ? "space-y-1" : "space-y-2")}>
      {/* Header row */}
      {showLabels && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-red-400 font-medium uppercase tracking-wider">Put Flow</span>
          <div className="flex items-center gap-2">
            <span className={cn("font-mono font-semibold", getBiasColor(bias))}>
              {bias.toUpperCase()}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground font-mono">{score.toFixed(0)}/100</span>
          </div>
          <span className="text-emerald-400 font-medium uppercase tracking-wider">Call Flow</span>
        </div>
      )}

      {/* Tug of War Bar */}
      <div className="relative">
        {/* Background track */}
        <div
          className={cn(
            "relative w-full rounded-full overflow-hidden",
            "bg-gradient-to-r from-red-950/50 via-zinc-900 to-emerald-950/50",
            "border border-zinc-700/50",
            compact ? "h-4" : "h-6"
          )}
        >
          {/* Left side (Put) fill */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600/60 to-red-500/20 transition-all duration-300"
            style={{ width: `${50 - Math.min(50, position - 50)}%` }}
          />

          {/* Right side (Call) fill */}
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-emerald-600/60 to-emerald-500/20 transition-all duration-300"
            style={{ width: `${Math.max(0, position - 50)}%` }}
          />

          {/* Center zero line */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-400/60 -translate-x-1/2" />

          {/* Flow position indicator */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500",
              compact ? "w-2 h-2" : "w-3 h-3",
              "rounded-full border-2 border-white shadow-lg",
              isStrong && "animate-pulse",
              `bg-gradient-to-br ${getBiasGradient(bias)}`
            )}
            style={{ left: `${position}%` }}
          />

          {/* Grid lines for reference */}
          <div className="absolute inset-0 flex justify-between pointer-events-none">
            {[25, 50, 75].map((pct) => (
              <div
                key={pct}
                className="w-px bg-zinc-600/30"
                style={{ marginLeft: pct === 25 ? "25%" : pct === 75 ? "auto" : undefined }}
              />
            ))}
          </div>
        </div>

        {/* Percentage labels */}
        {!compact && (
          <div className="absolute -bottom-4 inset-x-0 flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>100% PUT</span>
            <span>BALANCED</span>
            <span>100% CALL</span>
          </div>
        )}
      </div>

      {/* Bottom stats row */}
      {showLabels && (
        <div
          className={cn(
            "flex items-center justify-center gap-4 text-xs",
            compact ? "mt-1" : "mt-6"
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Institutional:</span>
            <span
              className={cn(
                "font-mono font-semibold",
                isSignificant ? "text-amber-400" : "text-zinc-400"
              )}
            >
              {score.toFixed(0)}
            </span>
          </div>

          {aggressiveness !== "NORMAL" && (
            <>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Aggression:</span>
                <span
                  className={cn(
                    "font-mono font-semibold uppercase",
                    aggressiveness === "VERY_AGGRESSIVE" || aggressiveness === "AGGRESSIVE"
                      ? "text-red-400"
                      : aggressiveness === "PASSIVE"
                        ? "text-blue-400"
                        : "text-zinc-400"
                  )}
                >
                  {aggressiveness.replace("_", " ")}
                </span>
              </div>
            </>
          )}

          {flow?.sweepCount && flow.sweepCount > 0 && (
            <>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Sweeps:</span>
                <span className="font-mono font-semibold text-amber-400">{flow.sweepCount}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default FlowPulse;
