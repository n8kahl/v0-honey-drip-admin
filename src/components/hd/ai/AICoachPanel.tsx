/**
 * AICoachPanel - AI Trade Coach panel
 *
 * Collapsed (default): 1-liner summary bar with expand button
 * Expanded: Full panel with summary, recommendations, risk flags, ask input
 */

import { useState } from "react";
import { cn } from "../../../lib/utils";
import {
  X,
  RefreshCw,
  Volume2,
  VolumeX,
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Shield,
  Activity,
  MessageCircle,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import type { Trade } from "../../../types";
import type { CoachingResponse, TradeType, RiskFlag, ActionType } from "../../../lib/ai/types";

interface AICoachPanelProps {
  trade: Trade;
  sessionId: string | null;
  coachingMode: TradeType | null;
  latestResponse: CoachingResponse | null;
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  updateCount: number;
  tokensUsed: number;
  startTime: number | null;
  onClose: () => void;
  onRefresh: () => void;
  onAsk: (question: string) => void;
  onEndSession: () => void;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  className?: string;
  defaultExpanded?: boolean;
}

const QUICK_QUESTIONS = ["Risk?", "Valid?", "Scale?", "Trail?"];

const RISK_FLAG_CONFIG: Record<RiskFlag, { label: string; color: string }> = {
  extended_move: { label: "Extended", color: "text-amber-400" },
  approaching_stop: { label: "Near Stop", color: "text-red-400" },
  volume_fading: { label: "Vol Fading", color: "text-amber-400" },
  theta_decay: { label: "Theta", color: "text-orange-400" },
  spread_widening: { label: "Wide Spread", color: "text-amber-400" },
  event_imminent: { label: "Event", color: "text-purple-400" },
  iv_elevated: { label: "IV High", color: "text-orange-400" },
  momentum_divergence: { label: "Divergence", color: "text-amber-400" },
  regime_unfavorable: { label: "Regime", color: "text-red-400" },
};

const ACTION_CONFIG: Record<ActionType, { label: string; color: string; icon: typeof Target }> = {
  scale_out: { label: "Scale Out", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: TrendingUp },
  trail_stop: { label: "Trail Stop", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Shield },
  move_to_be: { label: "Move BE", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Shield },
  hold: { label: "Hold", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Clock },
  take_profit: { label: "Take Profit", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: Target },
  watch_level: { label: "Watch", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Activity },
  reduce_size: { label: "Reduce", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: TrendingDown },
  exit: { label: "Exit", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: X },
  add_position: { label: "Add", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: TrendingUp },
  wait: { label: "Wait", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Clock },
};

export function AICoachPanel({
  trade,
  sessionId,
  coachingMode,
  latestResponse,
  isLoading,
  isProcessing,
  error,
  updateCount,
  tokensUsed,
  startTime,
  onClose,
  onRefresh,
  onAsk,
  onEndSession,
  voiceEnabled = false,
  onToggleVoice,
  className,
  defaultExpanded = false,
}: AICoachPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [question, setQuestion] = useState("");

  const handleAsk = () => {
    if (question.trim()) {
      onAsk(question.trim());
      setQuestion("");
    }
  };

  const sessionDuration = startTime ? Math.floor((Date.now() - startTime) / 1000 / 60) : 0;
  const estimatedCost = ((tokensUsed / 1000) * 0.01).toFixed(2);

  // Generate 1-liner summary
  const getSummaryOneLiner = (): string => {
    if (error) return "Coach error";
    if (isLoading && !latestResponse) return "Analyzing...";
    if (!latestResponse) return "No analysis yet";

    // Use first recommendation or summary excerpt
    const firstRec = latestResponse.recommendations[0];
    if (firstRec) {
      const config = ACTION_CONFIG[firstRec.action];
      return config?.label || firstRec.action.replace(/_/g, " ");
    }

    // Truncate summary to ~40 chars
    const summary = latestResponse.summary || "";
    return summary.length > 40 ? summary.slice(0, 37) + "..." : summary;
  };

  // Collapsed view: 1-liner summary bar
  if (!expanded) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] rounded", className)}>
        <Brain className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
        <span className="text-xs text-[var(--text-muted)] truncate flex-1">
          {getSummaryOneLiner()}
        </span>

        {/* Risk flag indicators */}
        {latestResponse?.riskFlags && latestResponse.riskFlags.length > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-400">{latestResponse.riskFlags.length}</span>
          </span>
        )}

        {/* Compact stats */}
        <span className="text-[10px] text-[var(--text-faint)] tabular-nums shrink-0">
          {updateCount > 0 && `${updateCount}↻`}
        </span>

        {/* Actions */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isProcessing}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={cn("w-3 h-3", isProcessing && "animate-spin")} />
        </Button>

        <button
          onClick={() => setExpanded(true)}
          className="flex items-center text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)]"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Expanded view: full panel
  return (
    <div className={cn("flex flex-col max-h-[400px] bg-[var(--surface-2)] rounded", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-xs font-medium text-[var(--text-high)]">AI Coach</span>
          <span className="text-[10px] text-[var(--text-muted)]">{coachingMode}</span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleVoice && (
            <Button variant="ghost" size="sm" onClick={onToggleVoice} className="h-6 w-6 p-0">
              {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isProcessing} className="h-6 w-6 p-0">
            <RefreshCw className={cn("w-3.5 h-3.5", isProcessing && "animate-spin")} />
          </Button>
          <button onClick={() => setExpanded(false)} className="p-1 text-[var(--text-faint)] hover:text-[var(--text-muted)]">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        {isLoading && !latestResponse && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-primary)]" />
            <span className="text-xs text-[var(--text-muted)]">Analyzing...</span>
          </div>
        )}

        {latestResponse && (
          <>
            {/* Summary */}
            <div className="p-2.5 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded">
              <p className="text-xs text-[var(--text-high)] leading-relaxed">
                {latestResponse.summary}
              </p>
              {latestResponse.confidence && (
                <span className="text-[10px] text-[var(--text-faint)]">
                  {latestResponse.confidence}% confidence
                </span>
              )}
            </div>

            {/* Recommendations */}
            {latestResponse.recommendations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {latestResponse.recommendations.map((rec, idx) => {
                  const config = ACTION_CONFIG[rec.action];
                  const Icon = config?.icon || Target;
                  return (
                    <div
                      key={idx}
                      className={cn("flex items-center gap-1 px-2 py-1 rounded border text-[10px]", config?.color)}
                      title={rec.reason}
                    >
                      <Icon className="w-3 h-3" />
                      <span className="font-medium">{config?.label || rec.action}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Risk Flags */}
            {latestResponse.riskFlags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {latestResponse.riskFlags.map((flag) => {
                  const config = RISK_FLAG_CONFIG[flag];
                  return (
                    <span
                      key={flag}
                      className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--surface-1)]", config?.color)}
                    >
                      {config?.label || flag}
                    </span>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Ask Honey */}
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="Ask..."
              className="flex-1 h-7 bg-[var(--surface-1)] border-[var(--border-hairline)] text-xs"
              disabled={isProcessing || !sessionId}
            />
            <Button
              onClick={handleAsk}
              disabled={!question.trim() || isProcessing || !sessionId}
              className="h-7 px-2 bg-[var(--brand-primary)] text-[var(--bg-base)]"
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                disabled={isProcessing || !sessionId}
                className="px-1.5 py-0.5 text-[9px] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-[var(--text-med)] disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer - compact */}
      <div className="px-3 py-1.5 border-t border-[var(--border-hairline)] text-[9px] text-[var(--text-faint)]">
        {updateCount}↻ · {(tokensUsed / 1000).toFixed(1)}K◆ · ${estimatedCost} · {sessionDuration}m
      </div>
    </div>
  );
}

export default AICoachPanel;
