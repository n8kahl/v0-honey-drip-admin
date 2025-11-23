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
 * Helper: Extract user ID from request (via RLS context or JWT)
 * In production, extract from verified JWT token
 */
function getUserId(req: Request): string | null {
  // For now, accept user_id from header (should be authenticated)
  const userId = req.headers["x-user-id"] as string;
  return userId || null;
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
  const validActions = [
    "entry",
    "trim",
    "add",
    "exit",
    "stop_update",
    "update-sl",
    "trail-stop",
    "tp_near",
  ];
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
  status?: string;
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
  action: string;
  price?: number;
  quantity?: number;
  notes?: string | null;
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
    const userId = getUserId(req);
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
    const tradeData: TradeInsert = {
      user_id: userId,
      ticker: trade.ticker,
      contract_type: trade.contract?.type || null,
      strike: trade.contract?.strike || null,
      expiration: trade.contract?.expiry || null,
      quantity: trade.quantity || 1,
      status: trade.status || "loaded",
      entry_price: trade.entry_price || null,
      target_price: trade.targetPrice || null,
      stop_loss: trade.stopLoss || null,
      entry_time: trade.entryTime || null,
      notes: trade.notes || null,
      contract: trade.contract || null, // Store full contract object as JSONB (includes bid, ask, volume, Greeks, etc.)
    } as any;

    const { data, error } = await getSupabaseClient()
      .from("trades")
      .insert([tradeData] as any)
      .select("*")
      .single();

    if (error) {
      console.error("[Trades API] Error creating trade:", error);
      return res.status(500).json({ error: "Failed to create trade", details: error.message });
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
    const userId = getUserId(req);
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
    if (updates.status && !["loaded", "entered", "exited"].includes(updates.status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // Update trade
    const updateData: TradeUpdate = {
      status: updates.status,
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
    const userId = getUserId(req);
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
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user ID" });
    }

    const { tradeId } = req.params;
    const { action, price, quantity, notes } = req.body;

    if (!tradeId) {
      return res.status(400).json({ error: "Missing trade ID" });
    }

    // Validate input
    const validation = validateTradeUpdateInput({ action, price });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    console.log(`[Trades API] Creating trade update for trade ${tradeId}: action=${action}`);

    // Create trade update
    const updateRecord: TradeUpdateInsert = {
      trade_id: tradeId,
      user_id: userId,
      action,
      price,
      quantity: quantity || 1,
      notes: notes || null,
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
    const userId = getUserId(req);
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

      // Handle foreign key constraint (channel doesn't exist)
      if (error.message.includes("foreign key") || error.message.includes("violates")) {
        console.warn(
          `[Trades API] Channel ${channelId} does not exist or trade ${tradeId} not found`
        );
        return res.status(400).json({
          error: "Discord channel not found or invalid",
          details: `Channel ID ${channelId} does not exist in database`,
        });
      }

      // Handle duplicate (idempotent)
      if (error.message.includes("duplicate")) {
        console.log(`[Trades API] Channel already linked (idempotent)`);
        return res.status(200).json({ message: "Channel already linked" });
      }

      // Other errors
      console.error("[Trades API] Unexpected error:", error.message);
      return res.status(500).json({ error: "Failed to link channel", details: error.message });
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
    const userId = getUserId(req);
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
    const userId = getUserId(req);
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

      // Handle foreign key constraint (challenge doesn't exist)
      if (error.message.includes("foreign key") || error.message.includes("violates")) {
        console.warn(
          `[Trades API] Challenge ${challengeId} does not exist or trade ${tradeId} not found`
        );
        return res.status(400).json({
          error: "Challenge not found or invalid",
          details: `Challenge ID ${challengeId} does not exist in database`,
        });
      }

      // Handle duplicate (idempotent)
      if (error.message.includes("duplicate")) {
        console.log(`[Trades API] Challenge already linked (idempotent)`);
        return res.status(200).json({ message: "Challenge already linked" });
      }

      // Other errors
      console.error("[Trades API] Unexpected error:", error.message);
      return res.status(500).json({ error: "Failed to link challenge", details: error.message });
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
      const userId = getUserId(req);
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

export default router;
