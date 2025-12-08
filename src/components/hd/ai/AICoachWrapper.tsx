/**
 * AICoachWrapper - Wraps trade panels with AI coaching capability
 *
 * Provides a split view with the trade panel on the left and
 * the AI coach panel on the right when activated
 */

import { useState, useCallback } from "react";
import { cn } from "../../../lib/utils";
import { useAITradeCoach } from "../../../hooks/useAITradeCoach";
import { AICoachPanel } from "./AICoachPanel";
import { AICoachButton } from "./AICoachButton";
import { AICoachSummary } from "./AICoachSummary";
import type { Trade } from "../../../types";

interface AICoachWrapperProps {
  trade: Trade;
  children: React.ReactNode;
  /** Show coach button in header */
  showButton?: boolean;
  /** Show compact summary when coach is not expanded */
  showSummary?: boolean;
  /** Enable voice output */
  enableVoice?: boolean;
  className?: string;
}

export function AICoachWrapper({
  trade,
  children,
  showButton = true,
  showSummary = true,
  enableVoice = false,
  className,
}: AICoachWrapperProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(enableVoice);

  const {
    state,
    startSession,
    endSession,
    refresh,
    ask,
    hasActiveSession,
    latestSummary,
    latestRecommendations,
    riskFlags,
    isProcessing,
  } = useAITradeCoach({
    enableVoice: voiceEnabled,
  });

  const handleToggleCoach = useCallback(async () => {
    if (hasActiveSession(trade.id)) {
      setIsExpanded(!isExpanded);
    } else {
      // Start a new session and expand
      await startSession(trade);
      setIsExpanded(true);
    }
  }, [trade, hasActiveSession, startSession, isExpanded]);

  const handleClose = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const handleEndSession = useCallback(async () => {
    await endSession();
    setIsExpanded(false);
  }, [endSession]);

  const handleToggleVoice = useCallback(() => {
    setVoiceEnabled(!voiceEnabled);
  }, [voiceEnabled]);

  const isActive = hasActiveSession(trade.id);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with AI Coach button */}
      {showButton && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">AI Coach</span>
          </div>
          <AICoachButton
            onClick={handleToggleCoach}
            isActive={isActive}
            isLoading={state.isLoading && !state.latestResponse}
            coachingMode={state.coachingMode}
            variant="compact"
          />
        </div>
      )}

      {/* Compact summary when not expanded but session active */}
      {showSummary && isActive && !isExpanded && state.latestResponse && (
        <div className="px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
          <AICoachSummary
            response={state.latestResponse}
            compact
            className="cursor-pointer"
            onClick={() => setIsExpanded(true)}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Trade panel content */}
        <div
          className={cn(
            "flex-1 overflow-y-auto transition-all duration-300",
            isExpanded && "w-1/2"
          )}
        >
          {children}
        </div>

        {/* AI Coach panel (slide in from right) */}
        {isExpanded && isActive && (
          <div className="w-1/2 min-w-[300px] max-w-[450px] border-l border-[var(--border-hairline)]">
            <AICoachPanel
              trade={trade}
              sessionId={state.sessionId}
              coachingMode={state.coachingMode}
              latestResponse={state.latestResponse}
              isLoading={state.isLoading}
              isProcessing={isProcessing}
              error={state.error}
              updateCount={state.updateCount}
              tokensUsed={state.tokensUsed}
              startTime={state.startTime}
              onClose={handleClose}
              onRefresh={refresh}
              onAsk={ask}
              onEndSession={handleEndSession}
              voiceEnabled={voiceEnabled}
              onToggleVoice={handleToggleVoice}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default AICoachWrapper;
