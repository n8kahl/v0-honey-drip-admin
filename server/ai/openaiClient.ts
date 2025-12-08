/**
 * OpenAI Client - Handles API calls to OpenAI for coaching responses
 *
 * Uses GPT-4 Turbo for fast, cost-effective coaching responses.
 * Handles structured JSON output parsing and error recovery.
 */

import OpenAI from "openai";
import { CoachingResponse, Recommendation, RiskFlag } from "./types.js";

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Model configuration
const MODEL = "gpt-4-turbo-preview"; // Fast, capable, cost-effective
const MAX_TOKENS = 500;
const TEMPERATURE = 0.7; // Slight creativity for natural voice

export interface OpenAICoachingRequest {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface OpenAICoachingResult {
  response: CoachingResponse;
  tokensUsed: number;
  latencyMs: number;
}

/**
 * Get a coaching response from OpenAI
 */
export async function getCoachingResponse(
  request: OpenAICoachingRequest
): Promise<OpenAICoachingResult> {
  const openai = getOpenAI();
  const startTime = Date.now();

  // Build messages array
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: request.systemPrompt },
  ];

  // Add conversation history if provided
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    messages.push(...request.conversationHistory);
  }

  // Add current user message
  messages.push({ role: "user", content: request.userMessage });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      response_format: { type: "json_object" },
    });

    const latencyMs = Date.now() - startTime;
    const tokensUsed =
      (completion.usage?.prompt_tokens || 0) + (completion.usage?.completion_tokens || 0);

    // Parse the response
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    const response = parseCoachingResponse(content);

    console.log(
      `[OpenAI] Coaching response generated in ${latencyMs}ms, ` +
        `tokens: ${tokensUsed}, confidence: ${response.confidence}`
    );

    return {
      response,
      tokensUsed,
      latencyMs,
    };
  } catch (error) {
    console.error("[OpenAI] Error getting coaching response:", error);

    // Return a fallback response
    return {
      response: createFallbackResponse(error),
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Get a response to a user question
 */
export async function getQuestionResponse(
  systemPrompt: string,
  questionPrompt: string,
  conversationHistory: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<OpenAICoachingResult> {
  return getCoachingResponse({
    systemPrompt,
    userMessage: questionPrompt,
    conversationHistory,
  });
}

/**
 * Parse the JSON response from OpenAI
 */
function parseCoachingResponse(content: string): CoachingResponse {
  try {
    const parsed = JSON.parse(content);

    // Validate and extract fields with defaults
    const response: CoachingResponse = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "Analysis complete.",

      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(parseRecommendation)
        : [],

      riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags.filter(isValidRiskFlag) : [],

      confidence:
        typeof parsed.confidence === "number" ? Math.min(100, Math.max(0, parsed.confidence)) : 70,

      shouldSpeak: typeof parsed.shouldSpeak === "boolean" ? parsed.shouldSpeak : true,

      trigger: "MANUAL_REFRESH", // Will be set by caller
      timestamp: new Date().toISOString(),
    };

    return response;
  } catch (error) {
    console.error("[OpenAI] Failed to parse response:", error, content);
    return createFallbackResponse(new Error("Failed to parse AI response"));
  }
}

/**
 * Parse a recommendation object
 */
function parseRecommendation(rec: unknown): Recommendation {
  if (typeof rec !== "object" || rec === null) {
    return {
      action: "hold",
      details: {},
      reason: "Unable to parse recommendation",
      urgency: 2,
    };
  }

  const r = rec as Record<string, unknown>;

  return {
    action: isValidAction(r.action) ? r.action : "hold",
    details:
      typeof r.details === "object" && r.details !== null
        ? (r.details as Record<string, unknown>)
        : {},
    reason: typeof r.reason === "string" ? r.reason : "No reason provided",
    urgency:
      typeof r.urgency === "number"
        ? (Math.min(5, Math.max(1, r.urgency)) as 1 | 2 | 3 | 4 | 5)
        : 2,
  };
}

/**
 * Check if a string is a valid recommendation action
 */
function isValidAction(action: unknown): action is Recommendation["action"] {
  const validActions = [
    "scale_out",
    "trail_stop",
    "move_to_be",
    "hold",
    "take_profit",
    "watch_level",
    "reduce_size",
    "exit",
    "add_position",
    "tighten_stop",
    "widen_stop",
  ];
  return typeof action === "string" && validActions.includes(action);
}

/**
 * Check if a string is a valid risk flag
 */
function isValidRiskFlag(flag: unknown): flag is RiskFlag {
  const validFlags = [
    "extended_move",
    "approaching_stop",
    "approaching_target",
    "volume_fading",
    "volume_spike_against",
    "theta_decay",
    "spread_widening",
    "event_imminent",
    "momentum_stall",
    "regime_unfavorable",
    "iv_elevated",
    "iv_crushed",
    "earnings_risk",
    "time_in_trade",
  ];
  return typeof flag === "string" && validFlags.includes(flag);
}

/**
 * Create a fallback response when OpenAI fails
 */
function createFallbackResponse(error: unknown): CoachingResponse {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  return {
    summary: "Unable to generate AI analysis. Please check manually.",
    recommendations: [
      {
        action: "hold",
        details: {},
        reason: `AI temporarily unavailable: ${errorMessage}`,
        urgency: 2,
      },
    ],
    riskFlags: [],
    confidence: 0,
    shouldSpeak: false,
    trigger: "MANUAL_REFRESH",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Test the OpenAI connection
 */
export async function testOpenAIConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}> {
  if (!isOpenAIConfigured()) {
    return {
      success: false,
      latencyMs: 0,
      error: "OPENAI_API_KEY not configured",
    };
  }

  const startTime = Date.now();

  try {
    const openai = getOpenAI();
    await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: 'Say "OK"' }],
      max_tokens: 5,
    });

    return {
      success: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
