/**
 * useSetupGrading Hook
 *
 * Converts CompositeSignal scores into letter grades (A+/A/A-/B+/B/C)
 * for intuitive display in the Plan tab.
 *
 * Grading is based on:
 * - baseScore: Overall signal strength (0-100)
 * - styleScore: How well signal fits recommended style (0-100)
 * - riskReward: Risk/reward ratio (e.g., 2.5 = 2.5:1)
 *
 * Grades also provide position sizing guidance without requiring user settings.
 */

import { useMemo } from "react";
import type { CompositeSignal } from "../lib/composite/CompositeSignal";

export type SetupGrade = "A+" | "A" | "A-" | "B+" | "B" | "C";

export interface GradingResult {
  /** Letter grade (A+, A, A-, B+, B, C) */
  grade: SetupGrade;

  /** Sizing guidance label */
  sizeLabel: "SIZE UP" | "FULL SIZE" | "NORMAL" | "REDUCED" | "SMALL" | "SKIP";

  /** Brief description for sizing */
  sizeDescription: string;

  /** Size multiplier relative to "normal" (1.0) */
  sizeMultiplier: number;

  /** CSS color for grade display */
  color: string;

  /** Background color (lighter variant) */
  bgColor: string;

  /** Whether this setup should be traded */
  tradeable: boolean;

  /** Grade tier for sorting/grouping (1=A+, 2=A, etc.) */
  tier: number;
}

/**
 * Grade thresholds aligned with AdaptiveThresholds.ts
 *
 * | Grade | baseScore | styleScore | R:R   | sizeMultiplier |
 * |-------|-----------|------------|-------|----------------|
 * | A+    | ≥88       | ≥85        | ≥2.5  | 1.2x           |
 * | A     | ≥82       | ≥80        | ≥2.0  | 1.0x           |
 * | A-    | ≥78       | ≥75        | ≥1.8  | 0.9x           |
 * | B+    | ≥72       | ≥70        | ≥1.5  | 0.75x          |
 * | B     | ≥65       | ≥65        | ≥1.3  | 0.5x           |
 * | C     | <65       | <65        | <1.3  | 0x             |
 */
const GRADE_THRESHOLDS: Array<{
  grade: SetupGrade;
  minBase: number;
  minStyle: number;
  minRR: number;
  sizeMultiplier: number;
  sizeLabel: GradingResult["sizeLabel"];
  sizeDescription: string;
  color: string;
  bgColor: string;
  tier: number;
}> = [
  {
    grade: "A+",
    minBase: 88,
    minStyle: 85,
    minRR: 2.5,
    sizeMultiplier: 1.2,
    sizeLabel: "SIZE UP",
    sizeDescription: "High conviction - increase normal size",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    tier: 1,
  },
  {
    grade: "A",
    minBase: 82,
    minStyle: 80,
    minRR: 2.0,
    sizeMultiplier: 1.0,
    sizeLabel: "FULL SIZE",
    sizeDescription: "Strong setup - normal position",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    tier: 2,
  },
  {
    grade: "A-",
    minBase: 78,
    minStyle: 75,
    minRR: 1.8,
    sizeMultiplier: 0.9,
    sizeLabel: "NORMAL",
    sizeDescription: "Good setup - standard size",
    color: "text-lime-400",
    bgColor: "bg-lime-500/20",
    tier: 3,
  },
  {
    grade: "B+",
    minBase: 72,
    minStyle: 70,
    minRR: 1.5,
    sizeMultiplier: 0.75,
    sizeLabel: "REDUCED",
    sizeDescription: "Less conviction - reduce size",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    tier: 4,
  },
  {
    grade: "B",
    minBase: 65,
    minStyle: 65,
    minRR: 1.3,
    sizeMultiplier: 0.5,
    sizeLabel: "SMALL",
    sizeDescription: "Watching only - minimal size",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    tier: 5,
  },
  {
    grade: "C",
    minBase: 0,
    minStyle: 0,
    minRR: 0,
    sizeMultiplier: 0,
    sizeLabel: "SKIP",
    sizeDescription: "Insufficient confluence",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/20",
    tier: 6,
  },
];

/**
 * Calculate grade from raw scores
 */
export function calculateGrade(
  baseScore: number,
  styleScore: number,
  riskReward: number
): GradingResult {
  // Find the highest grade that meets all criteria
  for (const threshold of GRADE_THRESHOLDS) {
    if (
      baseScore >= threshold.minBase &&
      styleScore >= threshold.minStyle &&
      riskReward >= threshold.minRR
    ) {
      return {
        grade: threshold.grade,
        sizeLabel: threshold.sizeLabel,
        sizeDescription: threshold.sizeDescription,
        sizeMultiplier: threshold.sizeMultiplier,
        color: threshold.color,
        bgColor: threshold.bgColor,
        tradeable: threshold.sizeMultiplier > 0,
        tier: threshold.tier,
      };
    }
  }

  // Fallback to C grade
  const cGrade = GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];
  return {
    grade: cGrade.grade,
    sizeLabel: cGrade.sizeLabel,
    sizeDescription: cGrade.sizeDescription,
    sizeMultiplier: cGrade.sizeMultiplier,
    color: cGrade.color,
    bgColor: cGrade.bgColor,
    tradeable: false,
    tier: cGrade.tier,
  };
}

/**
 * Hook to get grading for a single signal
 */
export function useSetupGrading(signal: CompositeSignal | null): GradingResult | null {
  return useMemo(() => {
    if (!signal) return null;

    return calculateGrade(
      signal.baseScore ?? 0,
      signal.recommendedStyleScore ?? 0,
      signal.riskReward ?? 0
    );
  }, [signal]);
}

/**
 * Hook to get grading for multiple signals with sorting
 */
export function useSetupGradingBatch(
  signals: CompositeSignal[]
): Array<{ signal: CompositeSignal; grading: GradingResult }> {
  return useMemo(() => {
    return signals
      .map((signal) => ({
        signal,
        grading: calculateGrade(
          signal.baseScore ?? 0,
          signal.recommendedStyleScore ?? 0,
          signal.riskReward ?? 0
        ),
      }))
      .sort((a, b) => a.grading.tier - b.grading.tier); // Sort by tier (A+ first)
  }, [signals]);
}

/**
 * Group signals by grade tier
 */
export function useGradedTiers(signals: CompositeSignal[]): {
  aTier: Array<{ signal: CompositeSignal; grading: GradingResult }>;
  bTier: Array<{ signal: CompositeSignal; grading: GradingResult }>;
  cTier: Array<{ signal: CompositeSignal; grading: GradingResult }>;
} {
  return useMemo(() => {
    const graded = signals.map((signal) => ({
      signal,
      grading: calculateGrade(
        signal.baseScore ?? 0,
        signal.recommendedStyleScore ?? 0,
        signal.riskReward ?? 0
      ),
    }));

    return {
      aTier: graded.filter((g) => g.grading.tier <= 3), // A+, A, A-
      bTier: graded.filter((g) => g.grading.tier === 4 || g.grading.tier === 5), // B+, B
      cTier: graded.filter((g) => g.grading.tier === 6), // C (skip)
    };
  }, [signals]);
}

/**
 * Get CSS classes for grade display
 */
export function getGradeClasses(grade: SetupGrade): {
  text: string;
  bg: string;
  border: string;
} {
  const gradeInfo = GRADE_THRESHOLDS.find((t) => t.grade === grade);

  return {
    text: gradeInfo?.color ?? "text-zinc-400",
    bg: gradeInfo?.bgColor ?? "bg-zinc-500/20",
    border: gradeInfo?.color.replace("text-", "border-") ?? "border-zinc-400",
  };
}

/**
 * Get grade display label with emoji
 */
export function getGradeLabel(grade: SetupGrade): string {
  switch (grade) {
    case "A+":
      return "A+";
    case "A":
      return "A";
    case "A-":
      return "A-";
    case "B+":
      return "B+";
    case "B":
      return "B";
    case "C":
      return "C";
    default:
      return "-";
  }
}
