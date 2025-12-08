/**
 * Confidence Scoring for Risk Calculations
 *
 * Production-grade confidence grading based on:
 * - Data quality (completeness, freshness)
 * - Market conditions (volatility, liquidity)
 * - Technical alignment (confluence, trend)
 * - Risk/reward ratio quality
 *
 * Scoring: 0-100 scale
 * - 85-100: High confidence (✓) - Strong entry with multiple confirmations
 * - 60-84:  Medium confidence (~) - Good setup with some confirmations
 * - 0-59:   Low confidence (?) - Weak setup or limited data
 */

import type { RiskCalculationResult } from "./types";

export interface ConfidenceFactors {
  /** Key levels available for calculation (0-25 points) */
  dataQuality: number;

  /** Market conditions favorability (0-25 points) */
  marketConditions: number;

  /** Technical indicator alignment (0-25 points) */
  technicalAlignment: number;

  /** Risk/reward ratio quality (0-25 points) */
  riskRewardQuality: number;
}

export interface ConfidenceGrade {
  /** Overall confidence score 0-100 */
  score: number;

  /** Grade: high | medium | low */
  grade: "high" | "medium" | "low";

  /** Individual factor scores */
  factors: ConfidenceFactors;

  /** Human-readable reasoning */
  reasoning: string[];

  /** Visual indicator for UI */
  indicator: "✓" | "~" | "?";
}

/**
 * Calculate confidence grade for a risk calculation result
 */
export function calculateConfidenceGrade(
  result: RiskCalculationResult,
  context: {
    levelsUsed?: string[];
    hasATR?: boolean;
    hasIV?: boolean;
    hasFlow?: boolean;
    hasGamma?: boolean;
    confluenceScore?: number;
    liquidityQuality?: "excellent" | "good" | "fair" | "poor";
    lastDataUpdate?: number; // timestamp
  }
): ConfidenceGrade {
  const reasoning: string[] = [];

  // ===== Factor 1: Data Quality (0-25 points) =====
  let dataQuality = 0;

  // Key levels available (up to 15 points)
  const levelCount = context.levelsUsed?.length || 0;
  if (levelCount >= 5) {
    dataQuality += 15;
    reasoning.push("✓ Excellent key level data (5+ levels)");
  } else if (levelCount >= 3) {
    dataQuality += 10;
    reasoning.push("~ Good key level data (3+ levels)");
  } else if (levelCount >= 1) {
    dataQuality += 5;
    reasoning.push("~ Limited key level data");
  } else {
    reasoning.push("✗ No key levels (fallback calculation)");
  }

  // ATR available (5 points)
  if (context.hasATR) {
    dataQuality += 5;
    reasoning.push("✓ ATR volatility data available");
  }

  // Data freshness (5 points)
  if (context.lastDataUpdate) {
    const ageSeconds = (Date.now() - context.lastDataUpdate) / 1000;
    if (ageSeconds < 10) {
      dataQuality += 5;
      reasoning.push("✓ Real-time data (<10s old)");
    } else if (ageSeconds < 60) {
      dataQuality += 3;
      reasoning.push("~ Recent data (<1m old)");
    } else {
      reasoning.push("✗ Stale data (>1m old)");
    }
  }

  // ===== Factor 2: Market Conditions (0-25 points) =====
  let marketConditions = 0;

  // Liquidity quality (up to 10 points)
  if (context.liquidityQuality === "excellent") {
    marketConditions += 10;
    reasoning.push("✓ Excellent liquidity");
  } else if (context.liquidityQuality === "good") {
    marketConditions += 7;
    reasoning.push("~ Good liquidity");
  } else if (context.liquidityQuality === "fair") {
    marketConditions += 4;
    reasoning.push("~ Fair liquidity");
  } else if (context.liquidityQuality === "poor") {
    marketConditions += 1;
    reasoning.push("✗ Poor liquidity");
  }

  // IV data (5 points)
  if (context.hasIV) {
    marketConditions += 5;
    reasoning.push("✓ IV percentile available");
  }

  // Options flow (5 points)
  if (context.hasFlow) {
    marketConditions += 5;
    reasoning.push("✓ Options flow data available");
  }

  // Gamma exposure (5 points)
  if (context.hasGamma) {
    marketConditions += 5;
    reasoning.push("✓ Gamma exposure data available");
  }

  // ===== Factor 3: Technical Alignment (0-25 points) =====
  let technicalAlignment = 0;

  // Confluence score (up to 20 points)
  if (context.confluenceScore !== undefined) {
    if (context.confluenceScore >= 70) {
      technicalAlignment += 20;
      reasoning.push("✓ Strong technical confluence (70+)");
    } else if (context.confluenceScore >= 50) {
      technicalAlignment += 15;
      reasoning.push("~ Moderate confluence (50-69)");
    } else if (context.confluenceScore >= 30) {
      technicalAlignment += 10;
      reasoning.push("~ Weak confluence (30-49)");
    } else {
      technicalAlignment += 5;
      reasoning.push("✗ Low confluence (<30)");
    }
  }

  // Trade type confidence (5 points for known type)
  if (result.tradeType) {
    technicalAlignment += 5;
    reasoning.push(`✓ Trade type: ${result.tradeType}`);
  }

  // ===== Factor 4: Risk/Reward Quality (0-25 points) =====
  let riskRewardQuality = 0;

  // R:R ratio scoring (up to 20 points)
  const rrRatio = result.riskRewardRatio;
  if (rrRatio >= 3.0) {
    riskRewardQuality += 20;
    reasoning.push(`✓ Excellent R:R (${rrRatio.toFixed(1)}:1)`);
  } else if (rrRatio >= 2.0) {
    riskRewardQuality += 15;
    reasoning.push(`✓ Good R:R (${rrRatio.toFixed(1)}:1)`);
  } else if (rrRatio >= 1.5) {
    riskRewardQuality += 10;
    reasoning.push(`~ Fair R:R (${rrRatio.toFixed(1)}:1)`);
  } else if (rrRatio >= 1.0) {
    riskRewardQuality += 5;
    reasoning.push(`~ Minimum R:R (${rrRatio.toFixed(1)}:1)`);
  } else {
    reasoning.push(`✗ Poor R:R (${rrRatio.toFixed(1)}:1)`);
  }

  // Level-based calculation bonus (5 points)
  if (levelCount >= 2) {
    riskRewardQuality += 5;
    reasoning.push("✓ Level-based calculation");
  }

  // ===== Calculate Total Score =====
  const totalScore = dataQuality + marketConditions + technicalAlignment + riskRewardQuality;

  // Determine grade
  let grade: "high" | "medium" | "low";
  let indicator: "✓" | "~" | "?";

  if (totalScore >= 85) {
    grade = "high";
    indicator = "✓";
  } else if (totalScore >= 60) {
    grade = "medium";
    indicator = "~";
  } else {
    grade = "low";
    indicator = "?";
  }

  return {
    score: totalScore,
    grade,
    factors: {
      dataQuality,
      marketConditions,
      technicalAlignment,
      riskRewardQuality,
    },
    reasoning,
    indicator,
  };
}

/**
 * Get color class for confidence score
 */
export function getConfidenceColor(score: number): string {
  if (score >= 85) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
}

/**
 * Get background color class for confidence badge
 */
export function getConfidenceBgColor(score: number): string {
  if (score >= 85) return "bg-green-500/20";
  if (score >= 60) return "bg-yellow-500/20";
  return "bg-red-500/20";
}

/**
 * Format confidence for display
 */
export function formatConfidence(grade: ConfidenceGrade, verbose = false): string {
  if (verbose) {
    return `${grade.indicator} ${grade.grade.toUpperCase()} (${grade.score}/100)`;
  }
  return `${grade.indicator} ${grade.score}`;
}
