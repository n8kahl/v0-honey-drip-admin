/**
 * AICoachSummary - Compact coaching summary display
 *
 * Shows the latest AI coaching response in a condensed format
 * for embedding in trade cards or sidebars
 */

import { cn } from "../../../lib/utils";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  Target,
  X,
  Activity,
} from "lucide-react";
import type { CoachingResponse, ActionType, RiskFlag } from "../../../lib/ai/types";

interface AICoachSummaryProps {
  response: CoachingResponse | null;
  isLoading?: boolean;
  showRecommendations?: boolean;
  showRiskFlags?: boolean;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

// Simplified action icons
const ACTION_ICONS: Record<ActionType, typeof Target> = {
  scale_out: TrendingUp,
  trail_stop: Shield,
  move_to_be: Shield,
  hold: Clock,
  take_profit: Target,
  watch_level: Activity,
  reduce_size: TrendingDown,
  exit: X,
  add_position: TrendingUp,
  wait: Clock,
};

// Get urgency color
function getUrgencyColor(urgency: number): string {
  if (urgency >= 5) return "text-red-400";
  if (urgency >= 4) return "text-orange-400";
  if (urgency >= 3) return "text-amber-400";
  return "text-[var(--text-med)]";
}

export function AICoachSummary({
  response,
  isLoading = false,
  showRecommendations = true,
  showRiskFlags = true,
  compact = false,
  className,
  onClick,
}: AICoachSummaryProps) {
  if (!response && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-2 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]",
          className
        )}
      >
        <Brain className="w-4 h-4 text-[var(--brand-primary)] animate-pulse" />
        <span className="text-xs text-[var(--text-muted)]">Analyzing...</span>
      </div>
    );
  }

  if (!response) return null;

  const topRecommendation = response.recommendations[0];
  const TopIcon = topRecommendation ? ACTION_ICONS[topRecommendation.action] : null;
  const hasHighUrgency = response.recommendations.some((r) => r.urgency >= 4);

  if (compact) {
    // Ultra-compact mode - single line
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]",
          onClick && "cursor-pointer hover:bg-[var(--surface-2)] transition-colors",
          className
        )}
        onClick={onClick}
      >
        <Brain className="w-3.5 h-3.5 text-[var(--brand-primary)] flex-shrink-0" />
        <span className="text-[10px] text-[var(--text-high)] truncate flex-1">
          {response.summary.slice(0, 60)}
          {response.summary.length > 60 && "..."}
        </span>
        {hasHighUrgency && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] space-y-2",
        onClick && "cursor-pointer hover:bg-[var(--surface-2)] transition-colors",
        className
      )}
      onClick={onClick}
    >
      {/* Header with summary */}
      <div className="flex items-start gap-2">
        <Brain className="w-4 h-4 text-[var(--brand-primary)] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--text-high)] leading-relaxed">{response.summary}</p>
        </div>
      </div>

      {/* Recommendations */}
      {showRecommendations && response.recommendations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {response.recommendations.slice(0, 3).map((rec, idx) => {
            const Icon = ACTION_ICONS[rec.action] || Target;
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                  "bg-[var(--surface-2)] border border-[var(--border-hairline)]",
                  getUrgencyColor(rec.urgency)
                )}
                title={rec.reason}
              >
                <Icon className="w-3 h-3" />
                <span className="capitalize">{rec.action.replace(/_/g, " ")}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Risk Flags */}
      {showRiskFlags && response.riskFlags.length > 0 && (
        <div className="flex items-center gap-1 pt-1 border-t border-[var(--border-hairline)]">
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <div className="flex flex-wrap gap-1">
            {response.riskFlags.slice(0, 3).map((flag) => (
              <span
                key={flag}
                className="text-[9px] px-1 py-0.5 bg-amber-500/10 text-amber-400 rounded"
              >
                {flag.replace(/_/g, " ")}
              </span>
            ))}
            {response.riskFlags.length > 3 && (
              <span className="text-[9px] text-[var(--text-muted)]">
                +{response.riskFlags.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Confidence & timestamp */}
      <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] pt-1">
        <span>{response.confidence}% confidence</span>
        <span>{new Date(response.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

export default AICoachSummary;
