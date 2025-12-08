/**
 * Drip Coach - AI Trade Coaching System
 * Type definitions for the coaching infrastructure
 */

// ============= Trade Types =============

export type TradeType = "Scalp" | "Day" | "Swing" | "LEAP";
export type CoachingMode = "scalp" | "day" | "swing" | "leap";
export type Direction = "LONG" | "SHORT";

// ============= Trigger Types =============

export type TriggerType =
  | "R_MILESTONE"
  | "KEY_LEVEL_HIT"
  | "VOLUME_SPIKE"
  | "MOMENTUM_STALL"
  | "STOP_PROXIMITY"
  | "TARGET_PROXIMITY"
  | "THETA_DECAY"
  | "TIME_WARNING"
  | "DAILY_CHECKIN"
  | "ECONOMIC_EVENT_IMMINENT"
  | "ECONOMIC_EVENT_TOMORROW"
  | "EARNINGS_APPROACHING"
  | "IV_SHIFT"
  | "WEEKLY_REVIEW"
  | "SESSION_CHANGE"
  | "REGIME_SHIFT"
  | "EOD_APPROACH"
  | "MANUAL_REFRESH"
  | "SESSION_START";

export interface CoachingTrigger {
  type: TriggerType;
  priority: 1 | 2 | 3 | 4 | 5; // 5 = critical
  cooldownSeconds: number;
  triggerTime?: string; // For scheduled triggers like '16:05'
  triggerDay?: number; // 0-6 for day of week
}

export interface TriggerResult {
  triggered: boolean;
  type: TriggerType;
  priority: number;
  reason?: string;
  data?: Record<string, unknown>;
}

// ============= Snapshot Types =============

export interface DripCoachSnapshot {
  // Trade Identity
  trade: {
    tradeId: string;
    symbol: string;
    underlying: string;
    direction: Direction;
    tradeType: TradeType;
    dte: number;
    strike?: number;
    optionType?: "CALL" | "PUT";
    contractSymbol?: string;
  };

  // Position Status
  position: {
    entryPrice: number;
    currentPrice: number;
    stopPrice: number;
    targets: {
      t1: number;
      t2?: number;
      t3?: number;
    };

    // P&L
    pnlDollars: number;
    pnlPercent: number;
    rMultiple: number;

    // Position management
    timeInTradeBars: number;
    timeInTradeMinutes: number;
    partialsTaken: number;
    remainingSize: number; // 0-100%

    // Distances in ATR
    distanceToStopATR: number;
    distanceToT1ATR: number;
    distanceToT2ATR?: number;
  };

  // Market Snapshot
  market: {
    lastPrice: number;
    bid: number;
    ask: number;
    spread: number;
    spreadPercent: number;

    // Volatility
    atr: number;
    atrPercent: number;
    atr5m?: number;
    atr15m?: number;

    // Momentum indicators
    rsi: number;
    rsi5m?: number;
    momentum: "strong_bull" | "bull" | "neutral" | "bear" | "strong_bear";

    // Volume analysis
    currentVolume: number;
    avgVolume: number;
    volumeRatio: number;
    volumeTrend: "spiking" | "above_avg" | "normal" | "below_avg" | "drying_up";

    // VWAP
    vwap: number;
    vwapDistance: number;
    aboveVWAP: boolean;

    // Multi-timeframe trend
    mtfTrend: {
      "1m": "bullish" | "bearish" | "neutral";
      "5m": "bullish" | "bearish" | "neutral";
      "15m": "bullish" | "bearish" | "neutral";
      "60m": "bullish" | "bearish" | "neutral";
      alignment: "full" | "partial" | "conflicting";
    };
  };

  // Structure Context
  structure: {
    nearestSupport: {
      price: number;
      type: string;
      atrDistance: number;
    };
    nearestResistance: {
      price: number;
      type: string;
      atrDistance: number;
    };

    // Key levels
    orbHigh: number;
    orbLow: number;
    priorDayHigh: number;
    priorDayLow: number;
    priorDayClose: number;

    // Level proximity
    keyLevelProximity: "at_level" | "near" | "clear";
    nearestLevelName?: string;
    nearestLevelDistance?: number;
  };

  // Greeks (Options Only)
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    iv: number;

    // Derived
    thetaPerMinute: number;
    thetaCostSinceEntry: number;
    gammaExposure: number;

    // IV context
    ivPercentile: number;
    ivRank: number;
    recentIVCrush: boolean;
    recentIVSpike: boolean;
  };

  // Time Context
  timeContext: {
    timeWindow: string;
    timeWindowLabel: string;
    minutesSinceOpen: number;
    minutesToClose: number;
    isExtendedHours: boolean;

    nextSessionChange?: {
      window: string;
      minutesUntil: number;
    };
  };

  // Volatility Context
  volatilityContext: {
    vixLevel: "low" | "medium" | "high" | "extreme";
    vixValue: number;
    vixTrend: "rising" | "falling" | "stable";
    marketRegime: "trending" | "ranging" | "choppy" | "volatile";
    regimeConfidence: number;
  };

  // Economic Context
  economicContext: {
    nextHighImpactEvent?: {
      name: string;
      datetime: string;
      hoursUntil: number;
      impact: "HIGH" | "CRITICAL";
      affectsSymbol: boolean;
    };

    earningsProximity?: {
      symbol: string;
      daysUntil: number;
      timing: "BMO" | "AMC";
    };

    tradingRecommendations: string[];
    volatilityOutlook: "elevated" | "normal" | "low";
    marketSentiment: "risk-on" | "risk-off" | "neutral";
  };

  // Session Metadata
  session: {
    sessionId: string;
    coachingMode: CoachingMode;
    updateCount: number;
    lastTrigger: string;
    lastUpdateTime: string;
    tokensUsedTotal: number;
    sessionStartTime: string;
    maxUpdatesRemaining: number;
  };
}

// ============= Recommendation Types =============

export type RecommendationAction =
  | "scale_out"
  | "trail_stop"
  | "move_to_be"
  | "hold"
  | "take_profit"
  | "watch_level"
  | "reduce_size"
  | "exit"
  | "add_position"
  | "tighten_stop"
  | "widen_stop";

export interface Recommendation {
  action: RecommendationAction;
  details: Record<string, unknown>;
  reason: string;
  urgency: 1 | 2 | 3 | 4 | 5; // 5 = act now
}

export type RiskFlag =
  | "extended_move"
  | "approaching_stop"
  | "approaching_target"
  | "volume_fading"
  | "volume_spike_against"
  | "theta_decay"
  | "spread_widening"
  | "event_imminent"
  | "momentum_stall"
  | "regime_unfavorable"
  | "iv_elevated"
  | "iv_crushed"
  | "earnings_risk"
  | "time_in_trade";

// ============= Response Types =============

export interface CoachingResponse {
  summary: string;
  recommendations: Recommendation[];
  riskFlags: RiskFlag[];
  confidence: number;
  shouldSpeak: boolean;
  trigger: TriggerType;
  timestamp: string;
}

// ============= Session Types =============

export interface CoachingSession {
  sessionId: string;
  tradeId: string;
  userId: string;
  coachingMode: CoachingMode;

  // Limits
  maxUpdates: number;
  maxDurationMs: number;
  updateCooldownMs: number;

  // State
  updateCount: number;
  tokensUsed: number;
  startTime: number;
  lastUpdateTime: number;
  lastSnapshot?: DripCoachSnapshot;
  lastRMultiple?: number;

  // Conversation context
  conversationHistory: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;

  // Trigger cooldowns
  triggerCooldowns: Map<TriggerType, number>;

  // Status
  status: "active" | "paused" | "ended";
  endReason?: string;
}

export interface SessionSummary {
  sessionId: string;
  tradeId: string;
  duration: number;
  updateCount: number;
  tokensUsed: number;
  estimatedCost: number;
  triggers: TriggerType[];
  finalRMultiple?: number;
}

// ============= Config Types =============

export interface CoachingLimits {
  maxUpdatesPerSession: number;
  maxSessionDurationMs: number;
  minUpdateIntervalMs: number;
  maxTokensPerSession: number;
}

export interface CoachingConfig {
  scalp: CoachingLimits;
  day: CoachingLimits;
  swing: CoachingLimits & { maxUpdatesPerDay: number };
  leap: CoachingLimits & { maxUpdatesPerWeek: number };
}

export const DEFAULT_COACHING_CONFIG: CoachingConfig = {
  scalp: {
    maxUpdatesPerSession: 20,
    maxSessionDurationMs: 15 * 60 * 1000, // 15 min
    minUpdateIntervalMs: 15 * 1000, // 15s
    maxTokensPerSession: 20_000,
  },
  day: {
    maxUpdatesPerSession: 30,
    maxSessionDurationMs: 4 * 60 * 60 * 1000, // 4 hours
    minUpdateIntervalMs: 60 * 1000, // 1 min
    maxTokensPerSession: 30_000,
  },
  swing: {
    maxUpdatesPerSession: 10,
    maxSessionDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    minUpdateIntervalMs: 60 * 60 * 1000, // 1 hour
    maxTokensPerSession: 10_000,
    maxUpdatesPerDay: 3,
  },
  leap: {
    maxUpdatesPerSession: 5,
    maxSessionDurationMs: 7 * 24 * 60 * 60 * 1000, // 1 week
    minUpdateIntervalMs: 24 * 60 * 60 * 1000, // 1 day
    maxTokensPerSession: 5_000,
    maxUpdatesPerWeek: 2,
  },
};

// ============= API Types =============

export interface StartSessionRequest {
  tradeId: string;
  coachingMode: CoachingMode;
  tradeData: {
    symbol: string;
    underlying: string;
    direction: Direction;
    tradeType: TradeType;
    dte: number;
    strike?: number;
    optionType?: "CALL" | "PUT";
    contractSymbol?: string;
    entryPrice: number;
    stopPrice: number;
    targets: { t1: number; t2?: number; t3?: number };
  };
}

export interface StartSessionResponse {
  sessionId: string;
  initialAnalysis: CoachingResponse;
  limits: CoachingLimits;
}

export interface AskQuestionRequest {
  sessionId: string;
  question: string;
}

export interface AskQuestionResponse {
  answer: string;
  recommendations: Recommendation[];
  tokensUsed: number;
}

export interface SessionStatusResponse {
  active: boolean;
  updateCount: number;
  tokensUsed: number;
  maxUpdatesRemaining: number;
  sessionDurationMs: number;
  lastUpdateTime?: string;
}
