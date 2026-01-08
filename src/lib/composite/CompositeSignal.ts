/**
 * Composite Signal Interface
 * Phase 5: Signal Generation
 *
 * Represents a complete trade setup signal with all metadata
 */

import type { OpportunityType, OpportunityDirection, AssetClass } from "./OpportunityDetector.js";
import type { SymbolFeatures } from "../strategy/engine.js";

/**
 * Complete trade setup signal
 */
export interface CompositeSignal {
  // Identity
  id?: string; // Database ID (after persistence)
  createdAt: Date;
  updatedAt?: Date;

  // Ownership
  owner: string; // User ID
  symbol: string;

  // Opportunity Classification
  opportunityType: OpportunityType;
  direction: OpportunityDirection;
  assetClass: AssetClass;

  // Scoring
  baseScore: number; // 0-100 composite score
  scalpScore: number; // Style-specific scores
  dayTradeScore: number;
  swingScore: number;
  recommendedStyle: "scalp" | "day_trade" | "swing";
  recommendedStyleScore: number; // Score for recommended style

  // Confluence Breakdown (for transparency)
  confluence: Record<string, number>; // e.g., { volume: 95, flow: 88, vwap: 75 }

  // Full Confluence (all factors, not truncated) - Phase 6
  allConfluenceFactors?: Record<string, number>;

  // Context Boosts Applied - Phase 6
  contextBoosts?: {
    iv: number; // e.g., +0.08 for low IV boost
    gamma: number; // e.g., +0.05 for long gamma boost
    flowAlignment: number; // e.g., +0.10 for aligned flow
    regime: number; // e.g., -0.05 for choppy regime penalty
  };

  // Flow Summary for Display - Phase 6
  flowSummary?: {
    sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
    alignment: "ALIGNED" | "OPPOSED" | "NEUTRAL";
    recommendation: string; // 'FOLLOW_FLOW', 'FADE_FLOW', 'CONFIRM_FLOW', 'WAIT', 'NEUTRAL'
    sweepCount: number;
    blockCount: number;
    institutionalScore: number; // 0-100
    buyPressure: number; // 0-100 percentage
    totalPremium: number; // Total premium in dollars
  };

  // Data Confidence Score - Phase 6
  dataConfidence?: number; // 0-100

  // Entry/Risk Management
  entryPrice: number;
  stopPrice: number;
  targets: {
    T1: number;
    T2: number;
    T3: number;
  };
  riskReward: number; // e.g., 2.0 = 2:1 R:R

  // Full Features (for analysis)
  features: SymbolFeatures;

  // Signal Lifecycle
  status: "ACTIVE" | "FILLED" | "EXPIRED" | "DISMISSED" | "STOPPED" | "TARGET_HIT";
  expiresAt: Date;
  alertedAt?: Date;
  dismissedAt?: Date;
  filledAt?: Date;
  exitedAt?: Date;

  // Trade Execution (if filled)
  fillPrice?: number;
  exitPrice?: number;
  exitReason?: "STOP" | "T1" | "T2" | "T3" | "MANUAL" | "EXPIRED";
  contractsTraded?: number;
  realizedPnl?: number;
  realizedPnlPct?: number;
  holdTimeMinutes?: number;

  // Performance Tracking
  maxFavorableExcursion?: number; // MFE: best price reached
  maxAdverseExcursion?: number; // MAE: worst price reached

  // Metadata
  barTimeKey?: string; // For idempotency
  detectorVersion?: string; // Track detector changes
  timestamp: number; // Unix timestamp
}

/**
 * Risk/Reward calculation result
 */
export interface RiskRewardCalculation {
  entry: number;
  stop: number;
  targets: {
    T1: number;
    T2: number;
    T3: number;
  };
  riskAmount: number;
  rewardPotential: number;
  riskRewardRatio: number;
}

/**
 * Style-specific scoring result
 */
export interface StyleScoringResult {
  scalpScore: number;
  dayTradeScore: number;
  swingScore: number;
  recommendedStyle: "scalp" | "day_trade" | "swing";
  recommendedStyleScore: number;
}

/**
 * Detected opportunity before signal generation
 */
export interface DetectedOpportunity {
  detector: any; // OpportunityDetector type
  baseScore: number;
  styleScores: StyleScoringResult;
  confluence: Record<string, number>;
}

/**
 * Generate bar time key for idempotent signal insertion
 * Format: ISO_timestamp + _ + symbol + _ + opportunity_type
 *
 * @param symbol - Symbol
 * @param timestamp - Unix timestamp
 * @param opportunityType - Opportunity type
 * @returns Bar time key string
 */
export function generateBarTimeKey(
  symbol: string,
  timestamp: number,
  opportunityType: OpportunityType
): string {
  const isoTime = new Date(timestamp).toISOString();
  return `${isoTime}_${symbol}_${opportunityType}`;
}

/**
 * Format opportunity type for display
 *
 * @param type - Opportunity type
 * @returns Human-readable string
 */
export function formatOpportunityType(type: OpportunityType): string {
  const typeMap: Record<OpportunityType, string> = {
    // Universal Equity
    breakout_bullish: "Bullish Breakout",
    breakout_bearish: "Bearish Breakout",
    mean_reversion_long: "Mean Reversion Long",
    mean_reversion_short: "Mean Reversion Short",
    trend_continuation_long: "Trend Continuation Long",
    trend_continuation_short: "Trend Continuation Short",

    // SPX/NDX Specific
    gamma_squeeze_bullish: "Bullish Gamma Squeeze",
    gamma_squeeze_bearish: "Bearish Gamma Squeeze",
    power_hour_reversal_bullish: "Bullish Power Hour Reversal",
    power_hour_reversal_bearish: "Bearish Power Hour Reversal",
    index_mean_reversion_long: "Index Mean Reversion Long",
    index_mean_reversion_short: "Index Mean Reversion Short",
    opening_drive_bullish: "Bullish Opening Drive",
    opening_drive_bearish: "Bearish Opening Drive",
    gamma_flip_bullish: "Bullish Gamma Flip",
    gamma_flip_bearish: "Bearish Gamma Flip",
    eod_pin_setup: "EOD Pin Setup",

    // KCU LTP Strategies
    kcu_ema_bounce: "KCU EMA Bounce",
    kcu_vwap_standard: "KCU VWAP Standard",
    kcu_vwap_advanced: "KCU VWAP Reclaim",
    kcu_king_queen: "KCU King & Queen",
    kcu_orb_breakout: "KCU ORB Breakout",
    kcu_cloud_bounce: "KCU Cloud Bounce",

    // Flow-Primary (Phase 3)
    sweep_momentum_long: "Sweep Momentum Long",
    sweep_momentum_short: "Sweep Momentum Short",

    // Flow-Only (Phase 6)
    institutional_flow_bullish: "Institutional Flow Alert (Bullish)",
    institutional_flow_bearish: "Institutional Flow Alert (Bearish)",
  };

  return typeMap[type] || type;
}

/**
 * Format confluence breakdown for display
 *
 * @param confluence - Confluence scores
 * @returns Formatted string
 */
export function formatConfluence(confluence: Record<string, number>): string {
  return Object.entries(confluence)
    .map(([factor, score]) => `${factor}: ${score.toFixed(0)}/100`)
    .join("\n");
}
