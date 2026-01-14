/**
 * Optimizer Routes - Exposes optimization status and results to frontend
 *
 * Routes:
 * - GET /api/optimizer/status - Returns current optimization params and report
 * - POST /api/optimizer/run - Kicks off background optimization (quick mode)
 */

import express, { Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const router = express.Router();

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

export default router;
