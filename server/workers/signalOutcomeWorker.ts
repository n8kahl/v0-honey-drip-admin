/**
 * Signal Outcome Worker
 * Phase 6: Performance Analytics Pipeline
 *
 * Evaluates expired composite signals by walking through historical bars
 * to determine exit outcomes (stopped, target hit, or expired).
 *
 * Features:
 * - Runs every 5 minutes to process expired signals
 * - Fetches 1m bars for signal lifetime
 * - Simulates path-dependent exits using bar high/low
 * - Computes realized P&L in R-multiple units
 * - Updates composite_signals with exit data
 * - Idempotent: skips signals already processed
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CompositeSignalRow } from "../../src/lib/supabase/compositeSignals.js";
import { fetchBarsForRange, type RawBar } from "./lib/barProvider.js";

// Configuration
const OUTCOME_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SIGNALS_PER_RUN = 50; // Limit to avoid overloading
const BARS_DAYS_BACK = 7; // Fetch up to 7 days of bars

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
// Exit Resolution Types
// ============================================================================

export type ExitReason = "STOP" | "T1" | "T2" | "T3" | "EXPIRED";
export type ExitStatus = "STOPPED" | "TARGET_HIT" | "EXPIRED";

export interface ExitResult {
  status: ExitStatus;
  exitReason: ExitReason;
  exitPrice: number;
  exitedAt: Date;
  maxFavorableExcursion: number; // MFE: best price reached
  maxAdverseExcursion: number; // MAE: worst price reached
  holdTimeMinutes: number;
  realizedPnl: number; // R-multiple
  realizedPnlPct: number; // Percentage
}

export interface SignalPrices {
  entryPrice: number;
  stopPrice: number;
  targetT1: number;
  targetT2: number;
  targetT3: number;
  direction: "LONG" | "SHORT";
}

// ============================================================================
// Bar Walk Exit Resolution
// ============================================================================

/**
 * Walk through bars to determine exit outcome
 *
 * For LONG positions:
 * - If low <= stop first → STOPPED
 * - If high >= T1/T2/T3 → TARGET_HIT (prefer T3 > T2 > T1 if hit same bar)
 * - If no exit triggered → EXPIRED
 *
 * For SHORT positions:
 * - If high >= stop first → STOPPED
 * - If low <= T1/T2/T3 → TARGET_HIT
 * - If no exit triggered → EXPIRED
 *
 * @param bars - Array of 1m bars sorted by timestamp ascending
 * @param prices - Signal entry/stop/target prices
 * @param startTime - Signal creation time (only process bars after this)
 * @param endTime - Signal expiration time (only process bars before this)
 */
export function resolveExitFromBars(
  bars: RawBar[],
  prices: SignalPrices,
  startTime: number,
  endTime: number
): ExitResult {
  const { entryPrice, stopPrice, targetT1, targetT2, targetT3, direction } = prices;

  // Risk = distance from entry to stop
  const risk = Math.abs(entryPrice - stopPrice);

  // Track MFE/MAE
  let maxFavorableExcursion = 0;
  let maxAdverseExcursion = 0;

  // Filter and sort bars within signal lifetime
  const relevantBars = bars
    .filter((bar) => bar.t >= startTime && bar.t <= endTime)
    .sort((a, b) => a.t - b.t);

  if (relevantBars.length === 0) {
    // No bars in range, mark as expired
    return {
      status: "EXPIRED",
      exitReason: "EXPIRED",
      exitPrice: entryPrice,
      exitedAt: new Date(endTime),
      maxFavorableExcursion: 0,
      maxAdverseExcursion: 0,
      holdTimeMinutes: Math.floor((endTime - startTime) / 60000),
      realizedPnl: 0,
      realizedPnlPct: 0,
    };
  }

  // Walk through bars
  for (const bar of relevantBars) {
    const { h: high, l: low, t: timestamp } = bar;

    if (direction === "LONG") {
      // Update MFE (max high)
      const favorableMove = high - entryPrice;
      if (favorableMove > maxFavorableExcursion) {
        maxFavorableExcursion = favorableMove;
      }

      // Update MAE (max low below entry)
      const adverseMove = entryPrice - low;
      if (adverseMove > maxAdverseExcursion) {
        maxAdverseExcursion = adverseMove;
      }

      // Check stop first (conservative: assume worst case)
      if (low <= stopPrice) {
        return buildExitResult(
          "STOPPED",
          "STOP",
          stopPrice,
          timestamp,
          startTime,
          entryPrice,
          risk,
          direction,
          maxFavorableExcursion,
          maxAdverseExcursion
        );
      }

      // Check targets (prefer higher targets if hit same bar)
      if (high >= targetT3) {
        return buildExitResult(
          "TARGET_HIT",
          "T3",
          targetT3,
          timestamp,
          startTime,
          entryPrice,
          risk,
          direction,
          maxFavorableExcursion,
          maxAdverseExcursion
        );
      }
      if (high >= targetT2) {
        return buildExitResult(
          "TARGET_HIT",
          "T2",
          targetT2,
          timestamp,
          startTime,
          entryPrice,
          risk,
          direction,
          maxFavorableExcursion,
          maxAdverseExcursion
        );
      }
      if (high >= targetT1) {
        return buildExitResult(
          "TARGET_HIT",
          "T1",
          targetT1,
          timestamp,
          startTime,
          entryPrice,
          risk,
          direction,
          maxFavorableExcursion,
          maxAdverseExcursion
        );
      }
    } else {
      // SHORT position logic (inverted)

      // Update MFE (max low below entry)
      const favorableMove = entryPrice - low;
      if (favorableMove > maxFavorableExcursion) {
        maxFavorableExcursion = favorableMove;
      }

      // Update MAE (max high above entry)
      const adverseMove = high - entryPrice;
      if (adverseMove > maxAdverseExcursion) {
        maxAdverseExcursion = adverseMove;
      }

      // Check stop first (high >= stop for shorts)
      if (high >= stopPrice) {
        return buildExitResult(
          "STOPPED",
          "STOP",
          stopPrice,
          timestamp,
          startTime,
          entryPrice,
          risk,
          direction,
          maxFavorableExcursion,
          maxAdverseExcursion
        );
      }

      // Check targets (low <= target for shorts)
      if (low <= targetT3) {
        return buildExitResult(
          "TARGET_HIT",
          "T3",
          targetT3,
          timestamp,
          startTime,
          entryPrice,
          risk,
          direction,
          maxFavorableExcursion,
          maxAdverseExcursion
        );
      }
      if (low <= targetT2) {
        return buildExitResult(
          "TARGET_HIT",
          "T2",
          targetT2,
          timestamp,
          startTime,
          entryPrice,
          risk,
          direction,
          maxFavorableExcursion,
          maxAdverseExcursion
        );
      }
      if (low <= targetT1) {
        return buildExitResult(
          "TARGET_HIT",
          "T1",
          targetT1,
          timestamp,
          startTime,
          entryPrice,
          risk,
          direction,
          maxFavorableExcursion,
          maxAdverseExcursion
        );
      }
    }
  }

  // No exit triggered - mark as expired at last bar's close
  const lastBar = relevantBars[relevantBars.length - 1];
  return buildExitResult(
    "EXPIRED",
    "EXPIRED",
    lastBar.c,
    endTime,
    startTime,
    entryPrice,
    risk,
    direction,
    maxFavorableExcursion,
    maxAdverseExcursion
  );
}

/**
 * Build exit result with calculated R-multiple and percentage P&L
 */
function buildExitResult(
  status: ExitStatus,
  exitReason: ExitReason,
  exitPrice: number,
  exitTimestamp: number,
  startTime: number,
  entryPrice: number,
  risk: number,
  direction: "LONG" | "SHORT",
  mfe: number,
  mae: number
): ExitResult {
  // Calculate P&L based on direction
  const priceDelta = direction === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice;

  // R-multiple: P&L divided by risk
  const realizedPnl = risk > 0 ? priceDelta / risk : 0;

  // Percentage P&L
  const realizedPnlPct = entryPrice > 0 ? (priceDelta / entryPrice) * 100 : 0;

  // Hold time in minutes
  const holdTimeMinutes = Math.floor((exitTimestamp - startTime) / 60000);

  return {
    status,
    exitReason,
    exitPrice,
    exitedAt: new Date(exitTimestamp),
    maxFavorableExcursion: mfe,
    maxAdverseExcursion: mae,
    holdTimeMinutes: Math.max(0, holdTimeMinutes),
    realizedPnl: Math.round(realizedPnl * 100) / 100, // Round to 2 decimals
    realizedPnlPct: Math.round(realizedPnlPct * 100) / 100,
  };
}

// ============================================================================
// Signal Processing
// ============================================================================

/**
 * Fetch expired signals that need outcome processing
 */
async function fetchExpiredSignals(): Promise<CompositeSignalRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("composite_signals")
    .select("*")
    .eq("status", "ACTIVE")
    .lte("expires_at", new Date().toISOString())
    .is("exited_at", null)
    .order("expires_at", { ascending: true })
    .limit(MAX_SIGNALS_PER_RUN);

  if (error) {
    console.error("[Signal Outcome] Error fetching expired signals:", error);
    return [];
  }

  return data || [];
}

/**
 * Process a single signal's outcome
 */
async function processSignalOutcome(signal: CompositeSignalRow): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    // Fetch 1m bars for the signal's symbol
    const { bars } = await fetchBarsForRange(signal.symbol, 1, "minute", BARS_DAYS_BACK);

    if (!bars || bars.length === 0) {
      console.warn(`[Signal Outcome] No bars found for ${signal.symbol}, marking as expired`);
    }

    // Build prices object
    const prices: SignalPrices = {
      entryPrice: Number(signal.entry_price),
      stopPrice: Number(signal.stop_price),
      targetT1: Number(signal.target_t1),
      targetT2: Number(signal.target_t2),
      targetT3: Number(signal.target_t3),
      direction: signal.direction as "LONG" | "SHORT",
    };

    // Resolve exit from bars
    const startTime = new Date(signal.created_at).getTime();
    const endTime = new Date(signal.expires_at).getTime();

    const exitResult = resolveExitFromBars(bars || [], prices, startTime, endTime);

    // Update signal with exit data
    const updateData: Record<string, any> = {
      status: exitResult.status,
      exited_at: exitResult.exitedAt.toISOString(),
      exit_price: exitResult.exitPrice,
      exit_reason: exitResult.exitReason,
      max_favorable_excursion: exitResult.maxFavorableExcursion,
      max_adverse_excursion: exitResult.maxAdverseExcursion,
      hold_time_minutes: exitResult.holdTimeMinutes,
      realized_pnl: exitResult.realizedPnl,
      realized_pnl_pct: exitResult.realizedPnlPct,
    };

    // Set filled_at and fill_price if not already set (for performance modeling)
    if (!signal.filled_at) {
      updateData.filled_at = signal.created_at;
      updateData.fill_price = signal.entry_price;
    }

    const { error } = await supabase
      .from("composite_signals")
      .update(updateData)
      .eq("id", signal.id);

    if (error) {
      console.error(`[Signal Outcome] Error updating signal ${signal.id}:`, error);
      return false;
    }

    console.log(
      `[Signal Outcome] ✅ ${signal.symbol} ${signal.direction} → ${exitResult.status} (${exitResult.exitReason}) R=${exitResult.realizedPnl.toFixed(2)}`
    );

    return true;
  } catch (error) {
    console.error(`[Signal Outcome] Error processing signal ${signal.id}:`, error);
    return false;
  }
}

/**
 * Process all expired signals
 */
async function processExpiredSignals(): Promise<{ processed: number; errors: number }> {
  console.log("[Signal Outcome] Starting outcome processing run...");

  const signals = await fetchExpiredSignals();

  if (signals.length === 0) {
    console.log("[Signal Outcome] No expired signals to process");
    return { processed: 0, errors: 0 };
  }

  console.log(`[Signal Outcome] Processing ${signals.length} expired signals...`);

  let processed = 0;
  let errors = 0;

  for (const signal of signals) {
    try {
      const success = await processSignalOutcome(signal);
      if (success) {
        processed++;
      } else {
        errors++;
      }

      // Small delay between signals to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[Signal Outcome] Exception processing signal ${signal.id}:`, error);
      errors++;
    }
  }

  console.log(`[Signal Outcome] Completed: ${processed} processed, ${errors} errors`);

  return { processed, errors };
}

// ============================================================================
// Worker Class
// ============================================================================

/**
 * Signal Outcome Worker
 * Processes expired signals to determine exit outcomes
 */
export class SignalOutcomeWorker {
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[Signal Outcome] Worker already running");
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Signal Outcome] Missing required environment variables");
      return;
    }

    this.isRunning = true;
    console.log("[Signal Outcome] ======================================");
    console.log("[Signal Outcome] Starting Signal Outcome Worker");
    console.log("[Signal Outcome] Check interval: 5 minutes");
    console.log("[Signal Outcome] Max signals per run: 50");
    console.log("[Signal Outcome] ======================================\n");

    // Run initial processing
    try {
      await processExpiredSignals();
    } catch (error) {
      console.error("[Signal Outcome] Error in initial processing:", error);
    }

    // Schedule recurring processing
    this.timer = setInterval(async () => {
      try {
        await processExpiredSignals();
      } catch (error) {
        console.error("[Signal Outcome] Error in scheduled processing:", error);
      }
    }, OUTCOME_CHECK_INTERVAL);

    console.log("[Signal Outcome] Worker started successfully");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.isRunning = false;
    console.log("[Signal Outcome] Worker stopped");
  }
}

// ============================================================================
// Standalone Execution
// ============================================================================

// Allow running as standalone script
const isMainModule =
  process.argv[1]?.endsWith("signalOutcomeWorker.ts") ||
  process.argv[1]?.endsWith("signalOutcomeWorker.js");

if (isMainModule) {
  console.log("[Signal Outcome] Running as standalone worker...");

  const worker = new SignalOutcomeWorker();
  worker.start().catch((error) => {
    console.error("[Signal Outcome] Failed to start worker:", error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Signal Outcome] Shutting down...");
    worker.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[Signal Outcome] Shutting down...");
    worker.stop();
    process.exit(0);
  });
}
