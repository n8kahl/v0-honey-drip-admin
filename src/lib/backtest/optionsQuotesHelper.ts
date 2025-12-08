/**
 * Options Quotes Helper
 * Provides bid/ask data for realistic backtest fills
 *
 * Uses options_quotes table populated from Massive.com flat files
 * Falls back to estimated spreads when data unavailable
 *
 * IMPORTANT: This module is SERVER-SIDE ONLY and uses SUPABASE_SERVICE_ROLE_KEY.
 * It should NEVER be imported in browser/frontend code bundled by Vite.
 */

// Runtime check to prevent accidental browser usage
if (typeof window !== "undefined") {
  throw new Error(
    "optionsQuotesHelper is server-only and cannot be used in browser. " +
      "Do not import this module in frontend code."
  );
}

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabase;
}

// ============================================================================
// Types
// ============================================================================

export interface OptionsQuote {
  underlying: string;
  option_ticker: string;
  timestamp: number;
  bid_price: number;
  ask_price: number;
  bid_size: number;
  ask_size: number;
  mid_price: number;
  spread_percent: number;
}

export interface SpreadEstimate {
  bidAskSpread: number; // In dollars
  spreadPercent: number; // As percentage
  isEstimate: boolean; // True if using fallback
  source: "database" | "estimate";
  liquidity: "high" | "medium" | "low";
}

export interface QuoteLookupResult {
  found: boolean;
  quote?: OptionsQuote;
  estimate: SpreadEstimate;
}

// ============================================================================
// Estimated Spreads (Fallback)
// ============================================================================

/**
 * Estimated spreads by underlying when no quote data available
 * Based on typical market conditions
 */
const ESTIMATED_SPREADS: Record<string, { spread: number; spreadPct: number }> = {
  // Index options - typically tighter spreads
  SPX: { spread: 0.5, spreadPct: 1.5 },
  NDX: { spread: 1.0, spreadPct: 1.5 },

  // ETF options - very liquid
  SPY: { spread: 0.02, spreadPct: 0.5 },
  QQQ: { spread: 0.03, spreadPct: 0.6 },

  // Liquid single stocks
  TSLA: { spread: 0.05, spreadPct: 1.0 },
  AMD: { spread: 0.03, spreadPct: 0.8 },
  NVDA: { spread: 0.05, spreadPct: 0.8 },
  MSFT: { spread: 0.03, spreadPct: 0.6 },
  PLTR: { spread: 0.02, spreadPct: 0.8 },
  UNH: { spread: 0.5, spreadPct: 0.8 },

  // Less liquid stocks
  SOFI: { spread: 0.02, spreadPct: 2.0 },

  // Default for unknown
  DEFAULT: { spread: 0.05, spreadPct: 1.5 },
};

/**
 * Get estimated spread for an underlying
 */
function getEstimatedSpread(underlying: string): SpreadEstimate {
  const estimate = ESTIMATED_SPREADS[underlying] || ESTIMATED_SPREADS.DEFAULT;

  return {
    bidAskSpread: estimate.spread,
    spreadPercent: estimate.spreadPct,
    isEstimate: true,
    source: "estimate",
    liquidity: estimate.spreadPct < 1.0 ? "high" : estimate.spreadPct < 2.0 ? "medium" : "low",
  };
}

// ============================================================================
// Database Queries
// ============================================================================

/**
 * Get quote at a specific timestamp for an underlying
 * Returns the closest quote at or before the requested time
 */
export async function getQuoteAtTime(
  underlying: string,
  timestamp: number,
  maxSpreadPct: number = 5.0,
  minSize: number = 10
): Promise<QuoteLookupResult> {
  const db = getSupabase();

  // If no database connection, return estimate
  if (!db) {
    return {
      found: false,
      estimate: getEstimatedSpread(underlying),
    };
  }

  try {
    // Query for closest quote at or before timestamp
    const { data, error } = await db
      .from("options_quotes")
      .select("*")
      .eq("underlying", underlying)
      .lte("timestamp", timestamp)
      .lte("spread_percent", maxSpreadPct)
      .gte("bid_size", minSize)
      .gte("ask_size", minSize)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // No quote found, return estimate
      return {
        found: false,
        estimate: getEstimatedSpread(underlying),
      };
    }

    // Cast data to any to avoid TypeScript errors with untyped table
    const row = data as any;
    const quote: OptionsQuote = {
      underlying: row.underlying,
      option_ticker: row.option_ticker,
      timestamp: row.timestamp,
      bid_price: parseFloat(row.bid_price),
      ask_price: parseFloat(row.ask_price),
      bid_size: row.bid_size,
      ask_size: row.ask_size,
      mid_price: parseFloat(row.mid_price),
      spread_percent: parseFloat(row.spread_percent),
    };

    return {
      found: true,
      quote,
      estimate: {
        bidAskSpread: quote.ask_price - quote.bid_price,
        spreadPercent: quote.spread_percent,
        isEstimate: false,
        source: "database",
        liquidity:
          quote.bid_size >= 50 && quote.ask_size >= 50
            ? "high"
            : quote.bid_size >= 20 && quote.ask_size >= 20
              ? "medium"
              : "low",
      },
    };
  } catch (err) {
    console.warn(`[OptionsQuotes] Error fetching quote: ${err}`);
    return {
      found: false,
      estimate: getEstimatedSpread(underlying),
    };
  }
}

/**
 * Get average spread statistics for a time range
 */
export async function getSpreadStats(
  underlying: string,
  startTs: number,
  endTs: number
): Promise<{
  avgSpreadPct: number;
  minSpreadPct: number;
  maxSpreadPct: number;
  quoteCount: number;
}> {
  const db = getSupabase();

  if (!db) {
    const est = ESTIMATED_SPREADS[underlying] || ESTIMATED_SPREADS.DEFAULT;
    return {
      avgSpreadPct: est.spreadPct,
      minSpreadPct: est.spreadPct * 0.5,
      maxSpreadPct: est.spreadPct * 2,
      quoteCount: 0,
    };
  }

  try {
    // Cast db to any to bypass strict RPC typing
    const { data, error } = await (db as any).rpc("get_avg_spread_stats", {
      p_underlying: underlying,
      p_start_ts: startTs,
      p_end_ts: endTs,
    });

    // Cast to any for untyped RPC function
    const rows = data as any[];

    if (error || !rows || rows.length === 0) {
      const est = ESTIMATED_SPREADS[underlying] || ESTIMATED_SPREADS.DEFAULT;
      return {
        avgSpreadPct: est.spreadPct,
        minSpreadPct: est.spreadPct * 0.5,
        maxSpreadPct: est.spreadPct * 2,
        quoteCount: 0,
      };
    }

    return {
      avgSpreadPct: parseFloat(rows[0].avg_spread_pct) || 1.0,
      minSpreadPct: parseFloat(rows[0].min_spread_pct) || 0.5,
      maxSpreadPct: parseFloat(rows[0].max_spread_pct) || 2.0,
      quoteCount: parseInt(rows[0].quote_count) || 0,
    };
  } catch (err) {
    console.warn(`[OptionsQuotes] Error fetching stats: ${err}`);
    const est = ESTIMATED_SPREADS[underlying] || ESTIMATED_SPREADS.DEFAULT;
    return {
      avgSpreadPct: est.spreadPct,
      minSpreadPct: est.spreadPct * 0.5,
      maxSpreadPct: est.spreadPct * 2,
      quoteCount: 0,
    };
  }
}

// ============================================================================
// Backtest Integration
// ============================================================================

/**
 * Calculate realistic slippage for a trade
 *
 * @param underlying - The underlying symbol (SPY, SPX, etc.)
 * @param timestamp - Entry timestamp
 * @param basePrice - The underlying price
 * @param direction - LONG or SHORT
 * @returns Slippage amount to apply to entry price
 */
export async function calculateRealisticSlippage(
  underlying: string,
  timestamp: number,
  basePrice: number,
  direction: "LONG" | "SHORT"
): Promise<{
  slippage: number;
  slippagePercent: number;
  source: "database" | "estimate";
  spreadPercent: number;
}> {
  const result = await getQuoteAtTime(underlying, timestamp);

  // Use half the spread as slippage (we enter at mid, slippage to bid/ask)
  const halfSpreadPct = result.estimate.spreadPercent / 2;
  const slippagePct = halfSpreadPct / 100;
  const slippage = basePrice * slippagePct;

  return {
    slippage: direction === "LONG" ? slippage : -slippage,
    slippagePercent: halfSpreadPct,
    source: result.estimate.source,
    spreadPercent: result.estimate.spreadPercent,
  };
}

/**
 * Check if a trade should be filtered due to poor liquidity
 *
 * @param underlying - The underlying symbol
 * @param timestamp - Entry timestamp
 * @param maxSpreadPct - Maximum acceptable spread (default 2%)
 * @param minSize - Minimum bid/ask size (default 10 lots)
 * @returns Object indicating if trade should be taken
 */
export async function checkLiquidity(
  underlying: string,
  timestamp: number,
  maxSpreadPct: number = 2.0,
  minSize: number = 10
): Promise<{
  isLiquid: boolean;
  reason?: string;
  spreadPercent: number;
  bidSize: number;
  askSize: number;
}> {
  const result = await getQuoteAtTime(underlying, timestamp, maxSpreadPct, minSize);

  // If using estimate, assume liquid (don't filter)
  if (!result.found) {
    return {
      isLiquid: true,
      reason: "Using estimated spread (no quote data)",
      spreadPercent: result.estimate.spreadPercent,
      bidSize: 100, // Assume adequate
      askSize: 100,
    };
  }

  const quote = result.quote!;

  // Check spread
  if (quote.spread_percent > maxSpreadPct) {
    return {
      isLiquid: false,
      reason: `Spread too wide: ${quote.spread_percent.toFixed(2)}% > ${maxSpreadPct}%`,
      spreadPercent: quote.spread_percent,
      bidSize: quote.bid_size,
      askSize: quote.ask_size,
    };
  }

  // Check size
  if (quote.bid_size < minSize || quote.ask_size < minSize) {
    return {
      isLiquid: false,
      reason: `Insufficient size: bid=${quote.bid_size}, ask=${quote.ask_size} (min=${minSize})`,
      spreadPercent: quote.spread_percent,
      bidSize: quote.bid_size,
      askSize: quote.ask_size,
    };
  }

  return {
    isLiquid: true,
    spreadPercent: quote.spread_percent,
    bidSize: quote.bid_size,
    askSize: quote.ask_size,
  };
}

// ============================================================================
// Cache Management
// ============================================================================

// In-memory cache for frequently accessed quotes
const quoteCache = new Map<string, { quote: QuoteLookupResult; expiry: number }>();
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get quote with caching (for repeated backtests)
 */
export async function getQuoteAtTimeCached(
  underlying: string,
  timestamp: number
): Promise<QuoteLookupResult> {
  const cacheKey = `${underlying}:${timestamp}`;
  const cached = quoteCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.quote;
  }

  const result = await getQuoteAtTime(underlying, timestamp);

  quoteCache.set(cacheKey, {
    quote: result,
    expiry: Date.now() + CACHE_TTL,
  });

  return result;
}

/**
 * Clear the quote cache
 */
export function clearQuoteCache(): void {
  quoteCache.clear();
}
