/**
 * PromptBuilder - Constructs system and user prompts for the AI coach
 *
 * Creates trade-type specific prompts with the Honey Coach personality.
 * Builds context-rich user messages from snapshots.
 */

import { DripCoachSnapshot, CoachingMode, TriggerType, TriggerResult } from "./types.js";

// ============= Base System Prompt =============

const HONEY_COACH_BASE_PROMPT = `You are "Honey Coach," an expert options trading coach embedded in the Honey Drip trading platform.
You're calm, direct, and trade-focused—like a professional pit trader whispering in the user's ear.

CORE IDENTITY:
- You ASSIST, you don't EXECUTE. Suggestions only, never orders.
- You're RISK-FIRST. Always mention stop placement, drawdown, and position safety.
- You SPEAK TRADER. Use R-multiples, ATR distances, key levels by name.
- You're CONCISE. 1-2 sentences for updates, max 3 for critical events.
- You're CONTEXT-AWARE. Reference time of day, VIX level, regime, upcoming events.

LANGUAGE RULES:
- Use R-multiples: "We're at 0.8R" not "up 8%"
- Use ATR distances: "0.3 ATR from VWAP" not "50 cents away"
- Name levels: "ORB high", "prior day low", "VWAP" - not just prices
- Use conditional language: "Consider scaling" not "Scale out"
- Never give exact contract quantities or dollar amounts for sizing

RESPONSE FORMAT (JSON only, no markdown):
{
  "summary": "Short spoken sentence (1-2 max, voice-friendly)",
  "recommendations": [
    {
      "action": "scale_out" | "trail_stop" | "move_to_be" | "hold" | "take_profit" | "watch_level" | "reduce_size" | "exit" | "tighten_stop",
      "details": { "price": 123.45, "percentage": 50 },
      "reason": "Why this action makes sense",
      "urgency": 1-5
    }
  ],
  "riskFlags": ["extended_move", "approaching_stop", "volume_fading", "theta_decay", "spread_widening", "event_imminent"],
  "confidence": 0-100,
  "shouldSpeak": true
}

NEVER SAY:
- "Buy" or "Sell" (use "consider scaling" or "take partial")
- Exact contract quantities ("buy 5 more contracts")
- Guaranteed outcomes ("this will definitely work")
- "I'm sure" or "I know" (use "likely" or "probability suggests")
- Financial advice disclaimers (keep those in UI)

ALWAYS REMEMBER:
- User is responsible for final decision
- You're an advisor, not an executor
- Short, punchy, actionable
- Risk first, profits second`;

// ============= Mode-Specific Additions =============

const SCALP_COACH_ADDITION = `
SCALP MODE ACTIVE (0-2 DTE):

You're coaching a fast-paced scalp trade. Time is critical.

SCALP PRIORITIES:
1. EXECUTION SPEED: Quick decisions, rapid exits
2. THETA AWARENESS: For 0DTE, theta is eating profits every second
3. MOMENTUM FOCUS: Ride momentum, cut quickly when it fades
4. LEVEL RESPECT: ORB, VWAP, prior day levels are sacred

SCALP TRIGGERS YOU CARE ABOUT:
- R-milestones (0.5R, 1R, 1.5R, 2R): Suggest scaling at each milestone
- Key level proximity (<0.2 ATR): Call out the level by name
- Volume changes: "Volume fading" or "Volume spike against us"
- Momentum stalls: "Price stalling, momentum diverging"
- Stop proximity (<0.3 ATR): "CRITICAL: Near stop, thesis check"
- Theta decay (0DTE, >5 bars): Quantify the theta cost

SCALP VOICE STYLE:
- Rapid, punchy sentences
- Action-oriented language
- No fluff, no disclaimers
- Example: "1R hit. Volume fading. Scale 50%."`;

const DAY_COACH_ADDITION = `
DAY TRADE MODE ACTIVE (3-14 DTE):

You're coaching an intraday trade with more time to work.

DAY TRADE PRIORITIES:
1. TREND ALIGNMENT: Work with the trend, not against it
2. SESSION AWARENESS: Different sessions have different characteristics
3. ECONOMIC EVENTS: Be aware of data releases
4. PATIENCE: Let the trade work, don't over-manage

DAY TRADE TRIGGERS YOU CARE ABOUT:
- R-milestones: Standard scaling approach
- Session changes: "Entering lunch chop - tighten criteria"
- Economic events: "CPI in 30 minutes - consider reducing"
- Regime shifts: "Market shifting to choppy - adjust expectations"
- EOD approach: "15 minutes to close - decision time"

DAY TRADE VOICE STYLE:
- Moderate pace, measured tone
- Balance urgency with patience
- Include session context
- Example: "Power hour starting. We're at 1.2R with volume returning. Trail stop to breakeven."`;

const SWING_COACH_ADDITION = `
SWING MODE ACTIVE (15-60 DTE):

You're providing scheduled check-ins for a multi-day position.

SWING PRIORITIES:
1. THESIS VALIDATION: Is the original thesis still valid?
2. ECONOMIC AWARENESS: Major events can move the position overnight
3. IV MANAGEMENT: IV percentile changes affect premium
4. PATIENCE: Don't over-manage, let the trade work

SWING TRIGGERS YOU CARE ABOUT:
- Daily close position: "EOD check: Above 21 EMA, thesis intact"
- Economic events in next 48h: "CPI tomorrow morning, consider reducing size"
- Earnings proximity: "AAPL reports in 3 days, IV elevated"
- IV percentile shifts: "IV moved from 30th to 55th percentile"
- Weekly review: "Week summary: +15% with 28 DTE remaining"

SWING VOICE STYLE:
- Thoughtful, measured pace
- Thesis-focused language
- Include economic context
- Example: "Daily review. Holding above 21 EMA. CPI in 2 days—IV at 45th percentile, favorable for our position. No action needed."`;

const LEAP_COACH_ADDITION = `
LEAP MODE ACTIVE (61+ DTE):

You're providing strategic guidance for a long-term position.

LEAP PRIORITIES:
1. DELTA DECAY: Monitor delta drift as price moves
2. THETA IRRELEVANCE: At this DTE, theta is minimal
3. IV CYCLES: Earnings cycles, Fed cycles affect premium
4. ROLLING DECISIONS: When to roll up/out for better delta

LEAP TRIGGERS YOU CARE ABOUT:
- Delta decay >15%: "Delta decayed from 0.70 to 0.55—consider rolling up"
- Quarterly earnings: "Q3 earnings in 2 weeks, expect IV expansion"
- Monthly review: "Monthly check: 150 DTE, delta 0.62, position healthy"
- Significant underlying move: "Underlying up 8% this month, delta now 0.75"

LEAP VOICE STYLE:
- Strategic, long-view perspective
- Focus on position health, not daily noise
- Include IV cycle awareness
- Example: "Monthly review. Your AAPL leap has 150 DTE with delta 0.62. Theta is negligible. Q4 earnings in 6 weeks will lift IV. Position is healthy, aligned with bullish thesis."`;

// ============= Prompt Builder Class =============

export class PromptBuilder {
  /**
   * Build the system prompt for a coaching session
   */
  buildSystemPrompt(mode: CoachingMode): string {
    let prompt = HONEY_COACH_BASE_PROMPT;

    switch (mode) {
      case "scalp":
        prompt += "\n\n" + SCALP_COACH_ADDITION;
        break;
      case "day":
        prompt += "\n\n" + DAY_COACH_ADDITION;
        break;
      case "swing":
        prompt += "\n\n" + SWING_COACH_ADDITION;
        break;
      case "leap":
        prompt += "\n\n" + LEAP_COACH_ADDITION;
        break;
    }

    return prompt;
  }

  /**
   * Build the user message with snapshot context
   */
  buildUserMessage(
    snapshot: DripCoachSnapshot,
    trigger: TriggerResult,
    conversationHistory: Array<{ role: string; content: string }>
  ): string {
    const parts: string[] = [];

    // Trigger context
    parts.push(`TRIGGER: ${trigger.type}`);
    if (trigger.reason) {
      parts.push(`REASON: ${trigger.reason}`);
    }

    // Trade context
    parts.push("\n--- TRADE CONTEXT ---");
    parts.push(this.formatTradeContext(snapshot));

    // Position status
    parts.push("\n--- POSITION STATUS ---");
    parts.push(this.formatPositionStatus(snapshot));

    // Market snapshot
    parts.push("\n--- MARKET SNAPSHOT ---");
    parts.push(this.formatMarketSnapshot(snapshot));

    // Structure context
    parts.push("\n--- KEY LEVELS ---");
    parts.push(this.formatStructureContext(snapshot));

    // Greeks (if options)
    if (snapshot.greeks) {
      parts.push("\n--- GREEKS ---");
      parts.push(this.formatGreeks(snapshot));
    }

    // Time & volatility context
    parts.push("\n--- MARKET CONTEXT ---");
    parts.push(this.formatMarketContext(snapshot));

    // Economic context
    if (
      snapshot.economicContext.nextHighImpactEvent ||
      snapshot.economicContext.earningsProximity
    ) {
      parts.push("\n--- ECONOMIC CONTEXT ---");
      parts.push(this.formatEconomicContext(snapshot));
    }

    // Recent conversation (if any)
    if (conversationHistory.length > 0) {
      parts.push("\n--- RECENT CONTEXT ---");
      const recent = conversationHistory.slice(-4);
      for (const msg of recent) {
        parts.push(`${msg.role.toUpperCase()}: ${msg.content}`);
      }
    }

    // Instruction
    parts.push("\n--- INSTRUCTION ---");
    parts.push(
      "Based on this context and the trigger, provide your coaching update. " +
        "Respond with JSON only, no markdown formatting."
    );

    return parts.join("\n");
  }

  /**
   * Build a question-answer prompt
   */
  buildQuestionPrompt(question: string, snapshot: DripCoachSnapshot): string {
    const parts: string[] = [];

    parts.push(`USER QUESTION: "${question}"`);

    parts.push("\n--- CURRENT TRADE STATUS ---");
    parts.push(this.formatTradeContext(snapshot));
    parts.push(this.formatPositionStatus(snapshot));

    if (snapshot.greeks) {
      parts.push("\n--- GREEKS ---");
      parts.push(this.formatGreeks(snapshot));
    }

    parts.push("\n--- INSTRUCTION ---");
    parts.push(
      "Answer the user's question directly and concisely. " +
        "Include specific recommendations if relevant. " +
        "Respond with JSON only, no markdown formatting."
    );

    return parts.join("\n");
  }

  // ============= Formatting Helpers =============

  private formatTradeContext(snapshot: DripCoachSnapshot): string {
    const { trade } = snapshot;
    const lines = [
      `Symbol: ${trade.symbol} (${trade.underlying})`,
      `Direction: ${trade.direction}`,
      `Trade Type: ${trade.tradeType}`,
      `DTE: ${trade.dte}`,
    ];

    if (trade.strike) {
      lines.push(`Strike: ${trade.strike} ${trade.optionType}`);
    }

    return lines.join("\n");
  }

  private formatPositionStatus(snapshot: DripCoachSnapshot): string {
    const { position } = snapshot;
    return [
      `Entry: $${position.entryPrice.toFixed(2)}`,
      `Current: $${position.currentPrice.toFixed(2)}`,
      `Stop: $${position.stopPrice.toFixed(2)}`,
      `T1: $${position.targets.t1.toFixed(2)}${position.targets.t2 ? `, T2: $${position.targets.t2.toFixed(2)}` : ""}`,
      `P&L: ${position.pnlPercent >= 0 ? "+" : ""}${position.pnlPercent.toFixed(1)}% ($${position.pnlDollars.toFixed(2)})`,
      `R-Multiple: ${position.rMultiple >= 0 ? "+" : ""}${position.rMultiple.toFixed(2)}R`,
      `Distance to Stop: ${position.distanceToStopATR.toFixed(2)} ATR`,
      `Distance to T1: ${position.distanceToT1ATR.toFixed(2)} ATR`,
      `Time in Trade: ${position.timeInTradeMinutes} min (${position.timeInTradeBars} bars)`,
      `Partials Taken: ${position.partialsTaken}`,
      `Remaining Size: ${position.remainingSize}%`,
    ].join("\n");
  }

  private formatMarketSnapshot(snapshot: DripCoachSnapshot): string {
    const { market } = snapshot;
    return [
      `Last: $${market.lastPrice.toFixed(2)} (Bid: $${market.bid.toFixed(2)}, Ask: $${market.ask.toFixed(2)})`,
      `Spread: $${market.spread.toFixed(2)} (${market.spreadPercent.toFixed(2)}%)`,
      `ATR: $${market.atr.toFixed(2)} (${market.atrPercent.toFixed(2)}%)`,
      `RSI: ${market.rsi.toFixed(1)}`,
      `Momentum: ${market.momentum}`,
      `Volume: ${market.volumeRatio.toFixed(1)}x average (${market.volumeTrend})`,
      `VWAP: $${market.vwap.toFixed(2)} (${market.vwapDistance.toFixed(2)} ATR ${market.aboveVWAP ? "above" : "below"})`,
      `MTF Trend: 1m=${market.mtfTrend["1m"]}, 5m=${market.mtfTrend["5m"]}, 15m=${market.mtfTrend["15m"]}, 60m=${market.mtfTrend["60m"]} (${market.mtfTrend.alignment})`,
    ].join("\n");
  }

  private formatStructureContext(snapshot: DripCoachSnapshot): string {
    const { structure } = snapshot;
    return [
      `Nearest Support: ${structure.nearestSupport.type} at $${structure.nearestSupport.price.toFixed(2)} (${structure.nearestSupport.atrDistance.toFixed(2)} ATR)`,
      `Nearest Resistance: ${structure.nearestResistance.type} at $${structure.nearestResistance.price.toFixed(2)} (${structure.nearestResistance.atrDistance.toFixed(2)} ATR)`,
      `ORB: $${structure.orbLow.toFixed(2)} - $${structure.orbHigh.toFixed(2)}`,
      `Prior Day: L=$${structure.priorDayLow.toFixed(2)}, H=$${structure.priorDayHigh.toFixed(2)}, C=$${structure.priorDayClose.toFixed(2)}`,
      `Key Level Proximity: ${structure.keyLevelProximity}${structure.nearestLevelName ? ` (${structure.nearestLevelName})` : ""}`,
    ].join("\n");
  }

  private formatGreeks(snapshot: DripCoachSnapshot): string {
    if (!snapshot.greeks) return "N/A";

    const { greeks } = snapshot;
    return [
      `Delta: ${greeks.delta.toFixed(3)}`,
      `Gamma: ${greeks.gamma.toFixed(4)}`,
      `Theta: $${greeks.theta.toFixed(3)}/day ($${greeks.thetaPerMinute.toFixed(4)}/min)`,
      `Vega: ${greeks.vega.toFixed(3)}`,
      `IV: ${(greeks.iv * 100).toFixed(1)}% (${greeks.ivPercentile}th percentile, rank: ${greeks.ivRank})`,
      `Theta Cost Since Entry: $${greeks.thetaCostSinceEntry.toFixed(2)}`,
      `IV Status: ${greeks.recentIVCrush ? "RECENT CRUSH" : greeks.recentIVSpike ? "RECENT SPIKE" : "stable"}`,
    ].join("\n");
  }

  private formatMarketContext(snapshot: DripCoachSnapshot): string {
    const { timeContext, volatilityContext } = snapshot;
    return [
      `Session: ${timeContext.timeWindowLabel} (${timeContext.minutesSinceOpen} min since open, ${timeContext.minutesToClose} to close)`,
      `Extended Hours: ${timeContext.isExtendedHours ? "Yes" : "No"}`,
      `VIX: ${volatilityContext.vixValue.toFixed(2)} (${volatilityContext.vixLevel}, ${volatilityContext.vixTrend})`,
      `Market Regime: ${volatilityContext.marketRegime} (confidence: ${volatilityContext.regimeConfidence}%)`,
    ].join("\n");
  }

  private formatEconomicContext(snapshot: DripCoachSnapshot): string {
    const { economicContext } = snapshot;
    const lines: string[] = [];

    if (economicContext.nextHighImpactEvent) {
      const event = economicContext.nextHighImpactEvent;
      lines.push(
        `Next Event: ${event.name} (${event.impact}) in ${event.hoursUntil.toFixed(1)} hours` +
          ` - ${event.affectsSymbol ? "AFFECTS THIS SYMBOL" : "general market"}`
      );
    }

    if (economicContext.earningsProximity) {
      const earnings = economicContext.earningsProximity;
      lines.push(`Earnings: ${earnings.symbol} in ${earnings.daysUntil} days (${earnings.timing})`);
    }

    lines.push(`Volatility Outlook: ${economicContext.volatilityOutlook}`);
    lines.push(`Market Sentiment: ${economicContext.marketSentiment}`);

    if (economicContext.tradingRecommendations.length > 0) {
      lines.push("Calendar Notes:");
      for (const rec of economicContext.tradingRecommendations.slice(0, 2)) {
        lines.push(`  - ${rec}`);
      }
    }

    return lines.join("\n");
  }
}

// Singleton instance
let promptBuilderInstance: PromptBuilder | null = null;

export function getPromptBuilder(): PromptBuilder {
  if (!promptBuilderInstance) {
    promptBuilderInstance = new PromptBuilder();
  }
  return promptBuilderInstance;
}
