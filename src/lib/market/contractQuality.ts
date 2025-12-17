/**
 * contractQuality.ts - Contract Liquidity and Execution Quality Metrics
 *
 * Provides deterministic calculations for:
 * - Liquidity grade (A/B/C) based on spread percentage
 * - Expected slippage estimates
 * - Spread validation
 */

export type LiquidityGrade = "A" | "B" | "C";

export interface ContractQualityMetrics {
  spreadAbs: number;
  spreadPct: number;
  liquidityGrade: LiquidityGrade;
  expectedSlippageMin: number;
  expectedSlippageMax: number;
  isWideSpread: boolean;
  warnings: string[];
}

/**
 * Liquidity grade thresholds (documented for testing)
 * - A: spreadPct <= 3% - Excellent liquidity, minimal slippage
 * - B: spreadPct <= 8% - Good liquidity, moderate slippage
 * - C: spreadPct > 8% - Poor liquidity, significant slippage
 */
export const SPREAD_THRESHOLDS = {
  GRADE_A_MAX: 0.03, // 3%
  GRADE_B_MAX: 0.08, // 8%
  WIDE_SPREAD: 0.10, // 10% triggers warning
} as const;

/**
 * Slippage multipliers by liquidity grade
 * These represent expected slippage as a multiple of the absolute spread
 */
export const SLIPPAGE_MULTIPLIERS = {
  A: { min: 0.5, max: 1.0 },
  B: { min: 1.0, max: 1.5 },
  C: { min: 1.5, max: 2.5 },
} as const;

/**
 * Calculate liquidity grade from spread percentage
 */
export function getLiquidityGrade(spreadPct: number): LiquidityGrade {
  if (spreadPct <= SPREAD_THRESHOLDS.GRADE_A_MAX) return "A";
  if (spreadPct <= SPREAD_THRESHOLDS.GRADE_B_MAX) return "B";
  return "C";
}

/**
 * Calculate contract quality metrics from bid/ask/mid
 *
 * @param bid - Bid price
 * @param ask - Ask price
 * @param mid - Mid price (optional, calculated if not provided)
 * @returns ContractQualityMetrics or null if data is invalid
 */
export function calculateContractQuality(
  bid: number,
  ask: number,
  mid?: number
): ContractQualityMetrics | null {
  // Validate inputs
  if (!bid || bid <= 0 || !ask || ask <= 0) {
    return null;
  }

  // Ensure bid < ask
  if (bid >= ask) {
    return null;
  }

  // Calculate mid if not provided
  const effectiveMid = mid && mid > 0 ? mid : (bid + ask) / 2;

  // Calculate spread
  const spreadAbs = ask - bid;
  const spreadPct = spreadAbs / effectiveMid;

  // Get liquidity grade
  const liquidityGrade = getLiquidityGrade(spreadPct);

  // Calculate expected slippage range
  const multipliers = SLIPPAGE_MULTIPLIERS[liquidityGrade];
  const expectedSlippageMin = spreadAbs * multipliers.min;
  const expectedSlippageMax = spreadAbs * multipliers.max;

  // Check for wide spread warning
  const isWideSpread = spreadPct > SPREAD_THRESHOLDS.WIDE_SPREAD;

  // Build warnings
  const warnings: string[] = [];
  if (isWideSpread) {
    warnings.push(`Wide spread (${(spreadPct * 100).toFixed(1)}%)`);
  }
  if (liquidityGrade === "C") {
    warnings.push("Poor liquidity - expect significant slippage");
  }
  if (bid < 0.05) {
    warnings.push("Very low bid price - penny option risk");
  }

  return {
    spreadAbs,
    spreadPct,
    liquidityGrade,
    expectedSlippageMin,
    expectedSlippageMax,
    isWideSpread,
    warnings,
  };
}

/**
 * Format spread percentage for display
 */
export function formatSpreadPct(spreadPct: number): string {
  return `${(spreadPct * 100).toFixed(1)}%`;
}

/**
 * Format slippage range for display
 */
export function formatSlippageRange(min: number, max: number): string {
  if (min === max) {
    return `$${min.toFixed(2)}`;
  }
  return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
}

/**
 * Get liquidity grade display style
 */
export function getLiquidityGradeStyle(grade: LiquidityGrade): {
  className: string;
  label: string;
  description: string;
} {
  switch (grade) {
    case "A":
      return {
        className: "text-green-400 bg-green-500/20",
        label: "A",
        description: "Excellent liquidity",
      };
    case "B":
      return {
        className: "text-yellow-400 bg-yellow-500/20",
        label: "B",
        description: "Good liquidity",
      };
    case "C":
      return {
        className: "text-red-400 bg-red-500/20",
        label: "C",
        description: "Poor liquidity",
      };
  }
}

export default {
  SPREAD_THRESHOLDS,
  SLIPPAGE_MULTIPLIERS,
  getLiquidityGrade,
  calculateContractQuality,
  formatSpreadPct,
  formatSlippageRange,
  getLiquidityGradeStyle,
};
