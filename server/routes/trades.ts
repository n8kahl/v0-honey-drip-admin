import express, { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Lazy initialization of Supabase client
// This prevents crashes when env vars are missing at module load time
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
          "Please set these in your .env.local or Railway Variables."
      );
    }

    supabase = createClient(url, key);
  }

  return supabase;
}

/**
 * Helper: Extract user ID from request
 * Priority:
 * 1. Verify JWT from Authorization header (secure, production)
 * 2. Fall back to x-user-id header (development convenience)
 */
async function getUserId(req: Request): Promise<string | null> {
  // First, try to extract from JWT Bearer token (secure method)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (!error && user?.id) {
        return user.id;
      }

      // Token invalid or expired - log but continue to fallback
      if (error) {
        console.warn("[Trades API] JWT verification failed:", error.message);
      }
    } catch (err) {
      console.warn("[Trades API] Error verifying JWT:", err);
    }
  }

  // Fallback: x-user-id header (for development and backward compatibility)
  const headerUserId = req.headers["x-user-id"] as string;
  if (headerUserId) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[Trades API] SECURITY WARNING: x-user-id header used in production. " +
          "Ensure client sends proper JWT token."
      );
    }
    return headerUserId;
  }

  return null;
}

/**
 * Helper: Validate required fields
 */
function validateTradeInput(trade: any): { valid: boolean; error?: string } {
  if (!trade.ticker || typeof trade.ticker !== "string") {
    return { valid: false, error: "Missing or invalid ticker" };
  }
  if (trade.contract && typeof trade.contract !== "object") {
    return { valid: false, error: "Invalid contract object" };
  }
  if (trade.status && !["loaded", "entered", "exited"].includes(trade.status)) {
    return { valid: false, error: "Invalid status value" };
  }
  if (trade.entry_price !== undefined && typeof trade.entry_price !== "number") {
    return { valid: false, error: "Invalid entry_price" };
  }
  if (trade.exit_price !== undefined && typeof trade.exit_price !== "number") {
    return { valid: false, error: "Invalid exit_price" };
  }
  return { valid: true };
}

/**
 * Helper: Validate trade update input
 */
function validateTradeUpdateInput(update: any): { valid: boolean; error?: string } {
  // Valid types must match the database CHECK constraint
  const validActions = ["enter", "trim", "update", "update-sl", "trail-stop", "add", "exit"];
  if (!update.action || !validActions.includes(update.action)) {
    return { valid: false, error: `Invalid action. Must be one of: ${validActions.join(", ")}` };
  }
  if (update.price !== undefined && typeof update.price !== "number") {
    return { valid: false, error: "Invalid price" };
  }
  return { valid: true };
}

/**
 * Type definitions for database operations
 * These bypass Supabase type inference limitations
 */
interface TradeInsert {
  user_id: string;
  ticker: string;
  contract_type?: string | null;
  strike?: number | null;
  expiration?: string | null;
  quantity?: number;
  status?: string;
  entry_price?: number | null;
  target_price?: number | null;
  stop_loss?: number | null;
  entry_time?: string | null;
  notes?: string | null;
}

interface TradeUpdate {
  state?: string; // Database column is 'state', not 'status'
  entry_price?: number;
  entry_time?: string;
  exit_price?: number;
  exit_time?: string;
  target_price?: number;
  stop_loss?: number;
  current_price?: number;
  move_percent?: number;
  notes?: string;
  updated_at?: string;
}

interface TradeUpdateInsert {
  trade_id: string;
  user_id: string;
  type: string; // 'enter', 'trim', 'update', 'update-sl', 'trail-stop', 'add', 'exit'
  price: number;
  message: string;
  pnl_percent?: number | null;
  timestamp?: string;
}

interface DiscordChannelLink {
  trade_id: string;
  discord_channel_id: string;
}

interface ChallengeLink {
  trade_id: string;
  challenge_id: string;
}

// ============================================================================
// POST /api/trades - Create a new trade
// ============================================================================
router.post("/api/trades", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { trade } = req.body;
    if (!trade) {
      return res.status(400).json({ error: "Missing trade object in request body" });
    }

    // Validate input
    const validation = validateTradeInput(trade);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    console.log(`[Trades API] Creating trade for user ${userId}:`, trade.ticker);

    // Create trade in database
    // Note: Client sends camelCase, we normalize to snake_case for database
    // The database has a constraint called 'trades_status_check' but column is 'state'
    const contract = trade.contract || {};
    const tradeData: Record<string, any> = {
      user_id: userId,
      ticker: trade.ticker,
      // Column is 'state' with CHECK constraint for uppercase: WATCHING, LOADED, ENTERED, EXITED
      state: (trade.state || trade.status || "LOADED").toUpperCase(),
      // Contract details as separate columns (legacy schema)
      strike: contract.strike || null,
      expiration: contract.expiry || contract.expiration || null,
      contract_type: contract.type || null,
      quantity: trade.quantity || 1, // Default to 1 contract
      // Also store full contract object as JSONB (migration 011)
      contract: contract,
      // Pricing fields
      entry_price: trade.entryPrice || trade.entry_price || null,
      target_price: trade.targetPrice || trade.target_price || null,
      stop_loss: trade.stopLoss || trade.stop_loss || null,
      entry_time: trade.entryTime || trade.entry_time || null,
    };

    console.log("[Trades API] Inserting trade data:", JSON.stringify(tradeData, null, 2));

    const { data, error } = await getSupabaseClient()
      .from("trades")
      .insert([tradeData] as any)
      .select("*")
      .single();

    if (error) {
      console.error("[Trades API] Error creating trade:", JSON.stringify(error, null, 2));
      console.error(
        "[Trades API] Error details - code:",
        error.code,
        "message:",
        error.message,
        "hint:",
        error.hint
      );
      return res
        .status(500)
        .json({ error: "Failed to create trade", details: error.message, code: error.code });
    }

    if (!data) {
      return res.status(500).json({ error: "Failed to create trade: no data returned" });
    }

    const tradeData_ = data as unknown as { id: string };
    console.log(`[Trades API] Trade created successfully with ID: ${tradeData_.id}`);

    // Link Discord channels if provided
    if (
      trade.discordChannelIds &&
      Array.isArray(trade.discordChannelIds) &&
      trade.discordChannelIds.length > 0
    ) {
      const channelLinks = trade.discordChannelIds.map((channelId: string) => ({
        trade_id: tradeData_.id,
        discord_channel_id: channelId,
      }));

      const { error: channelError } = await getSupabaseClient()
        .from("trades_discord_channels")
        .insert(channelLinks as any);

      if (channelError) {
        console.warn("[Trades API] Warning: Failed to link Discord channels:", channelError);
        // Don't fail the request, just warn
      }
    }

    // Link challenges if provided
    if (trade.challengeIds && Array.isArray(trade.challengeIds) && trade.challengeIds.length > 0) {
      const challengeLinks = trade.challengeIds.map((challengeId: string) => ({
        trade_id: tradeData_.id,
        challenge_id: challengeId,
      }));

      const { error: challengeError } = await getSupabaseClient()
        .from("trades_challenges")
        .insert(challengeLinks as any);

      if (challengeError) {
        console.warn("[Trades API] Warning: Failed to link challenges:", challengeError);
        // Don't fail the request, just warn
      }
    }

    res.status(201).json(data);
  } catch (error: any) {
    console.error("[Trades API] Unexpected error in POST /api/trades:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// PATCH /api/trades/:tradeId - Update a trade
// ============================================================================
router.patch("/api/trades/:tradeId", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { tradeId } = req.params;
    const updates = req.body;

    if (!tradeId) {
      return res.status(400).json({ error: "Missing trade ID" });
    }

    console.log(`[Trades API] Updating trade ${tradeId}:`, Object.keys(updates));

    // Validate input
    const upperStatus = updates.status?.toUpperCase();
    if (upperStatus && !["LOADED", "ENTERED", "EXITED", "WATCHING"].includes(upperStatus)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // Update trade
    // NOTE: Client sends 'status' field, but database column is 'state'
    const updateData: TradeUpdate = {
      state: upperStatus,
      entry_price: updates.entry_price,
      entry_time: updates.entry_time,
      exit_price: updates.exit_price,
      exit_time: updates.exit_time,
      target_price: updates.targetPrice || updates.target_price,
      stop_loss: updates.stopLoss || updates.stop_loss,
      current_price: updates.currentPrice || updates.current_price,
      move_percent: updates.movePercent || updates.move_percent,
      notes: updates.notes,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (getSupabaseClient().from("trades") as any)
      .update(updateData)
      .eq("id", tradeId)
      .eq("user_id", userId) // RLS: only own trades
      .select("*")
      .single();

    if (error) {
      console.error("[Trades API] Error updating trade:", error);
      return res.status(500).json({ error: "Failed to update trade", details: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Trade not found or unauthorized" });
    }

    console.log(`[Trades API] Trade ${tradeId} updated successfully`);
    res.json(data);
  } catch (error: any) {
    console.error("[Trades API] Unexpected error in PATCH /api/trades/:tradeId:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// DELETE /api/trades/:tradeId - Delete a trade
// ============================================================================
router.delete("/api/trades/:tradeId", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { tradeId } = req.params;

    if (!tradeId) {
      return res.status(400).json({ error: "Missing trade ID" });
    }

    console.log(`[Trades API] Deleting trade ${tradeId}`);

    // Delete trade (cascade deletes will remove links automatically)
    const { error } = await getSupabaseClient()
      .from("trades")
      .delete()
      .eq("id", tradeId)
      .eq("user_id", userId); // RLS: only own trades

    if (error) {
      console.error("[Trades API] Error deleting trade:", error);
      return res.status(500).json({ error: "Failed to delete trade", details: error.message });
    }

    console.log(`[Trades API] Trade ${tradeId} deleted successfully`);
    res.json({ message: "Trade deleted successfully" });
  } catch (error: any) {
    console.error("[Trades API] Unexpected error in DELETE /api/trades/:tradeId:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// POST /api/trades/:tradeId/updates - Create a trade update record
// ============================================================================
router.post("/api/trades/:tradeId/updates", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { tradeId } = req.params;
    const { type, price, message, pnl_percent, timestamp } = req.body;

    if (!tradeId) {
      return res.status(400).json({ error: "Missing trade ID" });
    }

    if (!type) {
      return res.status(400).json({ error: "Missing type field" });
    }

    // Validate input
    const validation = validateTradeUpdateInput({ action: type, price });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    console.log(`[Trades API] Creating trade update for trade ${tradeId}: type=${type}`);

    // Create trade update
    const updateRecord: TradeUpdateInsert = {
      trade_id: tradeId,
      user_id: userId,
      type,
      price: price || 0,
      message: message || `${type} action`,
      pnl_percent: pnl_percent || null,
      timestamp: timestamp || new Date().toISOString(),
    };

    const { data, error } = await getSupabaseClient()
      .from("trade_updates")
      .insert([updateRecord] as any)
      .select("*")
      .single();

    if (error) {
      console.error("[Trades API] Error creating trade update:", error);
      return res
        .status(500)
        .json({ error: "Failed to create trade update", details: error.message });
    }

    if (!data) {
      return res.status(500).json({ error: "Failed to create trade update: no data returned" });
    }

    const updateData_ = data as unknown as { id: string };
    console.log(`[Trades API] Trade update created successfully with ID: ${updateData_.id}`);
    res.status(201).json(data);
  } catch (error: any) {
    console.error("[Trades API] Unexpected error in POST /api/trades/:tradeId/updates:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// POST /api/trades/:tradeId/channels/:channelId - Link Discord channel to trade
// ============================================================================
router.post("/api/trades/:tradeId/channels/:channelId", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { tradeId, channelId } = req.params;

    if (!tradeId || !channelId) {
      return res.status(400).json({ error: "Missing trade ID or channel ID" });
    }

    console.log(`[Trades API] Linking channel ${channelId} to trade ${tradeId}`);

    // Insert or ignore if already exists (UNIQUE constraint)
    const channelLink: DiscordChannelLink = {
      trade_id: tradeId,
      discord_channel_id: channelId,
    };

    const { data, error } = await getSupabaseClient()
      .from("trades_discord_channels")
      .insert([channelLink] as any)
      .select("*")
      .single();

    if (error) {
      console.error("[Trades API] Error linking channel:", error);

      // Handle duplicate key error - this is OK, channel is already linked (code 23505)
      const errorCode =
        typeof error.code === "number" ? error.code : parseInt(error.code || "0", 10);
      if (errorCode === 23505) {
        console.log(
          `[Trades API] Channel ${channelId} already linked to trade ${tradeId} (idempotent - OK)`
        );
        return res.status(200).json({ message: "Channel already linked", alreadyLinked: true });
      }

      // Handle foreign key constraint (channel doesn't exist)
      // Note: Exclude duplicate key errors (already handled above)
      const errorMsg =
        typeof error.message === "string" ? error.message : String(error.message || "");
      if (
        errorMsg.includes("foreign key") ||
        (errorMsg.includes("violates") && !errorMsg.includes("duplicate key"))
      ) {
        console.warn(
          `[Trades API] Channel ${channelId} does not exist or trade ${tradeId} not found`
        );
        return res.status(400).json({
          error: "Discord channel not found or invalid",
          details: `Channel ID ${channelId} does not exist in database`,
        });
      }

      // Other errors
      console.error("[Trades API] Unexpected error:", errorMsg);
      return res.status(500).json({ error: "Failed to link channel", details: errorMsg });
    }

    console.log(`[Trades API] Channel linked successfully`);
    res.status(201).json(data);
  } catch (error: any) {
    console.error(
      "[Trades API] Unexpected error in POST /api/trades/:tradeId/channels/:channelId:",
      error
    );
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// DELETE /api/trades/:tradeId/channels/:channelId - Unlink Discord channel
// ============================================================================
router.delete("/api/trades/:tradeId/channels/:channelId", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { tradeId, channelId } = req.params;

    if (!tradeId || !channelId) {
      return res.status(400).json({ error: "Missing trade ID or channel ID" });
    }

    console.log(`[Trades API] Unlinking channel ${channelId} from trade ${tradeId}`);

    const { error } = await getSupabaseClient()
      .from("trades_discord_channels")
      .delete()
      .eq("trade_id", tradeId)
      .eq("discord_channel_id", channelId);

    if (error) {
      console.error("[Trades API] Error unlinking channel:", error);
      return res.status(500).json({ error: "Failed to unlink channel", details: error.message });
    }

    console.log(`[Trades API] Channel unlinked successfully`);
    res.json({ message: "Channel unlinked successfully" });
  } catch (error: any) {
    console.error(
      "[Trades API] Unexpected error in DELETE /api/trades/:tradeId/channels/:channelId:",
      error
    );
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// POST /api/trades/:tradeId/challenges/:challengeId - Link challenge to trade
// ============================================================================
router.post("/api/trades/:tradeId/challenges/:challengeId", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { tradeId, challengeId } = req.params;

    if (!tradeId || !challengeId) {
      return res.status(400).json({ error: "Missing trade ID or challenge ID" });
    }

    console.log(`[Trades API] Linking challenge ${challengeId} to trade ${tradeId}`);

    const challengeLink: ChallengeLink = {
      trade_id: tradeId,
      challenge_id: challengeId,
    };

    const { data, error } = await getSupabaseClient()
      .from("trades_challenges")
      .insert([challengeLink] as any)
      .select("*")
      .single();

    if (error) {
      console.error("[Trades API] Error linking challenge:", error);

      // Handle duplicate key error - this is OK, challenge is already linked (code 23505)
      const challengeErrorCode =
        typeof error.code === "number" ? error.code : parseInt(error.code || "0", 10);
      if (challengeErrorCode === 23505) {
        console.log(
          `[Trades API] Challenge ${challengeId} already linked to trade ${tradeId} (idempotent - OK)`
        );
        return res.status(200).json({ message: "Challenge already linked", alreadyLinked: true });
      }

      // Handle foreign key constraint (challenge doesn't exist)
      // Note: Exclude duplicate key errors (already handled above)
      const challengeErrorMsg =
        typeof error.message === "string" ? error.message : String(error.message || "");
      if (
        challengeErrorMsg.includes("foreign key") ||
        (challengeErrorMsg.includes("violates") && !challengeErrorMsg.includes("duplicate key"))
      ) {
        console.warn(
          `[Trades API] Challenge ${challengeId} does not exist or trade ${tradeId} not found`
        );
        return res.status(400).json({
          error: "Challenge not found or invalid",
          details: `Challenge ID ${challengeId} does not exist in database`,
        });
      }

      // Other errors
      console.error("[Trades API] Unexpected error:", challengeErrorMsg);
      return res
        .status(500)
        .json({ error: "Failed to link challenge", details: challengeErrorMsg });
    }

    console.log(`[Trades API] Challenge linked successfully`);
    res.status(201).json(data);
  } catch (error: any) {
    console.error(
      "[Trades API] Unexpected error in POST /api/trades/:tradeId/challenges/:challengeId:",
      error
    );
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// DELETE /api/trades/:tradeId/challenges/:challengeId - Unlink challenge
// ============================================================================
router.delete(
  "/api/trades/:tradeId/challenges/:challengeId",
  async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized: No user ID" });
      }

      const { tradeId, challengeId } = req.params;

      if (!tradeId || !challengeId) {
        return res.status(400).json({ error: "Missing trade ID or challenge ID" });
      }

      console.log(`[Trades API] Unlinking challenge ${challengeId} from trade ${tradeId}`);

      const { error } = await getSupabaseClient()
        .from("trades_challenges")
        .delete()
        .eq("trade_id", tradeId)
        .eq("challenge_id", challengeId);

      if (error) {
        console.error("[Trades API] Error unlinking challenge:", error);
        return res
          .status(500)
          .json({ error: "Failed to unlink challenge", details: error.message });
      }

      console.log(`[Trades API] Challenge unlinked successfully`);
      res.json({ message: "Challenge unlinked successfully" });
    } catch (error: any) {
      console.error(
        "[Trades API] Unexpected error in DELETE /api/trades/:tradeId/challenges/:challengeId:",
        error
      );
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  }
);

// ============================================================================
// PUT /api/trades/:tradeId/challenges - Replace all challenge links for a trade
// ============================================================================
router.put("/api/trades/:tradeId/challenges", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { tradeId } = req.params;
    const { challengeIds } = req.body;

    if (!tradeId) {
      return res.status(400).json({ error: "Missing trade ID" });
    }

    if (!Array.isArray(challengeIds)) {
      return res.status(400).json({ error: "challengeIds must be an array" });
    }

    console.log(
      `[Trades API] Replacing challenges for trade ${tradeId}: ${challengeIds.length} challenges`
    );

    // First, verify the trade belongs to this user
    const { data: tradeData, error: tradeError } = await getSupabaseClient()
      .from("trades")
      .select("id")
      .eq("id", tradeId)
      .eq("user_id", userId)
      .single();

    if (tradeError || !tradeData) {
      return res.status(404).json({ error: "Trade not found or unauthorized" });
    }

    // Delete all existing challenge links for this trade
    const { error: deleteError } = await getSupabaseClient()
      .from("trades_challenges")
      .delete()
      .eq("trade_id", tradeId);

    if (deleteError) {
      console.error("[Trades API] Error deleting existing challenge links:", deleteError);
      return res
        .status(500)
        .json({ error: "Failed to update challenges", details: deleteError.message });
    }

    // Insert new challenge links if any provided
    if (challengeIds.length > 0) {
      const challengeLinks = challengeIds.map((challengeId: string) => ({
        trade_id: tradeId,
        challenge_id: challengeId,
      }));

      const { error: insertError } = await getSupabaseClient()
        .from("trades_challenges")
        .insert(challengeLinks as any);

      if (insertError) {
        console.error("[Trades API] Error inserting new challenge links:", insertError);
        return res
          .status(500)
          .json({ error: "Failed to update challenges", details: insertError.message });
      }
    }

    console.log(`[Trades API] Successfully updated challenges for trade ${tradeId}`);
    res.json({
      message: "Challenges updated successfully",
      tradeId,
      challengeIds,
    });
  } catch (error: any) {
    console.error("[Trades API] Unexpected error in PUT /api/trades/:tradeId/challenges:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// GET /api/trades/admin/stale-loaded - Get stale LOADED trades for cleanup
// ============================================================================
router.get("/api/trades/admin/stale-loaded", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    console.log(`[Trades API] Fetching stale LOADED trades for user ${userId}`);

    // Find all LOADED trades older than 1 day
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data, error } = await getSupabaseClient()
      .from("trades")
      .select("id, ticker, created_at, state")
      .eq("user_id", userId)
      .eq("state", "LOADED")
      .lt("created_at", oneDayAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Trades API] Error fetching stale trades:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch stale trades", details: error.message });
    }

    res.json({
      count: data?.length || 0,
      trades: data || [],
      message: `Found ${data?.length || 0} stale LOADED trades older than 1 day`,
    });
  } catch (error: any) {
    console.error("[Trades API] Unexpected error in GET /api/trades/admin/stale-loaded:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ============================================================================
// DELETE /api/trades/admin/cleanup-stale - Delete stale LOADED trades
// ============================================================================
router.delete("/api/trades/admin/cleanup-stale", async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { olderThanDays = 1 } = req.body;

    console.log(
      `[Trades API] Cleaning up stale LOADED trades for user ${userId} (older than ${olderThanDays} days)`
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await getSupabaseClient()
      .from("trades")
      .delete()
      .eq("user_id", userId)
      .eq("state", "LOADED")
      .lt("created_at", cutoffDate.toISOString())
      .select("id, ticker");

    if (error) {
      console.error("[Trades API] Error cleaning up stale trades:", error);
      return res
        .status(500)
        .json({ error: "Failed to cleanup stale trades", details: error.message });
    }

    console.log(`[Trades API] Deleted ${data?.length || 0} stale LOADED trades`);
    res.json({
      deleted: data?.length || 0,
      trades: data || [],
      message: `Successfully deleted ${data?.length || 0} stale LOADED trades`,
    });
  } catch (error: any) {
    console.error(
      "[Trades API] Unexpected error in DELETE /api/trades/admin/cleanup-stale:",
      error
    );
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

export default router;
