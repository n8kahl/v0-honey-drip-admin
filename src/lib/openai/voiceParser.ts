/**
 * OpenAI-powered voice command parser
 * Uses GPT-4 to parse natural language into structured trading commands
 */

import OpenAI from "openai";
import type { ParsedVoiceAction } from "../../hooks/useVoiceCommands";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Required for client-side usage
});

const SYSTEM_PROMPT = `You are a trading voice command parser. Convert natural language into structured trading commands.

Available actions:
- add-ticker: Add ticker to watchlist (e.g., "add google", "add TSLA to watchlist")
- remove-ticker: Remove from watchlist (e.g., "remove spy")
- enter-trade: Enter a new trade (e.g., "enter spy", "buy tesla calls")
- trim-trade: Take partial profits (e.g., "trim spy", "take profits on qqq")
- exit-trade: Exit full position (e.g., "exit spy", "close my tesla position")
- update-stop-loss: Update stop loss (e.g., "move stop to 15.50", "stop loss at break even")
- add-position: Add to existing position (e.g., "add to spy", "scale into qqq")
- navigate: Navigate to different tab (e.g., "go to settings", "show history")

Ticker aliases:
- google/alphabet → GOOGL
- tesla → TSLA
- apple → AAPL
- amazon → AMZN
- microsoft → MSFT
- meta/facebook → META
- nvidia → NVDA
- spy/spiders → SPY
- qqq/nasdaq → QQQ

Context extraction (preserve these phrases):
- Sizing: "size lightly", "size up", "full position", "starter position"
- Levels: "at resistance", "near support", "at vwap", "breaking out"
- Timing: "quick scalp", "day trade", "swing position"
- Technical: "oversold", "overbought", "high volume"

Return JSON with this structure:
{
  "actions": [
    {
      "type": "add-ticker" | "enter-trade" | "trim-trade" | "exit-trade" | "update-stop-loss" | "add-position" | "remove-ticker" | "navigate",
      "ticker": "SPY" (uppercase, use alias mapping),
      "context": "size lightly" (preserve natural language context),
      "breakEven": true (only for stop-loss commands),
      "destination": "settings" (only for navigate),
      "waitForPrevious": true (if this action needs the previous action to fully complete)
    }
  ]
}

Examples:
"add google to watchlist and enter a trade" → 
{
  "actions": [
    {"type": "add-ticker", "ticker": "GOOGL"},
    {"type": "enter-trade", "ticker": "GOOGL", "waitForPrevious": true}
  ]
}

"enter spy at resistance with light size" →
{
  "actions": [
    {"type": "enter-trade", "ticker": "SPY", "context": "at resistance with light size"}
  ]
}

"take profits on tesla and move stop to break even" →
{
  "actions": [
    {"type": "trim-trade", "ticker": "TSLA"},
    {"type": "update-stop-loss", "ticker": "TSLA", "breakEven": true, "waitForPrevious": true}
  ]
}

"go to settings" →
{
  "actions": [
    {"type": "navigate", "destination": "settings"}
  ]
}

IMPORTANT: Always return valid JSON. If the command is unclear, return a single action with type "unknown".`;

interface OpenAIVoiceAction {
  type: string;
  ticker?: string;
  context?: string;
  breakEven?: boolean;
  destination?: string;
  waitForPrevious?: boolean;
}

interface OpenAIResponse {
  actions: OpenAIVoiceAction[];
}

/**
 * Parse voice transcript using OpenAI GPT-4
 */
export async function parseVoiceWithOpenAI(transcript: string): Promise<ParsedVoiceAction | null> {
  try {
    console.warn("[v0] OpenAI: Parsing transcript:", transcript);

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent parsing
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[v0] OpenAI: No response content");
      return null;
    }

    const parsed: OpenAIResponse = JSON.parse(content);
    console.warn("[v0] OpenAI: Parsed actions:", parsed.actions);

    // Convert OpenAI actions to ParsedVoiceAction format
    if (!parsed.actions || parsed.actions.length === 0) {
      return { type: "unknown", ticker: "", price: 0 };
    }

    // If single action, return it directly
    if (parsed.actions.length === 1) {
      return convertToVoiceAction(parsed.actions[0]);
    }

    // If multiple actions, create compound command
    const subActions = parsed.actions.map(convertToVoiceAction);
    return {
      type: "compound",
      subActions,
      ticker: subActions[0].ticker || "",
      price: 0,
    };
  } catch (error) {
    console.error("[v0] OpenAI parsing failed:", error);
    return null;
  }
}

/**
 * Convert OpenAI action to ParsedVoiceAction
 */
function convertToVoiceAction(action: OpenAIVoiceAction): ParsedVoiceAction {
  const baseAction: ParsedVoiceAction = {
    type: action.type as ParsedVoiceAction["type"],
    ticker: action.ticker || "",
    price: 0,
  };

  if (action.context) {
    baseAction.extractedContext = action.context;
  }

  if (action.breakEven) {
    baseAction.breakEvenStop = true;
  }

  if (action.destination) {
    baseAction.destination = action.destination as
      | "live"
      | "active"
      | "history"
      | "settings"
      | "monitoring";
  }

  return baseAction;
}

/**
 * Check if OpenAI is available
 */
export function isOpenAIAvailable(): boolean {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
}
