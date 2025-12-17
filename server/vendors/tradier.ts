import { calculateDTE } from "../lib/marketCalendar.js";

function getTradierBaseUrl() {
  // Allow sandbox or prod via env
  // Sandbox: https://sandbox.tradier.com/v1
  // Prod:    https://api.tradier.com/v1
  return process.env.TRADIER_BASE_URL || "https://api.tradier.com/v1";
}

function getTradierToken() {
  return process.env.TRADIER_ACCESS_TOKEN || "";
}

async function tradierFetch<T = any>(
  path: string
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const url = `${getTradierBaseUrl()}${path}`;
  const token = getTradierToken();
  if (!token) {
    console.error("[Tradier] ❌ TRADIER_ACCESS_TOKEN is not set");
    return { ok: false, status: 500, error: "TRADIER_ACCESS_TOKEN missing" };
  }
  console.log(
    `[Tradier] 🔐 Token present: ${token.substring(0, 8)}...${token.substring(token.length - 4)} (length: ${token.length})`
  );
  console.log(`[Tradier] 📍 Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[Tradier] ❌ HTTP ${res.status} from ${path}`);
    console.error(`[Tradier] ❌ Response body:`, text || res.statusText);
    console.error(`[Tradier] ❌ Full URL that failed:`, url);
    return { ok: false, status: res.status, error: text || `Tradier ${res.status}` };
  }
  const json = await res.json();
  console.log(`[Tradier] ✅ Success from ${path}`);
  return { ok: true, status: 200, data: json as T };
}

export async function tradierGetUnderlyingPrice(symbol: string): Promise<number> {
  const s = symbol.replace(/^I:/, "");
  const { ok, data, error } = await tradierFetch<any>(
    `/markets/quotes?symbols=${encodeURIComponent(s)}`
  );
  if (!ok) throw new Error(error || "Tradier quotes failed");
  const q = data?.quotes?.quote;
  if (Array.isArray(q) && q.length > 0) {
    const price = q[0]?.last || q[0]?.close || q[0]?.bid || 0;
    return typeof price === "number" ? price : 0;
  }
  if (q && typeof q === "object") {
    const price = q.last || q.close || q.bid || 0;
    return typeof price === "number" ? price : 0;
  }
  return 0;
}

/**
 * Batch fetch stock quotes from Tradier
 * Returns normalized quote objects for multiple symbols in a single request
 */
export interface TradierQuote {
  symbol: string;
  last: number;
  change: number;
  changePercent: number;
  prevClose: number;
  asOf: number;
}

export async function tradierGetBatchQuotes(symbols: string[]): Promise<TradierQuote[]> {
  if (symbols.length === 0) return [];

  // Clean symbols (remove I: prefix if any)
  const cleanSymbols = symbols.map(s => s.replace(/^I:/, ""));
  const symbolsParam = cleanSymbols.join(",");

  const { ok, data, error } = await tradierFetch<any>(
    `/markets/quotes?symbols=${encodeURIComponent(symbolsParam)}`
  );

  if (!ok) {
    console.error("[Tradier] Batch quotes failed:", error);
    // Return empty quotes with error source
    return symbols.map(s => ({
      symbol: s,
      last: 0,
      change: 0,
      changePercent: 0,
      prevClose: 0,
      asOf: Date.now(),
    }));
  }

  // Tradier returns { quotes: { quote: [...] } } for multiple, or { quotes: { quote: {...} } } for single
  const rawQuotes = data?.quotes?.quote;
  const quoteArray: any[] = Array.isArray(rawQuotes) ? rawQuotes : rawQuotes ? [rawQuotes] : [];

  // Create a map for quick lookup
  const quoteMap = new Map<string, TradierQuote>();

  for (const q of quoteArray) {
    const symbol = q?.symbol || "";
    const last = Number(q?.last || q?.close || q?.bid || 0);
    const prevClose = Number(q?.prevclose || q?.previous_close || 0);
    const change = Number(q?.change || 0);

    // Calculate change percent - prefer Tradier's value, fallback to manual calc
    let changePercent = Number(q?.change_percentage || 0);
    if (changePercent === 0 && prevClose > 0 && last > 0) {
      changePercent = ((last - prevClose) / prevClose) * 100;
    }

    quoteMap.set(symbol.toUpperCase(), {
      symbol: symbol.toUpperCase(),
      last,
      change: change || (prevClose > 0 ? last - prevClose : 0),
      changePercent,
      prevClose,
      asOf: Date.now(),
    });
  }

  // Return in order of requested symbols, with fallback for missing
  return symbols.map(s => {
    const clean = s.replace(/^I:/, "").toUpperCase();
    return quoteMap.get(clean) || {
      symbol: s,
      last: 0,
      change: 0,
      changePercent: 0,
      prevClose: 0,
      asOf: Date.now(),
    };
  });
}

export async function tradierGetExpirations(
  symbol: string,
  gteISO: string,
  lteISO?: string
): Promise<string[]> {
  const s = symbol.replace(/^I:/, "");
  const { ok, data, error } = await tradierFetch<any>(
    `/markets/options/expirations?symbol=${encodeURIComponent(s)}&includeAllRoots=true&strikes=false`
  );
  if (!ok) throw new Error(error || "Tradier expirations failed");
  const dates = data?.expirations?.date;
  const arr: string[] = Array.isArray(dates) ? dates : dates ? [dates] : [];
  return arr.filter((d) => d >= gteISO && (lteISO ? d <= lteISO : true)).sort();
}

export type TradierNorm = {
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

export async function tradierGetNormalizedForExpiration(
  symbol: string,
  expirationISO: string,
  today: Date
): Promise<TradierNorm[]> {
  const s = symbol.replace(/^I:/, "");
  const { ok, data, error } = await tradierFetch<any>(
    `/markets/options/chains?symbol=${encodeURIComponent(s)}&expiration=${encodeURIComponent(expirationISO)}&greeks=true`
  );
  if (!ok) throw new Error(error || "Tradier chains failed");
  const options = data?.options?.option;
  const list: any[] = Array.isArray(options) ? options : options ? [options] : [];
  const norm: TradierNorm[] = [];
  for (const c of list) {
    const id = c?.symbol || c?.option_symbol || "";
    const strike = Number(c?.strike) || 0;
    const typeRaw = (c?.option_type || c?.type || "").toString().toUpperCase();
    const side: "C" | "P" = typeRaw.startsWith("C") ? "C" : "P";
    const exp = c?.expiration_date || expirationISO;
    const dte = calculateDTE(new Date(exp), today);
    const bid = typeof c?.bid === "number" ? c.bid : undefined;
    const ask = typeof c?.ask === "number" ? c.ask : undefined;
    const last = typeof c?.last === "number" ? c.last : undefined;
    const oi = typeof c?.open_interest === "number" ? c.open_interest : undefined;
    const g = c?.greeks || {};
    const iv =
      typeof g?.mid_iv === "number" ? g.mid_iv : typeof g?.iv === "number" ? g.iv : undefined;
    const delta = typeof g?.delta === "number" ? g.delta : undefined;
    const gamma = typeof g?.gamma === "number" ? g.gamma : undefined;
    const theta = typeof g?.theta === "number" ? g.theta : undefined;
    const vega = typeof g?.vega === "number" ? g.vega : undefined;

    if (!Number.isFinite(strike) || strike <= 0 || !id) continue;

    norm.push({
      id,
      ticker: id,
      type: side,
      strike,
      expiration: exp,
      dte,
      iv,
      delta,
      gamma,
      theta,
      vega,
      bid,
      ask,
      last,
      oi,
    });
  }
  return norm;
}

/**
 * Get historical OHLC bars from Tradier for a stock symbol
 * Interval: daily, weekly, monthly (minute intervals require different endpoint)
 * For intraday: use /markets/timeseries with interval=1min, 5min, 15min
 */
export async function tradierGetHistory(
  symbol: string,
  interval: "daily" | "weekly" | "monthly" | "1min" | "5min" | "15min",
  startDate?: string,
  endDate?: string
): Promise<
  { time: number; open: number; high: number; low: number; close: number; volume: number }[]
> {
  const s = symbol.replace(/^I:/, "");

  // For intraday bars, use timesales endpoint
  const isIntraday = ["1min", "5min", "15min"].includes(interval);

  let path: string;
  if (isIntraday) {
    // Intraday timesales: /markets/timesales?symbol=SPY&interval=5min&start=2024-01-01&end=2024-01-31
    const params = new URLSearchParams({
      symbol: s,
      interval: interval,
    });
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    path = `/markets/timesales?${params}`;
  } else {
    // Daily/weekly/monthly history: /markets/history?symbol=SPY&interval=daily&start=2024-01-01&end=2024-01-31
    const params = new URLSearchParams({
      symbol: s,
      interval: interval,
    });
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    path = `/markets/history?${params}`;
  }

  const { ok, data, error } = await tradierFetch<any>(path);
  if (!ok) throw new Error(error || "Tradier history failed");

  // Parse response - format varies between endpoints
  let bars: any[] = [];
  if (isIntraday) {
    // Timesales response: { series: { data: [ { time, timestamp, price, open, high, low, close, volume }, ... ] } }
    bars = data?.series?.data || [];
  } else {
    // History response: { history: { day: [ { date, open, high, low, close, volume }, ... ] } }
    bars = data?.history?.day || [];
  }

  if (!Array.isArray(bars)) bars = [];

  // Normalize to common format
  return bars
    .map((bar: any) => {
      // Intraday: Tradier timesales returns timestamp in seconds; daily uses date (YYYY-MM-DD)
      let epochSeconds = 0;

      if (bar.timestamp !== undefined) {
        const ts = Number(bar.timestamp);
        if (Number.isFinite(ts)) {
          // If already seconds (<= 1e12), use as-is; if ms (> 1e12), convert to seconds
          epochSeconds = ts > 1e12 ? Math.floor(ts / 1000) : ts;
        }
      } else if (bar.time !== undefined) {
        // bar.time can be "HH:MM" or an ISO string or a numeric epoch
        const tnum = Number(bar.time);
        if (Number.isFinite(tnum)) {
          epochSeconds = tnum > 1e12 ? Math.floor(tnum / 1000) : tnum;
        } else {
          const parsed = Date.parse(String(bar.time));
          if (!Number.isNaN(parsed)) epochSeconds = Math.floor(parsed / 1000);
        }
      } else if (bar.date) {
        const parsed = Date.parse(String(bar.date));
        if (!Number.isNaN(parsed)) epochSeconds = Math.floor(parsed / 1000);
      }

      return {
        time: epochSeconds,
        open: Number(bar.open) || 0,
        high: Number(bar.high) || 0,
        low: Number(bar.low) || 0,
        close: Number(bar.close) || 0,
        volume: Number(bar.volume) || 0,
      };
    })
    .filter((bar) => bar.time > 0);
}
