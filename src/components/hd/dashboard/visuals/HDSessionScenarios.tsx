/**
 * HDSessionScenarios - If/Then playbook for next trading session
 *
 * Shows bull/bear/neutral scenarios to prepare trader for different opening conditions
 */

import { useState } from "react";
import { cn } from "../../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ChevronDown,
  ChevronUp,
  Target,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { SessionScenario } from "../../../../types/radar-visuals";

export interface HDSessionScenariosProps {
  scenarios: SessionScenario[];
  className?: string;
  onAddToBattlePlan?: (symbol: string, scenario: SessionScenario) => void;
}

export function HDSessionScenarios({
  scenarios,
  className,
  onAddToBattlePlan,
}: HDSessionScenariosProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (scenarios.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] p-6",
          className
        )}
      >
        <div className="text-center">
          <Target className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">
            Add symbols to watchlist to see session scenarios
          </p>
        </div>
      </div>
    );
  }

  // Group by symbol
  const scenariosBySymbol = scenarios.reduce(
    (acc, scenario) => {
      if (!acc[scenario.symbol]) {
        acc[scenario.symbol] = [];
      }
      acc[scenario.symbol].push(scenario);
      return {};
    },
    {} as Record<string, SessionScenario[]>
  );

  // For MVP, show scenarios for first symbol only (or all if multiple symbols)
  const displayScenarios = scenarios.slice(0, 3); // Bull, Bear, Neutral

  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[var(--brand-primary)]" />
          <h3 className="font-semibold text-[var(--text-high)]">Session Scenarios</h3>
          <span className="text-xs text-[var(--text-muted)]">Next session playbook</span>
        </div>
      </div>

      {/* Scenarios */}
      <div className="p-4 space-y-3">
        {displayScenarios.map((scenario) => {
          const isExpanded = expandedId === scenario.id;
          const config = getScenarioConfig(scenario.caseType);

          return (
            <div
              key={scenario.id}
              className={cn("rounded-lg border transition-all", config.borderColor, config.bgColor)}
            >
              {/* Scenario Header (Always Visible) */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
                className="w-full p-3 text-left hover:bg-[var(--surface-2)]/30 transition-colors rounded-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Icon */}
                    <div className={cn("mt-0.5", config.iconColor)}>
                      <config.icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn("text-sm font-bold uppercase", config.textColor)}>
                          {scenario.caseType} Case
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold",
                            scenario.probability === "high" && "bg-green-500/20 text-green-400",
                            scenario.probability === "medium" && "bg-yellow-500/20 text-yellow-400",
                            scenario.probability === "low" && "bg-gray-500/20 text-gray-400"
                          )}
                        >
                          {scenario.probability} Prob
                        </span>
                      </div>

                      <p className="text-sm text-[var(--text-high)] font-medium">
                        {scenario.trigger}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{scenario.setup}</p>
                    </div>
                  </div>

                  {/* Expand Icon */}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-[var(--border-hairline)] pt-3 mt-2">
                  {/* Action Plan */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowRight className="w-3 h-3 text-[var(--brand-primary)]" />
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">
                        Action Plan
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-high)] pl-5">{scenario.action}</p>
                  </div>

                  {/* Targets & Stop */}
                  {scenario.targets.length > 0 && (
                    <div className="pl-5 space-y-1">
                      <div className="text-xs text-[var(--text-muted)]">
                        Targets:{" "}
                        <span className="text-green-400 font-mono font-medium">
                          {scenario.targets.map((t) => t.toFixed(2)).join(", ")}
                        </span>
                      </div>
                      {scenario.stop && (
                        <div className="text-xs text-[var(--text-muted)]">
                          Stop:{" "}
                          <span className="text-red-400 font-mono font-medium">
                            {scenario.stop.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Invalidation */}
                  <div className="pl-5">
                    <div className="flex items-start gap-2 p-2 rounded bg-[var(--surface-2)]/50">
                      <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-[10px] font-semibold text-yellow-400 uppercase mb-0.5">
                          Invalidation
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">{scenario.invalidation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="pl-5 text-xs text-[var(--text-muted)] italic">
                    {scenario.reasoning}
                  </div>

                  {/* Add to Battle Plan Button */}
                  {onAddToBattlePlan && (
                    <div className="pl-5 pt-2">
                      <button
                        onClick={() => onAddToBattlePlan(scenario.symbol, scenario)}
                        className={cn(
                          "w-full px-3 py-2 rounded text-sm font-medium transition-colors",
                          "bg-[var(--brand-primary)] text-white",
                          "hover:bg-[var(--brand-primary)]/90"
                        )}
                      >
                        Add to Battle Plan
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Tip */}
      <div className="px-4 py-3 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]/30">
        <p className="text-xs text-[var(--text-muted)] text-center">
          💡 Prep all scenarios - market can open anywhere. Have a plan for each case.
        </p>
      </div>
    </div>
  );
}

// Scenario visual configuration
function getScenarioConfig(caseType: "bull" | "bear" | "neutral") {
  const configs = {
    bull: {
      icon: TrendingUp,
      iconColor: "text-green-400",
      textColor: "text-green-400",
      bgColor: "bg-green-500/5",
      borderColor: "border-green-500/30",
    },
    bear: {
      icon: TrendingDown,
      iconColor: "text-red-400",
      textColor: "text-red-400",
      bgColor: "bg-red-500/5",
      borderColor: "border-red-500/30",
    },
    neutral: {
      icon: Activity,
      iconColor: "text-gray-400",
      textColor: "text-gray-400",
      bgColor: "bg-gray-500/5",
      borderColor: "border-gray-500/30",
    },
  };

  return configs[caseType];
}

export default HDSessionScenarios;
