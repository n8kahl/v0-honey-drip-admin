/**
 * Options Flow Listener Worker
 * Phase 4: Live Options Flow Integration
 *
 * Connects to Massive.com WebSocket trade feed and processes real-time
 * options trades to detect institutional activity (sweeps, blocks, unusual volume).
 *
 * Usage:
 *   pnpm dev:flow        # Development mode (watch)
 *   pnpm start:flow      # Production mode
 *
 * Features:
 * - Real-time trade feed from Massive.com OPTIONS ADVANCED
 * - Automatic classification (SWEEP, BLOCK, LARGE, REGULAR)
 * - Sentiment detection (BULLISH, BEARISH, NEUTRAL)
 * - Aggressiveness scoring (PASSIVE, NORMAL, AGGRESSIVE)
 * - Database persistence in options_flow_history table
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { processTrade } from "./ingestion/flowIngestion.js";

// Environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[FlowListener] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!MASSIVE_API_KEY) {
  console.error("[FlowListener] Missing MASSIVE_API_KEY");
  process.exit(1);
}

// Singleton Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient!;
}

const supabase = getSupabaseClient();

// Configuration
const DEFAULT_SYMBOLS = ["SPX", "NDX", "SPY", "QQQ", "IWM"]; // Fallback if no watchlist data
const RECONNECT_DELAY = 5000; // 5 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MIN_TRADE_SIZE = 10; // Minimum contract size to track
const SYMBOL_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh subscriptions every 5 minutes
const MAX_SYMBOLS = parseInt(process.env.FLOW_MAX_SYMBOLS || "50", 10); // Safety limit

// ============================================================================
// Dynamic Symbol Loading (Pure Functions for Testing)
// ============================================================================

/**
 * Normalize and deduplicate symbols
 * @param symbols - Array of symbols (may contain duplicates, mixed case)
 * @returns Unique, uppercase, sorted symbols
 */
export function normalizeSymbols(symbols: string[]): string[] {
  const uniqueSet = new Set<string>();
  for (const sym of symbols) {
    if (sym && typeof sym === "string") {
      uniqueSet.add(sym.toUpperCase().trim());
    }
  }
  return Array.from(uniqueSet).sort();
}

/**
 * Apply safety limit to symbol list
 * @param symbols - Array of symbols
 * @param maxSymbols - Maximum number of symbols allowed
 * @returns Truncated array if necessary
 */
export function applySymbolLimit(symbols: string[], maxSymbols: number): string[] {
  if (symbols.length <= maxSymbols) return symbols;
  console.log(`[FlowListener] ⚠️ Symbol limit: truncating ${symbols.length} → ${maxSymbols}`);
  return symbols.slice(0, maxSymbols);
}

/**
 * Merge symbols from multiple sources
 * @param sources - Arrays of symbols from different sources
 * @returns Merged, normalized, limited symbol array
 */
export function mergeSymbolSources(
  sources: string[][],
  maxSymbols: number = MAX_SYMBOLS
): string[] {
  const allSymbols: string[] = [];
  for (const source of sources) {
    allSymbols.push(...source);
  }
  const normalized = normalizeSymbols(allSymbols);
  return applySymbolLimit(normalized, maxSymbols);
}

/**
 * Load symbols from Supabase watchlist and active trades
 * Uses service role for server-side access (bypasses RLS)
 */
async function loadDynamicSymbols(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  try {
    // Query watchlist symbols
    const { data: watchlistData, error: watchlistError } = await supabase
      .from("watchlist")
      .select("symbol");

    if (watchlistError) {
      console.error("[FlowListener] Watchlist query error:", watchlistError.message);
    }

    const watchlistSymbols = (watchlistData || []).map((row: { symbol: string }) => row.symbol);

    // Query active trade symbols (LOADED or ENTERED states)
    const { data: tradesData, error: tradesError } = await supabase
      .from("trades")
      .select("ticker")
      .in("state", ["LOADED", "ENTERED"]);

    if (tradesError) {
      console.error("[FlowListener] Trades query error:", tradesError.message);
    }

    // Extract underlying symbol from ticker (e.g., "O:SPY250117C00622000" → "SPY")
    const tradeSymbols = (tradesData || [])
      .map((row: { ticker: string }) => {
        const match = row.ticker?.match(/^O:([A-Z]+)/);
        return match ? match[1] : null;
      })
      .filter((s): s is string => s !== null);

    // Merge all sources with defaults as fallback
    const allSources = [watchlistSymbols, tradeSymbols];
    const hasData = watchlistSymbols.length > 0 || tradeSymbols.length > 0;

    if (!hasData) {
      console.log("[FlowListener] ℹ️ No watchlist/trade data, using defaults");
      return DEFAULT_SYMBOLS;
    }

    // Always include core index symbols for institutional flow
    allSources.push(DEFAULT_SYMBOLS);

    const merged = mergeSymbolSources(allSources, MAX_SYMBOLS);
    console.log(
      `[FlowListener] 📊 Loaded ${merged.length} symbols (watchlist: ${watchlistSymbols.length}, trades: ${tradeSymbols.length})`
    );

    return merged;
  } catch (error) {
    console.error("[FlowListener] Symbol loading error:", error);
    return DEFAULT_SYMBOLS;
  }
}

/**
 * Check if two symbol arrays are equal (same symbols in any order)
 */
export function symbolsAreEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((sym) => setA.has(sym));
}

// Stats tracking
interface Stats {
  tradesProcessed: number;
  tradesStored: number;
  sweepsDetected: number;
  blocksDetected: number;
  errors: number;
  lastTradeTime: number;
  connectionUptime: number;
}

const stats: Stats = {
  tradesProcessed: 0,
  tradesStored: 0,
  sweepsDetected: 0,
  blocksDetected: 0,
  errors: 0,
  lastTradeTime: 0,
  connectionUptime: Date.now(),
};

// WebSocket connection
const ws: WebSocket | null = null;
const heartbeatInterval: NodeJS.Timeout | null = null;
let isReconnecting = false;

/**
 * Main WebSocket listener
 */
class OptionsFlowListener {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private subscriptions = new Set<string>();
  private watchedSymbols: string[] = DEFAULT_SYMBOLS;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private symbolRefreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeWithDynamicSymbols();
  }

  /**
   * Initialize listener with dynamically loaded symbols
   */
  private async initializeWithDynamicSymbols() {
    console.log("[FlowListener] 🔄 Loading initial symbols from database...");
    this.watchedSymbols = await loadDynamicSymbols(supabase);
    console.log(`[FlowListener] ✅ Initial symbols: ${this.watchedSymbols.length} symbols`);

    // Connect after symbols are loaded
    this.connect();

    // Set up periodic symbol refresh
    this.startSymbolRefresh();
  }

  /**
   * Start periodic symbol refresh (every 5 minutes)
   */
  private startSymbolRefresh() {
    if (this.symbolRefreshInterval) {
      clearInterval(this.symbolRefreshInterval);
    }

    this.symbolRefreshInterval = setInterval(async () => {
      await this.refreshSymbols();
    }, SYMBOL_REFRESH_INTERVAL);

    console.log(
      `[FlowListener] ⏰ Symbol refresh scheduled every ${SYMBOL_REFRESH_INTERVAL / 60000} minutes`
    );
  }

  /**
   * Refresh symbols from database and update subscriptions if changed
   */
  private async refreshSymbols() {
    console.log("[FlowListener] 🔄 Refreshing symbols...");

    const newSymbols = await loadDynamicSymbols(supabase);

    if (symbolsAreEqual(this.watchedSymbols, newSymbols)) {
      console.log("[FlowListener] ✓ No symbol changes");
      return;
    }

    console.log(
      `[FlowListener] 📝 Symbols changed: ${this.watchedSymbols.length} → ${newSymbols.length}`
    );
    this.watchedSymbols = newSymbols;

    // Update subscriptions (will be filtered client-side)
    this.subscriptions.clear();
    newSymbols.forEach((s) => this.subscriptions.add(s));

    // Log the new symbol set (no sensitive data)
    console.log(`[FlowListener] 📊 Now watching ${this.watchedSymbols.length} symbols`);
  }

  /**
   * Get current watched symbols (for external access)
   */
  getWatchedSymbols(): string[] {
    return [...this.watchedSymbols];
  }

  /**
   * Connect to WebSocket
   *
   * Supports two modes:
   * 1. Hub proxy (default): Connect to local server hub which handles auth
   * 2. Direct: Connect directly to Massive.com (requires different subscription format)
   */
  private connect() {
    if (isReconnecting) return;
    isReconnecting = true;

    // Try hub proxy first (requires main server to be running)
    const useHubProxy = process.env.USE_HUB_PROXY !== "false";
    const hubUrl = process.env.HUB_URL || "ws://localhost:3000/ws/options";

    if (useHubProxy) {
      console.log(`[FlowListener] 🔌 Connecting via hub proxy (${hubUrl})...`);
      this.connectViaHub(hubUrl);
    } else {
      console.log("[FlowListener] 🔌 Connecting directly to Massive.com...");
      this.connectDirect();
    }
  }

  /**
   * Connect via local hub proxy (recommended)
   * Hub handles authentication, we just need to subscribe
   */
  private async connectViaHub(hubUrl: string) {
    try {
      // First, fetch an ephemeral token from the API
      const apiBase = process.env.API_BASE || "http://localhost:3000";
      console.log(`[FlowListener] 🔑 Fetching ephemeral token from ${apiBase}/api/ws-token...`);

      const tokenResponse = await fetch(`${apiBase}/api/ws-token`, { method: "POST" });
      if (!tokenResponse.ok) {
        throw new Error(`Failed to get token: ${tokenResponse.status}`);
      }
      const { token } = (await tokenResponse.json()) as { token: string };
      console.log("[FlowListener] 🔑 Got ephemeral token");

      // Connect with token
      const wsUrlWithToken = `${hubUrl}?token=${token}`;
      this.ws = new WebSocket(wsUrlWithToken);

      this.ws.on("open", () => {
        console.log("[FlowListener] ✅ Connected to hub proxy");
        this.isConnected = true;
        isReconnecting = false;
        stats.connectionUptime = Date.now();

        // Hub handles auth - subscribe immediately using options.trades format
        this.subscribeViaHub(this.watchedSymbols);
        this.startHeartbeat();
      });

      this.ws.on("message", (data) => this.handleMessage(data));
      this.ws.on("error", (error) => this.handleError(error));
      this.ws.on("close", (code, reason) => this.handleClose(code, reason));
      this.ws.on("ping", () => this.ws?.pong());
    } catch (error) {
      console.error("[FlowListener] Hub connection error:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Connect directly to Massive.com (fallback)
   */
  private connectDirect() {
    try {
      const wsUrl = "wss://socket.massive.com/options";
      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => this.handleOpen());
      this.ws.on("message", (data) => this.handleMessage(data));
      this.ws.on("error", (error) => this.handleError(error));
      this.ws.on("close", (code, reason) => this.handleClose(code, reason));
      this.ws.on("ping", () => this.ws?.pong());
    } catch (error) {
      console.error("[FlowListener] Direct connection error:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open (direct connection only)
   */
  private handleOpen() {
    console.log("[FlowListener] ✅ Connected to Massive.com");
    this.isConnected = true;
    isReconnecting = false;
    stats.connectionUptime = Date.now();

    // Authenticate with API key
    this.send({
      action: "auth",
      params: MASSIVE_API_KEY,
    });

    // Note: Subscriptions are sent after auth_success in handleStatusMessage
    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Subscribe via hub proxy using T.* format
   *
   * Per Massive docs (https://massive.com/docs/websocket/options/trades):
   * - Use `T.*` for ALL option trades (not SPY* per-underlying)
   * - Event type is "T" for trades
   * We'll filter by underlying symbol on our end.
   */
  private subscribeViaHub(symbols: string[]) {
    console.log(`[FlowListener] 📡 Subscribing via hub to ALL options trades...`);
    console.log(`[FlowListener]   Will filter for: ${symbols.join(", ")}`);

    // Per Massive docs: use T.* for all options trades
    const tradesChannel = `T.*`;

    this.send({
      action: "subscribe",
      params: tradesChannel,
    });

    symbols.forEach((s) => this.subscriptions.add(s));
    console.log(`[FlowListener]   ✓ Subscribed to: ${tradesChannel}`);
  }

  /**
   * Subscribe to trade feeds for symbols (direct connection)
   *
   * Per Massive docs (https://massive.com/docs/websocket/options/trades):
   * - Use `*` to subscribe to ALL option contracts
   * - Use specific ticker like T.O:SPY251219C00650000 for one contract
   * - Wildcards like SPY* are NOT supported
   */
  private subscribeToSymbols(symbols: string[]) {
    console.log(`[FlowListener] 📡 Subscribing to ALL options trades...`);
    console.log(`[FlowListener]   Will filter for: ${symbols.join(", ")}`);

    // Per docs: use T.* for all options trades (not T.O:SPY*)
    this.send({
      action: "subscribe",
      params: "T.*",
    });
    console.log(`[FlowListener]   ✓ Subscribed to ALL options trades (T.*)`);

    symbols.forEach((s) => this.subscriptions.add(s));
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(data: WebSocket.Data) {
    try {
      const rawData = data.toString();

      // Debug: Log first 200 chars of each message
      console.log(`[FlowListener] 📨 Received: ${rawData.slice(0, 200)}`);

      // Massive.com sends messages as JSON arrays, not newline-delimited
      const parsed = JSON.parse(rawData);
      const messages = Array.isArray(parsed) ? parsed : [parsed];

      for (const message of messages) {
        if (!message || typeof message !== "object") continue;

        // Handle different message types
        switch (message.ev) {
          case "status":
            this.handleStatusMessage(message);
            break;

          case "T": // Trade message
            await this.handleTradeMessage(message);
            break;

          case "A": // Aggregate (alternative format)
            await this.handleAggregateMessage(message);
            break;

          default:
            // Log unknown event types for debugging
            if (message.ev) {
              console.log(`[FlowListener] Unknown event type: ${message.ev}`);
            }
            break;
        }
      }
    } catch (error) {
      console.error("[FlowListener] Message parsing error:", error);
      stats.errors++;
    }
  }

  /**
   * Handle status message (auth confirmation)
   */
  private handleStatusMessage(message: any) {
    if (message.status === "auth_success") {
      console.log("[FlowListener] 🔐 Authentication successful");
      // Now that we're authenticated, subscribe to trade feeds
      this.subscribeToSymbols(this.watchedSymbols);
    } else if (message.status === "auth_failed") {
      console.error("[FlowListener] ❌ Authentication failed");
      process.exit(1);
    } else {
      console.log(`[FlowListener] Status: ${message.status} - ${message.message || ""}`);
    }
  }

  /**
   * Handle trade message
   */
  private async handleTradeMessage(message: any) {
    try {
      stats.tradesProcessed++;
      stats.lastTradeTime = Date.now();

      // Extract underlying symbol from contract ticker
      // Format: O:SPX251219C06475000 → SPX
      const ticker = message.sym || "";
      const underlyingMatch = ticker.match(/^O:([A-Z]+)/);
      if (!underlyingMatch) {
        return; // Skip invalid tickers
      }

      const symbol = underlyingMatch[1];

      // Filter by size (ignore tiny retail trades)
      const size = message.s || 0;
      if (size < MIN_TRADE_SIZE) {
        return;
      }

      // Parse contract details from ticker
      // Format: O:SPX251219C06475000
      //         O: prefix
      //         SPX: underlying
      //         251219: expiration (YYMMDD)
      //         C: call/put
      //         06475000: strike price (× 1000)
      const tickerParts = ticker.match(/^O:([A-Z]+)(\d{6})([CP])(\d{8})$/);
      if (!tickerParts) {
        console.warn(`[FlowListener] Invalid ticker format: ${ticker}`);
        return;
      }

      const [, , expirationStr, optionTypeStr, strikePriceStr] = tickerParts;

      // Parse expiration: 251219 → 2025-12-19
      const year = 2000 + parseInt(expirationStr.slice(0, 2));
      const month = expirationStr.slice(2, 4);
      const day = expirationStr.slice(4, 6);
      const expiration = `${year}-${month}-${day}`;

      // Parse strike: 06475000 → 6475.00
      const strike = parseInt(strikePriceStr) / 1000;

      // Option type: C → call, P → put
      const optionType = optionTypeStr === "C" ? "call" : "put";

      // Build contract object
      const contract = {
        ticker,
        symbol,
        strike,
        expiration,
        option_type: optionType,
        bid: message.b || 0,
        ask: message.a || 0,
      };

      // Build trade object
      const trade = {
        ticker,
        price: message.p || 0,
        size: message.s || 0,
        timestamp: message.t || Date.now(),
        bid: message.b || 0,
        ask: message.a || 0,
        exchange: message.x || null,
        conditions: message.c || [],
      };

      // Get underlying price (you may need to query this separately)
      const underlyingPrice = await this.getUnderlyingPrice(symbol);

      // Process trade and store in database
      const stored = await processTrade(supabase, trade, symbol, contract, underlyingPrice);

      if (stored) {
        stats.tradesStored++;

        // Check for special trade types using OPRA condition codes
        // Code 12 = Intermarket sweep order
        const conditions = trade.conditions || [];
        if (conditions.some((c: number) => c === 12)) {
          stats.sweepsDetected++;
        }
        if (trade.size >= 500) {
          stats.blocksDetected++;
        }

        // Log significant trades
        if (trade.size >= 100) {
          const premium = trade.price * trade.size * 100;
          const sentiment = optionType === "call" ? "📈" : "📉";
          console.log(
            `[FlowListener] ${sentiment} ${symbol} ${strike}${optionType.toUpperCase()[0]} ` +
              `${trade.size} @ $${trade.price.toFixed(2)} ($${(premium / 1000).toFixed(1)}K premium)`
          );
        }
      }

      // Log stats every 100 trades
      if (stats.tradesProcessed % 100 === 0) {
        this.logStats();
      }
    } catch (error) {
      console.error("[FlowListener] Trade processing error:", error);
      stats.errors++;
    }
  }

  /**
   * Handle aggregate message (alternative format)
   */
  private async handleAggregateMessage(message: any) {
    // Aggregate messages may contain aggregated trade data
    // Can be implemented similarly to handleTradeMessage
    // For now, we'll focus on raw trades
  }

  /**
   * Get underlying price for a symbol
   * Note: You may want to cache this or query from a separate stream
   */
  private async getUnderlyingPrice(symbol: string): Promise<number> {
    // TODO: Query from indices snapshot or quote feed
    // For now, return a placeholder (will not affect classification logic)
    return 0;
  }

  /**
   * Send message to WebSocket
   */
  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Error) {
    console.error("[FlowListener] ❌ WebSocket error:", error.message);
    stats.errors++;
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(code: number, reason: Buffer) {
    console.log(
      `[FlowListener] 🔌 Connection closed (code: ${code}, reason: ${reason.toString()})`
    );
    this.isConnected = false;
    this.subscriptions.clear();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.scheduleReconnect();
  }

  /**
   * Schedule reconnect attempt
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    console.log(`[FlowListener] ⏳ Reconnecting in ${RECONNECT_DELAY / 1000}s...`);

    this.reconnectTimeout = setTimeout(() => {
      isReconnecting = false;
      this.connect();
    }, RECONNECT_DELAY);
  }

  /**
   * Log statistics
   */
  private logStats() {
    const uptime = Math.floor((Date.now() - stats.connectionUptime) / 1000 / 60);
    const storeRate =
      stats.tradesProcessed > 0
        ? ((stats.tradesStored / stats.tradesProcessed) * 100).toFixed(1)
        : "0.0";

    console.log("\n[FlowListener] 📊 Statistics:");
    console.log(`  Uptime: ${uptime} minutes`);
    console.log(`  Trades processed: ${stats.tradesProcessed}`);
    console.log(`  Trades stored: ${stats.tradesStored} (${storeRate}%)`);
    console.log(`  Sweeps detected: ${stats.sweepsDetected}`);
    console.log(`  Blocks detected: ${stats.blocksDetected}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(
      `  Last trade: ${stats.lastTradeTime ? new Date(stats.lastTradeTime).toLocaleTimeString() : "Never"}\n`
    );
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    console.log("[FlowListener] 🛑 Shutting down...");

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.symbolRefreshInterval) {
      clearInterval(this.symbolRefreshInterval);
    }

    if (this.ws) {
      this.ws.close(1000, "Graceful shutdown");
    }

    this.logStats();
    process.exit(0);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║       Options Flow Listener - Phase 4 Integration             ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

console.log(`[FlowListener] Dynamic symbol loading from Supabase watchlists`);
console.log(`[FlowListener] Max symbols: ${MAX_SYMBOLS} (FLOW_MAX_SYMBOLS env override)`);
console.log(`[FlowListener] Symbol refresh: every ${SYMBOL_REFRESH_INTERVAL / 60000} minutes`);
console.log(`[FlowListener] Min trade size: ${MIN_TRADE_SIZE} contracts`);
console.log(`[FlowListener] Database connected\n`);

// Create listener
const listener = new OptionsFlowListener();

// Graceful shutdown on signals
process.on("SIGINT", () => listener.shutdown());
process.on("SIGTERM", () => listener.shutdown());

// Log stats every 5 minutes
setInterval(
  () => {
    listener["logStats"]();
  },
  5 * 60 * 1000
);
