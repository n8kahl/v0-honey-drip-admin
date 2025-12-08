/**
 * AICoachPanel - Main AI Trade Coach panel component
 *
 * Displays:
 * - Live metrics (R-multiple, time in trade, ATR to stop)
 * - AI coaching summary and recommendations
 * - Risk flags and warnings
 * - "Ask Honey" input for questions
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
}

// Quick questions for the "Ask Honey" section
const QUICK_QUESTIONS = ["Breakeven?", "Risk?", "Valid?", "Scale?", "Trail stop?"];

// Risk flag display config
const RISK_FLAG_CONFIG: Record<RiskFlag, { label: string; color: string }> = {
  extended_move: { label: "Extended Move", color: "text-amber-400" },
  approaching_stop: { label: "Near Stop", color: "text-red-400" },
  volume_fading: { label: "Volume Fading", color: "text-amber-400" },
  theta_decay: { label: "Theta Decay", color: "text-orange-400" },
  spread_widening: { label: "Wide Spread", color: "text-amber-400" },
  event_imminent: { label: "Event Soon", color: "text-purple-400" },
  iv_elevated: { label: "IV Elevated", color: "text-orange-400" },
  momentum_divergence: { label: "Momentum Div", color: "text-amber-400" },
  regime_unfavorable: { label: "Regime Risk", color: "text-red-400" },
};

// Action type display config
const ACTION_CONFIG: Record<ActionType, { label: string; color: string; icon: typeof Target }> = {
  scale_out: {
    label: "Scale Out",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: TrendingUp,
  },
  trail_stop: {
    label: "Trail Stop",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: Shield,
  },
  move_to_be: {
    label: "Move to BE",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: Shield,
  },
  hold: { label: "Hold", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Clock },
  take_profit: {
    label: "Take Profit",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: Target,
  },
  watch_level: {
    label: "Watch Level",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: Activity,
  },
  reduce_size: {
    label: "Reduce Size",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: TrendingDown,
  },
  exit: { label: "Exit", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: X },
  add_position: {
    label: "Add",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: TrendingUp,
  },
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
}: AICoachPanelProps) {
  const [question, setQuestion] = useState("");

  const handleAsk = () => {
    if (question.trim()) {
      onAsk(question.trim());
      setQuestion("");
    }
  };

  const handleQuickQuestion = (q: string) => {
    onAsk(q);
  };

  // Calculate session duration
  const sessionDuration = startTime ? Math.floor((Date.now() - startTime) / 1000 / 60) : 0;

  // Estimate cost (~$0.01 per 1000 tokens for GPT-4 Turbo)
  const estimatedCost = ((tokensUsed / 1000) * 0.01).toFixed(3);

  return (
    <div className={cn("flex flex-col max-h-[600px] bg-[var(--surface-2)]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--brand-primary)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-high)]">AI Trade Coach</h3>
            <p className="text-[10px] text-[var(--text-muted)]">
              {trade.ticker} · {coachingMode?.toUpperCase()} Mode
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onToggleVoice && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVoice}
              className="h-7 w-7 p-0"
              title={voiceEnabled ? "Disable voice" : "Enable voice"}
            >
              {voiceEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isProcessing}
            className="h-7 w-7 p-0"
            title="Refresh analysis"
          >
            <RefreshCw className={cn("w-4 h-4", isProcessing && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0" title="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error State */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-[var(--radius)] text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && !latestResponse && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
            <p className="text-sm text-[var(--text-muted)]">Analyzing trade...</p>
          </div>
        )}

        {/* AI Summary */}
        {latestResponse && (
          <>
            <div className="p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)]">
              <div className="flex items-start gap-2 mb-2">
                <Brain className="w-4 h-4 text-[var(--brand-primary)] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--text-high)] uppercase tracking-wide">
                      Honey Coach
                    </span>
                    {latestResponse.confidence && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {latestResponse.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-high)] leading-relaxed">
                    {latestResponse.summary}
                  </p>
                  <div className="mt-2 text-[10px] text-[var(--text-muted)]">
                    Updated {new Date(latestResponse.timestamp).toLocaleTimeString()}
                    {latestResponse.trigger && (
                      <span className="ml-2 px-1.5 py-0.5 bg-[var(--surface-2)] rounded">
                        {latestResponse.trigger.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {latestResponse.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-[var(--text-high)] uppercase tracking-wide">
                  Suggestions
                </h4>
                <div className="flex flex-wrap gap-2">
                  {latestResponse.recommendations.map((rec, idx) => {
                    const config = ACTION_CONFIG[rec.action];
                    const Icon = config?.icon || Target;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius)] border text-xs",
                          config?.color ||
                            "bg-[var(--surface-1)] text-[var(--text-med)] border-[var(--border-hairline)]"
                        )}
                        title={rec.reason}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="font-medium">{config?.label || rec.action}</span>
                        {rec.urgency >= 4 && (
                          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Risk Flags */}
            {latestResponse.riskFlags.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-[var(--text-high)] uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Risk Flags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {latestResponse.riskFlags.map((flag) => {
                    const config = RISK_FLAG_CONFIG[flag];
                    return (
                      <span
                        key={flag}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-1)]",
                          config?.color || "text-[var(--text-muted)]"
                        )}
                      >
                        {config?.label || flag}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Ask Honey Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[var(--text-high)] uppercase tracking-wide flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            Ask Honey
          </h4>
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="Ask a question..."
              className="flex-1 h-9 bg-[var(--surface-1)] border-[var(--border-hairline)] text-sm"
              disabled={isProcessing || !sessionId}
            />
            <Button
              onClick={handleAsk}
              disabled={!question.trim() || isProcessing || !sessionId}
              className="h-9 px-3 bg-[var(--brand-primary)] text-[var(--bg-base)]"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleQuickQuestion(q)}
                disabled={isProcessing || !sessionId}
                className="px-2 py-1 text-[10px] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-[var(--text-med)] transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border-hairline)] bg-[var(--surface-1)]">
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span>
            Session: {updateCount} updates · {tokensUsed.toLocaleString()} tokens · ~$
            {estimatedCost}
          </span>
          <span>{sessionDuration}m elapsed</span>
        </div>
        <p className="mt-1 text-[9px] text-[var(--text-faint)]">
          Experimental. Not financial advice.
        </p>
      </div>
    </div>
  );
}

export default AICoachPanel;
