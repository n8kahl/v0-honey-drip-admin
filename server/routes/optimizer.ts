/**
 * Optimizer Routes - Exposes optimization status and results to frontend
 *
 * Routes:
 * - GET /api/optimizer/status - Returns current optimization params and report
 * - POST /api/optimizer/run - Kicks off background optimization (quick mode)
 * - PATCH /api/optimizer/activate/:strategyId - Activate pending params for a strategy
 * - POST /api/optimizer/activate-all - Activate all pending params
 * - GET /api/optimizer/pending - Get strategies with pending params
 */

import express, { Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// ============================================================================
// Supabase Client
// ============================================================================

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
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

interface OptimizedParams {
  parameters: {
    minScores: { scalp: number; day: number; swing: number };
    ivBoosts: { lowIV: number; highIV: number };
    gammaBoosts: { shortGamma: number; longGamma: number };
    flowBoosts: { aligned: number; opposed: number };
    mtfWeights: { weekly: number; daily: number; hourly: number; fifteenMin: number };
    riskReward: { targetMultiple: number; stopMultiple: number; maxHoldBars: number };
  };
  performance: {
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  timestamp: string;
  phase: number;
}

interface DetectorStats {
  detector: string;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgHoldBars?: number;
  expectancy?: number;
  wins?: number;
  losses?: number;
  compositeScore?: number;
  hasSufficientSample?: boolean;
  recommendedStyle?: "scalp" | "day_trade" | "swing" | "unknown";
}

interface ThresholdsUsed {
  minTrades: number;
  windowDays: number;
}

interface OptimizedReport {
  timestamp: string;
  parametersSummary: {
    targetMultiple: number;
    stopMultiple: number;
    maxHoldBars: number;
  };
  /** Thresholds used for filtering (new) */
  thresholdsUsed?: ThresholdsUsed;
  /** All detectors regardless of sample size (new) */
  allDetectors?: DetectorStats[];
  /** Top detectors with sufficient sample size (new) */
  topDetectors?: DetectorStats[];
  /** Detectors with insufficient sample size (new) */
  lowSampleDetectors?: DetectorStats[];
  /** Legacy field for backward compatibility */
  perDetectorStats: DetectorStats[];
  ranking: string[];
  testedSymbols: string[];
  windowStartDate: string;
  windowEndDate: string;
  totalTrades: number;
  avgWinRate: number;
  avgProfitFactor?: number;
}

interface OptimizerStatusResponse {
  paramsConfig: OptimizedParams | null;
  performanceSummary: OptimizedParams["performance"] | null;
  report: OptimizedReport | null;
  missingFiles: string[];
  lastUpdated: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely read and parse a JSON file
 * Returns null if file doesn't exist or parsing fails
 */
function safeReadJson<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.warn(`[Optimizer] Failed to read ${filePath}:`, error);
    return null;
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/optimizer/status
 *
 * Returns the current optimization parameters and performance report.
 * Always returns 200, even if files are missing (missingFiles array indicates which).
 */
router.get("/status", async (_req: Request, res: Response) => {
  const configDir = join(process.cwd(), "config");
  const paramsPath = join(configDir, "optimized-params.json");
  const reportPath = join(configDir, "optimized-report.json");

  const missingFiles: string[] = [];

  // Read params config
  const paramsConfig = safeReadJson<OptimizedParams>(paramsPath);
  if (!paramsConfig) {
    missingFiles.push("optimized-params.json");
  }

  // Read report
  const report = safeReadJson<OptimizedReport>(reportPath);
  if (!report) {
    missingFiles.push("optimized-report.json");
  }

  // Extract performance summary from params
  const performanceSummary = paramsConfig?.performance ?? null;

  // Determine last updated timestamp
  const lastUpdated = report?.timestamp ?? paramsConfig?.timestamp ?? null;

  const response: OptimizerStatusResponse = {
    paramsConfig,
    performanceSummary,
    report,
    missingFiles,
    lastUpdated,
  };

  res.status(200).json(response);
});

/**
 * POST /api/optimizer/run
 *
 * Kicks off a background optimization job.
 * Returns 202 immediately (does not block on optimization completion).
 *
 * Query params:
 * - mode: "quick" (default) or "full"
 *   - quick: 5 generations, 10 population
 *   - full: 10 generations, 20 population
 */
router.post("/run", async (req: Request, res: Response) => {
  const mode = (req.query.mode as string) || "quick";

  // For now, return 501 Not Implemented with guidance
  // Background job infrastructure would require additional setup
  // (e.g., Bull queue, worker process, job status tracking)

  res.status(501).json({
    error: "Background optimization not yet implemented",
    guidance: {
      message: "To run optimization manually, use the CLI:",
      commands: [
        "pnpm run optimizer           # Run genetic algorithm optimizer",
        "pnpm run report              # Generate performance report",
      ],
      mode,
      estimatedDuration: mode === "quick" ? "5-10 minutes" : "30-60 minutes",
    },
    status: "not_implemented",
  });

  // Future implementation would look like:
  // 1. Validate auth (admin only)
  // 2. Check for existing running job
  // 3. Spawn worker process or add to job queue
  // 4. Return 202 with job ID
  // 5. Client polls /api/optimizer/status or /api/optimizer/job/:id
});

/**
 * GET /api/optimizer/detectors
 *
 * Returns list of available detectors that can be optimized.
 * Useful for debugging and understanding what strategies exist.
 */
router.get("/detectors", async (_req: Request, res: Response) => {
  try {
    // Import detector list dynamically to avoid circular dependencies
    const { BACKTESTABLE_DETECTORS_WITH_KCU, FLOW_PRIMARY_DETECTORS } = await import(
      "../../src/lib/composite/detectors/index.js"
    );

    const detectors = [...BACKTESTABLE_DETECTORS_WITH_KCU, ...FLOW_PRIMARY_DETECTORS]
      .filter(Boolean)
      .map((d: any) => ({
        type: d.type,
        name: d.name || d.type,
        category: d.category || "unknown",
      }));

    res.status(200).json({
      count: detectors.length,
      detectors,
    });
  } catch (error) {
    console.error("[Optimizer] Failed to load detectors:", error);
    res.status(500).json({
      error: "Failed to load detector list",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/optimizer/pending
 *
 * Returns strategies with pending optimization params awaiting activation.
 */
router.get("/pending", async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("strategy_definitions")
      .select(
        "id, name, slug, category, pending_params, active_params, last_optimized_at, baseline_expectancy"
      )
      .eq("enabled", true)
      .not("pending_params", "is", null)
      .order("last_optimized_at", { ascending: false });

    if (error) {
      console.error("[Optimizer] Error fetching pending params:", error);
      return res.status(500).json({ error: "Failed to fetch pending params" });
    }

    // Calculate improvement for each strategy
    const strategies = (data || []).map((s: any) => {
      const pendingExpectancy = s.pending_params?.newExpectancy;
      const baselineExpectancy = s.baseline_expectancy;
      let improvement = null;

      if (pendingExpectancy != null && baselineExpectancy != null && baselineExpectancy > 0) {
        improvement = ((pendingExpectancy - baselineExpectancy) / baselineExpectancy) * 100;
      }

      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        pendingParams: s.pending_params,
        activeParams: s.active_params,
        lastOptimizedAt: s.last_optimized_at,
        baselineExpectancy,
        newExpectancy: pendingExpectancy,
        improvementPercent: improvement != null ? Math.round(improvement * 10) / 10 : null,
        isActivated: s.active_params != null,
      };
    });

    res.status(200).json({
      count: strategies.length,
      strategies,
    });
  } catch (error) {
    console.error("[Optimizer] Error in /pending:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PATCH /api/optimizer/activate/:strategyId
 *
 * Activates pending params for a specific strategy.
 * Copies pending_params → active_params.
 */
router.patch("/activate/:strategyId", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    if (!strategyId) {
      return res.status(400).json({ error: "Missing strategyId parameter" });
    }

    const supabase = getSupabaseClient();

    // First, check if strategy exists and has pending params
    const { data: strategyData, error: fetchError } = await supabase
      .from("strategy_definitions")
      .select("id, name, slug, pending_params, active_params")
      .eq("id", strategyId)
      .single();

    const strategy = strategyData as {
      id: string;
      name: string;
      slug: string;
      pending_params: any;
      active_params: any;
    } | null;

    if (fetchError || !strategy) {
      return res.status(404).json({
        error: "Strategy not found",
        strategyId,
      });
    }

    if (!strategy.pending_params) {
      return res.status(400).json({
        error: "No pending params to activate",
        strategyId,
        strategyName: strategy.name,
      });
    }

    // Copy pending_params to active_params
    const { data: updatedData, error: updateError } = await (
      supabase.from("strategy_definitions") as any
    )
      .update({
        active_params: strategy.pending_params,
        updated_at: new Date().toISOString(),
      })
      .eq("id", strategyId)
      .select("id, name, slug, active_params, pending_params")
      .single();

    const updated = updatedData as {
      id: string;
      name: string;
      slug: string;
      active_params: any;
      pending_params: any;
    } | null;

    if (updateError || !updated) {
      console.error("[Optimizer] Error activating params:", updateError);
      return res.status(500).json({ error: "Failed to activate params" });
    }

    console.log(`[Optimizer] ✅ Activated params for strategy: ${updated.name} (${strategyId})`);

    res.status(200).json({
      success: true,
      strategy: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        activeParams: updated.active_params,
      },
      message: `Activated optimization params for ${updated.name}`,
    });
  } catch (error) {
    console.error("[Optimizer] Error in /activate/:strategyId:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/optimizer/activate-all
 *
 * Activates pending params for ALL strategies that have pending_params.
 * Query params:
 * - minImprovement: Minimum improvement percentage required (default: 0)
 */
router.post("/activate-all", async (req: Request, res: Response) => {
  try {
    const minImprovement = parseFloat(req.query.minImprovement as string) || 0;

    const supabase = getSupabaseClient();

    // Fetch all strategies with pending params
    const { data: strategiesData, error: fetchError } = await supabase
      .from("strategy_definitions")
      .select("id, name, slug, pending_params, baseline_expectancy")
      .eq("enabled", true)
      .not("pending_params", "is", null);

    const strategies = strategiesData as Array<{
      id: string;
      name: string;
      slug: string;
      pending_params: any;
      baseline_expectancy: number | null;
    }> | null;

    if (fetchError) {
      console.error("[Optimizer] Error fetching strategies:", fetchError);
      return res.status(500).json({ error: "Failed to fetch strategies" });
    }

    if (!strategies || strategies.length === 0) {
      return res.status(200).json({
        success: true,
        activated: 0,
        skipped: 0,
        message: "No strategies with pending params found",
      });
    }

    // Filter by minimum improvement if specified
    const toActivate: string[] = [];
    const skipped: Array<{ id: string; name: string; reason: string }> = [];

    for (const strategy of strategies) {
      const pendingExpectancy = strategy.pending_params?.newExpectancy;
      const baseline = strategy.baseline_expectancy;

      let improvement = 0;
      if (pendingExpectancy != null && baseline != null && baseline > 0) {
        improvement = ((pendingExpectancy - baseline) / baseline) * 100;
      }

      if (improvement >= minImprovement) {
        toActivate.push(strategy.id);
      } else {
        skipped.push({
          id: strategy.id,
          name: strategy.name,
          reason: `Improvement ${improvement.toFixed(1)}% < minimum ${minImprovement}%`,
        });
      }
    }

    if (toActivate.length === 0) {
      return res.status(200).json({
        success: true,
        activated: 0,
        skipped: skipped.length,
        skippedStrategies: skipped,
        message: "No strategies met the minimum improvement threshold",
      });
    }

    // Individual updates for each strategy
    let activated = 0;
    for (const id of toActivate) {
      const strategy = strategies.find((s) => s.id === id);
      if (!strategy) continue;

      const { error } = await (supabase.from("strategy_definitions") as any)
        .update({
          active_params: strategy.pending_params,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (!error) {
        activated++;
        console.log(`[Optimizer] ✅ Activated params for: ${strategy.name}`);
      } else {
        console.error(`[Optimizer] Failed to activate ${strategy.name}:`, error);
      }
    }

    res.status(200).json({
      success: true,
      activated,
      skipped: skipped.length,
      skippedStrategies: skipped,
      message: `Activated ${activated} strategies`,
    });
  } catch (error) {
    console.error("[Optimizer] Error in /activate-all:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /api/optimizer/deactivate/:strategyId
 *
 * Deactivates (clears) active params for a specific strategy.
 */
router.delete("/deactivate/:strategyId", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    if (!strategyId) {
      return res.status(400).json({ error: "Missing strategyId parameter" });
    }

    const supabase = getSupabaseClient();

    const { data: updatedData, error } = await (supabase.from("strategy_definitions") as any)
      .update({
        active_params: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", strategyId)
      .select("id, name, slug")
      .single();

    const updated = updatedData as { id: string; name: string; slug: string } | null;

    if (error) {
      console.error("[Optimizer] Error deactivating params:", error);
      return res.status(500).json({ error: "Failed to deactivate params" });
    }

    if (!updated) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    console.log(`[Optimizer] ⏹️ Deactivated params for: ${updated.name}`);

    res.status(200).json({
      success: true,
      strategy: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
      },
      message: `Deactivated optimization params for ${updated.name}`,
    });
  } catch (error) {
    console.error("[Optimizer] Error in /deactivate/:strategyId:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
