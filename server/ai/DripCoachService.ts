/**
 * DripCoachService - Main orchestrator for AI trade coaching
 *
 * Coordinates:
 * - Session management
 * - Snapshot building
 * - Trigger evaluation
 * - Prompt construction
 * - OpenAI API calls
 *
 * Provides the main API for frontend integration.
 */

import { getSessionManager, SessionManager } from "./SessionManager.js";
import {
  getSnapshotBuilder,
  SnapshotBuilder,
  SnapshotBuilderInput,
  TradeInput,
  MarketInput,
  GreeksInput,
  EconomicInput,
  ContextInput,
} from "./SnapshotBuilder.js";
import { getTriggerEngine, TriggerEngine } from "./TriggerEngine.js";
import { getPromptBuilder, PromptBuilder } from "./PromptBuilder.js";
import { getCoachingResponse, getQuestionResponse, isOpenAIConfigured } from "./openaiClient.js";
import {
  CoachingSession,
  CoachingMode,
  CoachingResponse,
  DripCoachSnapshot,
  StartSessionRequest,
  StartSessionResponse,
  AskQuestionResponse,
  SessionStatusResponse,
  SessionSummary,
  TriggerResult,
  DEFAULT_COACHING_CONFIG,
} from "./types.js";

export class DripCoachService {
  private sessionManager: SessionManager;
  private snapshotBuilder: SnapshotBuilder;
  private triggerEngine: TriggerEngine;
  private promptBuilder: PromptBuilder;

  constructor() {
    this.sessionManager = getSessionManager();
    this.snapshotBuilder = getSnapshotBuilder();
    this.triggerEngine = getTriggerEngine();
    this.promptBuilder = getPromptBuilder();
  }

  /**
   * Start a new coaching session for a trade
   */
  async startSession(userId: string, request: StartSessionRequest): Promise<StartSessionResponse> {
    // Check OpenAI configuration
    if (!isOpenAIConfigured()) {
      throw new Error("OpenAI API key not configured");
    }

    const { tradeId, coachingMode, tradeData } = request;

    // Create session
    const session = this.sessionManager.createSession(tradeId, userId, coachingMode, {
      symbol: tradeData.symbol,
      underlying: tradeData.underlying,
      direction: tradeData.direction,
      tradeType: tradeData.tradeType,
      dte: tradeData.dte,
      entryPrice: tradeData.entryPrice,
      stopPrice: tradeData.stopPrice,
    });

    // Build initial snapshot (with minimal market data - will be updated)
    const tradeInput: TradeInput = {
      tradeId,
      symbol: tradeData.symbol,
      underlying: tradeData.underlying,
      direction: tradeData.direction,
      tradeType: tradeData.tradeType,
      dte: tradeData.dte,
      strike: tradeData.strike,
      optionType: tradeData.optionType,
      contractSymbol: tradeData.contractSymbol,
      entryPrice: tradeData.entryPrice,
      entryTime: new Date().toISOString(),
      stopPrice: tradeData.stopPrice,
      targets: tradeData.targets,
    };

    // Generate initial analysis
    const initialResponse = await this.generateInitialAnalysis(session, tradeInput);

    return {
      sessionId: session.sessionId,
      initialAnalysis: initialResponse,
      limits: DEFAULT_COACHING_CONFIG[coachingMode],
    };
  }

  /**
   * Update a session with new market data and check for triggers
   */
  async updateSession(
    sessionId: string,
    trade: TradeInput,
    market: MarketInput,
    greeks?: GreeksInput,
    economic?: EconomicInput,
    context?: ContextInput
  ): Promise<{ response: CoachingResponse | null; triggered: boolean; reason?: string }> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return { response: null, triggered: false, reason: "Session not found" };
    }

    // Check if update is allowed
    const canUpdate = this.sessionManager.canUpdate(sessionId);
    if (!canUpdate.allowed) {
      return { response: null, triggered: false, reason: canUpdate.reason };
    }

    // Build snapshot
    const snapshotInput: SnapshotBuilderInput = {
      trade,
      market,
      greeks,
      economic,
      context,
      sessionId,
      coachingMode: session.coachingMode,
      updateCount: session.updateCount,
      maxUpdates: session.maxUpdates,
      tokensUsed: session.tokensUsed,
      sessionStartTime: new Date(session.startTime).toISOString(),
    };

    const snapshot = this.snapshotBuilder.build(snapshotInput);

    // Evaluate triggers
    const trigger = this.triggerEngine.evaluateTriggers(
      session.coachingMode,
      snapshot,
      session.lastSnapshot,
      (type, cooldown) => this.sessionManager.canTrigger(sessionId, type, cooldown)
    );

    if (!trigger) {
      return { response: null, triggered: false, reason: "No trigger fired" };
    }

    // Generate coaching response
    const response = await this.generateCoachingResponse(session, snapshot, trigger);

    // Update session
    this.sessionManager.updateSession(sessionId, response, response.confidence, snapshot);
    this.sessionManager.recordTrigger(sessionId, trigger.type);

    return { response, triggered: true };
  }

  /**
   * Force a refresh (manual trigger)
   */
  async forceRefresh(
    sessionId: string,
    trade: TradeInput,
    market: MarketInput,
    greeks?: GreeksInput,
    economic?: EconomicInput,
    context?: ContextInput
  ): Promise<CoachingResponse | null> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return null;
    }

    // Check if update is allowed (skip cooldown for manual refresh)
    if (session.status !== "active") {
      return null;
    }

    if (session.updateCount >= session.maxUpdates) {
      return null;
    }

    // Build snapshot
    const snapshotInput: SnapshotBuilderInput = {
      trade,
      market,
      greeks,
      economic,
      context,
      sessionId,
      coachingMode: session.coachingMode,
      updateCount: session.updateCount,
      maxUpdates: session.maxUpdates,
      tokensUsed: session.tokensUsed,
      sessionStartTime: new Date(session.startTime).toISOString(),
    };

    const snapshot = this.snapshotBuilder.build(snapshotInput);

    // Create manual trigger
    const trigger: TriggerResult = {
      triggered: true,
      type: "MANUAL_REFRESH",
      priority: 3,
      reason: "Manual refresh requested",
    };

    // Generate response
    const response = await this.generateCoachingResponse(session, snapshot, trigger);

    // Update session
    this.sessionManager.updateSession(sessionId, response, response.confidence, snapshot);

    return response;
  }

  /**
   * Ask a question during a session
   */
  async askQuestion(
    sessionId: string,
    question: string,
    trade: TradeInput,
    market: MarketInput,
    greeks?: GreeksInput
  ): Promise<AskQuestionResponse | null> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || session.status !== "active") {
      return null;
    }

    // Build a current snapshot for context
    const snapshotInput: SnapshotBuilderInput = {
      trade,
      market,
      greeks,
      sessionId,
      coachingMode: session.coachingMode,
      updateCount: session.updateCount,
      maxUpdates: session.maxUpdates,
      tokensUsed: session.tokensUsed,
      sessionStartTime: new Date(session.startTime).toISOString(),
    };

    const snapshot = this.snapshotBuilder.build(snapshotInput);

    // Build prompts
    const systemPrompt = this.promptBuilder.buildSystemPrompt(session.coachingMode);
    const questionPrompt = this.promptBuilder.buildQuestionPrompt(question, snapshot);

    // Add question to conversation history
    this.sessionManager.addUserQuestion(sessionId, question);

    // Get response
    const result = await getQuestionResponse(
      systemPrompt,
      questionPrompt,
      session.conversationHistory
    );

    return {
      answer: result.response.summary,
      recommendations: result.response.recommendations,
      tokensUsed: result.tokensUsed,
    };
  }

  /**
   * End a coaching session
   */
  endSession(sessionId: string, reason?: string): SessionSummary | null {
    return this.sessionManager.endSession(sessionId, reason || "user_ended");
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): SessionStatusResponse | null {
    return this.sessionManager.getSessionStatus(sessionId);
  }

  /**
   * Get session by trade ID
   */
  getSessionByTrade(tradeId: string): CoachingSession | null {
    return this.sessionManager.getSessionByTrade(tradeId);
  }

  /**
   * Check if OpenAI is configured
   */
  isConfigured(): boolean {
    return isOpenAIConfigured();
  }

  // ============= Private Methods =============

  private async generateInitialAnalysis(
    session: CoachingSession,
    trade: TradeInput
  ): Promise<CoachingResponse> {
    // Build a minimal snapshot for initial analysis
    const now = new Date();

    // Create minimal market data (will be replaced with real data)
    const minimalMarket: MarketInput = {
      lastPrice: trade.entryPrice,
      bid: trade.entryPrice - 0.01,
      ask: trade.entryPrice + 0.01,
      volume: 0,
      avgVolume: 1000000,
      vwap: trade.entryPrice,
      atr: Math.abs(trade.entryPrice - trade.stopPrice) * 0.5,
      rsi: 50,
      priorDayHigh: trade.entryPrice * 1.01,
      priorDayLow: trade.entryPrice * 0.99,
      priorDayClose: trade.entryPrice,
    };

    const snapshotInput: SnapshotBuilderInput = {
      trade,
      market: minimalMarket,
      sessionId: session.sessionId,
      coachingMode: session.coachingMode,
      updateCount: 0,
      maxUpdates: session.maxUpdates,
      tokensUsed: 0,
      sessionStartTime: now.toISOString(),
    };

    const snapshot = this.snapshotBuilder.build(snapshotInput);

    const trigger: TriggerResult = {
      triggered: true,
      type: "SESSION_START",
      priority: 3,
      reason: "New coaching session started",
    };

    return this.generateCoachingResponse(session, snapshot, trigger);
  }

  private async generateCoachingResponse(
    session: CoachingSession,
    snapshot: DripCoachSnapshot,
    trigger: TriggerResult
  ): Promise<CoachingResponse> {
    // Build prompts
    const systemPrompt = this.promptBuilder.buildSystemPrompt(session.coachingMode);
    const userMessage = this.promptBuilder.buildUserMessage(
      snapshot,
      trigger,
      session.conversationHistory
    );

    // Get response from OpenAI
    const result = await getCoachingResponse({
      systemPrompt,
      userMessage,
      conversationHistory: session.conversationHistory.slice(-6), // Keep last 6 messages
    });

    // Enhance response with trigger info
    const response: CoachingResponse = {
      ...result.response,
      trigger: trigger.type,
      timestamp: new Date().toISOString(),
    };

    return response;
  }
}

// Singleton instance
let dripCoachServiceInstance: DripCoachService | null = null;

export function getDripCoachService(): DripCoachService {
  if (!dripCoachServiceInstance) {
    dripCoachServiceInstance = new DripCoachService();
  }
  return dripCoachServiceInstance;
}
