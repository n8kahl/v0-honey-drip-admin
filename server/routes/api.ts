import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  massiveFetch,
  callMassive,
  getOptionChain,
  listOptionContracts,
  getIndicesSnapshot,
} from "../massive/client.js";
import {
  tradierGetUnderlyingPrice,
  tradierGetBatchQuotes,
  tradierGetExpirations,
  tradierGetNormalizedForExpiration,
  tradierGetHistory,
} from "../vendors/tradier.js";
import {
  isV2AggsPath,
  rememberFailure,
  shouldShortCircuit,
  buildEmptyAggsResponse,
} from "../lib/fallbackAggs.js";
import { normalizeSymbolForMassive, isIndex } from "../lib/symbolUtils.js";
import {
  cachedFetch,
  getCachedBars,
  setCachedBars,
  getCachedContracts,
  setCachedContracts,
  getCachedSnapshot,
  setCachedSnapshot,
  getCachedIndex,
  setCachedIndex,
} from "../lib/cache.js";
import { calculateDTE, getMarketStatus } from "../lib/marketCalendar.js";
import { sendToWebhook, type DiscordAlertPayload } from "../discordClient.js";

const router = Router();
const TOKEN_EXPIRY_MS = 5 * 60 * 1000;

// Supabase client for database operations (with service role for write operations)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient;
}

/**
 * Map timespan to timeframe string for database
 * minute+1 -> "1m", hour+1 -> "1h", etc.
 */
function getTimeframeKey(multiplier: string, timespan: string): string {
  const mult = multiplier;
  if (timespan === "minute") {
    return `${mult}m`;
  } else if (timespan === "hour") {
    return `${mult}h`;
  } else if (timespan === "day") {
    return "day";
  }
  return `${mult}${timespan.charAt(0)}`;
}

/**
 * Query historical_bars table for cached bars
 * Returns null if not found or on error
 */
async function queryHistoricalBars(
  symbol: string,
  timeframe: string,
  fromDate: string,
  toDate: string
): Promise<any[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null; // No database client available
  }

  try {
    // Convert YYYY-MM-DD to epoch milliseconds
    const fromMs = new Date(fromDate).getTime();
    const toMs = new Date(toDate).getTime() + 86400000 - 1; // End of day

    const { data, error } = await supabase
      .from("historical_bars")
      .select("*")
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .gte("timestamp", fromMs)
      .lte("timestamp", toMs)
      .order("timestamp", { ascending: true });

    if (error) {
      console.warn(`[API] Error querying historical_bars for ${symbol}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      return null; // No data in database
    }

    console.log(`[API] ✅ Database hit: ${symbol} ${timeframe} (${data.length} bars)`);
    return data;
  } catch (error) {
    console.warn(`[API] Exception querying historical_bars:`, error);
    return null;
  }
}

/**
 * Store bars in historical_bars table for future use
 */
async function storeHistoricalBars(symbol: string, timeframe: string, bars: any[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || bars.length === 0) {
    return;
  }

  try {
    const rows = bars.map((bar) => ({
      symbol,
      timeframe,
      timestamp: bar.t || bar.timestamp,
      open: Number(bar.o || bar.open),
      high: Number(bar.h || bar.high),
      low: Number(bar.l || bar.low),
      close: Number(bar.c || bar.close),
      volume: Number(bar.v || bar.volume || 0),
      vwap: bar.vw || bar.vwap || null,
      trades: bar.n || bar.trades || null,
    }));

    const { error } = await supabase.from("historical_bars").upsert(rows as any, {
      onConflict: "symbol,timeframe,timestamp",
      ignoreDuplicates: true,
    });

    if (error) {
      console.warn(`[API] Error storing historical_bars for ${symbol}:`, error);
    } else {
      console.log(`[API] Stored ${rows.length} bars for ${symbol} ${timeframe} in database`);
    }
  } catch (error) {
    console.warn(`[API] Exception storing historical_bars:`, error);
  }
}

// Lazy-loaded environment variable (read at runtime after dotenv loads)
function getMassiveApiKey(): string {
  return process.env.MASSIVE_API_KEY || "";
}

/**
 * Validate ephemeral token (signed with MASSIVE_API_KEY)
 * Same validation logic as WebSocket server
 */
function requireProxyToken(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-massive-proxy-token");

  if (!token) {
    return res.status(403).json({ error: "Forbidden: Missing token" });
  }

  try {
    const MASSIVE_API_KEY = getMassiveApiKey();
    if (!MASSIVE_API_KEY) {
      return res.status(500).json({ error: "Server not configured: MASSIVE_API_KEY" });
    }

    const parts = token.split(".");
    if (parts.length !== 2) {
      return res.status(403).json({ error: "Forbidden: Invalid token format" });
    }

    const payloadB64 = parts[0];
    const sig = parts[1];
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
    const obj = JSON.parse(payloadJson) as { exp?: number; n?: string };

    if (!obj?.exp || typeof obj.exp !== "number") {
      return res.status(403).json({ error: "Forbidden: Invalid token payload" });
    }

    if (Date.now() > obj.exp) {
      return res.status(403).json({ error: "Forbidden: Token expired" });
    }

    const expected = crypto.createHmac("sha256", MASSIVE_API_KEY).update(payloadJson).digest("hex");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");

    if (
      a.byteLength !== b.byteLength ||
      !crypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
    ) {
      return res.status(403).json({ error: "Forbidden: Invalid signature" });
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: "Forbidden: Token validation failed" });
  }
}

function handleMassiveError(res: Response, error: any) {
  const msg = String(error?.message || error || "");
  const lower = msg.toLowerCase();
  const statusCode = error?.status || 502;
  const status =
    statusCode === 403 || lower.includes("403") || lower.includes("forbidden") ? 403 : 502;
  res.status(status).json({
    error: status === 403 ? "Massive 403: Forbidden" : "Massive request failed",
    message: msg,
  });
}

type BarsQuery = {
  symbol?: string;
  ticker?: string;
  multiplier?: string;
  timespan?: string;
  from?: string;
  to?: string;
  limit?: string;
  adjusted?: string;
  sort?: string;
};

function ensureParams(required: string[], query: Record<string, string | undefined>) {
  const missing = required.filter((key) => !query[key]);
  return missing;
}

router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Market status endpoint
router.get("/market/status", (_req, res) => {
  const status = getMarketStatus();
  res.json({
    ...status,
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
// Note: Actual metrics data is tracked client-side via the MonitoringDashboard component
// which has real-time access to the MetricsService singleton. This endpoint indicates
// that metrics monitoring is active. The MonitoringDashboard polls metrics every 5 seconds.
router.get("/metrics", (_req, res) => {
  res.json({
    status: "ok",
    monitoring: true,
    message: "Production metrics are tracked client-side via MonitoringDashboard",
    metricsTracked: [
      "Provider Health (Massive/Tradier uptime, response times)",
      "Greeks Quality (validation rates, bounds checking)",
      "P&L Accuracy (gross vs net P&L, cost impact)",
      "System Health (API times, errors, WebSocket status)",
    ],
    updateFrequency: "5 seconds",
    timestamp: new Date().toISOString(),
  });
});

// Backwards-compatible token mint (requires proxy token header). Deprecated: do not include apiKey in payload.
router.post("/massive/ws-token", requireProxyToken, (_req, res) => {
  const MASSIVE_API_KEY = getMassiveApiKey();
  if (!MASSIVE_API_KEY) return res.status(500).json({ error: "MASSIVE_API_KEY missing" });
  const exp = Date.now() + TOKEN_EXPIRY_MS;
  const payloadObj = { exp, n: crypto.randomBytes(16).toString("hex") };
  const payload = JSON.stringify(payloadObj);
  const sig = crypto.createHmac("sha256", MASSIVE_API_KEY).update(payload).digest("hex");
  const token = `${Buffer.from(payload).toString("base64")}.${sig}`;
  res.json({ token, expiresAt: exp });
});

// Public ephemeral token route for client WS auth (no long-lived secret in browser)
router.post("/ws-token", (_req, res) => {
  const MASSIVE_API_KEY = getMassiveApiKey();
  if (!MASSIVE_API_KEY) return res.status(500).json({ error: "MASSIVE_API_KEY missing" });
  const exp = Date.now() + TOKEN_EXPIRY_MS;
  const payloadObj = { exp, n: crypto.randomBytes(16).toString("hex") };
  const payload = JSON.stringify(payloadObj);
  const sig = crypto.createHmac("sha256", MASSIVE_API_KEY).update(payload).digest("hex");
  const token = `${Buffer.from(payload).toString("base64")}.${sig}`;
  res.json({ token, expiresAt: exp });
});

/**
 * Discord Webhook Proxy
 * Proxies Discord webhook calls from client to avoid CSP violations
 * and keep webhook URLs secure
 */
router.post("/discord/webhook", async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body as {
      webhookUrl: string;
      payload: DiscordAlertPayload;
    };

    if (!webhookUrl || !payload) {
      return res.status(400).json({ error: "Missing webhookUrl or payload" });
    }

    // Validate webhook URL format
    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      return res.status(400).json({ error: "Invalid Discord webhook URL" });
    }

    const result = await sendToWebhook(webhookUrl, payload);

    if (result.ok) {
      return res.json({ success: true, status: result.status });
    } else {
      return res.status(result.status || 502).json({
        success: false,
        error: result.error || "Failed to send Discord webhook",
      });
    }
  } catch (error: any) {
    console.error("[API] Discord webhook proxy error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Removed /massive/stocks/bars endpoint: application operates solely on indices and options.

router.get("/massive/indices/bars", requireProxyToken, async (req, res) => {
  const {
    symbol,
    multiplier,
    timespan,
    from,
    to,
    limit = "250",
    adjusted = "true",
    sort = "asc",
  } = req.query as BarsQuery;

  const missing = ensureParams(
    ["symbol", "multiplier", "timespan", "from", "to"],
    req.query as Record<string, string>
  );
  if (missing.length) {
    return res.status(400).json({ error: `Missing query params: ${missing.join(", ")}` });
  }

  try {
    // CRITICAL: Normalize symbol for Massive.com (adds I: prefix for indices like SPX, NDX)
    const normalizedSymbol = normalizeSymbolForMassive(symbol!);
    console.log(
      `[Massive] /massive/indices/bars: Normalized symbol: ${symbol} → ${normalizedSymbol}`
    );

    const path =
      `/v2/aggs/ticker/${encodeURIComponent(normalizedSymbol)}` +
      `/range/${multiplier}/${timespan}/${from}/${to}` +
      `?adjusted=${adjusted}&sort=${sort}&limit=${limit}`;
    const json = await massiveFetch(path);
    res.json(json);
  } catch (error) {
    handleMassiveError(res, error);
  }
});

router.get("/massive/options/bars", requireProxyToken, async (req, res) => {
  const {
    ticker,
    multiplier,
    timespan,
    from,
    to,
    limit = "5000",
    adjusted = "true",
    sort = "asc",
  } = req.query as BarsQuery;

  const missing = ensureParams(
    ["ticker", "multiplier", "timespan", "from", "to"],
    req.query as Record<string, string>
  );
  if (missing.length) {
    return res.status(400).json({ error: `Missing query params: ${missing.join(", ")}` });
  }

  try {
    const path =
      `/v2/aggs/ticker/${encodeURIComponent(ticker!)}` +
      `/range/${multiplier}/${timespan}/${from}/${to}` +
      `?adjusted=${adjusted}&sort=${sort}&limit=${limit}`;
    const json = await massiveFetch(path);
    res.json(json);
  } catch (error) {
    handleMassiveError(res, error);
  }
});

// Tradier stock bars endpoint - fallback for stocks when user doesn't have Massive stocks plan
// Uses Tradier /markets/timesales for intraday (1min, 5min, 15min) and /markets/history for daily
router.get("/massive/tradier/stocks/bars", requireProxyToken, async (req, res) => {
  const {
    symbol,
    interval = "5min",
    start,
    end,
  } = req.query as {
    symbol?: string;
    interval?: "1min" | "5min" | "15min" | "daily" | "weekly" | "monthly";
    start?: string;
    end?: string;
  };

  if (!symbol) {
    return res.status(400).json({ error: "Missing query param: symbol" });
  }

  try {
    console.log(
      `[Tradier] Fetching ${symbol} bars: interval=${interval}, start=${start}, end=${end}`
    );

    // Use vendor tradierGetHistory which supports both intraday and daily
    const bars = await tradierGetHistory(symbol, interval, start, end);
    console.log(`[Tradier] ✅ Received ${bars.length} bars for ${symbol}`);

    // Return in Massive-compatible format
    res.json({
      results: bars.map((bar) => ({
        t: bar.time * 1000, // Convert seconds to milliseconds
        o: bar.open,
        h: bar.high,
        l: bar.low,
        c: bar.close,
        v: bar.volume,
        vw: (bar.open + bar.high + bar.low + bar.close) / 4, // Approximate VWAP
      })),
    });
  } catch (error: any) {
    console.error("[Tradier] ❌ Stock bars error for", symbol, ":", error.message || error);
    res.status(502).json({ error: "External API error" });
  }
});

router.get("/massive/options/chain", requireProxyToken, async (req, res) => {
  try {
    const underlying = String(req.query.underlying || req.query.symbol || "");
    if (!underlying) return res.status(400).json({ error: "underlying required" });
    const limitParam = Array.isArray(req.query.limit)
      ? req.query.limit[0]
      : String(req.query.limit || "");
    const parsedLimit = limitParam ? Number(limitParam) : undefined;
    const limit =
      typeof parsedLimit === "number" && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : undefined;

    // Extract filter parameters (e.g., ?strike_price.gte=400&expiration_date.lte=...)
    const filters = extractFilterParams(req.query);

    const data = await getOptionChain(underlying, limit, filters);
    res.json(data);
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    const status = msg.includes("403") || msg.toLowerCase().includes("forbidden") ? 403 : 502;

    res.status(status).json({
      error: status === 403 ? "Massive 403: Forbidden" : "Massive request failed",
      message: msg,
    });
  }
});

// Helper to extract filter parameters (.gte, .lte, etc.)
function extractFilterParams(query: Record<string, any>): Record<string, any> {
  const filters: Record<string, any> = {};

  Object.entries(query).forEach(([key, value]) => {
    if (key.includes(".") && !["limit", "underlying", "symbol"].includes(key.split(".")[0])) {
      filters[key] = value; // Preserve .gte, .lte etc.
    }
  });

  return filters;
}

router.get("/massive/options/contracts", requireProxyToken, async (req, res) => {
  try {
    const data = await listOptionContracts(req.query as Record<string, string>);
    res.json(data);
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    const status = msg.includes("403") || msg.toLowerCase().includes("forbidden") ? 403 : 502;

    res.status(status).json({
      error: status === 403 ? "Massive 403: Forbidden" : "Massive request failed",
      message: msg,
    });
  }
});

// Unified, normalized options chain for UI consumption
// GET /api/options/chain?symbol=SPX&window=10
router.get("/options/chain", requireProxyToken, async (req, res) => {
  try {
    const symbol = String(req.query.symbol || req.query.underlying || "").toUpperCase();
    console.log(`[v0] 🔥 /api/options/chain called for ${symbol} (unified endpoint)`);
    if (!symbol) return res.status(400).json({ error: "symbol required" });
    // Provider: 'massive' | 'tradier'
    // Priority: query.provider > env OPTIONS_PROVIDER > presence of TRADIER_ACCESS_TOKEN
    let provider = String((req.query as any).provider || "").toLowerCase();
    if (!provider) {
      const envProvider = String(process.env.OPTIONS_PROVIDER || "").toLowerCase();
      if (envProvider === "massive" || envProvider === "tradier") provider = envProvider;
      else if (process.env.TRADIER_ACCESS_TOKEN) provider = "tradier";
      else provider = "massive";
    }
    // window = optional number of expirations to include (Webull-like)
    const windowParam = Array.isArray(req.query.window)
      ? req.query.window[0]
      : req.query.window
        ? String(req.query.window)
        : undefined;
    const parsedWindow = typeof windowParam !== "undefined" ? Number(windowParam) : Number.NaN;
    const expWindow =
      Number.isFinite(parsedWindow) && parsedWindow > 0 ? Math.min(250, parsedWindow) : undefined;
    // strikeWindow controls strikes per side around ATM
    const strikeWindowParam = Array.isArray((req.query as any).strikeWindow)
      ? (req.query as any).strikeWindow[0]
      : String((req.query as any).strikeWindow || "10");
    const perSide = Math.max(1, Math.min(25, Number(strikeWindowParam) || 10));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // 1) Resolve underlying price and expirations window
    let price = 0;

    // 2) Build target expirations list out to ~1 year, limited by expWindow
    // endDate = optional upper bound for expirations (YYYY-MM-DD). If omitted, include all available.
    const endDateParam = Array.isArray((req.query as any).endDate)
      ? (req.query as any).endDate[0]
      : String((req.query as any).endDate || "");
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endDateParam) ? endDateParam : undefined;

    // Provider branch: Tradier vs Massive (default)
    const useTradier = provider === "tradier";
    let expirations: string[] = [];
    if (useTradier) {
      try {
        price = await tradierGetUnderlyingPrice(symbol);
      } catch (e) {
        console.warn("[v0] Tradier underlying price failed; defaulting to 0", e);
        price = 0;
      }
      expirations = await tradierGetExpirations(symbol, todayStr, endDate);
      if (typeof expWindow === "number" && expWindow > 0)
        expirations = expirations.slice(0, expWindow);
      console.log(`[v0] Tradier ${symbol} expirations: ${expirations.length}`);
    } else {
      const indexLike = ["SPX", "NDX", "VIX", "RUT"].includes(symbol) || symbol.startsWith("I:");
      if (indexLike) {
        const snap = await getIndicesSnapshot([symbol.replace(/^I:/, "")]);
        const v = Array.isArray(snap?.results) ? snap.results[0]?.value : snap?.value;
        price = typeof v === "number" ? v : 0;
      } else {
        const optSnap = await getOptionChain(symbol.replace(/^I:/, ""), 1);
        const u = optSnap?.results?.[0]?.underlying_asset?.price;
        price = typeof u === "number" ? u : 0;
      }
      console.log(`[v0] ${symbol} underlying price: $${price.toFixed(2)}`);

      // Prefer reference contracts for a complete expiration calendar
      try {
        const params: any = {
          underlying_ticker: symbol.replace(/^I:/, ""),
          "expiration_date.gte": todayStr,
          limit: "1000",
        };
        if (endDate) params["expiration_date.lte"] = endDate;
        const ref = await listOptionContracts(params as any);
        const refResults: any[] = Array.isArray(ref?.results) ? ref.results : [];
        const expSet = new Set<string>(
          refResults
            .map((c: any) => c.expiration_date || c.details?.expiration_date)
            .filter(Boolean)
        );
        expirations = Array.from(expSet).sort();
      } catch (err) {
        console.warn(`[v0] reference contracts failed, falling back to snapshot expirations:`, err);
        // Fallback: take expirations from a single snapshot page
        const contractsSnap = await getOptionChain(symbol.replace(/^I:/, ""), 250);
        const contractsList = Array.isArray(contractsSnap?.results) ? contractsSnap.results : [];
        const expSet = new Set<string>(
          contractsList
            .map((c: any) => c.details?.expiration_date || c.expiration_date)
            .filter(Boolean)
        );
        expirations = Array.from(expSet).sort();
      }

      // Trim to endDate and optional expWindow
      if (endDate) expirations = expirations.filter((date) => date <= endDate);
      if (typeof expWindow === "number" && expWindow > 0) {
        expirations = expirations.slice(0, expWindow);
      }
      console.log(
        `[v0] ${symbol} selected expirations: ${expirations.length}${endDate ? ` (endDate=${endDate}` : ""}${expWindow ? `${endDate ? "," : " ("} window=${expWindow}` : ""}${endDate || expWindow ? ")" : ""}`,
        expirations.slice(0, 10)
      );
    }

    // 4) Normalize and group by expiration
    // Greeks & Mid-Price Policy:
    // - Greeks sourced from options snapshot (greeks.delta/gamma/theta/vega)
    // - Mid-price: prefer NBBO mid ((bid+ask)/2) when both available
    // - Fallback: last_trade.p, then single-side quote (ap or bp)
    // - IV from snapshot implied_volatility
    type Norm = {
      id: string;
      ticker: string;
      type: "C" | "P";
      strike: number;
      expiration: string;
      dte: number;
      iv?: number;
      delta?: number;
      gamma?: number;
      theta?: number;
      vega?: number;
      bid?: number;
      ask?: number;
      last?: number;
      oi?: number;
    };

    // 3) Fetch contract pages per expiration and normalize (parallel to avoid N+1)
    let normalized: Norm[] = [];
    if (useTradier) {
      const normsArrays = await Promise.all(
        expirations.map((date) => tradierGetNormalizedForExpiration(symbol, date, today))
      );
      for (const norms of normsArrays) {
        normalized.push(...(norms as any as Norm[]));
      }
    } else {
      const snapshots = await Promise.all(
        expirations.map((date) =>
          getOptionChain(symbol.replace(/^I:/, ""), 250, { expiration_date: date })
        )
      );
      const pages: any[] = [];
      for (const snap of snapshots) {
        const arr = Array.isArray(snap?.results) ? snap.results : [];
        pages.push(...arr);
      }

      normalized = pages
        .map((c: any) => {
          // Snapshot data structure: c has details, greeks, last_quote, last_trade, etc.
          const details = c.details || {};
          const ticker = details.ticker || c.ticker;
          const expiration = details.expiration_date || c.expiration_date;
          const strike = details.strike_price || c.strike_price;
          const contractType = details.contract_type || c.contract_type || c.type || "";

          const exp = new Date(expiration);
          // Use market calendar for accurate DTE (trading days, not calendar days)
          const dte = calculateDTE(exp, today);
          const side = contractType.toString().toUpperCase().startsWith("C") ? "C" : "P";

          // Greeks from snapshot
          const greeks = c.greeks || {};

          // Price sourcing with NBBO mid preference
          const bid = c.last_quote?.bid || c.last_quote?.bp;
          const ask = c.last_quote?.ask || c.last_quote?.ap;
          const last =
            (c.last_trade?.price || c.last_trade?.p) ?? (bid && ask ? undefined : (ask ?? bid));

          return {
            id: ticker,
            ticker: ticker,
            type: side,
            strike: Number(strike) || 0,
            expiration: expiration,
            dte,
            iv: c.implied_volatility,
            delta: greeks?.delta,
            gamma: greeks?.gamma,
            theta: greeks?.theta,
            vega: greeks?.vega,
            bid,
            ask,
            last,
            oi: c.open_interest,
          } as Norm;
        })
        .filter((n: Norm) => Number.isFinite(n.strike) && n.strike > 0);
    }

    const byExp = new Map<string, Norm[]>();
    for (const n of normalized) {
      const arr = byExp.get(n.expiration) || [];
      arr.push(n);
      byExp.set(n.expiration, arr);
    }

    function windowAroundATM(items: Norm[], atm: number, side: "C" | "P") {
      const sameSide = items.filter((i) => i.type === side).sort((a, b) => a.strike - b.strike);
      if (sameSide.length === 0) return [] as Norm[];

      // Find the strike closest to ATM
      let atmIdx = 0;
      let bestDiff = Math.abs(sameSide[0].strike - atm);
      for (let i = 1; i < sameSide.length; i++) {
        const d = Math.abs(sameSide[i].strike - atm);
        if (d < bestDiff) {
          bestDiff = d;
          atmIdx = i;
        }
      }

      // Return exactly perSide ITM + ATM + perSide OTM (total: 2*perSide + 1)
      // For calls: ITM is below ATM (lower strikes), OTM is above (higher strikes)
      // For puts: ITM is above ATM (higher strikes), OTM is below (lower strikes)
      // Since we're sorting ascending, we just take perSide on each side of ATM
      const start = Math.max(0, atmIdx - perSide);
      const end = Math.min(sameSide.length, atmIdx + perSide + 1);

      const result = sameSide.slice(start, end);
      console.log(
        `[v0] windowAroundATM ${side}: total=${sameSide.length}, atmIdx=${atmIdx}, atmStrike=${sameSide[atmIdx].strike}, window=[${start},${end}), returned=${result.length}`
      );

      return result;
    }

    const allExpirations = Array.from(byExp.keys()).sort();
    const payload = expirations.map((date) => {
      const items = byExp.get(date)!;
      // ATM is closest strike among all items
      let atmStrike = items[0].strike;
      let minD = Math.abs(items[0].strike - price);
      for (let i = 1; i < items.length; i++) {
        const d = Math.abs(items[i].strike - price);
        if (d < minD) {
          minD = d;
          atmStrike = items[i].strike;
        }
      }
      return {
        date,
        dte: Math.max(0, Math.ceil((new Date(date).getTime() - today.getTime()) / 86_400_000)),
        atmStrike,
        calls: windowAroundATM(items, atmStrike, "C"),
        puts: windowAroundATM(items, atmStrike, "P"),
      };
    });

    res.json({
      symbol,
      price,
      asOf: new Date().toISOString(),
      expirations: payload,
    });
  } catch (error) {
    handleMassiveError(res, error);
  }
});

router.get("/massive/indices", requireProxyToken, async (req, res) => {
  try {
    const tickers = String(req.query.tickers || "");
    if (!tickers) return res.status(400).json({ error: "tickers required" });
    const data = await getIndicesSnapshot(tickers.split(","));
    res.json(data);
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    const status = msg.includes("403") || msg.toLowerCase().includes("forbidden") ? 403 : 502;

    res.status(status).json({
      error: status === 403 ? "Massive 403: Forbidden" : "Massive request failed",
      message: msg,
    });
  }
});

// Unified bars endpoint (stocks/indices/options) -> normalized shape for UI
// GET /api/bars?symbol=SPY&timespan=minute&multiplier=1&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500
//
// **OPTIMIZATION**: Write-through cache with database persistence
// 1. Check database first (historical_bars table)
// 2. If not found, fetch from Massive API
// 3. Store in database for future use
// Result: 10-50x faster for repeated queries (database vs API)
router.get("/bars", requireProxyToken, async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const timespan = String(req.query.timespan || "minute");
    const multiplier = String(req.query.multiplier || "1");
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const limit = String(req.query.limit || "500");
    const adjusted = String(req.query.adjusted || "true");
    const sort = String(req.query.sort || "asc");

    if (!from || !to) {
      return res.status(400).json({ error: "from and to dates required (YYYY-MM-DD)" });
    }

    const timeframe = getTimeframeKey(multiplier, timespan);

    // **STEP 1**: Check database for historical bars
    const dbBars = await queryHistoricalBars(symbol, timeframe, from, to);

    let normalized: any[] = [];
    let source = "api"; // Track data source for logging

    if (dbBars && dbBars.length > 0) {
      // Database hit! Convert to normalized format
      normalized = dbBars.map((bar: any) => ({
        timestamp: Number(bar.timestamp),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume) || 0,
        vwap: bar.vwap ? Number(bar.vwap) : undefined,
        trades: bar.trades ? Number(bar.trades) : undefined,
      }));
      source = "database";
    } else {
      // **STEP 2**: Database miss - fetch from Massive API or Tradier fallback
      const isIndexSymbol = isIndex(symbol);
      const massiveSymbol = normalizeSymbolForMassive(symbol);

      const path =
        `/v2/aggs/ticker/${encodeURIComponent(massiveSymbol)}` +
        `/range/${multiplier}/${timespan}/${from}/${to}` +
        `?adjusted=${adjusted}&sort=${sort}&limit=${limit}`;

      try {
        // Use cache with smart TTL (historical data cached longer)
        const cacheKey = `bars:${symbol}:${timespan}:${multiplier}:${from}:${to}:${limit}`;
        const data = (await cachedFetch(
          cacheKey,
          () => massiveFetch(path),
          getCachedBars,
          setCachedBars
        )) as any;

        // Normalize response shape
        const results = Array.isArray(data?.results) ? data.results : [];
        normalized = results.map((bar: any) => ({
          timestamp: bar.t || 0, // Massive returns milliseconds (Unix epoch)
          open: Number(bar.o) || 0,
          high: Number(bar.h) || 0,
          low: Number(bar.l) || 0,
          close: Number(bar.c) || 0,
          volume: Number(bar.v) || 0,
          vwap: bar.vw ? Number(bar.vw) : undefined,
          trades: bar.n ? Number(bar.n) : undefined,
        }));

        // **STEP 3**: Store in database for future use (async, don't await)
        if (results.length > 0) {
          storeHistoricalBars(symbol, timeframe, results).catch((err) =>
            console.warn("[API] Failed to store bars in database:", err)
          );
        }
      } catch (massiveError: any) {
        // **FALLBACK**: For stocks (non-indices), try Tradier if Massive fails
        const errorMsg = String(massiveError?.message || massiveError || "").toLowerCase();
        const isForbidden = errorMsg.includes("403") || errorMsg.includes("forbidden");

        if (!isIndexSymbol && process.env.TRADIER_ACCESS_TOKEN) {
          console.log(
            `[API] Massive failed for ${symbol} (${isForbidden ? "403 Forbidden" : "error"}), trying Tradier fallback...`
          );

          try {
            // Map timespan to Tradier intervals
            const intervalMap: Record<string, string> = {
              minute: "1min",
              "5minute": "5min",
              "15minute": "15min",
              hour: "daily",
              day: "daily",
            };
            const tradierInterval =
              intervalMap[`${multiplier}${timespan}`] || intervalMap[timespan] || "5min";

            const tradierBars = await tradierGetHistory(symbol, tradierInterval as any, from, to);
            console.log(
              `[API] ✅ Tradier fallback succeeded: ${tradierBars.length} bars for ${symbol}`
            );

            // Normalize Tradier response to match our format
            normalized = tradierBars.map((bar: any) => ({
              timestamp: bar.time * 1000, // Tradier returns seconds, convert to milliseconds
              open: Number(bar.open) || 0,
              high: Number(bar.high) || 0,
              low: Number(bar.low) || 0,
              close: Number(bar.close) || 0,
              volume: Number(bar.volume) || 0,
              vwap: undefined,
              trades: undefined,
            }));

            source = "tradier-fallback";

            // Store Tradier data in database too
            if (tradierBars.length > 0) {
              const tradierResults = tradierBars.map((bar: any) => ({
                t: bar.time * 1000,
                o: bar.open,
                h: bar.high,
                l: bar.low,
                c: bar.close,
                v: bar.volume,
              }));
              storeHistoricalBars(symbol, timeframe, tradierResults).catch((err) =>
                console.warn("[API] Failed to store Tradier bars in database:", err)
              );
            }
          } catch (tradierError) {
            console.error(`[API] ❌ Tradier fallback also failed for ${symbol}:`, tradierError);
            throw massiveError; // Re-throw original Massive error
          }
        } else {
          // No fallback available or symbol is an index
          throw massiveError;
        }
      }
    }

    res.json({
      symbol,
      timespan,
      multiplier: Number(multiplier),
      from,
      to,
      adjusted: adjusted === "true",
      count: normalized.length,
      bars: normalized,
      _source: source, // Debug info: 'database' or 'api'
    });
  } catch (error) {
    handleMassiveError(res, error);
  }
});

// Unified quotes endpoint (stocks + indices) -> normalized shape for UI
// GET /api/quotes?tickers=SPY,SPX,NDX
router.get("/quotes", requireProxyToken, async (req, res) => {
  try {
    const tickersParam = String(req.query.tickers || "");
    if (!tickersParam) return res.status(400).json({ error: "tickers required" });
    const symbols = tickersParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Partition into index-like and stock-like
    const isIndexLike = (s: string) =>
      s.startsWith("I:") || ["SPX", "NDX", "VIX", "RUT"].includes(s);
    const indexSymbols = symbols.filter(isIndexLike).map((s) => s.replace(/^I:/, ""));
    const stockSymbols = symbols.filter((s) => !isIndexLike(s));

    const results: Array<{
      symbol: string;
      last: number;
      change: number;
      changePercent: number;
      asOf: number;
      source: string;
    }> = [];

    // Fetch indices snapshot (with caching)
    if (indexSymbols.length) {
      const cacheKey = `indices:${indexSymbols.sort().join(",")}`;
      const idxSnap = await cachedFetch(
        cacheKey,
        () => getIndicesSnapshot(indexSymbols),
        getCachedIndex,
        setCachedIndex
      );
      const items: any[] = Array.isArray(idxSnap?.results) ? idxSnap.results : [];
      for (const it of items) {
        const symbol = it.ticker || it.symbol || "";
        // Try multiple field names for the current price (indices API returns value, stocks use different fields)
        const last = Number(it.value ?? it.last ?? it.price ?? it.close ?? 0);

        // Calculate change from previous close (especially important for weekends/after-hours)
        const prevClose = Number(it.prevDay?.c ?? it.previous_close ?? 0);
        let change = Number(it.session?.change || 0);
        let changePercent = Number(it.session?.change_percent || 0);

        // If session data is missing/zero but we have prevClose, calculate manually
        if ((change === 0 || changePercent === 0) && prevClose > 0 && last > 0) {
          change = last - prevClose;
          changePercent = (change / prevClose) * 100;
        }

        results.push({
          symbol: symbol,
          last,
          change,
          changePercent,
          asOf: Date.now(),
          source: "indices",
        });
      }
    }

    // Fetch stocks via Tradier batch quotes (single API call for all stocks)
    if (stockSymbols.length) {
      try {
        console.log(`[v0] /api/quotes: Fetching ${stockSymbols.length} stock(s) from Tradier: ${stockSymbols.join(",")}`);
        const tradierQuotes = await tradierGetBatchQuotes(stockSymbols);

        for (const quote of tradierQuotes) {
          results.push({
            symbol: quote.symbol,
            last: quote.last,
            change: quote.change,
            changePercent: quote.changePercent,
            asOf: quote.asOf,
            source: "tradier",
          });
        }
      } catch (err) {
        console.error(`[v0] /api/quotes: Tradier batch fetch error`, err);

        // Add error results for all stock symbols
        for (const s of stockSymbols) {
          results.push({
            symbol: s,
            last: 0,
            change: 0,
            changePercent: 0,
            asOf: Date.now(),
            source: "error",
          });
        }
      }
    }

    // Ensure every requested symbol returns something (even zeros)
    const map = new Map(results.map((r) => [r.symbol.replace(/^I:/, ""), r]));
    const final = symbols.map((s) => {
      const key = s.replace(/^I:/, "");
      return (
        map.get(key) || {
          symbol: s,
          last: 0,
          change: 0,
          changePercent: 0,
          asOf: Date.now(),
          source: "none",
        }
      );
    });

    res.json({ results: final });
  } catch (e) {
    handleMassiveError(res, e);
  }
});

router.all("/massive/*", requireProxyToken, async (req, res) => {
  const subPath = ((req.params as any)[0] as string) || "";
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const fullPath = `/${subPath}${qs}`;
  const body = ["POST", "PUT", "PATCH"].includes(req.method) ? req.body : undefined;

  try {
    // Test-mode short-circuit for Massive endpoints
    if (process.env.TEST_FAKE_DATA === "true") {
      // Minimal fake data for options snapshots and contracts to support E2E
      const url = new URL(`http://localhost${fullPath}`);
      const pathname = url.pathname;
      const params = url.searchParams;

      // Helper: build a synthetic options contracts list across a date range
      const buildContracts = (
        underlying: string,
        spot: number,
        range?: { gte?: string | null; lte?: string | null }
      ) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = (() => {
          const s = range?.gte ? new Date(range.gte) : new Date(today);
          s.setHours(0, 0, 0, 0);
          return isNaN(s.getTime()) ? new Date(today) : s;
        })();
        const end = (() => {
          if (range?.lte) {
            const e = new Date(range.lte);
            e.setHours(0, 0, 0, 0);
            if (!isNaN(e.getTime())) return e;
          }
          const e = new Date(today);
          e.setFullYear(e.getFullYear() + 3); // up to ~3 years out for dev
          e.setHours(0, 0, 0, 0);
          return e;
        })();

        const exps: Date[] = [];

        // Weekly expirations from start for 26 weeks
        for (let w = 1; w <= 26; w++) {
          const exp = new Date(start);
          exp.setDate(exp.getDate() + 7 * w);
          if (exp <= end) exps.push(exp);
        }

        // Monthly expirations (third Friday) from start month through end month (cap at 48 months)
        const startMonth = new Date(start);
        startMonth.setDate(1);
        const endMonth = new Date(end);
        endMonth.setDate(1);
        const totalMonths = Math.min(
          48,
          (endMonth.getFullYear() - startMonth.getFullYear()) * 12 +
            (endMonth.getMonth() - startMonth.getMonth())
        );
        for (let m = 0; m <= totalMonths; m++) {
          const exp = new Date(startMonth);
          exp.setMonth(startMonth.getMonth() + m);
          exp.setDate(1);
          const firstDay = exp.getDay();
          const firstFriday = firstDay <= 5 ? 6 - firstDay : 13 - firstDay;
          exp.setDate(firstFriday + 14); // Third Friday
          if (exp >= start && exp <= end) exps.push(exp);
        }

        const strikes: number[] = [];
        const step = underlying === "SPX" || underlying === "I:SPX" ? 5 : 2;
        for (let s = Math.floor(spot) - 20; s <= Math.ceil(spot) + 20; s += step) strikes.push(s);

        const results: any[] = [];
        for (const exp of exps) {
          const expStr = exp.toISOString().slice(0, 10);
          for (const strike of strikes) {
            // Calls and puts
            ["call", "put"].forEach((ct) => {
              results.push({
                ticker: `${underlying}-${strike}-${expStr}-${ct[0].toUpperCase()}`,
                underlying_ticker: underlying,
                expiration_date: expStr,
                contract_type: ct,
                strike_price: strike,
              });
            });
          }
        }
        return { results };
      };

      // /v3/snapshot/options/:underlying
      if (/^\/v3\/snapshot\/options\//.test(pathname)) {
        const underlying = decodeURIComponent(pathname.split("/").pop() || "QQQ").replace(
          /^I:/,
          ""
        );
        const price =
          underlying.toUpperCase() === "SPX"
            ? 5000
            : underlying.toUpperCase() === "QQQ"
              ? 400
              : 300;
        const limit = Number(params.get("limit") || "1");
        const base = {
          results: [
            {
              underlying_asset: { price },
              last_quote: { bp: price - 0.5, ap: price + 0.5 },
              last_trade: { p: price },
              greeks: { delta: 0.5, gamma: 0.01, theta: -0.02, vega: 0.1 },
              implied_volatility: 0.25,
              open_interest: 1000,
            },
          ],
        } as any;
        if (limit > 1) {
          // Return a few fabricated option snapshots referencing synthetic tickers
          const today = new Date();
          const expParam = params.get("expiration_date");
          const exp = expParam ? new Date(String(expParam)) : new Date(today);
          if (!expParam) exp.setDate(exp.getDate() + 5);
          const expStr = exp.toISOString().slice(0, 10);
          const snaps: any[] = [];
          for (let k = -4; k <= 4; k++) {
            const strike = Math.round(price + k * 2);
            ["C", "P"].forEach((side) => {
              snaps.push({
                ticker: `${underlying}-${strike}-${expStr}-${side}`,
                last_quote: { bp: 1 + Math.max(0, -k) * 0.1, ap: 1.2 + Math.max(0, k) * 0.1 },
                last_trade: { p: 1.1 },
                greeks: { delta: side === "C" ? 0.4 : -0.4, gamma: 0.01, theta: -0.02, vega: 0.1 },
                implied_volatility: 0.25,
                open_interest: 500 + (5 - Math.abs(k)) * 10,
                details: {
                  expiration_date: expStr,
                  strike_price: strike,
                  contract_type: side === "C" ? "call" : "put",
                },
              });
            });
          }
          return res.json({ results: snaps });
        }
        return res.json(base);
      }

      // /v3/reference/options/contracts?underlying_ticker=...
      if (pathname === "/v3/reference/options/contracts") {
        const underlying = String(
          params.get("underlying_ticker") || params.get("underlying") || "QQQ"
        ).toUpperCase();
        const spot = underlying === "SPX" ? 5000 : underlying === "QQQ" ? 400 : 300;
        const gte = params.get("expiration_date.gte") || "";
        const lte = params.get("expiration_date.lte") || "";
        return res.json(buildContracts(underlying, spot, { gte, lte }));
      }
    }

    // Short-circuit noisy v2 aggs failures for a brief window
    if (req.method === "GET" && isV2AggsPath(fullPath) && shouldShortCircuit(fullPath)) {
      console.log(`[v0] fallback(short-circuit) ${fullPath}`);
      res.setHeader("x-v0-fallback", "aggs-empty-cache");
      return res.status(200).json(buildEmptyAggsResponse());
    }

    const massiveResponse = await callMassive<{ error?: string; [key: string]: any }>(fullPath, {
      method: req.method as any,
      body,
    });

    if (!massiveResponse.ok) {
      // If this is a v2 aggs path, serve graceful empty payload and remember failure
      if (req.method === "GET" && isV2AggsPath(fullPath)) {
        rememberFailure(fullPath);
        console.warn(`[v0] fallback(aggs-empty) ${fullPath} -> Massive ${massiveResponse.status}`);
        res.setHeader("x-v0-fallback", "aggs-empty");
        return res.status(200).json(buildEmptyAggsResponse());
      }

      throw new Error(
        `Massive ${massiveResponse.status}: ${massiveResponse.error ?? "Massive request failed"}`
      );
    }

    res.json(massiveResponse.data);
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    const lower = msg.toLowerCase();

    // On network/5xx errors for v2 aggs, provide graceful empty response
    if (req.method === "GET" && isV2AggsPath(fullPath) && !lower.includes("403")) {
      rememberFailure(fullPath);
      console.warn(`[v0] fallback(aggs-empty-catch) ${fullPath} -> ${msg}`);
      res.setHeader("x-v0-fallback", "aggs-empty-catch");
      return res.status(200).json(buildEmptyAggsResponse());
    }

    const status = lower.includes("403") || lower.includes("forbidden") ? 403 : 502;
    res.status(status).json({
      error: status === 403 ? "Massive 403: Forbidden" : "Massive request failed",
      message: msg,
    });
  }
});

// ===== Backfill Trigger Endpoint =====
/**
 * POST /api/backfill/trigger
 * Triggers historical data backfill for a specific symbol
 * Called automatically when watchlist items are added
 */
router.post("/backfill/trigger", async (req: Request, res: Response) => {
  try {
    const { symbol, days = 90 } = req.body;

    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const cleanSymbol = symbol.toUpperCase().trim();

    console.log(`[Backfill] Trigger requested for ${cleanSymbol} (${days} days)`);

    // Import and run backfill dynamically
    const { spawn } = await import("child_process");

    const backfillProcess = spawn(
      "pnpm",
      ["backfill:s3", "--", `--symbol=${cleanSymbol}`, `--days=${days}`],
      {
        cwd: process.cwd(),
        env: process.env,
        detached: true, // Run in background
        stdio: "ignore", // Don't pipe output
      }
    );

    // Don't wait for process to finish
    backfillProcess.unref();

    res.json({
      success: true,
      symbol: cleanSymbol,
      days,
      message: `Backfill started for ${cleanSymbol}`,
      eta_seconds: 10, // Estimated time
    });
  } catch (error: any) {
    console.error("[Backfill] Trigger failed:", error);
    res.status(500).json({ error: "Failed to trigger backfill" });
  }
});

/**
 * GET /api/backfill/status
 * Check status of historical data for symbols
 */
router.get("/backfill/status", async (req: Request, res: Response) => {
  try {
    const symbols = String(req.query.symbols || "")
      .split(",")
      .filter(Boolean);

    if (symbols.length === 0) {
      return res.status(400).json({ error: "Symbols parameter required" });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const status: Record<string, any> = {};

    for (const symbol of symbols) {
      const cleanSymbol = symbol.toUpperCase().trim();

      // Check if we have data for this symbol
      const { data, error } = await supabase
        .from("historical_bars")
        .select("timestamp, timeframe")
        .eq("symbol", cleanSymbol)
        .eq("timeframe", "1m")
        .order("timestamp", { ascending: false })
        .limit(1);

      if (error) {
        status[cleanSymbol] = { hasData: false, error: error.message };
      } else if (data && data.length > 0) {
        const lastTimestamp = (data[0] as { timestamp: number; timeframe: string }).timestamp;
        const lastDate = new Date(lastTimestamp);
        const ageHours = (Date.now() - lastTimestamp) / (1000 * 60 * 60);

        status[cleanSymbol] = {
          hasData: true,
          lastUpdate: lastDate.toISOString(),
          ageHours: Math.round(ageHours),
          needsRefresh: ageHours > 168, // 7 days
        };
      } else {
        status[cleanSymbol] = { hasData: false };
      }
    }

    res.json({ status });
  } catch (error: any) {
    console.error("[Backfill] Status check failed:", error);
    res.status(500).json({ error: "Failed to check status" });
  }
});

// -----------------------------------------------------------------------------
// Discord alert preferences (admin control)
// -----------------------------------------------------------------------------
router.get("/discord/alert-preferences", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const userId = String((req.query.userId as string) || req.headers["x-user-id"] || "");

    const { data, error } = await supabase
      .from("discord_alert_preferences")
      .select("alert_type, enabled, webhook_urls")
      .or(`user_id.eq.${userId},user_id.is.null`);

    if (error) {
      console.warn("[DiscordPrefs API] Using defaults because query failed:", error.message);
      return res.json({
        preferences: [
          { alert_type: "setup", enabled: true, webhook_urls: null },
          { alert_type: "ready", enabled: true, webhook_urls: null },
          { alert_type: "signal", enabled: true, webhook_urls: null },
          { alert_type: "error", enabled: true, webhook_urls: null },
          { alert_type: "heartbeat", enabled: true, webhook_urls: null },
        ],
      });
    }

    return res.json({ preferences: data || [] });
  } catch (err: any) {
    console.warn("[DiscordPrefs API] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load preferences" });
  }
});

router.post("/discord/alert-preferences", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const userIdHeader = req.headers["x-user-id"] as string | undefined;
    const { alert_type, enabled, webhook_urls, user_id: bodyUserId } = req.body || {};
    const userId = bodyUserId || userIdHeader || null;

    if (!alert_type) {
      return res.status(400).json({ error: "alert_type is required" });
    }

    const payload: Record<string, any> = {
      alert_type,
      enabled: enabled !== undefined ? !!enabled : true,
      webhook_urls: Array.isArray(webhook_urls) ? webhook_urls : null,
    };
    if (userId) payload.user_id = userId;

    const { error } = await supabase
      .from("discord_alert_preferences")
      .upsert(payload as any, { onConflict: "user_id,alert_type" });

    if (error) {
      console.warn("[DiscordPrefs API] upsert failed:", error.message);
      return res.status(500).json({ error: "Failed to save preferences" });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.warn("[DiscordPrefs API] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to save preferences" });
  }
});

// ===== Strategy Scanner Routes =====
// NOTE: Scanner runs client-side via hooks, server endpoint moved to future iteration
// import strategiesRouter from './strategies';
// router.use('/strategies', strategiesRouter);

export default router;
