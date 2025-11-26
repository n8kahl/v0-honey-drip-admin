/**
 * HDDynamicProfitTargets - Smart multi-level profit targets with risk/reward
 *
 * Features:
 * - T1 (25%), T2 (50%), T3 (75%) take profit levels
 * - Risk/Reward ratio calculations
 * - DTE-aware target adjustments
 * - Visual progress bars toward each target
 * - Trade style recommendations (scalp vs swing)
 */

import { cn } from "../../../lib/utils";
import { Target, TrendingUp, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import type { Contract, Trade } from "../../../types";

interface HDDynamicProfitTargetsProps {
  contract: Contract;
  entryPrice: number;
  stopLoss?: number;
  currentPrice?: number;
  tradeType?: "Scalp" | "Day" | "Swing";
  className?: string;
  compact?: boolean;
}

interface ProfitTarget {
  level: "T1" | "T2" | "T3";
  price: number;
  percentGain: number;
  riskReward: number;
  recommendation: "aggressive" | "standard" | "conservative";
  description: string;
  progress: number; // 0-100
  hit: boolean;
}

interface TargetStrategy {
  targets: ProfitTarget[];
  recommendedExit: "T1" | "T2" | "T3";
  reasoning: string;
  urgency: "low" | "medium" | "high";
}

function calculateTargetStrategy(
  contract: Contract,
  entryPrice: number,
  stopLoss: number | undefined,
  currentPrice: number | undefined,
  tradeType: "Scalp" | "Day" | "Swing" = "Day"
): TargetStrategy {
  const dte = contract.daysToExpiry ?? 0;
  const atr = contract.mid * 0.15; // Estimate ATR as 15% of mid price
  const effectiveStop = stopLoss || entryPrice - atr * 0.5;
  const risk = entryPrice - effectiveStop;

  // Base target percentages adjusted by trade style
  const baseTargets = {
    Scalp: { t1: 0.15, t2: 0.25, t3: 0.4 }, // 15%, 25%, 40%
    Day: { t1: 0.25, t2: 0.5, t3: 0.75 }, // 25%, 50%, 75%
    Swing: { t1: 0.5, t2: 1.0, t3: 1.5 }, // 50%, 100%, 150%
  };

  // DTE adjustments - shorter DTE = smaller targets
  const dteMultiplier =
    dte === 0
      ? 0.6 // 0DTE: Reduce targets significantly
      : dte === 1
        ? 0.75 // 1DTE: Reduce targets moderately
        : dte <= 3
          ? 0.9 // 2-3DTE: Slight reduction
          : 1.0; // 4+ DTE: Full targets

  const styleTargets = baseTargets[tradeType];

  const targets: ProfitTarget[] = [
    {
      level: "T1",
      price: entryPrice * (1 + styleTargets.t1 * dteMultiplier),
      percentGain: styleTargets.t1 * dteMultiplier * 100,
      riskReward: (entryPrice * styleTargets.t1 * dteMultiplier) / risk,
      recommendation: "conservative",
      description: `Take 1/3 at ${(styleTargets.t1 * dteMultiplier * 100).toFixed(0)}%`,
      progress: 0,
      hit: false,
    },
    {
      level: "T2",
      price: entryPrice * (1 + styleTargets.t2 * dteMultiplier),
      percentGain: styleTargets.t2 * dteMultiplier * 100,
      riskReward: (entryPrice * styleTargets.t2 * dteMultiplier) / risk,
      recommendation: "standard",
      description: `Take 1/3 at ${(styleTargets.t2 * dteMultiplier * 100).toFixed(0)}%`,
      progress: 0,
      hit: false,
    },
    {
      level: "T3",
      price: entryPrice * (1 + styleTargets.t3 * dteMultiplier),
      percentGain: styleTargets.t3 * dteMultiplier * 100,
      riskReward: (entryPrice * styleTargets.t3 * dteMultiplier) / risk,
      recommendation: "aggressive",
      description: `Runner target at ${(styleTargets.t3 * dteMultiplier * 100).toFixed(0)}%`,
      progress: 0,
      hit: false,
    },
  ];

  // Calculate progress toward each target
  if (currentPrice) {
    const currentGain = ((currentPrice - entryPrice) / entryPrice) * 100;
    targets.forEach((target) => {
      if (currentGain >= target.percentGain) {
        target.hit = true;
        target.progress = 100;
      } else if (currentGain > 0) {
        target.progress = (currentGain / target.percentGain) * 100;
      }
    });
  }

  // Determine recommended exit based on DTE and trade style
  let recommendedExit: "T1" | "T2" | "T3" = "T2";
  let reasoning = "";
  let urgency: "low" | "medium" | "high" = "low";

  if (dte === 0) {
    recommendedExit = "T1";
    reasoning = "0DTE: Take quick profits, theta decay accelerating";
    urgency = "high";
  } else if (dte === 1) {
    recommendedExit = tradeType === "Scalp" ? "T1" : "T2";
    reasoning = "1DTE: Lock in gains early, avoid overnight theta";
    urgency = "medium";
  } else if (tradeType === "Scalp") {
    recommendedExit = "T1";
    reasoning = "Scalp style: Quick in-and-out, secure small wins";
    urgency = "medium";
  } else if (tradeType === "Swing") {
    recommendedExit = "T3";
    reasoning = "Swing style: Let winners run with trailing stops";
    urgency = "low";
  } else {
    recommendedExit = "T2";
    reasoning = "Day trade: Balance profit-taking with momentum";
    urgency = "low";
  }

  return {
    targets,
    recommendedExit,
    reasoning,
    urgency,
  };
}

export function HDDynamicProfitTargets({
  contract,
  entryPrice,
  stopLoss,
  currentPrice,
  tradeType = "Day",
  className,
  compact = false,
}: HDDynamicProfitTargetsProps) {
  const strategy = calculateTargetStrategy(contract, entryPrice, stopLoss, currentPrice, tradeType);

  const getLevelColor = (level: "T1" | "T2" | "T3", hit: boolean) => {
    if (hit) return "text-[var(--accent-positive)]";
    switch (level) {
      case "T1":
        return "text-blue-400";
      case "T2":
        return "text-amber-400";
      case "T3":
        return "text-purple-400";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  const getLevelBg = (level: "T1" | "T2" | "T3", hit: boolean) => {
    if (hit) return "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30";
    switch (level) {
      case "T1":
        return "bg-blue-500/10 border-blue-500/30";
      case "T2":
        return "bg-amber-500/10 border-amber-500/30";
      case "T3":
        return "bg-purple-500/10 border-purple-500/30";
      default:
        return "bg-[var(--surface-2)] border-[var(--border-hairline)]";
    }
  };

  if (compact) {
    // Compact mode - horizontal bar with targets marked
    const maxGain = strategy.targets[2].percentGain;
    const currentGain = currentPrice
      ? Math.max(0, ((currentPrice - entryPrice) / entryPrice) * 100)
      : 0;

    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--text-muted)] uppercase tracking-wide">Profit Targets</span>
          <span
            className={cn(
              "font-medium",
              currentGain > 0 ? "text-[var(--accent-positive)]" : "text-[var(--text-muted)]"
            )}
          >
            {currentGain > 0 ? `+${currentGain.toFixed(1)}%` : "Entry"}
          </span>
        </div>
        <div className="relative h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
          {/* Current progress */}
          {currentGain > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-[var(--accent-positive)] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (currentGain / maxGain) * 100)}%` }}
            />
          )}
          {/* Target markers */}
          {strategy.targets.map((target, i) => (
            <div
              key={target.level}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-full",
                target.hit
                  ? "bg-[var(--accent-positive)]"
                  : i === 0
                    ? "bg-blue-500"
                    : i === 1
                      ? "bg-amber-500"
                      : "bg-purple-500"
              )}
              style={{ left: `${(target.percentGain / maxGain) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-[var(--text-muted)]">
          {strategy.targets.map((target) => (
            <span
              key={target.level}
              className={cn(target.hit && "text-[var(--accent-positive)] font-medium")}
            >
              {target.level}: +{target.percentGain.toFixed(0)}%
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-[var(--text-high)] font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          Profit Targets
        </h4>
        <div
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
            strategy.urgency === "high"
              ? "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]"
              : strategy.urgency === "medium"
                ? "bg-amber-500/10 text-amber-400"
                : "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]"
          )}
        >
          {strategy.urgency === "high" && <AlertTriangle className="w-3 h-3" />}
          {strategy.urgency === "medium" && <Clock className="w-3 h-3" />}
          {strategy.urgency === "low" && <TrendingUp className="w-3 h-3" />}
          <span>Exit: {strategy.recommendedExit}</span>
        </div>
      </div>

      {/* Target Cards */}
      <div className="space-y-1.5">
        {strategy.targets.map((target) => (
          <div
            key={target.level}
            className={cn(
              "flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius)] border",
              getLevelBg(target.level, target.hit),
              target.level === strategy.recommendedExit &&
                !target.hit &&
                "ring-1 ring-[var(--brand-primary)]/50"
            )}
          >
            {/* Level Badge */}
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                target.hit ? "bg-[var(--accent-positive)]/20" : "bg-[var(--surface-3)]",
                getLevelColor(target.level, target.hit)
              )}
            >
              {target.hit ? <CheckCircle2 className="w-4 h-4" /> : target.level}
            </div>

            {/* Target Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span
                  className={cn("text-xs font-medium", getLevelColor(target.level, target.hit))}
                >
                  ${target.price.toFixed(2)}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    target.hit ? "text-[var(--accent-positive)]" : "text-[var(--text-high)]"
                  )}
                >
                  +{target.percentGain.toFixed(0)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-1 h-1 bg-[var(--surface-3)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    target.hit
                      ? "bg-[var(--accent-positive)]"
                      : target.level === "T1"
                        ? "bg-blue-500"
                        : target.level === "T2"
                          ? "bg-amber-500"
                          : "bg-purple-500"
                  )}
                  style={{ width: `${target.progress}%` }}
                />
              </div>

              {/* Meta Info */}
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] text-[var(--text-muted)]">{target.description}</span>
                <span className="text-[9px] text-[var(--text-muted)] tabular-nums">
                  R:R {target.riskReward.toFixed(1)}:1
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Strategy Reasoning */}
      <div className="px-2.5 py-2 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
        <p className="text-[10px] text-[var(--text-med)]">
          <span className="text-[var(--text-high)] font-medium">Strategy: </span>
          {strategy.reasoning}
        </p>
      </div>
    </div>
  );
}
