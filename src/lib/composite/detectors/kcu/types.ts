/**
 * KCU LTP Strategy Types
 *
 * The LTP (Levels, Trends, Patience) framework developed by Mr. K Capital University.
 * This file defines all types specific to KCU strategy detection and scoring.
 */

import type {
  OpportunityType,
  OpportunityDirection,
  AssetClass,
} from "../../OpportunityDetector.js";

// ============================================================================
// KCU Opportunity Types
// ============================================================================

/**
 * KCU-specific opportunity types
 * These extend the base OpportunityType union
 */
export type KCUOpportunityType =
  | "kcu_ema_bounce"
  | "kcu_vwap_standard"
  | "kcu_vwap_advanced"
  | "kcu_king_queen"
  | "kcu_orb_breakout"
  | "kcu_cloud_bounce";

/**
 * All opportunity types including KCU-specific ones
 */
export type ExtendedOpportunityType = OpportunityType | KCUOpportunityType;

// ============================================================================
// LTP Patience Candle Detection
// ============================================================================

/**
 * Quality grades for setups following KCU methodology
 * A+ = Perfect confluence, all factors aligned
 * A  = Strong setup, minor missing factors
 * B  = Acceptable but not ideal
 * Avoid = Too risky or conditions not met
 */
export type KCUSetupQuality = "A+" | "A" | "B" | "Avoid";

/**
 * LTP Patience Candle detection result
 * A patience candle is a small consolidation candle that signals optimal entry
 */
export interface LTPPatienceCandle {
  /** Whether a patience candle is detected */
  detected: boolean;

  /** Quality grade of the patience candle setup */
  quality: KCUSetupQuality;

  /** Bar index in the current sequence (0 = current bar) */
  barIndex: number;

  /** Entry trigger levels */
  entryTrigger: {
    /** Price level that triggers long entry (break above) */
    longBreak: number;
    /** Price level that triggers short entry (break below) */
    shortBreak: number;
  };

  /** Stop loss level (other side of patience candle) */
  stopLevel: number;

  /** True if this is an inside bar (High < PrevHigh && Low > PrevLow) */
  isInsideBar: boolean;

  /** Body size relative to ATR (lower = better consolidation) */
  bodyRatio: number;

  /** Number of consecutive contained/consolidation bars */
  containedCount: number;

  /** Candle close position relative to range */
  closePosition: "near_open" | "near_high" | "near_low" | "mid_range";

  /** Timestamp of the patience candle */
  timestamp: number;
}

// ============================================================================
// LTP Trend Detection
// ============================================================================

/**
 * LTP Trend direction
 */
export type LTPTrendDirection = "UPTREND" | "DOWNTREND" | "CHOP";

/**
 * ORB (Opening Range Breakout) status
 */
export type ORBBreakStatus = "HIGH" | "LOW" | "BOTH" | "NONE";

/**
 * LTP Trend detection result
 * Follows the KCU trend confirmation methodology:
 * - Uptrend: Higher Highs + Higher Lows
 * - Downtrend: Lower Highs + Lower Lows
 */
export interface LTPTrend {
  /** Current trend direction */
  direction: LTPTrendDirection;

  /** Trend strength score (0-100) */
  strength: number;

  /** Timestamp when trend was confirmed */
  confirmedAt: number;

  /** Count of higher highs in current trend */
  higherHighs: number;

  /** Count of higher lows in current trend */
  higherLows: number;

  /** Count of lower highs in current trend */
  lowerHighs: number;

  /** Count of lower lows in current trend */
  lowerLows: number;

  /** ORB breakout status */
  orbBroken: ORBBreakStatus;

  /** Premarket level breakout status */
  premarketBroken: ORBBreakStatus;

  /** Minutes since trend was established */
  durationMinutes: number;

  /** Whether this is a "micro trend" (short-term reversal within larger trend) */
  isMicroTrend: boolean;

  /** Multi-timeframe alignment */
  mtfAlignment: {
    "1m": LTPTrendDirection;
    "5m": LTPTrendDirection;
    "15m": LTPTrendDirection;
    "60m": LTPTrendDirection;
  };
}

// ============================================================================
// LTP Level Detection
// ============================================================================

/**
 * Level type in KCU methodology
 */
export type KCULevelType =
  | "VWAP" // "The King"
  | "EMA_8" // Green EMA - Fast trend
  | "EMA_21" // Red EMA - Slow trend
  | "SMA_200" // Major trend filter
  | "ORB_HIGH" // Opening Range Breakout High
  | "ORB_LOW" // Opening Range Breakout Low
  | "PREMARKET_HIGH" // Pre-market session high
  | "PREMARKET_LOW" // Pre-market session low
  | "PRIOR_DAY_HIGH" // PDH
  | "PRIOR_DAY_LOW" // PDL
  | "PRIOR_DAY_CLOSE" // PDC
  | "HOURLY_LEVEL" // 60-minute chart S/R
  | "FIB_236" // Fibonacci retracement
  | "FIB_382"
  | "FIB_500"
  | "FIB_618"
  | "REACTION_LEVEL" // Intraday reaction point
  | "OPEN_PRICE"; // Daily open price (yellow in KCU)

/**
 * A single level with its properties
 */
export interface KCULevel {
  /** Type of level */
  type: KCULevelType;

  /** Price level */
  price: number;

  /** Label for display */
  label: string;

  /** Level strength (0-100) based on reaction history */
  strength: number;

  /** Number of times price reacted at this level */
  reactionCount: number;

  /** Distance from current price (percentage) */
  distancePercent: number;

  /** Whether this is a "Queen" level (confluence with VWAP) */
  isQueen: boolean;
}

/**
 * King & Queen confluence detection
 * King = VWAP (always)
 * Queen = Any other level that aligns with VWAP
 */
export interface KingQueenConfluence {
  /** Whether King & Queen confluence is detected */
  detected: boolean;

  /** The King level (VWAP) */
  king: KCULevel;

  /** Queen levels that align with the King */
  queens: KCULevel[];

  /** Total confluence strength */
  confluenceStrength: number;

  /** Distance threshold used for confluence detection */
  proximityThreshold: number;
}

/**
 * Level confluence result - multiple levels stacking at same price
 */
export interface LevelConfluence {
  /** Price zone center */
  priceZone: number;

  /** Levels that stack at this zone */
  stackedLevels: KCULevel[];

  /** Total stacked level count */
  levelCount: number;

  /** Combined strength of stacked levels */
  combinedStrength: number;

  /** Whether this qualifies as King & Queen */
  isKingQueen: boolean;
}

// ============================================================================
// KCU Session Configuration
// ============================================================================

/**
 * Trading session time windows per KCU methodology
 */
export type KCUSessionWindow =
  | "opening" // 9:30-10:00 - 2m charts, ORB identification
  | "morning" // 10:00-11:00 - 5m charts, EMA bounces, VWAP plays
  | "midday" // 11:00-15:00 - 10m charts, King & Queen
  | "lunch_chop" // 11:30-14:00 - Avoid or size down
  | "afternoon" // 14:00-15:00 - Standard plays
  | "last_hour" // 15:00-16:00 - Avoid (Smart Money Hour)
  | "after_hours"; // 16:00+ - No trading

/**
 * Session configuration for a time window
 */
export interface KCUSessionConfig {
  /** Session identifier */
  window: KCUSessionWindow;

  /** Start time (HH:MM format, Eastern) */
  start: string;

  /** End time (HH:MM format, Eastern) */
  end: string;

  /** Primary timeframe for this session */
  primaryTimeframe: "2m" | "5m" | "10m" | "15m" | null;

  /** Strategies active during this session */
  activeStrategies: KCUOpportunityType[];

  /** Warning message if applicable */
  warning?: string;

  /** Position size multiplier (0.5 = half size, 1.0 = normal) */
  sizeMultiplier: number;
}

// ============================================================================
// KCU Trade Setup
// ============================================================================

/**
 * Complete KCU trade setup with all L-T-P components
 */
export interface KCUTradeSetup {
  /** Symbol */
  symbol: string;

  /** Strategy type */
  strategyType: KCUOpportunityType;

  /** Direction */
  direction: OpportunityDirection;

  /** Setup quality grade */
  quality: KCUSetupQuality;

  /** L - Levels analysis */
  levels: {
    /** All key levels */
    all: KCULevel[];
    /** Nearest support */
    nearestSupport: KCULevel | null;
    /** Nearest resistance */
    nearestResistance: KCULevel | null;
    /** King & Queen confluence if detected */
    kingQueen: KingQueenConfluence | null;
    /** All level confluences */
    confluences: LevelConfluence[];
  };

  /** T - Trend analysis */
  trend: LTPTrend;

  /** P - Patience Candle analysis */
  patienceCandle: LTPPatienceCandle;

  /** Entry parameters */
  entry: {
    /** Trigger price for entry */
    trigger: number;
    /** Suggested entry price */
    price: number;
    /** Entry type */
    type: "break" | "bounce";
  };

  /** Risk parameters */
  risk: {
    /** Stop loss price */
    stopLoss: number;
    /** Stop based on which level */
    stopReason: string;
    /** Risk amount in $ per share */
    riskPerShare: number;
    /** Risk as percentage */
    riskPercent: number;
  };

  /** Profit targets */
  targets: {
    T1: { price: number; reason: string };
    T2: { price: number; reason: string };
    T3: { price: number; reason: string };
  };

  /** Risk/Reward ratio */
  riskReward: number;

  /** Session information */
  session: KCUSessionConfig;

  /** Confluence scoring (L-T-P weighted) */
  confluence: {
    levelScore: number; // L - 30%
    trendScore: number; // T - 25%
    patienceScore: number; // P - 25%
    volumeScore: number; // Volume confirmation - 10%
    sessionScore: number; // Time of day - 10%
    totalScore: number; // Weighted composite
  };

  /** Timestamp of detection */
  detectedAt: number;

  /** Expiry time for this setup */
  expiresAt: number;
}

// ============================================================================
// Bid/Ask Monitoring Types
// ============================================================================

/**
 * Bid/Ask threshold monitoring configuration
 */
export interface BidAskThresholdConfig {
  /** How often to check bid/ask (milliseconds) */
  checkIntervalMs: number;

  /** Maximum acceptable spread as percentage */
  spreadThresholdPercent: number;

  /** Seconds of stable spread required before entry confirmation */
  confirmationSeconds: number;

  /** Maximum price movement allowed during confirmation period */
  priceMovementThreshold: number;
}

/**
 * Current bid/ask monitoring status
 */
export interface BidAskStatus {
  /** Whether bid/ask has been stable for required duration */
  isConfirmed: boolean;

  /** Current spread as percentage */
  currentSpreadPercent: number;

  /** Confirmation progress (0-100%) */
  confirmationProgress: number;

  /** Last recorded bid price */
  lastBid: number;

  /** Last recorded ask price */
  lastAsk: number;

  /** Timestamp of last check */
  lastChecked: number;

  /** Any warnings about spread or price movement */
  warnings: string[];
}

// ============================================================================
// KCU Indicator Configuration
// ============================================================================

/**
 * KCU indicator preset matching Mr. K Capital methodology
 */
export interface KCUIndicatorConfig {
  ema: {
    fast: { period: 8; color: "green" };
    slow: { period: 21; color: "red" };
  };
  sma: {
    major: { period: 200; color: "orange"; style: "circles" };
  };
  vwap: {
    enabled: true;
    color: "white";
    label: "The King";
  };
  orb: {
    windowMinutes: 15;
    showLevels: true;
  };
  ripsterCloud?: {
    cloud3Enabled: boolean;
  };
}

// ============================================================================
// KCU Score Factors (for detector weighting)
// ============================================================================

/**
 * Standard KCU score factor weights following L-T-P methodology
 */
export const KCU_SCORE_WEIGHTS = {
  level_confluence: 0.3, // L - Levels
  trend_strength: 0.25, // T - Trends
  patience_candle: 0.25, // P - Patience
  volume_confirmation: 0.1,
  session_timing: 0.1,
} as const;

/**
 * Format KCU opportunity type for display
 */
export function formatKCUOpportunityType(type: KCUOpportunityType): string {
  const typeMap: Record<KCUOpportunityType, string> = {
    kcu_ema_bounce: "KCU EMA Bounce",
    kcu_vwap_standard: "KCU VWAP Standard",
    kcu_vwap_advanced: "KCU VWAP Reclaim",
    kcu_king_queen: "KCU King & Queen",
    kcu_orb_breakout: "KCU ORB Breakout",
    kcu_cloud_bounce: "KCU Cloud Bounce",
  };
  return typeMap[type] || type;
}

/**
 * Check if an opportunity type is a KCU strategy
 */
export function isKCUOpportunityType(type: string): type is KCUOpportunityType {
  return type.startsWith("kcu_");
}

/**
 * Get expected frequency for KCU opportunity types
 */
export function getKCUExpectedFrequency(type: KCUOpportunityType): string {
  const frequencies: Record<KCUOpportunityType, string> = {
    kcu_ema_bounce: "3-5 signals/day",
    kcu_vwap_standard: "2-4 signals/day",
    kcu_vwap_advanced: "1-2 signals/day",
    kcu_king_queen: "2-3 signals/day",
    kcu_orb_breakout: "1-2 signals/day",
    kcu_cloud_bounce: "1-3 signals/day (afternoon)",
  };
  return frequencies[type] || "Unknown";
}
