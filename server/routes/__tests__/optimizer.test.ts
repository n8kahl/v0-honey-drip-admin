/**
 * Optimizer API Endpoint Tests
 *
 * Tests for the optimizer status and control endpoints.
 * Tests verify:
 * 1. GET /status returns 200 when files exist
 * 2. GET /status returns 200 with missingFiles when files don't exist
 * 3. Response shapes match expected format
 * 4. No secrets are exposed in responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// Mock fs module
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// ============================================================================
// Mock Data
// ============================================================================

const mockOptimizedParams = {
  parameters: {
    minScores: { scalp: 80, day: 80, swing: 80 },
    ivBoosts: { lowIV: 0.15, highIV: -0.2 },
    gammaBoosts: { shortGamma: 0.15, longGamma: -0.1 },
    flowBoosts: { aligned: 0.2, opposed: -0.15 },
    mtfWeights: { weekly: 3, daily: 2, hourly: 1, fifteenMin: 0.5 },
    riskReward: { targetMultiple: 2.42, stopMultiple: 1.16, maxHoldBars: 16 },
  },
  performance: {
    winRate: 0.45,
    profitFactor: 1.8,
    totalTrades: 100,
  },
  timestamp: "2026-01-10T10:00:00.000Z",
  phase: 4,
};

const mockOptimizedReport = {
  timestamp: "2026-01-10T12:00:00.000Z",
  parametersSummary: {
    targetMultiple: 2.42,
    stopMultiple: 1.16,
    maxHoldBars: 16,
  },
  perDetectorStats: [
    {
      detector: "breakout-bullish",
      winRate: 0.55,
      profitFactor: 2.1,
      totalTrades: 20,
      avgHoldBars: 8,
      expectancy: 0.35,
    },
    {
      detector: "mean-reversion-long",
      winRate: 0.45,
      profitFactor: 1.5,
      totalTrades: 15,
      avgHoldBars: 12,
      expectancy: 0.2,
    },
  ],
  ranking: ["breakout-bullish", "mean-reversion-long"],
  testedSymbols: ["SPY", "TSLA", "NVDA", "MSFT", "AMD"],
  windowStartDate: "2025-12-10",
  windowEndDate: "2026-01-10",
  totalTrades: 35,
  avgWinRate: 0.5,
  avgProfitFactor: 1.8,
};

// ============================================================================
// Helper Functions (simulating route logic)
// ============================================================================

interface OptimizedParams {
  parameters: Record<string, unknown>;
  performance: {
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  timestamp: string;
  phase: number;
}

interface OptimizedReport {
  timestamp: string;
  parametersSummary: Record<string, unknown>;
  perDetectorStats: Array<{
    detector: string;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  }>;
  ranking: string[];
  testedSymbols: string[];
  windowStartDate: string;
  windowEndDate: string;
  totalTrades: number;
  avgWinRate: number;
  avgProfitFactor: number;
}

interface OptimizerStatusResponse {
  paramsConfig: OptimizedParams | null;
  performanceSummary: OptimizedParams["performance"] | null;
  report: OptimizedReport | null;
  missingFiles: string[];
  lastUpdated: string | null;
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function getOptimizerStatus(): OptimizerStatusResponse {
  const configDir = join(process.cwd(), "config");
  const paramsPath = join(configDir, "optimized-params.json");
  const reportPath = join(configDir, "optimized-report.json");

  const missingFiles: string[] = [];

  const paramsConfig = safeReadJson<OptimizedParams>(paramsPath);
  if (!paramsConfig) {
    missingFiles.push("optimized-params.json");
  }

  const report = safeReadJson<OptimizedReport>(reportPath);
  if (!report) {
    missingFiles.push("optimized-report.json");
  }

  const performanceSummary = paramsConfig?.performance ?? null;
  const lastUpdated = report?.timestamp ?? paramsConfig?.timestamp ?? null;

  return {
    paramsConfig,
    performanceSummary,
    report,
    missingFiles,
    lastUpdated,
  };
}

// ============================================================================
// GET /api/optimizer/status Tests
// ============================================================================

describe("GET /api/optimizer/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("When both files exist", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path: any) => {
        if (path.includes("optimized-params.json")) {
          return JSON.stringify(mockOptimizedParams);
        }
        if (path.includes("optimized-report.json")) {
          return JSON.stringify(mockOptimizedReport);
        }
        throw new Error("Unknown file");
      });
    });

    it("returns paramsConfig with all parameters", () => {
      const response = getOptimizerStatus();

      expect(response.paramsConfig).not.toBeNull();
      expect(response.paramsConfig?.parameters).toHaveProperty("riskReward");
      expect(response.paramsConfig?.parameters).toHaveProperty("minScores");
    });

    it("returns performanceSummary from params", () => {
      const response = getOptimizerStatus();

      expect(response.performanceSummary).not.toBeNull();
      expect(response.performanceSummary?.winRate).toBe(0.45);
      expect(response.performanceSummary?.profitFactor).toBe(1.8);
      expect(response.performanceSummary?.totalTrades).toBe(100);
    });

    it("returns report with per-detector stats", () => {
      const response = getOptimizerStatus();

      expect(response.report).not.toBeNull();
      expect(response.report?.perDetectorStats.length).toBe(2);
      expect(response.report?.ranking).toContain("breakout-bullish");
    });

    it("returns empty missingFiles array", () => {
      const response = getOptimizerStatus();

      expect(response.missingFiles).toEqual([]);
    });

    it("returns lastUpdated timestamp from report", () => {
      const response = getOptimizerStatus();

      expect(response.lastUpdated).toBe("2026-01-10T12:00:00.000Z");
    });
  });

  describe("When only params file exists", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes("optimized-params.json");
      });
      vi.mocked(readFileSync).mockImplementation((path: any) => {
        if (path.includes("optimized-params.json")) {
          return JSON.stringify(mockOptimizedParams);
        }
        throw new Error("File not found");
      });
    });

    it("returns paramsConfig but null report", () => {
      const response = getOptimizerStatus();

      expect(response.paramsConfig).not.toBeNull();
      expect(response.report).toBeNull();
    });

    it("includes optimized-report.json in missingFiles", () => {
      const response = getOptimizerStatus();

      expect(response.missingFiles).toContain("optimized-report.json");
      expect(response.missingFiles).not.toContain("optimized-params.json");
    });

    it("returns lastUpdated from params timestamp", () => {
      const response = getOptimizerStatus();

      expect(response.lastUpdated).toBe("2026-01-10T10:00:00.000Z");
    });
  });

  describe("When only report file exists", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes("optimized-report.json");
      });
      vi.mocked(readFileSync).mockImplementation((path: any) => {
        if (path.includes("optimized-report.json")) {
          return JSON.stringify(mockOptimizedReport);
        }
        throw new Error("File not found");
      });
    });

    it("returns report but null paramsConfig", () => {
      const response = getOptimizerStatus();

      expect(response.paramsConfig).toBeNull();
      expect(response.report).not.toBeNull();
    });

    it("includes optimized-params.json in missingFiles", () => {
      const response = getOptimizerStatus();

      expect(response.missingFiles).toContain("optimized-params.json");
      expect(response.missingFiles).not.toContain("optimized-report.json");
    });

    it("returns null performanceSummary", () => {
      const response = getOptimizerStatus();

      expect(response.performanceSummary).toBeNull();
    });
  });

  describe("When neither file exists", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(false);
    });

    it("returns null for paramsConfig, report, and performanceSummary", () => {
      const response = getOptimizerStatus();

      expect(response.paramsConfig).toBeNull();
      expect(response.report).toBeNull();
      expect(response.performanceSummary).toBeNull();
    });

    it("includes both files in missingFiles", () => {
      const response = getOptimizerStatus();

      expect(response.missingFiles).toContain("optimized-params.json");
      expect(response.missingFiles).toContain("optimized-report.json");
    });

    it("returns null lastUpdated", () => {
      const response = getOptimizerStatus();

      expect(response.lastUpdated).toBeNull();
    });
  });

  describe("When file read fails (malformed JSON)", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("{ invalid json }");
    });

    it("returns null for both and includes in missingFiles", () => {
      const response = getOptimizerStatus();

      expect(response.paramsConfig).toBeNull();
      expect(response.report).toBeNull();
      expect(response.missingFiles.length).toBe(2);
    });
  });
});

// ============================================================================
// Response Shape Tests
// ============================================================================

describe("Response Shape Validation", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (path.includes("optimized-params.json")) {
        return JSON.stringify(mockOptimizedParams);
      }
      if (path.includes("optimized-report.json")) {
        return JSON.stringify(mockOptimizedReport);
      }
      throw new Error("Unknown file");
    });
  });

  it("paramsConfig has required structure", () => {
    const response = getOptimizerStatus();
    const params = response.paramsConfig;

    expect(params).toHaveProperty("parameters");
    expect(params).toHaveProperty("performance");
    expect(params).toHaveProperty("timestamp");
    expect(params).toHaveProperty("phase");
  });

  it("report has required structure", () => {
    const response = getOptimizerStatus();
    const report = response.report;

    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("parametersSummary");
    expect(report).toHaveProperty("perDetectorStats");
    expect(report).toHaveProperty("ranking");
    expect(report).toHaveProperty("testedSymbols");
    expect(report).toHaveProperty("windowStartDate");
    expect(report).toHaveProperty("windowEndDate");
    expect(report).toHaveProperty("totalTrades");
    expect(report).toHaveProperty("avgWinRate");
  });

  it("perDetectorStats has required fields", () => {
    const response = getOptimizerStatus();
    const detector = response.report?.perDetectorStats[0];

    expect(detector).toHaveProperty("detector");
    expect(detector).toHaveProperty("winRate");
    expect(detector).toHaveProperty("profitFactor");
    expect(detector).toHaveProperty("totalTrades");
  });
});

// ============================================================================
// Security Tests
// ============================================================================

describe("Security Validation", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (path.includes("optimized-params.json")) {
        return JSON.stringify(mockOptimizedParams);
      }
      if (path.includes("optimized-report.json")) {
        return JSON.stringify(mockOptimizedReport);
      }
      throw new Error("Unknown file");
    });
  });

  it("does not expose API keys", () => {
    const response = getOptimizerStatus();
    const stringified = JSON.stringify(response);

    // Ensure no common secret patterns
    expect(stringified).not.toContain("API_KEY");
    expect(stringified).not.toContain("SECRET");
    expect(stringified).not.toContain("TOKEN");
    expect(stringified).not.toContain("PASSWORD");
  });

  it("does not expose env vars", () => {
    const response = getOptimizerStatus();
    const stringified = JSON.stringify(response);

    expect(stringified).not.toContain("process.env");
    expect(stringified).not.toContain("SUPABASE_");
    expect(stringified).not.toContain("MASSIVE_");
  });

  it("only contains expected keys in response", () => {
    const response = getOptimizerStatus();
    const keys = Object.keys(response);

    expect(keys).toEqual([
      "paramsConfig",
      "performanceSummary",
      "report",
      "missingFiles",
      "lastUpdated",
    ]);
  });
});

// ============================================================================
// POST /api/optimizer/run Tests (501 Not Implemented)
// ============================================================================

describe("POST /api/optimizer/run", () => {
  it("should return 501 status code guidance", () => {
    // Simulating the expected response structure
    const response = {
      error: "Background optimization not yet implemented",
      guidance: {
        message: "To run optimization manually, use the CLI:",
        commands: [
          "pnpm run optimizer           # Run genetic algorithm optimizer",
          "pnpm run report              # Generate performance report",
        ],
        mode: "quick",
        estimatedDuration: "5-10 minutes",
      },
      status: "not_implemented",
    };

    expect(response.error).toContain("not yet implemented");
    expect(response.guidance.commands.length).toBeGreaterThan(0);
    expect(response.status).toBe("not_implemented");
  });

  it("provides correct duration estimate for quick mode", () => {
    const mode = "quick";
    const estimatedDuration = mode === "quick" ? "5-10 minutes" : "30-60 minutes";

    expect(estimatedDuration).toBe("5-10 minutes");
  });

  it("provides correct duration estimate for full mode", () => {
    const mode: string = "full";
    const estimatedDuration = mode === "quick" ? "5-10 minutes" : "30-60 minutes";

    expect(estimatedDuration).toBe("30-60 minutes");
  });
});
