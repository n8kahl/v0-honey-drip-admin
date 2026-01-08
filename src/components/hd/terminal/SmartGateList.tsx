/**
 * SmartGateList - Smart Gate Validation Checklist
 *
 * Displays a vertical checklist comparing current market features
 * against strategy-defined gate requirements.
 * Shows pass/fail status for each gate condition.
 */

import { cn } from "@/lib/utils";
import { Check, X, Clock, AlertTriangle } from "lucide-react";
import type { SymbolFeatures } from "@/lib/strategy/engine";
import type { StrategySmartGates } from "@/types/strategy";

interface SmartGateListProps {
  gates?: StrategySmartGates;
  features?: SymbolFeatures;
  technicalTrigger?: boolean; // Whether the price/technical condition is met
  className?: string;
  compact?: boolean;
}

interface GateCheckResult {
  id: string;
  label: string;
  required: string | number;
  actual: string | number | undefined;
  passed: boolean;
  pending?: boolean;
  description?: string;
}

function evaluateGates(
  gates: StrategySmartGates | undefined,
  features: SymbolFeatures | undefined,
  technicalTrigger?: boolean
): GateCheckResult[] {
  const results: GateCheckResult[] = [];

  if (!gates) {
    // No gates defined - show all as passed
    return [
      {
        id: "no-gates",
        label: "No Smart Gates",
        required: "None",
        actual: "N/A",
        passed: true,
        description: "Strategy has no gate requirements",
      },
    ];
  }

  // Flow Score Gate
  if (gates.minFlowScore !== undefined) {
    const actualScore = features?.flow?.institutionalConviction ?? features?.flow?.flowScore ?? 0;
    results.push({
      id: "flow-score",
      label: "Flow Score",
      required: `>= ${gates.minFlowScore}`,
      actual: actualScore?.toFixed(0) ?? "N/A",
      passed: actualScore >= gates.minFlowScore,
      description: "Institutional flow conviction score",
    });
  }

  // Flow Bias Gate
  if (gates.requiredFlowBias && gates.requiredFlowBias !== "any") {
    const actualBias = features?.flow?.flowBias ?? "neutral";
    const biasMatches = actualBias === gates.requiredFlowBias;
    results.push({
      id: "flow-bias",
      label: "Flow Bias",
      required: gates.requiredFlowBias.toUpperCase(),
      actual: actualBias.toUpperCase(),
      passed: biasMatches,
      description: "Options flow directional bias",
    });
  }

  // Gamma Regime Gate
  if (gates.gammaRegime && gates.gammaRegime !== "any") {
    // Determine actual gamma regime from features
    const dealerDelta = features?.greeks?.delta ?? 0;
    const actualRegime =
      dealerDelta > 0 ? "long_gamma" : dealerDelta < 0 ? "short_gamma" : "neutral";
    const regimeMatches = actualRegime === gates.gammaRegime;

    results.push({
      id: "gamma-regime",
      label: "Gamma Regime",
      required: gates.gammaRegime === "long_gamma" ? "LONG" : "SHORT",
      actual:
        actualRegime === "long_gamma"
          ? "LONG"
          : actualRegime === "short_gamma"
            ? "SHORT"
            : "NEUTRAL",
      passed: regimeMatches,
      description: "Dealer gamma exposure regime",
    });
  }

  // Minimum Gamma Exposure Gate
  if (gates.minGammaExposure !== undefined) {
    const actualExposure = Math.abs(features?.greeks?.gamma ?? 0);
    results.push({
      id: "gamma-exposure",
      label: "Gamma Exposure",
      required: `>= ${gates.minGammaExposure}`,
      actual: actualExposure.toFixed(2),
      passed: actualExposure >= gates.minGammaExposure,
      description: "Minimum dealer gamma threshold",
    });
  }

  // Institutional Score Gate
  if (gates.minInstitutionalScore !== undefined) {
    const actualScore = features?.flow?.institutionalConviction ?? 0;
    results.push({
      id: "institutional",
      label: "Institutional",
      required: `>= ${gates.minInstitutionalScore}`,
      actual: actualScore?.toFixed(0) ?? "N/A",
      passed: actualScore >= gates.minInstitutionalScore,
      description: "Institutional conviction threshold",
    });
  }

  // Technical Trigger Gate (always added if we have gates)
  results.push({
    id: "technical",
    label: "Technical Trigger",
    required: "Price Condition",
    actual: technicalTrigger ? "MET" : "WAITING",
    passed: technicalTrigger === true,
    pending: technicalTrigger === undefined || technicalTrigger === false,
    description: "Price/chart pattern condition",
  });

  return results;
}

export function SmartGateList({
  gates,
  features,
  technicalTrigger,
  className,
  compact = false,
}: SmartGateListProps) {
  const gateResults = evaluateGates(gates, features, technicalTrigger);
  const allPassed = gateResults.every((g) => g.passed);
  const anyFailed = gateResults.some((g) => !g.passed && !g.pending);
  const anyPending = gateResults.some((g) => g.pending);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Smart Gates
        </div>
        <div
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            allPassed
              ? "bg-emerald-500/20 text-emerald-400"
              : anyFailed
                ? "bg-red-500/20 text-red-400"
                : "bg-amber-500/20 text-amber-400"
          )}
        >
          {allPassed ? "ALL PASS" : anyFailed ? "BLOCKED" : "PENDING"}
        </div>
      </div>

      {/* Gate List */}
      <div className={cn("space-y-1.5", compact && "space-y-1")}>
        {gateResults.map((gate) => (
          <div
            key={gate.id}
            className={cn(
              "flex items-center justify-between p-2 rounded-lg",
              "bg-muted/30 border border-transparent",
              gate.passed && "border-emerald-500/20",
              !gate.passed && !gate.pending && "border-red-500/20 bg-red-500/5",
              gate.pending && "border-amber-500/20 bg-amber-500/5"
            )}
          >
            <div className="flex items-center gap-2">
              {/* Status Icon */}
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  gate.passed && "bg-emerald-500/20",
                  !gate.passed && !gate.pending && "bg-red-500/20",
                  gate.pending && "bg-amber-500/20"
                )}
              >
                {gate.passed ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : gate.pending ? (
                  <Clock className="w-3 h-3 text-amber-400" />
                ) : (
                  <X className="w-3 h-3 text-red-400" />
                )}
              </div>

              {/* Label */}
              <div>
                <div className={cn("text-sm font-medium", compact && "text-xs")}>{gate.label}</div>
                {!compact && gate.description && (
                  <div className="text-[10px] text-muted-foreground">{gate.description}</div>
                )}
              </div>
            </div>

            {/* Values */}
            <div className="text-right">
              <div
                className={cn(
                  "text-xs font-mono",
                  gate.passed
                    ? "text-emerald-400"
                    : gate.pending
                      ? "text-amber-400"
                      : "text-red-400"
                )}
              >
                {gate.actual}
              </div>
              <div className="text-[10px] text-muted-foreground">req: {gate.required}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {anyFailed && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300">
            {gateResults.filter((g) => !g.passed && !g.pending).length} gate(s) not met. Entry
            blocked.
          </span>
        </div>
      )}

      {anyPending && !anyFailed && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-300">Waiting for technical trigger...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Check if all gates are passing
 */
export function areAllGatesPassing(
  gates: StrategySmartGates | undefined,
  features: SymbolFeatures | undefined,
  technicalTrigger?: boolean
): boolean {
  const results = evaluateGates(gates, features, technicalTrigger);
  return results.every((g) => g.passed);
}

export default SmartGateList;
