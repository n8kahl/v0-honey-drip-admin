/**
 * Performance Routes - Exposes edge stats and setup performance to frontend
 *
 * Routes:
 * - GET /api/performance/edge-summary - Returns per (opportunity_type, recommended_style) edge stats
 * - GET /api/performance/top-setups - Returns ranked setups by expectancy proxy
 */

import express, { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// ============================================================================
// Supabase Client
// ============================================================================

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    supabase = createClient(url, key);
  }

  return supabase;
}

// ============================================================================
// Types
// ============================================================================

export interface EdgeStat {
  opportunityType: string;
  recommendedStyle: string;
  winRate: number;
  profitFactor: number;
  totalExited: number;
  avgRiskReward: number;
  totalWins: number;
  totalLosses: number;
  avgRMultiple: number;
  lastUpdated: string | null;
  confidence: "low" | "medium" | "high";
}

export interface TopSetup extends EdgeStat {
  expectancyScore: number;
  rank: number;
}

export interface EdgeSummaryResponse {
  stats: EdgeStat[];
  windowDays: number;
  totalSignals: number;
  totalExited: number;
  lastUpdated: string | null;
}

export interface TopSetupsResponse {
  setups: TopSetup[];
  windowDays: number;
  limit: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate confidence level based on sample size
 */
function getConfidence(sampleSize: number): "low" | "medium" | "high" {
  if (sampleSize >= 40) return "high";
  if (sampleSize >= 20) return "medium";
  return "low";
}

/**
 * Calculate expectancy score for ranking
 * Formula: win_rate * profit_factor * confidence_multiplier
 * Where confidence_multiplier scales with sample size
 */
function calculateExpectancyScore(
  winRate: number,
  profitFactor: number,
  sampleSize: number
): number {
  // Confidence multiplier: 0.5 for low, 0.75 for medium, 1.0 for high
  const confidenceMultiplier = sampleSize >= 40 ? 1.0 : sampleSize >= 20 ? 0.75 : 0.5;

  // Normalize win rate to 0-1 scale
  const normalizedWinRate = winRate / 100;

  // Cap profit factor at 3.0 to avoid outliers dominating
  const cappedProfitFactor = Math.min(profitFactor, 3.0);

  return normalizedWinRate * cappedProfitFactor * confidenceMultiplier * 100;
}

/**
 * Format opportunity type for display
 */
function formatOpportunityType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format style for display
 */
function formatStyle(style: string): string {
  return style.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/performance/edge-summary
 *
 * Returns aggregated edge stats per (opportunity_type, recommended_style) pair.
 *
 * Query params:
 * - windowDays: Number of days to look back (default: 30)
 * - userId: Optional user ID filter (if omitted, returns all users' stats)
 */
router.get("/edge-summary", async (req: Request, res: Response) => {
  try {
    const windowDays = parseInt(req.query.windowDays as string) || 30;
    const userId = req.query.userId as string | undefined;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - windowDays);

    // Build query for exited signals
    let query = getSupabaseClient()
      .from("composite_signals")
      .select(
        "opportunity_type, recommended_style, realized_pnl, risk_reward, exit_reason, exited_at, created_at"
      )
      .not("exited_at", "is", null)
      .gte("created_at", fromDate.toISOString());

    // Filter by user if provided
    if (userId) {
      query = query.eq("owner", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Performance] Error fetching edge stats:", error);
      return res.status(500).json({ error: "Failed to fetch edge stats" });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        stats: [],
        windowDays,
        totalSignals: 0,
        totalExited: 0,
        lastUpdated: null,
      } as EdgeSummaryResponse);
    }

    // Type assertion for Supabase result
    interface SignalRow {
      opportunity_type: string;
      recommended_style: string;
      realized_pnl: number | null;
      risk_reward: number | null;
      exit_reason: string | null;
      exited_at: string | null;
    }
    const signals = data as SignalRow[];

    // Aggregate by opportunity_type + recommended_style
    const groups = new Map<
      string,
      {
        wins: number;
        losses: number;
        totalWinPnl: number;
        totalLossPnl: number;
        totalRR: number;
        totalRMultiple: number;
        count: number;
        lastExited: string | null;
        opportunityType: string;
        recommendedStyle: string;
      }
    >();

    for (const signal of signals) {
      const key = `${signal.opportunity_type}:${signal.recommended_style}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          wins: 0,
          losses: 0,
          totalWinPnl: 0,
          totalLossPnl: 0,
          totalRR: 0,
          totalRMultiple: 0,
          count: 0,
          lastExited: null,
          opportunityType: signal.opportunity_type,
          recommendedStyle: signal.recommended_style,
        };
        groups.set(key, group);
      }

      const pnl = signal.realized_pnl || 0;
      const isWin =
        pnl > 0 || (signal.exit_reason && ["T1", "T2", "T3"].includes(signal.exit_reason));

      if (isWin) {
        group.wins++;
        group.totalWinPnl += Math.abs(pnl);
      } else {
        group.losses++;
        group.totalLossPnl += Math.abs(pnl);
      }

      group.totalRR += signal.risk_reward || 0;
      group.totalRMultiple += pnl; // realized_pnl is in R-multiples
      group.count++;

      // Track most recent exit
      if (!group.lastExited || signal.exited_at > group.lastExited) {
        group.lastExited = signal.exited_at;
      }
    }

    // Convert to EdgeStat array
    const stats: EdgeStat[] = [];
    let latestUpdate: string | null = null;

    for (const [, group] of groups.entries()) {
      const winRate = group.count > 0 ? (group.wins / group.count) * 100 : 0;
      const profitFactor = group.totalLossPnl > 0 ? group.totalWinPnl / group.totalLossPnl : 0;
      const avgRR = group.count > 0 ? group.totalRR / group.count : 0;
      const avgRMultiple = group.count > 0 ? group.totalRMultiple / group.count : 0;

      stats.push({
        opportunityType: group.opportunityType,
        recommendedStyle: group.recommendedStyle,
        winRate: Math.round(winRate * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        totalExited: group.count,
        avgRiskReward: Math.round(avgRR * 100) / 100,
        totalWins: group.wins,
        totalLosses: group.losses,
        avgRMultiple: Math.round(avgRMultiple * 100) / 100,
        lastUpdated: group.lastExited,
        confidence: getConfidence(group.count),
      });

      // Track global latest update
      if (!latestUpdate || (group.lastExited && group.lastExited > latestUpdate)) {
        latestUpdate = group.lastExited;
      }
    }

    // Sort by sample size (descending), then by win rate
    stats.sort((a, b) => {
      if (b.totalExited !== a.totalExited) return b.totalExited - a.totalExited;
      return b.winRate - a.winRate;
    });

    // Count totals
    const totalExited = data.length;

    // Also count total signals (including non-exited)
    let totalQuery = getSupabaseClient()
      .from("composite_signals")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromDate.toISOString());

    if (userId) {
      totalQuery = totalQuery.eq("owner", userId);
    }

    const { count: totalSignals } = await totalQuery;

    res.status(200).json({
      stats,
      windowDays,
      totalSignals: totalSignals || 0,
      totalExited,
      lastUpdated: latestUpdate,
    } as EdgeSummaryResponse);
  } catch (error) {
    console.error("[Performance] Edge summary error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/performance/top-setups
 *
 * Returns top performing setups ranked by expectancy score.
 *
 * Query params:
 * - windowDays: Number of days to look back (default: 30)
 * - limit: Max number of setups to return (default: 5)
 * - userId: Optional user ID filter
 * - minSamples: Minimum sample size to include (default: 10)
 */
router.get("/top-setups", async (req: Request, res: Response) => {
  try {
    const windowDays = parseInt(req.query.windowDays as string) || 30;
    const limit = parseInt(req.query.limit as string) || 5;
    const userId = req.query.userId as string | undefined;
    const minSamples = parseInt(req.query.minSamples as string) || 10;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - windowDays);

    // Build query for exited signals
    let query = getSupabaseClient()
      .from("composite_signals")
      .select(
        "opportunity_type, recommended_style, realized_pnl, risk_reward, exit_reason, exited_at"
      )
      .not("exited_at", "is", null)
      .gte("created_at", fromDate.toISOString());

    if (userId) {
      query = query.eq("owner", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Performance] Error fetching top setups:", error);
      return res.status(500).json({ error: "Failed to fetch top setups" });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        setups: [],
        windowDays,
        limit,
      } as TopSetupsResponse);
    }

    // Type assertion for Supabase result
    interface SignalRow {
      opportunity_type: string;
      recommended_style: string;
      realized_pnl: number | null;
      risk_reward: number | null;
      exit_reason: string | null;
      exited_at: string | null;
    }
    const signals = data as SignalRow[];

    // Aggregate by opportunity_type + recommended_style (same as edge-summary)
    const groups = new Map<
      string,
      {
        wins: number;
        losses: number;
        totalWinPnl: number;
        totalLossPnl: number;
        totalRR: number;
        totalRMultiple: number;
        count: number;
        lastExited: string | null;
        opportunityType: string;
        recommendedStyle: string;
      }
    >();

    for (const signal of signals) {
      const key = `${signal.opportunity_type}:${signal.recommended_style}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          wins: 0,
          losses: 0,
          totalWinPnl: 0,
          totalLossPnl: 0,
          totalRR: 0,
          totalRMultiple: 0,
          count: 0,
          lastExited: null,
          opportunityType: signal.opportunity_type,
          recommendedStyle: signal.recommended_style,
        };
        groups.set(key, group);
      }

      const pnl = signal.realized_pnl || 0;
      const isWin =
        pnl > 0 || (signal.exit_reason && ["T1", "T2", "T3"].includes(signal.exit_reason));

      if (isWin) {
        group.wins++;
        group.totalWinPnl += Math.abs(pnl);
      } else {
        group.losses++;
        group.totalLossPnl += Math.abs(pnl);
      }

      group.totalRR += signal.risk_reward || 0;
      group.totalRMultiple += pnl;
      group.count++;

      if (!group.lastExited || signal.exited_at > group.lastExited) {
        group.lastExited = signal.exited_at;
      }
    }

    // Convert to TopSetup array with expectancy scores
    const setups: TopSetup[] = [];

    for (const [, group] of groups.entries()) {
      // Skip setups with insufficient samples
      if (group.count < minSamples) continue;

      const winRate = group.count > 0 ? (group.wins / group.count) * 100 : 0;
      const profitFactor = group.totalLossPnl > 0 ? group.totalWinPnl / group.totalLossPnl : 0;
      const avgRR = group.count > 0 ? group.totalRR / group.count : 0;
      const avgRMultiple = group.count > 0 ? group.totalRMultiple / group.count : 0;

      // Calculate expectancy score for ranking
      const expectancyScore = calculateExpectancyScore(winRate, profitFactor, group.count);

      setups.push({
        opportunityType: group.opportunityType,
        recommendedStyle: group.recommendedStyle,
        winRate: Math.round(winRate * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        totalExited: group.count,
        avgRiskReward: Math.round(avgRR * 100) / 100,
        totalWins: group.wins,
        totalLosses: group.losses,
        avgRMultiple: Math.round(avgRMultiple * 100) / 100,
        lastUpdated: group.lastExited,
        confidence: getConfidence(group.count),
        expectancyScore: Math.round(expectancyScore * 100) / 100,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by expectancy score (descending)
    setups.sort((a, b) => b.expectancyScore - a.expectancyScore);

    // Assign ranks and limit results
    const rankedSetups = setups.slice(0, limit).map((setup, index) => ({
      ...setup,
      rank: index + 1,
    }));

    res.status(200).json({
      setups: rankedSetups,
      windowDays,
      limit,
    } as TopSetupsResponse);
  } catch (error) {
    console.error("[Performance] Top setups error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/performance/health
 *
 * Simple health check for the performance API
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    // Test database connectivity
    const { count, error } = await getSupabaseClient()
      .from("composite_signals")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      return res.status(503).json({
        status: "unhealthy",
        error: "Database connection failed",
        message: error.message,
      });
    }

    res.status(200).json({
      status: "healthy",
      signalsCount: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
