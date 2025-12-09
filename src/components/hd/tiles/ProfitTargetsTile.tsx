/**
 * ProfitTargetsTile - Contract-aware profit targets tile
 *
 * Default view: T1/T2/SL chips with price + % + R:R badge
 * Expanded view: Progress bars + strategy hint
 */

import { useState, useMemo } from "react";
import { cn } from "../../../lib/utils";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { TargetChip } from "../common/StatusChip";
import type { Contract } from "../../../types";

interface ProfitTargetsTileProps {
  contract: Contract | null;
  entryPrice?: number;
  stopLoss?: number;
  currentPrice?: number;
  underlyingPrice?: number;
  tradeType?: "Scalp" | "Day" | "Swing" | "LEAP";
  className?: string;
  defaultExpanded?: boolean;
}

interface ProfitTarget {
  level: "T1" | "T2" | "T3";
  price: number;
  underlyingTarget?: number;
  percentGain: number;
  riskReward: number;
  progress: number;
  hit: boolean;
}

function calculateTargets(
  entryPrice: number,
  stopLoss: number | undefined,
  currentPrice: number | undefined,
  contract: Contract,
  tradeType: "Scalp" | "Day" | "Swing" | "LEAP" = "Day",
  underlyingPrice?: number
): { targets: ProfitTarget[]; stopPrice: number; stopPct: number; rrRatio: string } {
  const dte = contract.daysToExpiry ?? 0;
  const atr = contract.mid * 0.15;
  const effectiveStop = stopLoss || entryPrice - atr * 0.5;
  const risk = Math.max(0.01, entryPrice - effectiveStop);

  // Base target percentages by style
  const baseTargets: Record<string, { t1: number; t2: number; t3: number }> = {
    Scalp: { t1: 0.15, t2: 0.25, t3: 0.4 },
    Day: { t1: 0.25, t2: 0.5, t3: 0.75 },
    Swing: { t1: 0.5, t2: 1.0, t3: 1.5 },
    LEAP: { t1: 0.75, t2: 1.5, t3: 2.5 },
  };

  // DTE multiplier
  const dteMultiplier = dte === 0 ? 0.6 : dte === 1 ? 0.75 : dte <= 3 ? 0.9 : 1.0;

  const styleTargets = baseTargets[tradeType] || baseTargets.Day;

  // Calculate underlying price targets based on delta
  // For every $1 move in underlying, option moves by delta
  const delta = Math.abs(contract.delta ?? 0.5);
  const isCall = contract.contractType === "call";

  // Estimate underlying move needed for each option target
  const getUnderlyingTarget = (optionTargetPct: number): number | undefined => {
    if (!underlyingPrice || !delta || delta === 0) return undefined;
    // Option target price = entryPrice * (1 + pct)
    // Option move = entryPrice * pct
    // Underlying move = option move / delta
    const optionMove = entryPrice * optionTargetPct;
    const underlyingMove = optionMove / delta;
    return isCall ? underlyingPrice + underlyingMove : underlyingPrice - underlyingMove;
  };

  const targets: ProfitTarget[] = [
    {
      level: "T1",
      price: entryPrice * (1 + styleTargets.t1 * dteMultiplier),
      underlyingTarget: getUnderlyingTarget(styleTargets.t1 * dteMultiplier),
      percentGain: styleTargets.t1 * dteMultiplier * 100,
      riskReward: (entryPrice * styleTargets.t1 * dteMultiplier) / risk,
      progress: 0,
      hit: false,
    },
    {
      level: "T2",
      price: entryPrice * (1 + styleTargets.t2 * dteMultiplier),
      underlyingTarget: getUnderlyingTarget(styleTargets.t2 * dteMultiplier),
      percentGain: styleTargets.t2 * dteMultiplier * 100,
      riskReward: (entryPrice * styleTargets.t2 * dteMultiplier) / risk,
      progress: 0,
      hit: false,
    },
    {
      level: "T3",
      price: entryPrice * (1 + styleTargets.t3 * dteMultiplier),
      underlyingTarget: getUnderlyingTarget(styleTargets.t3 * dteMultiplier),
      percentGain: styleTargets.t3 * dteMultiplier * 100,
      riskReward: (entryPrice * styleTargets.t3 * dteMultiplier) / risk,
      progress: 0,
      hit: false,
    },
  ];

  // Calculate progress
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

  const stopPct = ((entryPrice - effectiveStop) / entryPrice) * -100;
  const rrRatio = (targets[1].percentGain / Math.abs(stopPct)).toFixed(1);

  return { targets, stopPrice: effectiveStop, stopPct, rrRatio };
}

function getStrategyHint(dte: number, tradeType: string): string {
  if (dte === 0) return "0DTE: Take quick profits at T1";
  if (dte === 1) return "1DTE: Lock gains early, avoid overnight theta";
  if (tradeType === "Scalp") return "Scalp: Quick exits at T1";
  if (tradeType === "Day") return "Day: Balance T1/T2 exits";
  if (tradeType === "Swing") return "Swing: Let winners run to T3";
  if (tradeType === "LEAP") return "LEAP: Long-term hold to T3";
  return "Balance risk/reward across targets";
}

export function ProfitTargetsTile({
  contract,
  entryPrice,
  stopLoss,
  currentPrice,
  underlyingPrice,
  tradeType = "Day",
  className,
  defaultExpanded = false,
}: ProfitTargetsTileProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Calculate targets only if we have a contract and entry price
  const { targets, stopPrice, stopPct, rrRatio, strategyHint } = useMemo(() => {
    if (!contract || !entryPrice) {
      return {
        targets: [],
        stopPrice: 0,
        stopPct: 0,
        rrRatio: "—",
        strategyHint: "",
      };
    }

    const result = calculateTargets(
      entryPrice,
      stopLoss,
      currentPrice,
      contract,
      tradeType,
      underlyingPrice
    );
    const hint = getStrategyHint(contract.daysToExpiry ?? 0, tradeType);

    return {
      ...result,
      strategyHint: hint,
    };
  }, [contract, entryPrice, stopLoss, currentPrice, tradeType, underlyingPrice]);

  // No contract state
  if (!contract || !entryPrice) {
    return (
      <div
        className={cn(
          "p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Targets
          </span>
        </div>
        <div className="text-xs text-[var(--text-faint)]">Select contract for targets</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Targets
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Compact View: Target Chips with Underlying */}
      <div className="space-y-1.5">
        {/* Target Chips Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {targets.slice(0, 2).map((t) => (
            <TargetChip
              key={t.level}
              level={t.level}
              price={t.price}
              pct={Math.round(t.percentGain)}
              hit={t.hit}
            />
          ))}

          {/* R:R badge */}
          <span className="ml-auto px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[10px] font-medium text-[var(--text-muted)] tabular-nums">
            R:R 1:{rrRatio}
          </span>
        </div>

        {/* Underlying Price Targets Row */}
        {targets[0]?.underlyingTarget && (
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <span className="text-[var(--text-faint)]">Underlying:</span>
            {targets.slice(0, 2).map((t) => (
              <span key={t.level} className="tabular-nums">
                {t.level} ${t.underlyingTarget?.toFixed(2)}
              </span>
            ))}
          </div>
        )}

        {/* Stop Loss Row - Below targets */}
        <div className="flex items-center gap-1.5">
          <TargetChip level="SL" price={stopPrice} pct={Math.round(stopPct)} />
        </div>
      </div>

      {/* Expanded: Progress bars + T3 */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] space-y-2 animate-fade-in-up">
          {/* Progress bars for all targets */}
          {targets.map((t) => (
            <div key={t.level} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-6 text-[10px] font-medium",
                    t.hit ? "text-[var(--accent-positive)]" : "text-[var(--text-muted)]"
                  )}
                >
                  {t.level}
                </span>
                <span className="w-14 text-[10px] text-[var(--text-muted)] tabular-nums">
                  ${t.price.toFixed(2)}
                </span>
                <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      t.hit
                        ? "bg-[var(--accent-positive)]"
                        : t.level === "T1"
                          ? "bg-blue-500"
                          : t.level === "T2"
                            ? "bg-amber-500"
                            : "bg-purple-500"
                    )}
                    style={{ width: `${t.progress}%` }}
                  />
                </div>
                <span className="w-12 text-[10px] text-[var(--text-muted)] tabular-nums text-right">
                  +{t.percentGain.toFixed(0)}%
                </span>
              </div>
              {/* Underlying target for this level */}
              {t.underlyingTarget && (
                <div className="ml-6 text-[9px] text-[var(--text-faint)] tabular-nums">
                  → Underlying ${t.underlyingTarget.toFixed(2)}
                </div>
              )}
            </div>
          ))}

          {/* Strategy hint */}
          <div className="pt-1 text-[10px] text-[var(--text-faint)]">{strategyHint}</div>
        </div>
      )}
    </div>
  );
}

export default ProfitTargetsTile;
