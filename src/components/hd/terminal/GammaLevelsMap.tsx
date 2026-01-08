/**
 * GammaLevelsMap - Dealer Gamma Exposure Visualization
 *
 * Displays a horizontal price range with gamma-related levels.
 * Shows current price ("You"), gamma flip level, and key strikes.
 * Background color indicates gamma regime:
 * - Blue: Long Gamma (dealer will dampen moves, stability)
 * - Orange: Short Gamma (dealer will amplify moves, volatility)
 */

import { cn } from "@/lib/utils";

interface GammaData {
  flipLevel?: number;
  dealerNetDelta?: number;
  callWall?: number;
  putWall?: number;
  maxPain?: number;
  regime?: "long_gamma" | "short_gamma" | "neutral";
}

interface GammaLevelsMapProps {
  currentPrice: number;
  gamma?: GammaData;
  priceRange?: { low: number; high: number };
  compact?: boolean;
  showLabels?: boolean;
}

function getRegimeConfig(regime?: "long_gamma" | "short_gamma" | "neutral") {
  switch (regime) {
    case "long_gamma":
      return {
        bg: "bg-gradient-to-r from-blue-950/40 via-blue-900/30 to-blue-950/40",
        border: "border-blue-700/50",
        label: "LONG GAMMA",
        labelColor: "text-blue-400",
        description: "Stability Zone - Dealer Dampening",
        icon: "shield",
      };
    case "short_gamma":
      return {
        bg: "bg-gradient-to-r from-orange-950/40 via-orange-900/30 to-orange-950/40",
        border: "border-orange-700/50",
        label: "SHORT GAMMA",
        labelColor: "text-orange-400",
        description: "Volatility Zone - Amplified Moves",
        icon: "zap",
      };
    default:
      return {
        bg: "bg-gradient-to-r from-zinc-950/40 via-zinc-900/30 to-zinc-950/40",
        border: "border-zinc-700/50",
        label: "NEUTRAL",
        labelColor: "text-zinc-400",
        description: "Balanced Exposure",
        icon: "minus",
      };
  }
}

function calculatePosition(value: number, low: number, high: number): number {
  if (high === low) return 50;
  return Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
}

export function GammaLevelsMap({
  currentPrice,
  gamma,
  priceRange,
  compact = false,
  showLabels = true,
}: GammaLevelsMapProps) {
  // Calculate price range if not provided
  const pricePadding = currentPrice * 0.02; // 2% padding
  const low = priceRange?.low ?? currentPrice - pricePadding * 2;
  const high = priceRange?.high ?? currentPrice + pricePadding * 2;

  // Determine gamma regime from data
  const regime =
    gamma?.regime ??
    (gamma?.dealerNetDelta !== undefined
      ? gamma.dealerNetDelta > 0
        ? "long_gamma"
        : gamma.dealerNetDelta < 0
          ? "short_gamma"
          : "neutral"
      : "neutral");

  const regimeConfig = getRegimeConfig(regime);

  // Calculate positions for each level
  const currentPos = calculatePosition(currentPrice, low, high);
  const flipPos = gamma?.flipLevel ? calculatePosition(gamma.flipLevel, low, high) : null;
  const callWallPos = gamma?.callWall ? calculatePosition(gamma.callWall, low, high) : null;
  const putWallPos = gamma?.putWall ? calculatePosition(gamma.putWall, low, high) : null;
  const maxPainPos = gamma?.maxPain ? calculatePosition(gamma.maxPain, low, high) : null;

  return (
    <div className={cn("w-full", compact ? "space-y-1" : "space-y-2")}>
      {/* Header */}
      {showLabels && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={cn("font-semibold uppercase tracking-wider", regimeConfig.labelColor)}>
              {regimeConfig.label}
            </span>
            {gamma?.dealerNetDelta !== undefined && (
              <span className="text-muted-foreground font-mono">
                GEX: {(gamma.dealerNetDelta / 1e9).toFixed(2)}B
              </span>
            )}
          </div>
          <span className="text-muted-foreground text-[10px]">{regimeConfig.description}</span>
        </div>
      )}

      {/* Price Map */}
      <div className="relative">
        {/* Background track with regime color */}
        <div
          className={cn(
            "relative w-full rounded-lg overflow-hidden",
            regimeConfig.bg,
            "border",
            regimeConfig.border,
            compact ? "h-8" : "h-12"
          )}
        >
          {/* Grid lines */}
          <div className="absolute inset-0 flex justify-between px-2 pointer-events-none">
            {[0, 25, 50, 75, 100].map((pct) => (
              <div key={pct} className="w-px bg-zinc-600/20 h-full" />
            ))}
          </div>

          {/* Put Wall marker */}
          {putWallPos !== null && (
            <div
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: `${putWallPos}%`, transform: "translateX(-50%)" }}
            >
              <div className="w-1 h-full bg-red-500/40" />
              {!compact && (
                <span className="absolute -top-5 text-[9px] text-red-400 font-mono whitespace-nowrap">
                  PUT WALL
                </span>
              )}
            </div>
          )}

          {/* Call Wall marker */}
          {callWallPos !== null && (
            <div
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: `${callWallPos}%`, transform: "translateX(-50%)" }}
            >
              <div className="w-1 h-full bg-emerald-500/40" />
              {!compact && (
                <span className="absolute -top-5 text-[9px] text-emerald-400 font-mono whitespace-nowrap">
                  CALL WALL
                </span>
              )}
            </div>
          )}

          {/* Max Pain marker */}
          {maxPainPos !== null && (
            <div
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: `${maxPainPos}%`, transform: "translateX(-50%)" }}
            >
              <div className="w-0.5 h-full bg-purple-500/60 border-dashed" />
              {!compact && (
                <span className="absolute -bottom-5 text-[9px] text-purple-400 font-mono whitespace-nowrap">
                  MAX PAIN ${gamma?.maxPain?.toFixed(0)}
                </span>
              )}
            </div>
          )}

          {/* Gamma Flip Level marker */}
          {flipPos !== null && (
            <div
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center z-10"
              style={{ left: `${flipPos}%`, transform: "translateX(-50%)" }}
            >
              <div className="w-1.5 h-full bg-gradient-to-b from-amber-400 via-amber-500 to-amber-400 shadow-lg shadow-amber-500/50" />
              <span
                className={cn(
                  "absolute text-amber-400 font-mono font-bold whitespace-nowrap",
                  compact ? "text-[8px] -top-3" : "text-[10px] -top-5"
                )}
              >
                FLIP ${gamma?.flipLevel?.toFixed(0)}
              </span>
            </div>
          )}

          {/* Current Price marker ("You") */}
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center justify-center z-20"
            style={{ left: `${currentPos}%`, transform: "translateX(-50%)" }}
          >
            {/* Price line */}
            <div className="w-0.5 h-full bg-white shadow-lg" />
            {/* "You" indicator */}
            <div
              className={cn(
                "absolute bg-white rounded-full shadow-lg",
                "flex items-center justify-center",
                compact ? "w-5 h-5 text-[8px]" : "w-7 h-7 text-[10px]"
              )}
            >
              <span className="font-bold text-zinc-900">YOU</span>
            </div>
            {/* Price label */}
            <span
              className={cn(
                "absolute font-mono font-semibold text-white whitespace-nowrap",
                compact ? "text-[8px] -bottom-3" : "text-xs -bottom-5"
              )}
            >
              ${currentPrice.toFixed(2)}
            </span>
          </div>

          {/* Regime zone indicator */}
          {flipPos !== null && (
            <div
              className={cn(
                "absolute inset-y-0 opacity-20",
                regime === "long_gamma" ? "bg-blue-500" : "bg-orange-500"
              )}
              style={{
                left: regime === "long_gamma" ? `${flipPos}%` : "0%",
                right: regime === "long_gamma" ? "0%" : `${100 - flipPos}%`,
              }}
            />
          )}
        </div>

        {/* Price range labels */}
        {!compact && (
          <div className="absolute -bottom-8 inset-x-0 flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>${low.toFixed(2)}</span>
            <span>${high.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLabels && !compact && (
        <div className="flex items-center justify-center gap-4 text-[10px] mt-8">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-white" />
            <span className="text-muted-foreground">Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Flip Level</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Put Wall</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Call Wall</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default GammaLevelsMap;
