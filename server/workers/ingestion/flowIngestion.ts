/**
 * Options Flow Ingestion Module
 * Tracks institutional options flow (sweeps, blocks, large trades)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateDTE } from "../../lib/marketCalendar.js";

export interface FlowIngestionResult {
  success: boolean;
  symbol: string;
  tradesProcessed: number;
  tradesStored: number;
  sweepsDetected: number;
  blocksDetected: number;
  timestamp: number;
  error?: string;
}

interface FlowRecord {
  symbol: string;
  contract_ticker: string;
  timestamp: number;
  price: number;
  size: number;
  premium: number;
  trade_type: "SWEEP" | "BLOCK" | "SPLIT" | "LARGE" | "REGULAR";
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  aggressiveness: "PASSIVE" | "NORMAL" | "AGGRESSIVE";
  strike: number;
  expiration: string;
  option_type: "call" | "put";
  underlying_price: number;
  dte: number;
  is_sweep: boolean;
  is_block: boolean;
  is_above_ask: boolean;
  is_below_bid: boolean;
  is_unusual_volume: boolean;
  size_percentile: number | null;
  premium_percentile: number | null;
  exchange: string | null;
  conditions: string[] | null;
}

/**
 * Classify trade type based on characteristics
 */
function classifyTrade(
  size: number,
  conditions: string[],
  spread: number,
  avgSize: number
): "SWEEP" | "BLOCK" | "SPLIT" | "LARGE" | "REGULAR" {
  // Sweep: Multi-leg execution across exchanges (typically has conditions like "SWEEP")
  if (conditions.some((c) => c.includes("SWEEP") || c.includes("MLTI"))) {
    return "SWEEP";
  }

  // Block: Very large size (>= 500 contracts or 5x avg)
  if (size >= 500 || size >= avgSize * 5) {
    return "BLOCK";
  }

  // Split: Multiple fills indicated by conditions
  if (conditions.some((c) => c.includes("SPLIT") || c.includes("CANC"))) {
    return "SPLIT";
  }

  // Large: 2-5x average size
  if (size >= avgSize * 2) {
    return "LARGE";
  }

  return "REGULAR";
}

/**
 * Determine sentiment based on aggressiveness and option type
 */
function detectSentiment(
  optionType: "call" | "put",
  isAboveAsk: boolean,
  isBelowBid: boolean
): "BULLISH" | "BEARISH" | "NEUTRAL" {
  // Calls bought aggressively (above ask) = bullish
  if (optionType === "call" && isAboveAsk) return "BULLISH";

  // Puts bought aggressively (above ask) = bearish
  if (optionType === "put" && isAboveAsk) return "BEARISH";

  // Calls sold aggressively (below bid) = bearish
  if (optionType === "call" && isBelowBid) return "BEARISH";

  // Puts sold aggressively (below bid) = bullish
  if (optionType === "put" && isBelowBid) return "BULLISH";

  // Default sentiment based on option type (passive trades)
  if (optionType === "call") return "BULLISH";
  if (optionType === "put") return "BEARISH";

  return "NEUTRAL";
}

/**
 * Detect aggressiveness based on price vs bid/ask
 */
function detectAggressiveness(
  price: number,
  bid: number,
  ask: number
): "PASSIVE" | "NORMAL" | "AGGRESSIVE" {
  const spread = ask - bid;
  const midPrice = (bid + ask) / 2;

  // Aggressive: Price significantly above ask or below bid
  if (price > ask + spread * 0.1) return "AGGRESSIVE";
  if (price < bid - spread * 0.1) return "AGGRESSIVE";

  // Passive: Price at or better than bid/ask (limit order)
  if (price <= bid || price >= ask) return "PASSIVE";

  // Normal: Price near mid
  return "NORMAL";
}

/**
 * Ingest options flow for a symbol
 *
 * Note: This is a placeholder implementation. In production, you would:
 * 1. Subscribe to Massive.com WebSocket trade feed
 * 2. Process trades in real-time
 * 3. Calculate percentiles from historical data
 *
 * For now, we'll create a basic structure that can be populated when
 * WebSocket integration is added.
 */
export async function ingestOptionsFlow(
  supabase: SupabaseClient,
  symbol: string
): Promise<FlowIngestionResult> {
  const timestamp = Date.now();

  try {
    // TODO: In production, subscribe to WebSocket trade feed
    // For now, this is a placeholder that demonstrates the structure

    // Query recent flow to calculate percentiles
    const { data: recentFlow } = await supabase
      .from("options_flow_history")
      .select("size, premium")
      .eq("symbol", symbol)
      .gte("timestamp", timestamp - 20 * 24 * 60 * 60 * 1000) // Last 20 days
      .order("timestamp", { ascending: false });

    const avgSize = recentFlow && recentFlow.length > 0
      ? recentFlow.reduce((sum, t) => sum + (t.size || 0), 0) / recentFlow.length
      : 100;

    const avgPremium = recentFlow && recentFlow.length > 0
      ? recentFlow.reduce((sum, t) => sum + (t.premium || 0), 0) / recentFlow.length
      : 10000;

    // In production, process incoming trades here
    // For now, return success with zero trades
    return {
      success: true,
      symbol,
      tradesProcessed: 0,
      tradesStored: 0,
      sweepsDetected: 0,
      blocksDetected: 0,
      timestamp,
    };
  } catch (error) {
    console.error(`[FlowIngestion] Error for ${symbol}:`, error);
    return {
      success: false,
      symbol,
      tradesProcessed: 0,
      tradesStored: 0,
      sweepsDetected: 0,
      blocksDetected: 0,
      timestamp,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process a single trade (helper for WebSocket integration)
 * Export for use when WebSocket feed is implemented
 */
export async function processTrade(
  supabase: SupabaseClient,
  trade: any,
  symbol: string,
  contract: any,
  underlyingPrice: number
): Promise<boolean> {
  try {
    const bid = trade.bid || contract.bid || 0;
    const ask = trade.ask || contract.ask || bid + 0.1;
    const size = trade.size || 0;
    const price = trade.price || 0;
    const premium = price * size * 100;

    // Classify trade
    const conditions = trade.conditions || [];
    const tradeType = classifyTrade(size, conditions, ask - bid, 100);
    const isAboveAsk = price > ask;
    const isBelowBid = price < bid;
    const sentiment = detectSentiment(contract.option_type, isAboveAsk, isBelowBid);
    const aggressiveness = detectAggressiveness(price, bid, ask);

    const record: Partial<FlowRecord> = {
      symbol,
      contract_ticker: contract.ticker,
      timestamp: trade.timestamp || Date.now(),
      price,
      size,
      premium,
      trade_type: tradeType,
      sentiment,
      aggressiveness,
      strike: contract.strike,
      expiration: contract.expiration,
      option_type: contract.option_type.toLowerCase() as "call" | "put",
      underlying_price: underlyingPrice,
      dte: calculateDTE(new Date(contract.expiration)),
      is_sweep: tradeType === "SWEEP",
      is_block: tradeType === "BLOCK",
      is_above_ask: isAboveAsk,
      is_below_bid: isBelowBid,
      is_unusual_volume: size > 100, // Placeholder
      size_percentile: null, // Calculate from historical data
      premium_percentile: null, // Calculate from historical data
      exchange: trade.exchange || null,
      conditions: conditions.length > 0 ? conditions : null,
    };

    const { error } = await supabase.from("options_flow_history").insert(record as any);

    if (error) {
      console.error("[FlowIngestion] Database error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[FlowIngestion] Error processing trade:", error);
    return false;
  }
}
