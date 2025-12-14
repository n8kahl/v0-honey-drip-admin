/**
 * Trade Threads API Routes
 *
 * Endpoints for Trade Threads V1:
 * - Admin: Create threads, add updates, close threads
 * - Member: Subscribe ("I took this trade"), exit trades, view timeline
 * - Public: Get /wins feed
 */

import express, { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Helper: Extract user ID from request
 */
async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const {
        data: { user },
        error,
      } = await getSupabaseClient().auth.getUser(token);
      if (!error && user?.id) return user.id;
    } catch (err) {
      console.warn("[TradeThreads] JWT verification failed:", err);
    }
  }

  // Fallback for development
  const headerUserId = req.headers["x-user-id"] as string;
  return headerUserId || null;
}

// ============================================================================
// TRADE THREAD ROUTES (Admin)
// ============================================================================

/**
 * POST /api/trade-threads
 * Create a new trade thread (admin only)
 */
router.post("/api/trade-threads", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      symbol,
      contractId,
      contract,
      entryPrice,
      targetPrice,
      stopLoss,
      tradeType,
      adminName,
      message,
    } = req.body;

    if (!symbol || !contractId) {
      return res.status(400).json({ error: "Missing required fields: symbol, contractId" });
    }

    console.log(`[TradeThreads] Creating thread for ${symbol} by admin ${userId}`);

    // Create the thread
    const threadData: Record<string, any> = {
      admin_id: userId,
      admin_name: adminName || null,
      symbol,
      contract_id: contractId,
      contract: contract || null,
      entry_price: entryPrice || null,
      target_price: targetPrice || null,
      stop_loss: stopLoss || null,
      trade_type: tradeType || null,
      status: "open",
    };

    const { data: thread, error: threadError } = await getSupabaseClient()
      .from("trade_threads")
      .insert([threadData] as any)
      .select("*")
      .single();

    if (threadError) {
      console.error("[TradeThreads] Error creating thread:", threadError);
      return res.status(500).json({ error: "Failed to create thread", details: threadError.message });
    }

    // Create the OPEN update
    const updateData = {
      trade_thread_id: thread.id,
      admin_id: userId,
      type: "OPEN",
      message: message || `Trade thread opened for ${symbol}`,
      payload: {
        entryPrice,
        targetPrice,
        stopLoss,
      },
    };

    const { data: openUpdate, error: updateError } = await getSupabaseClient()
      .from("trade_thread_updates")
      .insert([updateData] as any)
      .select("*")
      .single();

    if (updateError) {
      console.warn("[TradeThreads] Error creating OPEN update:", updateError);
    }

    console.log(`[TradeThreads] Thread created: ${thread.id}`);
    res.status(201).json({ thread, openUpdate });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in POST /api/trade-threads:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * GET /api/trade-threads
 * List trade threads (with optional filters)
 */
router.get("/api/trade-threads", async (req: Request, res: Response) => {
  try {
    const { status, symbol, adminId, limit = 50, offset = 0 } = req.query;

    let query = getSupabaseClient()
      .from("trade_threads")
      .select("*, trade_thread_updates(*)")
      .order("latest_update_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) query = query.eq("status", status);
    if (symbol) query = query.eq("symbol", symbol);
    if (adminId) query = query.eq("admin_id", adminId);

    const { data, error } = await query;

    if (error) {
      console.error("[TradeThreads] Error fetching threads:", error);
      return res.status(500).json({ error: "Failed to fetch threads", details: error.message });
    }

    res.json({ threads: data || [] });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in GET /api/trade-threads:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * GET /api/trade-threads/:threadId
 * Get a single trade thread with updates
 */
router.get("/api/trade-threads/:threadId", async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const userId = await getUserId(req);

    // Build query with updates
    let selectQuery = "*, trade_thread_updates(*)";

    // If user is logged in, also get their member trade
    if (userId) {
      selectQuery += `, member_trades!member_trades_trade_thread_id_fkey(*)`;
    }

    const { data, error } = await getSupabaseClient()
      .from("trade_threads")
      .select(selectQuery)
      .eq("id", threadId)
      .single();

    if (error) {
      console.error("[TradeThreads] Error fetching thread:", error);
      return res.status(404).json({ error: "Thread not found" });
    }

    // Get subscriber count
    const { count } = await getSupabaseClient()
      .from("member_trades")
      .select("*", { count: "exact", head: true })
      .eq("trade_thread_id", threadId);

    res.json({
      ...data,
      memberCount: count || 0,
      memberTrade: userId ? data.member_trades?.[0] : null,
    });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in GET /api/trade-threads/:threadId:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * POST /api/trade-threads/:threadId/updates
 * Add an update to a trade thread (admin only)
 */
router.post("/api/trade-threads/:threadId/updates", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { threadId } = req.params;
    const { type, message, payload } = req.body;

    if (!type) {
      return res.status(400).json({ error: "Missing required field: type" });
    }

    const validTypes = ["OPEN", "UPDATE", "STOP_MOVE", "TRIM", "EXIT", "NOTE"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
    }

    console.log(`[TradeThreads] Adding ${type} update to thread ${threadId}`);

    // Verify thread exists and belongs to admin
    const { data: thread, error: threadError } = await getSupabaseClient()
      .from("trade_threads")
      .select("*")
      .eq("id", threadId)
      .eq("admin_id", userId)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: "Thread not found or unauthorized" });
    }

    if (thread.status === "closed" && type !== "NOTE") {
      return res.status(400).json({ error: "Cannot add updates to a closed thread" });
    }

    // Create the update
    const updateData = {
      trade_thread_id: threadId,
      admin_id: userId,
      type,
      message: message || `${type} update`,
      payload: payload || {},
    };

    const { data: update, error: updateError } = await getSupabaseClient()
      .from("trade_thread_updates")
      .insert([updateData] as any)
      .select("*")
      .single();

    if (updateError) {
      console.error("[TradeThreads] Error creating update:", updateError);
      return res.status(500).json({ error: "Failed to create update", details: updateError.message });
    }

    // If EXIT, close the thread
    let threadClosed = false;
    if (type === "EXIT") {
      const exitPrice = payload?.exitPrice;
      const entryPrice = thread.entry_price;
      let pnlPercent = 0;
      if (entryPrice && exitPrice) {
        pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      }

      const outcome = pnlPercent > 0.5 ? "win" : pnlPercent < -0.5 ? "loss" : "breakeven";

      const { error: closeError } = await getSupabaseClient()
        .from("trade_threads")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          exit_price: exitPrice,
          final_pnl_percent: pnlPercent,
          outcome,
        } as any)
        .eq("id", threadId);

      if (closeError) {
        console.warn("[TradeThreads] Error closing thread:", closeError);
      } else {
        threadClosed = true;
        console.log(`[TradeThreads] Thread ${threadId} closed with ${outcome} (${pnlPercent.toFixed(1)}%)`);
      }
    }

    res.status(201).json({ update, threadClosed });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in POST /api/trade-threads/:threadId/updates:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// MEMBER TRADE ROUTES
// ============================================================================

/**
 * POST /api/member-trades
 * "I took this trade" - Create a member subscription
 */
router.post("/api/member-trades", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tradeThreadId, entryPrice, sizeContracts, stopPrice, targets, notes, useAdminStopTargets } =
      req.body;

    if (!tradeThreadId || !entryPrice) {
      return res.status(400).json({ error: "Missing required fields: tradeThreadId, entryPrice" });
    }

    console.log(`[TradeThreads] Member ${userId} taking trade ${tradeThreadId}`);

    // Verify thread exists and is open
    const { data: thread, error: threadError } = await getSupabaseClient()
      .from("trade_threads")
      .select("*")
      .eq("id", tradeThreadId)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: "Trade thread not found" });
    }

    if (thread.status === "closed") {
      return res.status(400).json({ error: "Cannot subscribe to a closed trade" });
    }

    // Use admin stop/targets if requested (default behavior)
    const finalStopPrice = useAdminStopTargets !== false ? stopPrice || thread.stop_loss : stopPrice;
    const finalTargets = useAdminStopTargets !== false ? targets || (thread.target_price ? [thread.target_price] : null) : targets;

    // Create member trade (idempotent - UNIQUE constraint handles duplicates)
    const memberTradeData = {
      user_id: userId,
      trade_thread_id: tradeThreadId,
      entry_price: entryPrice,
      size_contracts: sizeContracts || null,
      stop_price: finalStopPrice || null,
      targets: finalTargets || null,
      notes: notes || null,
      status: "active",
    };

    const { data: memberTrade, error: memberError } = await getSupabaseClient()
      .from("member_trades")
      .upsert([memberTradeData] as any, { onConflict: "user_id,trade_thread_id" })
      .select("*")
      .single();

    if (memberError) {
      console.error("[TradeThreads] Error creating member trade:", memberError);
      return res.status(500).json({ error: "Failed to subscribe to trade", details: memberError.message });
    }

    console.log(`[TradeThreads] Member trade created: ${memberTrade.id}`);
    res.status(201).json({ memberTrade, thread });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in POST /api/member-trades:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * GET /api/member-trades
 * Get current user's member trades
 */
router.get("/api/member-trades", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, includeThread } = req.query;

    let selectQuery = "*";
    if (includeThread === "true") {
      selectQuery += ", trade_threads(*, trade_thread_updates(*))";
    }

    let query = getSupabaseClient()
      .from("member_trades")
      .select(selectQuery)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;

    if (error) {
      console.error("[TradeThreads] Error fetching member trades:", error);
      return res.status(500).json({ error: "Failed to fetch member trades", details: error.message });
    }

    res.json({ memberTrades: data || [] });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in GET /api/member-trades:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * PATCH /api/member-trades/:memberTradeId/exit
 * Exit a member trade
 */
router.patch("/api/member-trades/:memberTradeId/exit", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { memberTradeId } = req.params;
    const { exitPrice, notes } = req.body;

    if (!exitPrice) {
      return res.status(400).json({ error: "Missing required field: exitPrice" });
    }

    console.log(`[TradeThreads] Member ${userId} exiting trade ${memberTradeId} at ${exitPrice}`);

    // Verify trade belongs to user and is active
    const { data: existing, error: existingError } = await getSupabaseClient()
      .from("member_trades")
      .select("*")
      .eq("id", memberTradeId)
      .eq("user_id", userId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: "Member trade not found" });
    }

    if (existing.status === "exited") {
      return res.status(400).json({ error: "Trade already exited" });
    }

    // Update the trade
    const updateData: Record<string, any> = {
      exit_price: exitPrice,
      exit_time: new Date().toISOString(),
      status: "exited",
    };

    if (notes) {
      updateData.notes = existing.notes ? `${existing.notes}\n\nExit notes: ${notes}` : notes;
    }

    const { data: updated, error: updateError } = await getSupabaseClient()
      .from("member_trades")
      .update(updateData as any)
      .eq("id", memberTradeId)
      .select("*")
      .single();

    if (updateError) {
      console.error("[TradeThreads] Error exiting trade:", updateError);
      return res.status(500).json({ error: "Failed to exit trade", details: updateError.message });
    }

    // Calculate P/L
    const pnlPercent = ((exitPrice - existing.entry_price) / existing.entry_price) * 100;

    console.log(`[TradeThreads] Member trade exited: ${memberTradeId} (${pnlPercent.toFixed(1)}%)`);
    res.json({ memberTrade: updated, pnlPercent });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in PATCH /api/member-trades/:memberTradeId/exit:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * PATCH /api/member-trades/:memberTradeId
 * Update member trade (notes, stop, targets)
 */
router.patch("/api/member-trades/:memberTradeId", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { memberTradeId } = req.params;
    const { notes, stopPrice, targets } = req.body;

    const updateData: Record<string, any> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (stopPrice !== undefined) updateData.stop_price = stopPrice;
    if (targets !== undefined) updateData.targets = targets;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { data, error } = await getSupabaseClient()
      .from("member_trades")
      .update(updateData as any)
      .eq("id", memberTradeId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      console.error("[TradeThreads] Error updating member trade:", error);
      return res.status(500).json({ error: "Failed to update trade", details: error.message });
    }

    res.json({ memberTrade: data });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in PATCH /api/member-trades/:memberTradeId:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// PUBLIC WINS ROUTES
// ============================================================================

/**
 * GET /api/public/wins
 * Get public trade outcomes feed
 */
router.get("/api/public/wins", async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 20, outcome, adminId, date } = req.query;

    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;

    let query = getSupabaseClient()
      .from("public_trade_outcomes")
      .select("*", { count: "exact" })
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (outcome) query = query.eq("outcome", outcome);
    if (adminId) query = query.eq("admin_id", adminId);
    if (date) query = query.eq("publish_date", date);

    const { data, count, error } = await query;

    if (error) {
      console.error("[TradeThreads] Error fetching public wins:", error);
      return res.status(500).json({ error: "Failed to fetch wins", details: error.message });
    }

    res.json({
      outcomes: data || [],
      total: count || 0,
      page: Number(page),
      pageSize: limit,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in GET /api/public/wins:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * POST /api/trade-threads/:threadId/publish
 * Publish a closed thread to public outcomes (admin only, for EOD)
 */
router.post("/api/trade-threads/:threadId/publish", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { threadId } = req.params;
    const { publicComment, adminAvatarUrl } = req.body;

    // Verify thread exists, is closed, and belongs to admin
    const { data: thread, error: threadError } = await getSupabaseClient()
      .from("trade_threads")
      .select("*")
      .eq("id", threadId)
      .eq("admin_id", userId)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: "Thread not found or unauthorized" });
    }

    if (thread.status !== "closed") {
      return res.status(400).json({ error: "Cannot publish an open thread. Close it first." });
    }

    console.log(`[TradeThreads] Publishing thread ${threadId} to public wins`);

    // Create public outcome
    const outcomeData = {
      trade_thread_id: threadId,
      symbol: thread.symbol,
      contract_id: thread.contract_id,
      trade_type: thread.trade_type,
      outcome: thread.outcome,
      pnl_percent: thread.final_pnl_percent,
      admin_id: thread.admin_id,
      admin_name: thread.admin_name,
      admin_avatar_url: adminAvatarUrl || null,
      entry_price_masked: true,
      public_comment: publicComment || null,
      trade_opened_at: thread.created_at,
      trade_closed_at: thread.closed_at,
    };

    const { data: outcome, error: outcomeError } = await getSupabaseClient()
      .from("public_trade_outcomes")
      .upsert([outcomeData] as any, { onConflict: "trade_thread_id" })
      .select("*")
      .single();

    if (outcomeError) {
      console.error("[TradeThreads] Error publishing to public:", outcomeError);
      return res.status(500).json({ error: "Failed to publish", details: outcomeError.message });
    }

    console.log(`[TradeThreads] Thread ${threadId} published to public wins`);
    res.status(201).json({ outcome });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in POST /api/trade-threads/:threadId/publish:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * POST /api/admin/publish-eod
 * Batch publish all closed threads from today (admin only)
 */
router.post("/api/admin/publish-eod", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`[TradeThreads] EOD publish triggered by ${userId}`);

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all closed threads from today that aren't yet published
    const { data: threads, error: threadsError } = await getSupabaseClient()
      .from("trade_threads")
      .select("*")
      .eq("status", "closed")
      .gte("closed_at", today.toISOString())
      .lt("closed_at", tomorrow.toISOString());

    if (threadsError) {
      console.error("[TradeThreads] Error fetching threads for EOD:", threadsError);
      return res.status(500).json({ error: "Failed to fetch threads", details: threadsError.message });
    }

    if (!threads || threads.length === 0) {
      return res.json({ published: 0, message: "No closed threads to publish today" });
    }

    // Check which are already published
    const threadIds = threads.map((t: any) => t.id);
    const { data: existingOutcomes } = await getSupabaseClient()
      .from("public_trade_outcomes")
      .select("trade_thread_id")
      .in("trade_thread_id", threadIds);

    const existingIds = new Set((existingOutcomes || []).map((o: any) => o.trade_thread_id));
    const toPublish = threads.filter((t: any) => !existingIds.has(t.id));

    if (toPublish.length === 0) {
      return res.json({ published: 0, message: "All threads already published" });
    }

    // Publish each thread
    const outcomes = toPublish.map((thread: any) => ({
      trade_thread_id: thread.id,
      symbol: thread.symbol,
      contract_id: thread.contract_id,
      trade_type: thread.trade_type,
      outcome: thread.outcome,
      pnl_percent: thread.final_pnl_percent,
      admin_id: thread.admin_id,
      admin_name: thread.admin_name,
      entry_price_masked: true,
      trade_opened_at: thread.created_at,
      trade_closed_at: thread.closed_at,
    }));

    const { error: publishError } = await getSupabaseClient()
      .from("public_trade_outcomes")
      .insert(outcomes as any);

    if (publishError) {
      console.error("[TradeThreads] Error in EOD batch publish:", publishError);
      return res.status(500).json({ error: "Failed to publish", details: publishError.message });
    }

    console.log(`[TradeThreads] EOD published ${toPublish.length} threads`);
    res.json({ published: toPublish.length, message: `Published ${toPublish.length} trades` });
  } catch (error: any) {
    console.error("[TradeThreads] Unexpected error in POST /api/admin/publish-eod:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

export default router;
