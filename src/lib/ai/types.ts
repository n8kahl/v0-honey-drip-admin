/**
 * Client-side types for Drip Coach AI
 *
 * Mirrors the server-side types for frontend consumption
 */

export type TradeType = "scalp" | "day" | "swing" | "leap";

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
  | "ECONOMIC_EVENT_TOMORROW"
  | "EARNINGS_APPROACHING"
  | "IV_SHIFT"
  | "WEEKLY_REVIEW"
  | "MANUAL_REQUEST"
  | "SESSION_START";

export type RiskFlag =
  | "extended_move"
  | "approaching_stop"
  | "volume_fading"
  | "theta_decay"
  | "spread_widening"
  | "event_imminent"
  | "iv_elevated"
  | "momentum_divergence"
  | "regime_unfavorable";

export type ActionType =
  | "scale_out"
  | "trail_stop"
  | "move_to_be"
  | "hold"
  | "take_profit"
  | "watch_level"
  | "reduce_size"
  | "exit"
  | "add_position"
  | "wait";

export interface Recommendation {
  action: ActionType;
  details: Record<string, any>;
  reason: string;
  urgency: 1 | 2 | 3 | 4 | 5; // 5 = act now
}

export interface CoachingResponse {
  summary: string;
  recommendations: Recommendation[];
  riskFlags: RiskFlag[];
  confidence: number; // 0-100
  shouldSpeak: boolean;
  trigger?: TriggerType;
  timestamp: string;
  tokensUsed?: number;
}

export interface DripCoachSnapshot {
  trade: {
    tradeId: string;
    symbol: string;
    direction: "LONG" | "SHORT";
    tradeType: TradeType;
    dte: number;
    strike?: number;
    optionType?: "CALL" | "PUT";
  };
  position: {
    entryPrice: number;
    currentPrice: number;
    stopPrice: number;
    targets: {
      t1: number;
      t2?: number;
      t3?: number;
    };
    pnlDollars: number;
    pnlPercent: number;
    rMultiple: number;
    timeInTradeBars: number;
    timeInTradeMinutes: number;
    distanceToStopATR: number;
    distanceToT1ATR: number;
  };
  market: {
    lastPrice: number;
    atr: number;
    rsi: number;
    volumeRatio: number;
    volumeTrend: string;
    vwap: number;
    aboveVWAP: boolean;
    momentum: string;
  };
  timeContext: {
    timeWindow: string;
    minutesSinceOpen: number;
    minutesToClose: number;
  };
  volatilityContext: {
    vixLevel: string;
    marketRegime: string;
  };
}

export interface CoachSessionState {
  sessionId: string | null;
  tradeId: string | null;
  coachingMode: TradeType | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  latestResponse: CoachingResponse | null;
  responseHistory: CoachingResponse[];
  updateCount: number;
  tokensUsed: number;
  startTime: number | null;
}
