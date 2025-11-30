/**
 * Signal Performance Tracking
 * Phase 1.3: Historical win rate tracking infrastructure
 *
 * Provides comprehensive tracking of signal outcomes for:
 * - Historical win rate analysis by context
 * - ML training data generation
 * - Adaptive threshold optimization
 * - Performance reporting
 *
 * Key features:
 * - Records every signal with full context (regime, VIX, time of day)
 * - Tracks outcomes (win/loss, P&L, hold time)
 * - Provides aggregated win rate queries
 * - Supports real-time win rate lookups for scoring
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompositeSignal } from "../composite/CompositeSignal.js";
import type { TimeOfDayWindow, VIXLevel, MarketRegime } from "../composite/AdaptiveThresholds.js";

/**
 * Outcome types for signal tracking
 */
export type SignalOutcome =
  | "WIN_T1" // Hit T1 target
  | "WIN_T2" // Hit T2 target
  | "WIN_T3" // Hit T3 target
  | "STOP_HIT" // Stop loss triggered
  | "TIME_STOP" // Time-based exit
  | "MANUAL_EXIT" // Manual exit
  | "EXPIRED" // Signal expired without action
  | "PENDING"; // Awaiting outcome

/**
 * Full signal performance record
 */
export interface SignalPerformanceRecord {
  id?: string;
  signalId?: string;

  // Identification
  symbol: string;
  opportunityType: string;
  direction: "LONG" | "SHORT";

  // Context at signal time
  signalTime: Date;
  timeOfDayWindow?: TimeOfDayWindow;
  vixLevel?: VIXLevel;
  marketRegime?: MarketRegime;
  ivPercentile?: number;
  dataConfidence?: number;

  // Signal scores
  baseScore: number;
  scalpScore?: number;
  dayTradeScore?: number;
  swingScore?: number;
  recommendedStyle?: "scalp" | "day_trade" | "swing";
  confluenceCount?: number;
  confluenceBreakdown?: Record<string, number>;

  // Entry details
  entryPrice?: number;
  entryTime?: Date;
  projectedStop?: number;
  projectedT1?: number;
  projectedT2?: number;
  projectedT3?: number;
  projectedRR?: number;

  // Outcome
  outcome: SignalOutcome;
  exitPrice?: number;
  exitTime?: Date;
  actualRR?: number;
  holdTimeMinutes?: number;

  // Excursion
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;

  // Computed
  pnlAmount?: number;
  pnlPercent?: number;
  wasWinner?: boolean;

  // Metadata
  tradeType?: "SCALP" | "DAY" | "SWING" | "LEAP";
  assetClass?: "INDEX" | "EQUITY_ETF" | "STOCK";
  userId?: string;
  notes?: string;
}

/**
 * Query parameters for win rate lookups
 */
export interface WinRateQuery {
  opportunityType?: string;
  marketRegime?: MarketRegime;
  vixLevel?: VIXLevel;
  timeOfDayWindow?: TimeOfDayWindow;
  recommendedStyle?: string;
  assetClass?: string;
  minSampleSize?: number; // Minimum signals for reliable stats
}

/**
 * Win rate result from aggregated queries
 */
export interface WinRateResult {
  opportunityType: string;
  marketRegime?: string;
  vixLevel?: string;
  timeOfDayWindow?: string;
  recommendedStyle?: string;
  assetClass?: string;

  // Counts
  totalSignals: number;
  wins: number;
  losses: number;
  pending: number;
  expired: number;

  // Rates
  winRate: number; // 0-100 percentage
  avgRR: number; // Average R:R achieved
  avgWinPct: number; // Average win size %
  avgLossPct: number; // Average loss size %
  avgHoldTimeMin: number; // Average hold time in minutes
  expectancy: number; // Expected value per trade

  // Confidence in the stats
  sampleSize: number;
  confidence: "high" | "medium" | "low"; // Based on sample size
}

/**
 * Real-time contextual win rate for scoring
 */
export interface ContextualWinRate {
  winRate: number;
  sampleSize: number;
  confidence: number; // 0-1 confidence multiplier
  source: "exact_match" | "partial_match" | "fallback" | "default";
}

/**
 * Signal Performance Tracker
 *
 * Main class for tracking and querying signal performance
 */
export class SignalPerformanceTracker {
  private supabase: SupabaseClient;
  private cache: Map<string, { data: WinRateResult[]; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minute cache

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Record a new signal for tracking
   *
   * Call this when a signal is generated, before the trade is taken
   */
  async recordSignal(
    signal: CompositeSignal,
    context: {
      timeOfDayWindow?: TimeOfDayWindow;
      vixLevel?: VIXLevel;
      marketRegime?: MarketRegime;
      ivPercentile?: number;
      dataConfidence?: number;
    },
    userId?: string
  ): Promise<string | null> {
    try {
      const record: Partial<SignalPerformanceRecord> = {
        signalId: signal.id,
        symbol: signal.symbol,
        opportunityType: signal.opportunityType,
        direction: signal.direction,
        signalTime: signal.createdAt,
        timeOfDayWindow: context.timeOfDayWindow,
        vixLevel: context.vixLevel,
        marketRegime: context.marketRegime,
        ivPercentile: context.ivPercentile,
        dataConfidence: context.dataConfidence,
        baseScore: signal.baseScore,
        scalpScore: signal.scalpScore,
        dayTradeScore: signal.dayTradeScore,
        swingScore: signal.swingScore,
        recommendedStyle: signal.recommendedStyle,
        confluenceCount: Object.keys(signal.confluence).length,
        confluenceBreakdown: signal.confluence,
        entryPrice: signal.entryPrice,
        projectedStop: signal.stopPrice,
        projectedT1: signal.targets.T1,
        projectedT2: signal.targets.T2,
        projectedT3: signal.targets.T3,
        projectedRR: signal.riskReward,
        outcome: "PENDING",
        assetClass: signal.assetClass,
        userId,
      };

      const { data, error } = await this.supabase
        .from("signal_performance_metrics")
        .insert(this.toSnakeCase(record) as any)
        .select("id")
        .single();

      if (error) {
        console.error("[SignalPerformance] Error recording signal:", error);
        return null;
      }

      return data?.id || null;
    } catch (err) {
      console.error("[SignalPerformance] Exception recording signal:", err);
      return null;
    }
  }

  /**
   * Record trade entry
   *
   * Call this when the trade is actually entered
   */
  async recordEntry(
    performanceId: string,
    entryPrice: number,
    entryTime: Date = new Date(),
    tradeType?: "SCALP" | "DAY" | "SWING" | "LEAP"
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("signal_performance_metrics")
        .update({
          entry_price: entryPrice,
          entry_time: entryTime.toISOString(),
          trade_type: tradeType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", performanceId);

      if (error) {
        console.error("[SignalPerformance] Error recording entry:", error);
        return false;
      }

      return true;
    } catch (err) {
      console.error("[SignalPerformance] Exception recording entry:", err);
      return false;
    }
  }

  /**
   * Record trade outcome
   *
   * Call this when the trade exits (win, loss, or manual)
   */
  async recordOutcome(
    performanceId: string,
    outcome: SignalOutcome,
    exitPrice: number,
    exitTime: Date = new Date(),
    options?: {
      actualRR?: number;
      maxFavorableExcursion?: number;
      maxAdverseExcursion?: number;
      notes?: string;
    }
  ): Promise<boolean> {
    try {
      // First get the entry data to calculate metrics
      const { data: existing } = await this.supabase
        .from("signal_performance_metrics")
        .select("entry_price, entry_time, projected_stop, direction")
        .eq("id", performanceId)
        .single();

      if (!existing) {
        console.error("[SignalPerformance] Record not found:", performanceId);
        return false;
      }

      const entryPrice = existing.entry_price || exitPrice;
      const entryTime = existing.entry_time ? new Date(existing.entry_time) : exitTime;
      const direction = existing.direction;
      const stop = existing.projected_stop || entryPrice;

      // Calculate metrics
      const holdTimeMinutes = Math.round((exitTime.getTime() - entryTime.getTime()) / 60000);
      const pnlAmount = direction === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice;
      const pnlPercent = entryPrice > 0 ? (pnlAmount / entryPrice) * 100 : 0;

      // Determine if winner
      const wasWinner = outcome.startsWith("WIN_");

      // Calculate actual R:R if we have stop
      let actualRR = options?.actualRR;
      if (actualRR === undefined && stop && entryPrice) {
        const riskPerShare = Math.abs(entryPrice - stop);
        if (riskPerShare > 0) {
          actualRR = Math.abs(pnlAmount) / riskPerShare;
          if (!wasWinner) actualRR = -actualRR;
        }
      }

      const { error } = await this.supabase
        .from("signal_performance_metrics")
        .update({
          outcome,
          exit_price: exitPrice,
          exit_time: exitTime.toISOString(),
          hold_time_minutes: holdTimeMinutes,
          pnl_amount: pnlAmount,
          pnl_percent: pnlPercent,
          was_winner: wasWinner,
          actual_rr: actualRR,
          max_favorable_excursion: options?.maxFavorableExcursion,
          max_adverse_excursion: options?.maxAdverseExcursion,
          notes: options?.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", performanceId);

      if (error) {
        console.error("[SignalPerformance] Error recording outcome:", error);
        return false;
      }

      // Invalidate cache
      this.cache.clear();

      return true;
    } catch (err) {
      console.error("[SignalPerformance] Exception recording outcome:", err);
      return false;
    }
  }

  /**
   * Get aggregated win rates
   *
   * Uses the materialized view for fast queries
   */
  async getWinRates(query: WinRateQuery = {}): Promise<WinRateResult[]> {
    const cacheKey = JSON.stringify(query);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      let q = this.supabase.from("signal_win_rates").select("*");

      if (query.opportunityType) {
        q = q.eq("opportunity_type", query.opportunityType);
      }
      if (query.marketRegime) {
        q = q.eq("market_regime", query.marketRegime);
      }
      if (query.vixLevel) {
        q = q.eq("vix_level", query.vixLevel);
      }
      if (query.timeOfDayWindow) {
        q = q.eq("time_of_day_window", query.timeOfDayWindow);
      }
      if (query.recommendedStyle) {
        q = q.eq("recommended_style", query.recommendedStyle);
      }
      if (query.assetClass) {
        q = q.eq("asset_class", query.assetClass);
      }
      if (query.minSampleSize) {
        q = q.gte("total_signals", query.minSampleSize);
      }

      const { data, error } = await q;

      if (error) {
        console.error("[SignalPerformance] Error getting win rates:", error);
        return [];
      }

      const results = (data || []).map((row) => this.mapWinRateRow(row));

      this.cache.set(cacheKey, { data: results, timestamp: Date.now() });

      return results;
    } catch (err) {
      console.error("[SignalPerformance] Exception getting win rates:", err);
      return [];
    }
  }

  /**
   * Get contextual win rate for real-time scoring
   *
   * Used during signal generation to boost/penalize scores
   * based on historical performance in similar conditions
   */
  async getContextualWinRate(
    opportunityType: string,
    regime?: MarketRegime,
    vixLevel?: VIXLevel,
    timeWindow?: TimeOfDayWindow
  ): Promise<ContextualWinRate> {
    // Default fallback
    const defaultRate: ContextualWinRate = {
      winRate: 50,
      sampleSize: 0,
      confidence: 0.5,
      source: "default",
    };

    try {
      // Try exact match first
      if (regime && vixLevel && timeWindow) {
        const exactMatch = await this.getWinRates({
          opportunityType,
          marketRegime: regime,
          vixLevel,
          timeOfDayWindow: timeWindow,
          minSampleSize: 5,
        });

        if (exactMatch.length > 0) {
          const result = exactMatch[0];
          return {
            winRate: result.winRate,
            sampleSize: result.sampleSize,
            confidence: this.calculateConfidence(result.sampleSize),
            source: "exact_match",
          };
        }
      }

      // Try partial match (just regime + VIX)
      if (regime && vixLevel) {
        const partialMatch = await this.getWinRates({
          opportunityType,
          marketRegime: regime,
          vixLevel,
          minSampleSize: 10,
        });

        if (partialMatch.length > 0) {
          const result = partialMatch[0];
          return {
            winRate: result.winRate,
            sampleSize: result.sampleSize,
            confidence: this.calculateConfidence(result.sampleSize) * 0.8, // Reduce confidence for partial match
            source: "partial_match",
          };
        }
      }

      // Fallback to just opportunity type
      const fallback = await this.getWinRates({
        opportunityType,
        minSampleSize: 20,
      });

      if (fallback.length > 0) {
        const avgWinRate =
          fallback.reduce((sum, r) => sum + r.winRate * r.totalSignals, 0) /
          fallback.reduce((sum, r) => sum + r.totalSignals, 0);
        const totalSamples = fallback.reduce((sum, r) => sum + r.totalSignals, 0);

        return {
          winRate: avgWinRate,
          sampleSize: totalSamples,
          confidence: this.calculateConfidence(totalSamples) * 0.6, // Further reduce for generic fallback
          source: "fallback",
        };
      }

      return defaultRate;
    } catch (err) {
      console.error("[SignalPerformance] Exception getting contextual win rate:", err);
      return defaultRate;
    }
  }

  /**
   * Get performance summary for a user
   */
  async getUserSummary(
    userId: string,
    days: number = 30
  ): Promise<{
    totalSignals: number;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnlPercent: number;
    avgHoldTime: number;
    bestStrategy: string;
    worstStrategy: string;
  } | null> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from("signal_performance_metrics")
        .select("*")
        .eq("user_id", userId)
        .gte("signal_time", since);

      if (error || !data) {
        return null;
      }

      const completed = data.filter((r) => r.outcome !== "PENDING" && r.outcome !== "EXPIRED");
      const wins = completed.filter((r) => r.was_winner);
      const losses = completed.filter((r) => !r.was_winner);

      // Find best/worst strategies
      const byStrategy: Record<string, { wins: number; losses: number }> = {};
      completed.forEach((r) => {
        const key = r.opportunity_type;
        if (!byStrategy[key]) byStrategy[key] = { wins: 0, losses: 0 };
        if (r.was_winner) byStrategy[key].wins++;
        else byStrategy[key].losses++;
      });

      const strategyRates = Object.entries(byStrategy)
        .map(([type, stats]) => ({
          type,
          winRate: (stats.wins / (stats.wins + stats.losses)) * 100,
          total: stats.wins + stats.losses,
        }))
        .filter((s) => s.total >= 3);

      const best = strategyRates.sort((a, b) => b.winRate - a.winRate)[0];
      const worst = strategyRates.sort((a, b) => a.winRate - b.winRate)[0];

      return {
        totalSignals: data.length,
        totalTrades: completed.length,
        wins: wins.length,
        losses: losses.length,
        winRate: completed.length > 0 ? (wins.length / completed.length) * 100 : 0,
        totalPnlPercent: completed.reduce((sum, r) => sum + (r.pnl_percent || 0), 0),
        avgHoldTime:
          completed.length > 0
            ? completed.reduce((sum, r) => sum + (r.hold_time_minutes || 0), 0) / completed.length
            : 0,
        bestStrategy: best?.type || "N/A",
        worstStrategy: worst?.type || "N/A",
      };
    } catch (err) {
      console.error("[SignalPerformance] Exception getting user summary:", err);
      return null;
    }
  }

  /**
   * Refresh the materialized view (call periodically)
   */
  async refreshWinRates(): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc("refresh_signal_win_rates");
      if (error) {
        console.error("[SignalPerformance] Error refreshing win rates:", error);
        return false;
      }
      this.cache.clear();
      return true;
    } catch (err) {
      console.error("[SignalPerformance] Exception refreshing win rates:", err);
      return false;
    }
  }

  // Helper methods

  private calculateConfidence(sampleSize: number): number {
    // Confidence increases with sample size, asymptotically approaching 1.0
    // At 10 samples: ~0.5
    // At 50 samples: ~0.8
    // At 100+ samples: ~0.9+
    return Math.min(0.95, 1 - Math.exp(-sampleSize / 30));
  }

  private mapWinRateRow(row: any): WinRateResult {
    const sampleSize = row.total_signals - (row.pending || 0) - (row.expired || 0);
    return {
      opportunityType: row.opportunity_type,
      marketRegime: row.market_regime,
      vixLevel: row.vix_level,
      timeOfDayWindow: row.time_of_day_window,
      recommendedStyle: row.recommended_style,
      assetClass: row.asset_class,
      totalSignals: row.total_signals || 0,
      wins: row.wins || 0,
      losses: row.losses || 0,
      pending: row.pending || 0,
      expired: row.expired || 0,
      winRate: row.win_rate || 0,
      avgRR: row.avg_rr || 0,
      avgWinPct: row.avg_win_pct || 0,
      avgLossPct: row.avg_loss_pct || 0,
      avgHoldTimeMin: row.avg_hold_time_min || 0,
      expectancy: row.expectancy || 0,
      sampleSize,
      confidence: sampleSize >= 50 ? "high" : sampleSize >= 20 ? "medium" : "low",
    };
  }

  private toSnakeCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        result[snakeKey] = value instanceof Date ? value.toISOString() : value;
      }
    }
    return result;
  }
}

/**
 * Apply win rate modifier to signal score
 *
 * Boosts scores for historically profitable setups,
 * penalizes scores for historically losing setups
 */
export function applyWinRateModifier(
  rawScore: number,
  contextualWinRate: ContextualWinRate
): { adjustedScore: number; modifier: number; reasoning: string } {
  // Base modifier: neutral at 50% win rate
  // +5% score per 10% win rate above 50%
  // -5% score per 10% win rate below 50%
  const winRateDelta = contextualWinRate.winRate - 50;
  const rawModifier = 1 + winRateDelta / 200; // ±25% max

  // Apply confidence weighting
  // Low confidence = modifier closer to 1.0
  const weightedModifier = 1 + (rawModifier - 1) * contextualWinRate.confidence;

  // Clamp to reasonable range
  const modifier = Math.max(0.75, Math.min(1.25, weightedModifier));

  const adjustedScore = Math.round(rawScore * modifier);

  let reasoning = "";
  if (modifier > 1.01) {
    reasoning = `+${((modifier - 1) * 100).toFixed(0)}% from historical ${contextualWinRate.winRate.toFixed(0)}% win rate (n=${contextualWinRate.sampleSize})`;
  } else if (modifier < 0.99) {
    reasoning = `${((modifier - 1) * 100).toFixed(0)}% from historical ${contextualWinRate.winRate.toFixed(0)}% win rate (n=${contextualWinRate.sampleSize})`;
  } else {
    reasoning = `No adjustment (${contextualWinRate.source})`;
  }

  return { adjustedScore, modifier, reasoning };
}
