export type RiskMode = "percent" | "calculated";
export type TrailMode = "none" | "fixed" | "atr";
export type StopType = "fixed" | "breakeven" | "trailing";
export type TradeType = "SCALP" | "DAY" | "SWING" | "LEAP";

export interface AdminRiskDefaults {
  mode: RiskMode;
  tpPercent?: number;
  slPercent?: number;
  trailMode?: TrailMode;
  atrPeriod?: number;
  atrMultiplier?: number;
  dteThresholds?: {
    scalp: number;
    day: number;
    swing: number;
  };
  orbMinutes?: number;
}

export interface KeyLevels {
  preMarketHigh?: number;
  preMarketLow?: number;
  orbHigh?: number;
  orbLow?: number;
  priorDayHigh?: number;
  priorDayLow?: number;
  priorDayClose?: number;
  weeklyHigh?: number;
  weeklyLow?: number;
  monthlyHigh?: number;
  monthlyLow?: number;
  quarterlyHigh?: number;
  quarterlyLow?: number;
  yearlyHigh?: number;
  yearlyLow?: number;
  vwap?: number;
  vwapUpperBand?: number;
  vwapLowerBand?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
  bollingerMiddle?: number;
  dailyPivot?: number;
  smcLevels?: any[]; // StructureLevel[] from structureLevels.ts
  optionsFlow?: {
    gammaWall: number | null;
    callWall: number | null;
    putWall: number | null;
    maxPain: number | null;
  };
}

export interface RiskCalculationInput {
  entryPrice: number;
  currentUnderlyingPrice: number;
  currentOptionMid: number;
  keyLevels: KeyLevels;
  atr?: number;
  defaults: AdminRiskDefaults;
  timestamp?: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
  expirationISO?: string;
  tradeType?: TradeType; // Can be passed or inferred
  macroContext?: MacroContext; // Added for macro context
  liquidityQuality?: LiquidityQuality; // Added for liquidity quality
}

export interface RiskCalculationResult {
  targetPrice: number;
  stopLoss: number;
  targetPrice2?: number;
  targetPremium?: number;
  targetPremium2?: number;
  stopLossPremium?: number;
  riskRewardRatio: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  calculatedAt: number;
  usedLevels: string[];
  tradeType?: TradeType;
  profile?: string;
  dte?: number;
  // Underlying price context for TP/SL display (Format C)
  targetUnderlyingPrice?: number;
  targetUnderlyingPrice2?: number;
  stopUnderlyingPrice?: number;
  currentUnderlyingPrice?: number;
}

export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LevelCandidate {
  price: number;
  reason: string;
  weight: number;
  distance: number;
}

// Added for macro context
export interface MacroContext {
  spx: {
    price: number;
    change: number;
    changePercent: number;
  };
  vix: {
    price: number;
    level: "low" | "normal" | "elevated" | "high";
  };
  ndx: {
    price: number;
    change: number;
    changePercent: number;
  };
  regime: "bull" | "bear" | "choppy";
  bias: "bullish" | "bearish" | "neutral";
  updatedAt: number;
}

// Added for liquidity quality
export interface LiquidityQuality {
  quality: "excellent" | "good" | "fair" | "poor";
  warnings: string[];
}

// ============================================================================
// Trade Plan Anchors - TP/SL with structure-based rationale
// ============================================================================

/** Anchor types for TP/SL levels */
export type AnchorType =
  | "VWAP"
  | "ORB_HIGH"
  | "ORB_LOW"
  | "PDH" // Prior Day High
  | "PDL" // Prior Day Low
  | "GAMMA_WALL"
  | "CALL_WALL"
  | "PUT_WALL"
  | "MAX_PAIN"
  | "WEEKLY_HIGH"
  | "WEEKLY_LOW"
  | "ATR_FALLBACK"
  | "PERCENT_FALLBACK";

/** An anchor point with price and rationale */
export interface PlanAnchor {
  /** Type of anchor (VWAP, ORB, GAMMA_WALL, etc.) */
  type: AnchorType;
  /** Price level */
  price: number;
  /** Human-readable reason for this anchor */
  reason: string;
  /** Optional underlying price (for dual display) */
  underlyingPrice?: number;
  /** Optional premium price (for options) */
  premiumPrice?: number;
  /** Distance from current price (percentage) */
  distancePercent?: number;
  /** Whether this is a fallback (no structural anchor found) */
  isFallback?: boolean;
}

/** Target anchor with label */
export interface TargetAnchor extends PlanAnchor {
  /** Target label (TP1, TP2, TP3) */
  label: "TP1" | "TP2" | "TP3";
}

/** Overall plan quality assessment */
export interface PlanQuality {
  /** Quality score 0-100 */
  score: number;
  /** Quality level */
  level: "strong" | "moderate" | "weak";
  /** Warnings about the plan */
  warnings: string[];
  /** Reasons for the quality assessment */
  reasons: string[];
}

/** Complete trade plan anchors */
export interface TradePlanAnchors {
  /** Stop loss anchor with rationale */
  stopAnchor: PlanAnchor;
  /** Target anchors (TP1, TP2, optional TP3) */
  targets: TargetAnchor[];
  /** Overall plan quality */
  planQuality: PlanQuality;
  /** Direction of the trade */
  direction: "long" | "short";
  /** Current underlying price used for calculations */
  currentUnderlyingPrice: number;
  /** Trade type (SCALP, DAY, SWING) */
  tradeType?: TradeType;
}
