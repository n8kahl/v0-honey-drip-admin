/**
 * AI Coach API Routes
 *
 * Endpoints for the Drip Coach AI trading assistant:
 * - POST /api/ai/coach/start - Start a coaching session
 * - POST /api/ai/coach/update - Update with new market data
 * - POST /api/ai/coach/refresh/:sessionId - Force a refresh
 * - POST /api/ai/coach/ask - Ask a question
 * - POST /api/ai/coach/end/:sessionId - End a session
 * - GET /api/ai/coach/status/:sessionId - Get session status
 * - GET /api/ai/coach/health - Health check
 */

import { Router, Request, Response } from "express";
import { getDripCoachService } from "../ai/DripCoachService.js";
import { testOpenAIConnection, isOpenAIConfigured } from "../ai/openaiClient.js";
import { StartSessionRequest, CoachingMode, Direction, TradeType } from "../ai/types.js";
import {
  TradeInput,
  MarketInput,
  GreeksInput,
  EconomicInput,
  ContextInput,
} from "../ai/SnapshotBuilder.js";

const router = Router();

// ============= Validation Helpers =============

function isValidCoachingMode(mode: unknown): mode is CoachingMode {
  return typeof mode === "string" && ["scalp", "day", "swing", "leap"].includes(mode);
}

function isValidDirection(dir: unknown): dir is Direction {
  return typeof dir === "string" && ["LONG", "SHORT"].includes(dir);
}

function isValidTradeType(type: unknown): type is TradeType {
  return typeof type === "string" && ["Scalp", "Day", "Swing", "LEAP"].includes(type);
}

// ============= Routes =============

/**
 * Health check for AI service
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const configured = isOpenAIConfigured();

    if (!configured) {
      return res.json({
        status: "unconfigured",
        message: "OpenAI API key not set",
        configured: false,
      });
    }

    const testResult = await testOpenAIConnection();

    return res.json({
      status: testResult.success ? "healthy" : "error",
      configured: true,
      latencyMs: testResult.latencyMs,
      error: testResult.error,
    });
  } catch (error) {
    console.error("[AI Routes] Health check failed:", error);
    return res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Start a new coaching session
 */
router.post("/coach/start", async (req: Request, res: Response) => {
  try {
    const { tradeId, coachingMode, tradeData } = req.body;

    // Validate required fields
    if (!tradeId || typeof tradeId !== "string") {
      return res.status(400).json({ error: "tradeId is required" });
    }

    if (!isValidCoachingMode(coachingMode)) {
      return res.status(400).json({
        error: "Invalid coachingMode. Must be: scalp, day, swing, or leap",
      });
    }

    if (!tradeData || typeof tradeData !== "object") {
      return res.status(400).json({ error: "tradeData is required" });
    }

    // Validate trade data
    const { symbol, underlying, direction, tradeType, dte, entryPrice, stopPrice, targets } =
      tradeData;

    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "tradeData.symbol is required" });
    }

    if (!isValidDirection(direction)) {
      return res.status(400).json({ error: "Invalid direction. Must be LONG or SHORT" });
    }

    if (!isValidTradeType(tradeType)) {
      return res.status(400).json({ error: "Invalid tradeType" });
    }

    if (typeof entryPrice !== "number" || typeof stopPrice !== "number") {
      return res.status(400).json({ error: "entryPrice and stopPrice must be numbers" });
    }

    if (!targets || typeof targets.t1 !== "number") {
      return res.status(400).json({ error: "targets.t1 is required" });
    }

    // Get user ID from auth (placeholder - implement based on your auth)
    const userId = (req as any).userId || "anonymous";

    const service = getDripCoachService();

    const request: StartSessionRequest = {
      tradeId,
      coachingMode,
      tradeData: {
        symbol,
        underlying: underlying || symbol,
        direction,
        tradeType,
        dte: typeof dte === "number" ? dte : 0,
        strike: tradeData.strike,
        optionType: tradeData.optionType,
        contractSymbol: tradeData.contractSymbol,
        entryPrice,
        stopPrice,
        targets,
      },
    };

    const result = await service.startSession(userId, request);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[AI Routes] Start session failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to start session",
    });
  }
});

/**
 * Update a session with new market data
 */
router.post("/coach/update", async (req: Request, res: Response) => {
  try {
    const { sessionId, trade, market, greeks, economic, context } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId is required" });
    }

    if (!trade || !market) {
      return res.status(400).json({ error: "trade and market data are required" });
    }

    const service = getDripCoachService();

    const result = await service.updateSession(
      sessionId,
      trade as TradeInput,
      market as MarketInput,
      greeks as GreeksInput | undefined,
      economic as EconomicInput | undefined,
      context as ContextInput | undefined
    );

    return res.json({
      success: true,
      triggered: result.triggered,
      reason: result.reason,
      response: result.response,
    });
  } catch (error) {
    console.error("[AI Routes] Update session failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update session",
    });
  }
});

/**
 * Force a refresh (manual trigger)
 */
router.post("/coach/refresh/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { trade, market, greeks, economic, context } = req.body;

    if (!trade || !market) {
      return res.status(400).json({ error: "trade and market data are required" });
    }

    const service = getDripCoachService();

    const response = await service.forceRefresh(
      sessionId,
      trade as TradeInput,
      market as MarketInput,
      greeks as GreeksInput | undefined,
      economic as EconomicInput | undefined,
      context as ContextInput | undefined
    );

    if (!response) {
      return res.status(404).json({ error: "Session not found or inactive" });
    }

    return res.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("[AI Routes] Refresh failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to refresh",
    });
  }
});

/**
 * Ask a question during a session
 */
router.post("/coach/ask", async (req: Request, res: Response) => {
  try {
    const { sessionId, question, trade, market, greeks } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId is required" });
    }

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question is required" });
    }

    if (!trade || !market) {
      return res.status(400).json({ error: "trade and market data are required" });
    }

    const service = getDripCoachService();

    const response = await service.askQuestion(
      sessionId,
      question,
      trade as TradeInput,
      market as MarketInput,
      greeks as GreeksInput | undefined
    );

    if (!response) {
      return res.status(404).json({ error: "Session not found or inactive" });
    }

    return res.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error("[AI Routes] Ask question failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process question",
    });
  }
});

/**
 * End a coaching session
 */
router.post("/coach/end/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const service = getDripCoachService();
    const summary = service.endSession(sessionId, reason);

    if (!summary) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("[AI Routes] End session failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to end session",
    });
  }
});

/**
 * Get session status
 */
router.get("/coach/status/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = getDripCoachService();
    const status = service.getSessionStatus(sessionId);

    if (!status) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("[AI Routes] Get status failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get status",
    });
  }
});

/**
 * Get session by trade ID
 */
router.get("/coach/trade/:tradeId", async (req: Request, res: Response) => {
  try {
    const { tradeId } = req.params;

    const service = getDripCoachService();
    const session = service.getSessionByTrade(tradeId);

    if (!session) {
      return res.json({
        success: true,
        hasSession: false,
        session: null,
      });
    }

    return res.json({
      success: true,
      hasSession: true,
      session: {
        sessionId: session.sessionId,
        coachingMode: session.coachingMode,
        status: session.status,
        updateCount: session.updateCount,
        tokensUsed: session.tokensUsed,
        startTime: new Date(session.startTime).toISOString(),
      },
    });
  } catch (error) {
    console.error("[AI Routes] Get session by trade failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get session",
    });
  }
});

export default router;
