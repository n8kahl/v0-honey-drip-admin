/**
 * Signal Performance Worker
 * Phase 6: Performance Analytics Pipeline
 *
 * Aggregates daily performance metrics for composite signals and upserts
 * to signal_performance_metrics table.
 *
 * Features:
 * - Runs every 4 hours (or on demand)
 * - Computes metrics for the last 30 days
 * - Aggregates by date/owner/symbol/type/style combinations
 * - Calculates win rate, profit factor, avg hold time, etc.
 * - Idempotent: upserts based on unique constraint
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CompositeSignalRow,
  SignalPerformanceMetricsRow,
} from "../../src/lib/supabase/compositeSignals.js";

// Configuration
const METRICS_UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
const DEFAULT_LOOKBACK_DAYS = 30;

// Supabase client with service role key for server-side operations
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient!;
}

// ============================================================================
// Metrics Calculation (Ported from performanceAnalytics.ts)
// ============================================================================

/**
 * Aggregate metrics from an array of signals for a specific date
 */
function aggregateSignalMetrics(
  signals: CompositeSignalRow[],
  date: string,
  owner: string | null,
  symbol: string | null,
  opportunityType: string | null,
  recommendedStyle: string | null
): Omit<SignalPerformanceMetricsRow, "id" | "created_at" | "updated_at"> {
  const totalSignals = signals.length;

  // Count by status
  const signalsFilled = signals.filter((s) => s.status === "FILLED" || s.exited_at).length;
  const signalsExpired = signals.filter((s) => s.status === "EXPIRED").length;
  const signalsDismissed = signals.filter((s) => s.status === "DISMISSED").length;

  // Only consider exited trades for P&L metrics
  const exitedSignals = signals.filter(
    (s) => s.exited_at && s.realized_pnl !== undefined && s.realized_pnl !== null
  );

  // Win/Loss stats
  const winners = exitedSignals.filter((s) => (s.realized_pnl || 0) > 0).length;
  const losers = exitedSignals.filter((s) => (s.realized_pnl || 0) <= 0).length;
  const winRate = winners + losers > 0 ? (winners / (winners + losers)) * 100 : undefined;

  // P&L stats
  const totalPnl = exitedSignals.reduce((sum, s) => sum + (s.realized_pnl || 0), 0);

  const winningTrades = exitedSignals.filter((s) => (s.realized_pnl || 0) > 0);
  const losingTrades = exitedSignals.filter((s) => (s.realized_pnl || 0) <= 0);

  const avgWinnerPnl =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, s) => sum + (s.realized_pnl || 0), 0) / winningTrades.length
      : undefined;

  const avgLoserPnl =
    losingTrades.length > 0
      ? losingTrades.reduce((sum, s) => sum + (s.realized_pnl || 0), 0) / losingTrades.length
      : undefined;

  const largestWinner =
    winningTrades.length > 0
      ? Math.max(...winningTrades.map((s) => s.realized_pnl || 0))
      : undefined;

  const largestLoser =
    losingTrades.length > 0 ? Math.min(...losingTrades.map((s) => s.realized_pnl || 0)) : undefined;

  // Profit factor = total wins / abs(total losses)
  const totalWins = winningTrades.reduce((sum, s) => sum + (s.realized_pnl || 0), 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, s) => sum + (s.realized_pnl || 0), 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : undefined;

  // Execution stats
  const filledSignals = signals.filter((s) => s.filled_at);

  const avgHoldTimeMinutes =
    exitedSignals.length > 0
      ? Math.round(
          exitedSignals.reduce((sum, s) => sum + (s.hold_time_minutes || 0), 0) /
            exitedSignals.length
        )
      : undefined;

  const avgRiskReward =
    filledSignals.length > 0
      ? filledSignals.reduce((sum, s) => sum + (s.risk_reward || 0), 0) / filledSignals.length
      : undefined;

  // Calculate fill slippage
  const avgFillSlippagePct =
    filledSignals.length > 0
      ? filledSignals.reduce((sum, s) => {
          const slippage = s.fill_price
            ? ((s.fill_price - s.entry_price) / s.entry_price) * 100
            : 0;
          return sum + slippage;
        }, 0) / filledSignals.length
      : undefined;

  // Quality metrics
  const avgBaseScore =
    totalSignals > 0 ? signals.reduce((sum, s) => sum + s.base_score, 0) / totalSignals : undefined;

  const avgStyleScore =
    totalSignals > 0
      ? signals.reduce((sum, s) => sum + s.recommended_style_score, 0) / totalSignals
      : undefined;

  const avgMfe =
    exitedSignals.length > 0
      ? exitedSignals.reduce((sum, s) => sum + (s.max_favorable_excursion || 0), 0) /
        exitedSignals.length
      : undefined;

  const avgMae =
    exitedSignals.length > 0
      ? exitedSignals.reduce((sum, s) => sum + (s.max_adverse_excursion || 0), 0) /
        exitedSignals.length
      : undefined;

  // Exit distribution
  const exitsT1 = exitedSignals.filter((s) => s.exit_reason === "T1").length;
  const exitsT2 = exitedSignals.filter((s) => s.exit_reason === "T2").length;
  const exitsT3 = exitedSignals.filter((s) => s.exit_reason === "T3").length;
  const exitsStop = exitedSignals.filter((s) => s.exit_reason === "STOP").length;
  const exitsManual = exitedSignals.filter((s) => s.exit_reason === "MANUAL").length;
  const exitsExpired = exitedSignals.filter((s) => s.exit_reason === "EXPIRED").length;

  return {
    date,
    owner: owner || undefined,
    symbol: symbol || undefined,
    opportunity_type: opportunityType || undefined,
    recommended_style: recommendedStyle || undefined,
    total_signals: totalSignals,
    signals_filled: signalsFilled,
    signals_expired: signalsExpired,
    signals_dismissed: signalsDismissed,
    winners,
    losers,
    win_rate: winRate,
    total_pnl: totalPnl || undefined,
    avg_winner_pnl: avgWinnerPnl,
    avg_loser_pnl: avgLoserPnl,
    largest_winner: largestWinner,
    largest_loser: largestLoser,
    profit_factor: profitFactor,
    avg_hold_time_minutes: avgHoldTimeMinutes,
    avg_risk_reward: avgRiskReward,
    avg_fill_slippage_pct: avgFillSlippagePct,
    avg_base_score: avgBaseScore,
    avg_style_score: avgStyleScore,
    avg_mfe: avgMfe,
    avg_mae: avgMae,
    exits_t1: exitsT1,
    exits_t2: exitsT2,
    exits_t3: exitsT3,
    exits_stop: exitsStop,
    exits_manual: exitsManual,
    exits_expired: exitsExpired,
  };
}

/**
 * Upsert metrics to database
 */
async function upsertMetrics(
  metrics: Omit<SignalPerformanceMetricsRow, "id" | "created_at" | "updated_at">
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase.from("signal_performance_metrics").upsert(metrics as any, {
      onConflict: "date,owner,symbol,opportunity_type,recommended_style",
    });

    if (error) {
      console.error("[Signal Performance] Error upserting metrics:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Signal Performance] Exception upserting metrics:", error);
    return false;
  }
}

// ============================================================================
// Daily Metrics Processing
// ============================================================================

/**
 * Get unique owners with signals in the date range
 */
async function getOwnersWithSignals(fromDate: Date, toDate: Date): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("composite_signals")
    .select("owner")
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());

  if (error) {
    console.error("[Signal Performance] Error fetching owners:", error);
    return [];
  }

  // Get unique owners
  const owners = [...new Set((data || []).map((s) => s.owner))];
  return owners;
}

/**
 * Fetch signals for a specific date and owner
 */
async function fetchSignalsForDate(date: string, owner: string): Promise<CompositeSignalRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("composite_signals")
    .select("*")
    .eq("owner", owner)
    .gte("created_at", `${date}T00:00:00Z`)
    .lt("created_at", `${date}T23:59:59Z`);

  if (error) {
    console.error(`[Signal Performance] Error fetching signals for ${date}:`, error);
    return [];
  }

  return data || [];
}

/**
 * Process metrics for a single owner and date range
 */
async function processOwnerMetrics(
  owner: string,
  dates: string[]
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (const dateStr of dates) {
    try {
      const signals = await fetchSignalsForDate(dateStr, owner);

      if (signals.length === 0) {
        continue; // Skip dates with no signals
      }

      // Group signals by unique combinations
      const combos = new Map<string, CompositeSignalRow[]>();

      for (const signal of signals) {
        // Aggregated (all dimensions)
        const allKey = "ALL";
        if (!combos.has(allKey)) combos.set(allKey, []);
        combos.get(allKey)!.push(signal);

        // By symbol
        const symbolKey = `SYMBOL:${signal.symbol}`;
        if (!combos.has(symbolKey)) combos.set(symbolKey, []);
        combos.get(symbolKey)!.push(signal);

        // By opportunity type
        const typeKey = `TYPE:${signal.opportunity_type}`;
        if (!combos.has(typeKey)) combos.set(typeKey, []);
        combos.get(typeKey)!.push(signal);

        // By recommended style
        const styleKey = `STYLE:${signal.recommended_style}`;
        if (!combos.has(styleKey)) combos.set(styleKey, []);
        combos.get(styleKey)!.push(signal);

        // Full combination
        const fullKey = `${signal.symbol}|${signal.opportunity_type}|${signal.recommended_style}`;
        if (!combos.has(fullKey)) combos.set(fullKey, []);
        combos.get(fullKey)!.push(signal);
      }

      // Process each combination
      for (const [key, comboSignals] of combos.entries()) {
        let symbol: string | null = null;
        let opportunityType: string | null = null;
        let recommendedStyle: string | null = null;

        if (key === "ALL") {
          // All null - aggregated metrics
        } else if (key.startsWith("SYMBOL:")) {
          symbol = key.split(":")[1];
        } else if (key.startsWith("TYPE:")) {
          opportunityType = key.split(":")[1];
        } else if (key.startsWith("STYLE:")) {
          recommendedStyle = key.split(":")[1];
        } else if (key.includes("|")) {
          const parts = key.split("|");
          symbol = parts[0];
          opportunityType = parts[1];
          recommendedStyle = parts[2];
        }

        const metrics = aggregateSignalMetrics(
          comboSignals,
          dateStr,
          owner,
          symbol,
          opportunityType,
          recommendedStyle
        );

        const success = await upsertMetrics(metrics);
        if (success) {
          processed++;
        } else {
          errors++;
        }
      }
    } catch (error) {
      console.error(`[Signal Performance] Error processing ${dateStr} for ${owner}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Process all metrics for the lookback period
 */
async function processAllMetrics(
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): Promise<{ processed: number; errors: number; owners: number }> {
  console.log(`[Signal Performance] Starting metrics aggregation (${lookbackDays} days)...`);

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - lookbackDays);

  // Get all owners with signals in this period
  const owners = await getOwnersWithSignals(fromDate, toDate);

  if (owners.length === 0) {
    console.log("[Signal Performance] No owners with signals found");
    return { processed: 0, errors: 0, owners: 0 };
  }

  console.log(`[Signal Performance] Processing ${owners.length} owners...`);

  // Generate date strings for the period
  const dates: string[] = [];
  const current = new Date(fromDate);
  while (current <= toDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const owner of owners) {
    try {
      const { processed, errors } = await processOwnerMetrics(owner, dates);
      totalProcessed += processed;
      totalErrors += errors;

      // Small delay between owners to avoid overloading
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Signal Performance] Error processing owner ${owner}:`, error);
      totalErrors++;
    }
  }

  console.log(
    `[Signal Performance] Completed: ${totalProcessed} metrics upserted, ${totalErrors} errors, ${owners.length} owners`
  );

  return { processed: totalProcessed, errors: totalErrors, owners: owners.length };
}

// ============================================================================
// Worker Class
// ============================================================================

/**
 * Signal Performance Worker
 * Aggregates daily performance metrics
 */
export class SignalPerformanceWorker {
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[Signal Performance] Worker already running");
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Signal Performance] Missing required environment variables");
      return;
    }

    this.isRunning = true;
    console.log("[Signal Performance] ======================================");
    console.log("[Signal Performance] Starting Signal Performance Worker");
    console.log("[Signal Performance] Update interval: 4 hours");
    console.log("[Signal Performance] Lookback period: 30 days");
    console.log("[Signal Performance] ======================================\n");

    // Run initial aggregation
    try {
      await processAllMetrics();
    } catch (error) {
      console.error("[Signal Performance] Error in initial aggregation:", error);
    }

    // Schedule recurring aggregation
    this.timer = setInterval(async () => {
      try {
        await processAllMetrics();
      } catch (error) {
        console.error("[Signal Performance] Error in scheduled aggregation:", error);
      }
    }, METRICS_UPDATE_INTERVAL);

    console.log("[Signal Performance] Worker started successfully");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.isRunning = false;
    console.log("[Signal Performance] Worker stopped");
  }

  /**
   * Manually trigger metrics update
   */
  async triggerUpdate(lookbackDays?: number): Promise<void> {
    console.log("[Signal Performance] Manual update triggered");
    await processAllMetrics(lookbackDays);
  }
}

// ============================================================================
// Standalone Execution
// ============================================================================

// Allow running as standalone script
const isMainModule =
  process.argv[1]?.endsWith("signalPerformanceWorker.ts") ||
  process.argv[1]?.endsWith("signalPerformanceWorker.js");

if (isMainModule) {
  console.log("[Signal Performance] Running as standalone worker...");

  const worker = new SignalPerformanceWorker();
  worker.start().catch((error) => {
    console.error("[Signal Performance] Failed to start worker:", error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Signal Performance] Shutting down...");
    worker.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[Signal Performance] Shutting down...");
    worker.stop();
    process.exit(0);
  });
}
