/**
 * HDContractQualityBadge - Visual display of contract quality score
 *
 * Shows the quality grade and score with expandable details
 */

import { cn } from "../../../lib/utils";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Star,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  BarChart3,
  Gauge,
  Zap,
} from "lucide-react";
import {
  calculateContractQuality,
  type ContractQualityResult,
  type ContractQualityConfig,
} from "../../../lib/scoring/ContractQualityScore";
import type { Contract } from "../../../types";

interface HDContractQualityBadgeProps {
  contract: Contract;
  config: ContractQualityConfig;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

const GRADE_COLORS = {
  A: "text-[var(--accent-positive)] bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30",
  B: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  C: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  D: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  F: "text-[var(--accent-negative)] bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30",
};

const RECOMMENDATION_LABELS = {
  strong_buy: { label: "Strong Buy", color: "text-[var(--accent-positive)]" },
  buy: { label: "Buy", color: "text-blue-400" },
  consider: { label: "Consider", color: "text-amber-400" },
  avoid: { label: "Avoid", color: "text-[var(--accent-negative)]" },
};

const SCORE_ICONS = {
  liquidity: <BarChart3 className="w-3 h-3" />,
  greeksFit: <Gauge className="w-3 h-3" />,
  ivValue: <Activity className="w-3 h-3" />,
  flow: <TrendingUp className="w-3 h-3" />,
  probability: <Zap className="w-3 h-3" />,
};

const SCORE_LABELS = {
  liquidity: "Liquidity",
  greeksFit: "Greeks Fit",
  ivValue: "IV Value",
  flow: "Flow",
  probability: "Probability",
};

export function HDContractQualityBadge({
  contract,
  config,
  className,
  showDetails: initialShowDetails = false,
  compact = false,
}: HDContractQualityBadgeProps) {
  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const quality = calculateContractQuality(contract, config);

  if (compact) {
    // Compact mode - just grade badge
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold",
          GRADE_COLORS[quality.grade],
          className
        )}
      >
        <Star className="w-3 h-3" />
        <span>{quality.grade}</span>
        <span className="text-[10px] opacity-75">{quality.overallScore}</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Main Badge */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius)] border transition-colors",
          GRADE_COLORS[quality.grade],
          "hover:opacity-90"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4" />
            <span className="text-lg font-bold">{quality.grade}</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium">{quality.overallScore}/100</span>
            <span
              className={cn("text-[10px]", RECOMMENDATION_LABELS[quality.recommendation].color)}
            >
              {RECOMMENDATION_LABELS[quality.recommendation].label}
            </span>
          </div>
        </div>
        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div className="space-y-3 p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
          {/* Score Breakdown */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Score Breakdown
            </h4>
            {Object.entries(quality.scores).map(([key, score]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[var(--text-muted)]">
                  {SCORE_ICONS[key as keyof typeof SCORE_ICONS]}
                </span>
                <span className="text-xs text-[var(--text-med)] flex-1">
                  {SCORE_LABELS[key as keyof typeof SCORE_LABELS]}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        score >= 70
                          ? "bg-[var(--accent-positive)]"
                          : score >= 50
                            ? "bg-amber-500"
                            : "bg-[var(--accent-negative)]"
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-6">
                    {score}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Strengths */}
          {quality.strengths.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-[10px] text-[var(--accent-positive)] uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Strengths
              </h4>
              <div className="flex flex-wrap gap-1">
                {quality.strengths.map((strength, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-positive)]/10 text-[var(--accent-positive)] rounded"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {quality.warnings.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-[10px] text-amber-400 uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Warnings
              </h4>
              <div className="flex flex-wrap gap-1">
                {quality.warnings.map((warning, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded"
                  >
                    {warning}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
