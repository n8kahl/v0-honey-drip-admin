import { createClient } from "./client";

// ============================================================================
// PROFILES
// ============================================================================

export async function getProfile(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  updates: {
    display_name?: string;
    discord_handle?: string;
    avatar_url?: string;
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// DISCORD CHANNELS
// ============================================================================

export async function getDiscordChannels(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("discord_channels")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addDiscordChannel(
  userId: string,
  name: string,
  webhookUrl: string,
  description?: string
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("discord_channels")
    .insert({
      user_id: userId,
      name,
      webhook_url: webhookUrl,
      description: description || null,
      is_active: true,
      is_global_default: false,
      is_default_load: false,
      is_default_enter: false,
      is_default_exit: false,
      is_default_update: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDiscordChannel(
  channelId: string,
  updates: {
    name?: string;
    webhook_url?: string;
    description?: string;
    is_active?: boolean;
    is_global_default?: boolean;
    is_default_load?: boolean;
    is_default_enter?: boolean;
    is_default_exit?: boolean;
    is_default_update?: boolean;
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("discord_channels")
    .update(updates)
    .eq("id", channelId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDiscordChannel(id: string) {
  const supabase = createClient();

  const { error } = await supabase.from("discord_channels").delete().eq("id", id);

  if (error) throw error;
}

// ============================================================================
// CHALLENGES
// ============================================================================

export async function getChallenges(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addChallenge(
  userId: string,
  challenge: {
    name: string;
    description?: string;
    starting_balance: number;
    target_balance: number;
    start_date: string;
    end_date: string;
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      user_id: userId,
      name: challenge.name,
      description: challenge.description,
      starting_balance: challenge.starting_balance,
      current_balance: challenge.starting_balance,
      target_balance: challenge.target_balance,
      start_date: challenge.start_date,
      end_date: challenge.end_date,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateChallenge(
  challengeId: string,
  updates: {
    name?: string;
    description?: string;
    current_balance?: number;
    target_balance?: number;
    end_date?: string;
    is_active?: boolean;
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("challenges")
    .update(updates)
    .eq("id", challengeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChallenge(id: string) {
  const supabase = createClient();

  const { error } = await supabase.from("challenges").delete().eq("id", id);

  if (error) throw error;
}

export async function archiveChallenge(challengeId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("challenges")
    .update({
      archived_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", challengeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function restoreChallenge(challengeId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("challenges")
    .update({ archived_at: null })
    .eq("id", challengeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// WATCHLIST
// ============================================================================

export async function getWatchlist(userId: string) {
  // Test-mode: return a seeded watchlist without hitting Supabase
  const isAutomated = typeof navigator !== "undefined" && (navigator as any)?.webdriver === true;
  if ((import.meta as any)?.env?.VITE_TEST_FAKE_DB === "true" || isAutomated) {
    return [
      { id: "wl-1", user_id: userId, symbol: "QQQ", added_at: new Date().toISOString() },
      { id: "wl-2", user_id: userId, symbol: "SPY", added_at: new Date().toISOString() },
      { id: "wl-3", user_id: userId, symbol: "AAPL", added_at: new Date().toISOString() },
    ];
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addToWatchlist(userId: string, symbol: string) {
  const supabase = createClient();

  // Normalize
  const norm = (symbol || "").trim().toUpperCase();

  try {
    // Pre-check to avoid duplicate insert errors if state is stale
    const { data: existing, error: preErr } = await supabase
      .from("watchlist")
      .select("id, symbol")
      .eq("user_id", userId)
      .eq("symbol", norm)
      .maybeSingle();

    if (preErr) {
      console.error("[v0] addToWatchlist pre-check error:", preErr);
      // continue to attempt insert
    } else if (existing) {
      return existing;
    }

    // Insert new watchlist entry
    const { data: insertData, error: insertErr } = await supabase
      .from("watchlist")
      .insert({
        user_id: userId,
        symbol: norm,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[v0] addToWatchlist insert error:", {
        message: insertErr.message,
        code: insertErr.code,
        details: insertErr.details,
        hint: insertErr.hint,
      });
      throw insertErr;
    }

    return insertData;
  } catch (err) {
    console.error("[v0] addToWatchlist caught error:", (err as Error)?.message || err);
    throw err;
  }
}

export async function removeFromWatchlist(id: string) {
  const supabase = createClient();

  const { error } = await supabase.from("watchlist").delete().eq("id", id);

  if (error) throw error;
}

// ============================================================================
// TRADES
// ============================================================================

export interface GetTradesOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export async function getTrades(userId: string, options: GetTradesOptions = {}) {
  const supabase = createClient();
  const { status, limit = 100, offset = 0 } = options;

  // Fetch trades with related data from junction tables (with pagination)
  let query = supabase
    .from("trades")
    .select(
      "*, trade_updates(*), trades_discord_channels(discord_channel_id), trades_challenges(challenge_id)"
    )
    .eq("user_id", userId);

  if (status) {
    query = query.eq("state", status);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

/** Get total count of trades for pagination */
export async function getTradesCount(userId: string, status?: string): Promise<number> {
  const supabase = createClient();

  let query = supabase
    .from("trades")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (status) {
    query = query.eq("state", status);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count || 0;
}

export async function createTrade(
  userId: string,
  trade: {
    ticker: string;
    contract_type: "call" | "put";
    strike: number;
    expiration: string;
    quantity: number;
    entry_price?: number;
    status?: string;
    notes?: string;
    challenge_id?: string;
    contract?: any; // Full contract object to persist
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("trades")
    .insert({
      user_id: userId,
      ticker: trade.ticker,
      contract_type: trade.contract_type,
      strike: trade.strike,
      expiration: trade.expiration,
      quantity: trade.quantity,
      entry_price: trade.entry_price,
      state: trade.status || "watching",
      notes: trade.notes,
      challenge_id: trade.challenge_id,
      contract: trade.contract || null, // Store full contract as JSONB
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTrade(
  id: string,
  updates: {
    status?: string;
    quantity?: number;
    entry_price?: number;
    exit_price?: number;
    entry_time?: string;
    exit_time?: string;
    pnl?: number;
    pnl_percent?: number;
    notes?: string;
    target_price?: number;
    stop_loss?: number;
    current_price?: number;
    move_percent?: number;
    state?: string;
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("trades")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTrade(id: string) {
  const supabase = createClient();

  const { error } = await supabase.from("trades").delete().eq("id", id);

  if (error) throw error;
}

// ============================================================================
// TRADE UPDATES
// ============================================================================

export async function addTradeUpdate(
  tradeId: string,
  userId: string,
  update: {
    action: string;
    quantity?: number;
    price?: number;
    notes?: string;
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("trade_updates")
    .insert({
      trade_id: tradeId,
      user_id: userId,
      action: update.action,
      quantity: update.quantity,
      price: update.price,
      notes: update.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTradeUpdates(tradeId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("trade_updates")
    .select("*")
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

// ============================================================================
// ALERT HISTORY
// ============================================================================

export async function recordAlertHistory(params: {
  userId: string;
  tradeId?: string;
  alertType:
    | "load"
    | "enter"
    | "trim"
    | "update"
    | "update-sl"
    | "trail-stop"
    | "add"
    | "exit"
    | "summary"
    | "challenge";
  channelIds: string[];
  challengeIds?: string[];
  successCount: number;
  failedCount: number;
  errorMessage?: string;
  tradeTicker?: string;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("alert_history")
    .insert({
      user_id: params.userId,
      trade_id: params.tradeId || null,
      alert_type: params.alertType,
      channel_ids: params.channelIds,
      challenge_ids: params.challengeIds || [],
      success_count: params.successCount,
      failed_count: params.failedCount,
      error_message: params.errorMessage || null,
      trade_ticker: params.tradeTicker || null,
    })
    .select()
    .single();

  if (error) {
    // Don't throw - alert history is non-critical
    console.error("[Database] Failed to record alert history:", error);
    return null;
  }
  return data;
}

export async function getAlertHistory(userId: string, limit = 50) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("alert_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
