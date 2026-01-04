import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

/**
 * Options Trade Listener
 *
 * Server-side component that connects to Massive.com WebSocket,
 * filters for significant institutional flow (Sweeps/Blocks),
 * and persists them to the database for FlowAnalysisEngine.
 */

export interface TradeUpdate {
  ev: "T";
  sym: string; // Ticker (e.g., "O:SPY251219C00650000")
  p: number; // Price
  s: number; // Size
  x: number; // Exchange
  c: number[]; // Conditions
  t: number; // Timestamp
}

const WS_URL = "wss://socket.massive.com/v3/options";

export class OptionsTradeListener {
  private socket: WebSocket | null = null;
  private apiKey: string;
  private supabase: any;
  private isConnected = false;
  private reconnectAttempts = 0;
  private subscriptions: Set<string> = new Set();

  // filtering thresholds
  private MIN_PREMIUM = 25000; // $25k minimum premium
  private SWEEP_CONDITION = 35; // Hypothetical 'Sweep' condition code

  constructor(apiKey?: string, supabaseUrl?: string, supabaseKey?: string) {
    this.apiKey = apiKey || process.env.MASSIVE_API_KEY || "";

    const url = supabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key =
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!this.apiKey) console.warn("[OptionsTradeListener] Missing Massive API Key");
    if (!url || !key) console.warn("[OptionsTradeListener] Missing Supabase Credentials");

    this.supabase = createClient(url!, key!, {
      auth: { persistSession: false },
    });
  }

  public start() {
    this.connect();
  }

  private connect() {
    if (!this.apiKey) return;

    console.log("[OptionsTradeListener] Connecting to Massive Options Stream...");
    this.socket = new WebSocket(`${WS_URL}?token=${this.apiKey}`);

    this.socket.on("open", () => {
      console.log("[OptionsTradeListener] Connected.");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.subscribeToMarketWideFlow();
    });

    this.socket.on("message", (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        // Handle array of messages or single object
        if (Array.isArray(msg)) {
          msg.forEach((m) => this.handleMessage(m));
        } else {
          this.handleMessage(msg);
        }
      } catch (e) {
        console.error("[OptionsTradeListener] Parse error:", e);
      }
    });

    this.socket.on("close", () => {
      console.warn("[OptionsTradeListener] Disconnected. Reconnecting...");
      this.isConnected = false;
      this.scheduleReconnect();
    });

    this.socket.on("error", (err) => {
      console.error("[OptionsTradeListener] Error:", err.message);
    });
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  private subscribeToMarketWideFlow() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    // Subscribe to all trades. In production, might want to limit to specific tickers
    // or use a filtered channel if available.
    // For now, assuming we subscribe to "T.*"
    const msg = {
      action: "subscribe",
      params: ["T.*"],
    };
    this.socket.send(JSON.stringify(msg));
  }

  private async handleMessage(msg: any) {
    if (msg.ev !== "T") return;

    const trade = msg as TradeUpdate;
    const premium = trade.p * trade.s * 100; // Standard option contract size 100

    // Filter for significance
    if (premium < this.MIN_PREMIUM) return;

    const isSweep = trade.c.includes(this.SWEEP_CONDITION);
    const flowType = isSweep ? "SWEEP" : premium > 100000 ? "BLOCK" : "REGULAR";

    // We only care about Sweeps or Blocks > $100k
    if (flowType === "REGULAR" && premium < 100000) return;

    await this.persistTrade(trade, premium, flowType);
  }

  private async persistTrade(trade: TradeUpdate, premium: number, type: string) {
    // Parse ticker to get symbol, expiration, strike, type
    // Format: O:SPY251219C00650000
    // Simplified parsing logic
    const ticker = trade.sym.replace("O:", "");
    // Extract underlying (e.g., SPY) - heuristic
    const underlyingMatch = ticker.match(/^([A-Z]+)/);
    const symbol = underlyingMatch ? underlyingMatch[1] : "UNKNOWN";

    const record = {
      symbol: symbol,
      option_symbol: trade.sym,
      price: trade.p,
      size: trade.s,
      premium: premium,
      timestamp: trade.t,
      side: "unknown", // Massive data might not explicitly say buy/sell side without aggressor flag
      type: type, // SWEEP / BLOCK
      exchange: trade.x,
    };

    const { error } = await this.supabase.from("options_flow_history").insert(record);

    if (error) {
      console.error("[OptionsTradeListener] DB Insert Error:", error.message);
    } else {
      console.log(`[Flow] Captured ${type} on ${symbol}: $${Math.round(premium / 1000)}k`);
    }
  }
}
