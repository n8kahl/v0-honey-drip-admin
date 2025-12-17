/**
 * Public Portal API Routes
 *
 * Unauthenticated endpoints for the public-facing portal.
 * All data returned is filtered by show_on_public = true.
 */

import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import {
  calculatePnlPercent,
  calculateProgressToTarget,
  getTimeElapsed,
  getBestPrice,
  ACTIVE_TRADE_STATES,
  EXITED_TRADE_STATES,
} from "../lib/publicCalculations.js";

const router = Router();

// Create Supabase client with service role for public reads
// (RLS policies allow anon SELECT on public trades)
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(url, key);
}

// ============================================================================
// Types
// ============================================================================

interface PublicTrade {
  id: string;
  user_id: string;
  ticker: string;
  trade_type: string;
  state: string;
  contract: any;
  entry_price: number | null;
  current_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  exit_price: number | null;
  admin_id: string | null;
  admin_name: string | null;
  share_token: string | null;
  public_comment: string | null;
  created_at: string;
  updated_at: string;
  entry_time: string | null;
  exit_time: string | null;
}

interface TradeUpdate {
  id: string;
  trade_id: string;
  type: string;
  message: string;
  price: number;
  pnl_percent: number | null;
  trim_percent: number | null;
  created_at: string;
}

interface DailyStats {
  date: string;
  admin_id: string | null;
  admin_name?: string;
  trade_type: string | null;
  total_trades: number;
  wins: number;
  losses: number;
  total_gain_percent: number;
  avg_gain_percent: number;
  best_trade_percent: number;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/public/trades/active
 * Returns all active (LOADED, ENTERED) public trades grouped by type
 */
router.get("/trades/active", async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    const { data: trades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("show_on_public", true)
      .in("state", ACTIVE_TRADE_STATES)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Enrich trades with computed fields
    // FIX: Use nullish coalescing (??) for price fallbacks to handle 0 correctly
    const enrichedTrades = (trades || []).map((trade: PublicTrade) => ({
      ...trade,
      pnl_percent: calculatePnlPercent(trade.entry_price, trade.current_price),
      time_in_trade: getTimeElapsed(trade.entry_time ?? trade.created_at),
      progress_to_target: calculateProgressToTarget(
        trade.entry_price,
        trade.current_price,
        trade.target_price
      ),
    }));

    // Group by trade type
    const grouped = {
      scalps: enrichedTrades.filter((t: any) => t.trade_type === "Scalp"),
      day_trades: enrichedTrades.filter((t: any) => t.trade_type === "Day"),
      swings: enrichedTrades.filter((t: any) => t.trade_type === "Swing"),
      leaps: enrichedTrades.filter((t: any) => t.trade_type === "LEAP"),
    };

    res.json({
      trades: enrichedTrades,
      grouped,
      total: enrichedTrades.length,
      by_state: {
        loaded: enrichedTrades.filter((t: any) => t.state === "LOADED").length,
        entered: enrichedTrades.filter((t: any) => t.state === "ENTERED").length,
      },
    });
  } catch (error: any) {
    console.error("[Public API] Error fetching active trades:", error);
    res.status(500).json({ error: error.message || "Failed to fetch trades" });
  }
});

/**
 * GET /api/public/trades/:id
 * Returns a single trade with full timeline
 */
router.get("/trades/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    // Fetch trade
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", id)
      .eq("show_on_public", true)
      .single();

    if (tradeError || !trade) {
      return res.status(404).json({ error: "Trade not found" });
    }

    // Fetch timeline updates
    const { data: updates, error: updatesError } = await supabase
      .from("trade_updates")
      .select("*")
      .eq("trade_id", id)
      .order("created_at", { ascending: false });

    if (updatesError) throw updatesError;

    // Enrich trade
    // FIX: Use getBestPrice with nullish coalescing to handle 0 correctly
    const enrichedTrade = {
      ...trade,
      pnl_percent: calculatePnlPercent(
        trade.entry_price,
        getBestPrice(trade.current_price, trade.exit_price)
      ),
      time_in_trade: getTimeElapsed(trade.entry_time ?? trade.created_at),
      progress_to_target: calculateProgressToTarget(
        trade.entry_price,
        trade.current_price,
        trade.target_price
      ),
      timeline: updates || [],
    };

    res.json(enrichedTrade);
  } catch (error: any) {
    console.error("[Public API] Error fetching trade:", error);
    res.status(500).json({ error: error.message || "Failed to fetch trade" });
  }
});

/**
 * GET /api/public/t/:token
 * Returns a trade by share token (for shareable links)
 */
router.get("/t/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const supabase = getSupabase();

    // Fetch trade by share token
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("share_token", token)
      .eq("show_on_public", true)
      .single();

    if (tradeError || !trade) {
      return res.status(404).json({ error: "Trade not found" });
    }

    // Fetch timeline updates
    const { data: updates } = await supabase
      .from("trade_updates")
      .select("*")
      .eq("trade_id", trade.id)
      .order("created_at", { ascending: false });

    // Enrich trade
    // FIX: Use getBestPrice with nullish coalescing to handle 0 correctly
    const enrichedTrade = {
      ...trade,
      pnl_percent: calculatePnlPercent(
        trade.entry_price,
        getBestPrice(trade.current_price, trade.exit_price)
      ),
      time_in_trade: getTimeElapsed(trade.entry_time ?? trade.created_at),
      progress_to_target: calculateProgressToTarget(
        trade.entry_price,
        trade.current_price,
        trade.target_price
      ),
      timeline: updates || [],
    };

    res.json(enrichedTrade);
  } catch (error: any) {
    console.error("[Public API] Error fetching trade by token:", error);
    res.status(500).json({ error: error.message || "Failed to fetch trade" });
  }
});

/**
 * GET /api/public/stats/today
 * Returns today's group performance stats
 */
router.get("/stats/today", async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    // Get today's date in UTC
    const today = new Date().toISOString().split("T")[0];

    // Try to get from daily_stats first (pre-aggregated)
    const { data: cachedStats } = await supabase
      .from("daily_stats")
      .select("*")
      .eq("date", today)
      .is("admin_id", null) // Group totals
      .is("trade_type", null) // All types
      .single();

    if (cachedStats) {
      return res.json(cachedStats);
    }

    // Fallback: Calculate from trades in real-time
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: trades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("show_on_public", true)
      .gte("created_at", startOfDay.toISOString());

    if (error) throw error;

    // Calculate stats
    const stats = {
      date: today,
      total_trades: trades?.length || 0,
      wins: 0,
      losses: 0,
      total_gain_percent: 0,
      avg_gain_percent: 0,
      best_trade_percent: 0,
      best_trade_id: null as string | null,
      by_type: {
        Scalp: { count: 0, wins: 0, losses: 0 },
        Day: { count: 0, wins: 0, losses: 0 },
        Swing: { count: 0, wins: 0, losses: 0 },
        LEAP: { count: 0, wins: 0, losses: 0 },
      } as Record<string, { count: number; wins: number; losses: number }>,
    };

    trades?.forEach((trade: PublicTrade) => {
      // FIX: Use getBestPrice to handle 0 correctly
      const pnl = calculatePnlPercent(
        trade.entry_price,
        getBestPrice(trade.exit_price, trade.current_price)
      );

      if (pnl !== null) {
        stats.total_gain_percent += pnl;

        if (pnl > 0) {
          stats.wins++;
        } else if (pnl < 0) {
          stats.losses++;
        }

        if (pnl > stats.best_trade_percent) {
          stats.best_trade_percent = pnl;
          stats.best_trade_id = trade.id;
        }
      }

      // Track by type
      const type = trade.trade_type as keyof typeof stats.by_type;
      if (stats.by_type[type]) {
        stats.by_type[type].count++;
        if (pnl && pnl > 0) stats.by_type[type].wins++;
        if (pnl && pnl < 0) stats.by_type[type].losses++;
      }
    });

    if (stats.wins + stats.losses > 0) {
      stats.avg_gain_percent = stats.total_gain_percent / (stats.wins + stats.losses);
    }

    res.json(stats);
  } catch (error: any) {
    console.error("[Public API] Error fetching today stats:", error);
    res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

/**
 * GET /api/public/stats/leaderboard
 * Returns admin performance leaderboard for today
 */
router.get("/stats/leaderboard", async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Get today's trades grouped by admin
    const { data: trades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("show_on_public", true)
      .gte("created_at", startOfDay.toISOString());

    if (error) throw error;

    // Group by admin
    const adminStats = new Map<
      string,
      {
        admin_id: string;
        admin_name: string;
        total_trades: number;
        wins: number;
        losses: number;
        total_gain_percent: number;
      }
    >();

    trades?.forEach((trade: PublicTrade) => {
      const adminId = trade.admin_id || trade.user_id;
      const adminName = trade.admin_name || "Admin";

      if (!adminStats.has(adminId)) {
        adminStats.set(adminId, {
          admin_id: adminId,
          admin_name: adminName,
          total_trades: 0,
          wins: 0,
          losses: 0,
          total_gain_percent: 0,
        });
      }

      const stats = adminStats.get(adminId)!;
      stats.total_trades++;

      // FIX: Use getBestPrice to handle 0 correctly
      const pnl = calculatePnlPercent(
        trade.entry_price,
        getBestPrice(trade.exit_price, trade.current_price)
      );

      if (pnl !== null) {
        stats.total_gain_percent += pnl;
        if (pnl > 0) stats.wins++;
        else if (pnl < 0) stats.losses++;
      }
    });

    // Sort by total gains
    const leaderboard = Array.from(adminStats.values()).sort(
      (a, b) => b.total_gain_percent - a.total_gain_percent
    );

    res.json({
      leaderboard,
      updated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Public API] Error fetching leaderboard:", error);
    res.status(500).json({ error: error.message || "Failed to fetch leaderboard" });
  }
});

/**
 * GET /api/public/alerts/recent
 * Returns recent trade updates (alert feed)
 * Query params:
 *   - limit: number of alerts to return (default 3 for public, 50 for members)
 *   - member: "true" to get full feed (for demo toggle)
 */
router.get("/alerts/recent", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const isMember = req.query.member === "true";
    const limit = isMember ? 50 : 3;

    // Get recent updates for public trades
    const { data: updates, error } = await supabase
      .from("trade_updates")
      .select(
        `
        *,
        trades!inner (
          id,
          ticker,
          trade_type,
          state,
          contract,
          admin_name,
          show_on_public
        )
      `
      )
      .eq("trades.show_on_public", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Format for alert feed
    const alerts = (updates || []).map((update: any) => ({
      id: update.id,
      type: update.type,
      message: update.message,
      price: update.price,
      pnl_percent: update.pnl_percent,
      trim_percent: update.trim_percent,
      created_at: update.created_at,
      trade: {
        id: update.trades.id,
        ticker: update.trades.ticker,
        trade_type: update.trades.trade_type,
        contract: update.trades.contract,
        admin_name: update.trades.admin_name,
      },
    }));

    res.json({
      alerts,
      has_more: !isMember && (updates?.length || 0) >= limit,
      is_member_view: isMember,
    });
  } catch (error: any) {
    console.error("[Public API] Error fetching alerts:", error);
    res.status(500).json({ error: error.message || "Failed to fetch alerts" });
  }
});

/**
 * GET /api/public/wins/recent
 * Returns recent big wins (exited trades with positive P&L)
 */
router.get("/wins/recent", async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    // Get exited trades from last 7 days with positive P&L
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // FIX: Query both uppercase and lowercase state values
    const { data: trades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("show_on_public", true)
      .in("state", EXITED_TRADE_STATES)
      .gte("exit_time", sevenDaysAgo.toISOString())
      .order("exit_time", { ascending: false });

    if (error) throw error;

    // Filter and sort by P&L
    // FIX: Use calculatePnlPercent which handles 0 correctly
    const wins = (trades || [])
      .map((trade: PublicTrade) => ({
        ...trade,
        pnl_percent: calculatePnlPercent(trade.entry_price, trade.exit_price),
      }))
      .filter((trade: any) => trade.pnl_percent && trade.pnl_percent > 0)
      .sort((a: any, b: any) => b.pnl_percent - a.pnl_percent)
      .slice(0, 10);

    res.json({ wins });
  } catch (error: any) {
    console.error("[Public API] Error fetching recent wins:", error);
    res.status(500).json({ error: error.message || "Failed to fetch wins" });
  }
});

/**
 * GET /api/public/performance/30d
 * Returns 30-day performance breakdown by trade type
 */
router.get("/performance/30d", async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // FIX: Query both uppercase and lowercase state values
    const { data: trades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("show_on_public", true)
      .in("state", EXITED_TRADE_STATES)
      .gte("exit_time", thirtyDaysAgo.toISOString());

    if (error) throw error;

    // Calculate stats by type
    const typeStats = {
      Scalp: { total: 0, wins: 0, losses: 0, totalGain: 0, bestGain: 0 },
      Day: { total: 0, wins: 0, losses: 0, totalGain: 0, bestGain: 0 },
      Swing: { total: 0, wins: 0, losses: 0, totalGain: 0, bestGain: 0 },
      LEAP: { total: 0, wins: 0, losses: 0, totalGain: 0, bestGain: 0 },
    } as Record<
      string,
      { total: number; wins: number; losses: number; totalGain: number; bestGain: number }
    >;

    trades?.forEach((trade: PublicTrade) => {
      const type = trade.trade_type;
      if (!typeStats[type]) return;

      // FIX: Use calculatePnlPercent which handles 0 correctly
      const pnl = calculatePnlPercent(trade.entry_price, trade.exit_price);
      if (pnl === null) return;

      typeStats[type].total++;
      typeStats[type].totalGain += pnl;

      if (pnl > 0) typeStats[type].wins++;
      else if (pnl < 0) typeStats[type].losses++;

      if (pnl > typeStats[type].bestGain) {
        typeStats[type].bestGain = pnl;
      }
    });

    // Format response
    const performance = Object.entries(typeStats).map(([type, stats]) => ({
      trade_type: type,
      total_trades: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      win_rate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
      avg_gain: stats.total > 0 ? stats.totalGain / stats.total : 0,
      best_trade: stats.bestGain,
    }));

    res.json({ performance, period: "30d" });
  } catch (error: any) {
    console.error("[Public API] Error fetching 30d performance:", error);
    res.status(500).json({ error: error.message || "Failed to fetch performance" });
  }
});

/**
 * GET /api/public/challenges/active
 * Returns active challenges with progress
 */
router.get("/challenges/active", async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    const { data: challenges, error } = await supabase
      .from("challenges")
      .select("*")
      .eq("is_active", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Enrich with progress calculations
    // Database uses: starting_balance, current_balance, target_balance
    // Progress = (current - starting) / (target - starting) * 100
    const enrichedChallenges = (challenges || []).map((challenge: any) => {
      const startingBalance = challenge.starting_balance ?? 0;
      const currentBalance = challenge.current_balance ?? startingBalance;
      const targetBalance = challenge.target_balance ?? startingBalance;

      // Progress is based on gains toward target
      const targetGain = targetBalance - startingBalance;
      const currentGain = currentBalance - startingBalance;
      const progress = targetGain > 0 ? (currentGain / targetGain) * 100 : 0;

      const startDate = new Date(challenge.start_date);
      const endDate = new Date(challenge.end_date);
      const now = new Date();
      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, totalDays - daysElapsed);

      return {
        id: challenge.id,
        name: challenge.name,
        description: challenge.description,
        starting_balance: startingBalance,
        current_balance: currentBalance,
        target_balance: targetBalance,
        start_date: challenge.start_date,
        end_date: challenge.end_date,
        scope: challenge.scope,
        progress_percent: Math.min(100, Math.max(0, progress)),
        current_pnl: currentGain, // Computed: current - starting
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        total_days: totalDays,
      };
    });

    res.json({ challenges: enrichedChallenges });
  } catch (error: any) {
    console.error("[Public API] Error fetching challenges:", error);
    res.status(500).json({ error: error.message || "Failed to fetch challenges" });
  }
});

export default router;
