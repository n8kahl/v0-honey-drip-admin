/**
 * SessionManager - Manages AI coaching sessions
 *
 * Handles session lifecycle:
 * - Creating new sessions per trade
 * - Tracking update counts and token usage
 * - Enforcing rate limits and cooldowns
 * - Managing trigger cooldowns
 * - Auto-cleanup of expired sessions
 */

import {
  CoachingSession,
  CoachingMode,
  CoachingLimits,
  CoachingResponse,
  SessionSummary,
  TriggerType,
  DripCoachSnapshot,
  DEFAULT_COACHING_CONFIG,
  Direction,
  TradeType,
} from "./types.js";
import { randomUUID } from "crypto";

// Cost per 1K tokens (GPT-4 Turbo pricing)
const COST_PER_1K_INPUT_TOKENS = 0.01;
const COST_PER_1K_OUTPUT_TOKENS = 0.03;
const AVG_OUTPUT_TOKENS_PER_UPDATE = 200;

export class SessionManager {
  private sessions: Map<string, CoachingSession> = new Map();
  private sessionsByTrade: Map<string, string> = new Map(); // tradeId -> sessionId
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Create a new coaching session for a trade
   */
  createSession(
    tradeId: string,
    userId: string,
    mode: CoachingMode,
    tradeData: {
      symbol: string;
      underlying: string;
      direction: Direction;
      tradeType: TradeType;
      dte: number;
      entryPrice: number;
      stopPrice: number;
    }
  ): CoachingSession {
    // Check if there's already an active session for this trade
    const existingSessionId = this.sessionsByTrade.get(tradeId);
    if (existingSessionId) {
      const existingSession = this.sessions.get(existingSessionId);
      if (existingSession && existingSession.status === "active") {
        // End the existing session first
        this.endSession(existingSessionId, "new_session_started");
      }
    }

    const sessionId = randomUUID();
    const limits = this.getLimitsForMode(mode);
    const now = Date.now();

    const session: CoachingSession = {
      sessionId,
      tradeId,
      userId,
      coachingMode: mode,

      // Limits
      maxUpdates: limits.maxUpdatesPerSession,
      maxDurationMs: limits.maxSessionDurationMs,
      updateCooldownMs: limits.minUpdateIntervalMs,

      // State
      updateCount: 0,
      tokensUsed: 0,
      startTime: now,
      lastUpdateTime: 0,
      lastSnapshot: undefined,
      lastRMultiple: undefined,

      // Conversation context
      conversationHistory: [],

      // Trigger cooldowns
      triggerCooldowns: new Map(),

      // Status
      status: "active",
    };

    this.sessions.set(sessionId, session);
    this.sessionsByTrade.set(tradeId, sessionId);

    console.log(
      `[SessionManager] Created session ${sessionId} for trade ${tradeId} in ${mode} mode`
    );
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): CoachingSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get session by trade ID
   */
  getSessionByTrade(tradeId: string): CoachingSession | null {
    const sessionId = this.sessionsByTrade.get(tradeId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Check if an update is allowed
   */
  canUpdate(sessionId: string): { allowed: boolean; reason?: string } {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { allowed: false, reason: "Session not found" };
    }

    if (session.status !== "active") {
      return { allowed: false, reason: `Session is ${session.status}` };
    }

    const now = Date.now();

    // Check session duration
    if (now - session.startTime > session.maxDurationMs) {
      this.endSession(sessionId, "max_duration_exceeded");
      return { allowed: false, reason: "Session duration exceeded" };
    }

    // Check update count
    if (session.updateCount >= session.maxUpdates) {
      this.endSession(sessionId, "max_updates_exceeded");
      return { allowed: false, reason: "Maximum updates reached" };
    }

    // Check cooldown (skip for first update)
    if (session.lastUpdateTime > 0) {
      const timeSinceLastUpdate = now - session.lastUpdateTime;
      if (timeSinceLastUpdate < session.updateCooldownMs) {
        const remainingCooldown = Math.ceil(
          (session.updateCooldownMs - timeSinceLastUpdate) / 1000
        );
        return { allowed: false, reason: `Cooldown active: ${remainingCooldown}s remaining` };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if a specific trigger can fire (respects trigger-specific cooldowns)
   */
  canTrigger(sessionId: string, triggerType: TriggerType, cooldownSeconds: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const now = Date.now();
    const lastTriggerTime = session.triggerCooldowns.get(triggerType) || 0;
    const cooldownMs = cooldownSeconds * 1000;

    return now - lastTriggerTime >= cooldownMs;
  }

  /**
   * Record that a trigger has fired
   */
  recordTrigger(sessionId: string, triggerType: TriggerType): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.triggerCooldowns.set(triggerType, Date.now());
  }

  /**
   * Update session after a coaching response
   */
  updateSession(
    sessionId: string,
    response: CoachingResponse,
    tokensUsed: number,
    snapshot: DripCoachSnapshot
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.updateCount++;
    session.tokensUsed += tokensUsed;
    session.lastUpdateTime = Date.now();
    session.lastSnapshot = snapshot;
    session.lastRMultiple = snapshot.position.rMultiple;

    // Add to conversation history (keep last 5 exchanges)
    session.conversationHistory.push({
      role: "assistant",
      content: response.summary,
    });

    // Trim history to last 10 messages
    if (session.conversationHistory.length > 10) {
      session.conversationHistory = session.conversationHistory.slice(-10);
    }

    console.log(
      `[SessionManager] Session ${sessionId} update #${session.updateCount}, ` +
        `tokens: ${tokensUsed}, total: ${session.tokensUsed}`
    );
  }

  /**
   * Add a user question to the conversation
   */
  addUserQuestion(sessionId: string, question: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.conversationHistory.push({
      role: "user",
      content: question,
    });
  }

  /**
   * End a session
   */
  endSession(sessionId: string, reason?: string): SessionSummary | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.status = "ended";
    session.endReason = reason;

    const summary: SessionSummary = {
      sessionId,
      tradeId: session.tradeId,
      duration: Date.now() - session.startTime,
      updateCount: session.updateCount,
      tokensUsed: session.tokensUsed,
      estimatedCost: this.calculateCost(session.tokensUsed),
      triggers: Array.from(session.triggerCooldowns.keys()),
      finalRMultiple: session.lastRMultiple,
    };

    console.log(
      `[SessionManager] Session ${sessionId} ended. ` +
        `Reason: ${reason || "manual"}, Updates: ${summary.updateCount}, ` +
        `Cost: $${summary.estimatedCost.toFixed(4)}`
    );

    // Remove from trade mapping
    this.sessionsByTrade.delete(session.tradeId);

    // Keep session in memory for a bit for summary retrieval
    setTimeout(
      () => {
        this.sessions.delete(sessionId);
      },
      5 * 60 * 1000
    ); // 5 minutes

    return summary;
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): {
    active: boolean;
    updateCount: number;
    tokensUsed: number;
    maxUpdatesRemaining: number;
    sessionDurationMs: number;
    lastUpdateTime?: string;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      active: session.status === "active",
      updateCount: session.updateCount,
      tokensUsed: session.tokensUsed,
      maxUpdatesRemaining: session.maxUpdates - session.updateCount,
      sessionDurationMs: Date.now() - session.startTime,
      lastUpdateTime:
        session.lastUpdateTime > 0 ? new Date(session.lastUpdateTime).toISOString() : undefined,
    };
  }

  /**
   * Get all active sessions for a user
   */
  getActiveSessionsForUser(userId: string): CoachingSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId && s.status === "active"
    );
  }

  /**
   * Pause a session
   */
  pauseSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") return false;

    session.status = "paused";
    console.log(`[SessionManager] Session ${sessionId} paused`);
    return true;
  }

  /**
   * Resume a paused session
   */
  resumeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "paused") return false;

    // Check if session hasn't expired
    const now = Date.now();
    if (now - session.startTime > session.maxDurationMs) {
      this.endSession(sessionId, "max_duration_exceeded");
      return false;
    }

    session.status = "active";
    console.log(`[SessionManager] Session ${sessionId} resumed`);
    return true;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.status === "active") {
        // Check if session has exceeded max duration
        if (now - session.startTime > session.maxDurationMs) {
          this.endSession(sessionId, "max_duration_exceeded");
          cleaned++;
        }
      } else if (session.status === "ended") {
        // Remove ended sessions older than 10 minutes
        if (now - session.lastUpdateTime > 10 * 60 * 1000) {
          this.sessions.delete(sessionId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionManager] Cleaned up ${cleaned} sessions`);
    }
  }

  /**
   * Get limits for a coaching mode
   */
  private getLimitsForMode(mode: CoachingMode): CoachingLimits {
    return DEFAULT_COACHING_CONFIG[mode];
  }

  /**
   * Calculate estimated cost from tokens used
   */
  private calculateCost(tokensUsed: number): number {
    // Assume 70% input tokens, 30% output tokens
    const inputTokens = tokensUsed * 0.7;
    const outputTokens = tokensUsed * 0.3;

    return (
      (inputTokens / 1000) * COST_PER_1K_INPUT_TOKENS +
      (outputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS
    );
  }

  /**
   * Shutdown - clean up interval
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
