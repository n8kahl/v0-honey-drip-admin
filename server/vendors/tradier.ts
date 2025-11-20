import { calculateDTE } from '../lib/marketCalendar';

function getTradierBaseUrl() {
  // Allow sandbox or prod via env
  // Sandbox: https://sandbox.tradier.com/v1
  // Prod:    https://api.tradier.com/v1
  return process.env.TRADIER_BASE_URL || 'https://api.tradier.com/v1';
}

function getTradierToken() {
  return process.env.TRADIER_ACCESS_TOKEN || '';
}

async function tradierFetch<T = any>(path: string): Promise<{ ok: boolean; status: number; data?: T; error?: string }>{
  const url = `${getTradierBaseUrl()}${path}`;
  const token = getTradierToken();
  if (!token) {
    console.error('[Tradier] ❌ TRADIER_ACCESS_TOKEN is not set');
    return { ok: false, status: 500, error: 'TRADIER_ACCESS_TOKEN missing' };
  }
  console.log(`[Tradier] 🔐 Token present: ${token.substring(0, 8)}...${token.substring(token.length - 4)} (length: ${token.length})`);
  console.log(`[Tradier] 📍 Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
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
  const s = symbol.replace(/^I:/, '');
  const { ok, data, error } = await tradierFetch<any>(`/markets/quotes?symbols=${encodeURIComponent(s)}`);
  if (!ok) throw new Error(error || 'Tradier quotes failed');
  const q = data?.quotes?.quote;
  if (Array.isArray(q) && q.length > 0) {
    const price = q[0]?.last || q[0]?.close || q[0]?.bid || 0;
    return typeof price === 'number' ? price : 0;
  }
  if (q && typeof q === 'object') {
    const price = q.last || q.close || q.bid || 0;
    return typeof price === 'number' ? price : 0;
  }
  return 0;
}

export async function tradierGetExpirations(symbol: string, gteISO: string, lteISO?: string): Promise<string[]> {
  const s = symbol.replace(/^I:/, '');
  const { ok, data, error } = await tradierFetch<any>(`/markets/options/expirations?symbol=${encodeURIComponent(s)}&includeAllRoots=true&strikes=false`);
  if (!ok) throw new Error(error || 'Tradier expirations failed');
  const dates = data?.expirations?.date;
  const arr: string[] = Array.isArray(dates) ? dates : (dates ? [dates] : []);
  return arr
    .filter((d) => d >= gteISO && (lteISO ? d <= lteISO : true))
    .sort();
}

export type TradierNorm = {
  id: string;
  ticker: string;
  type: 'C' | 'P';
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

export async function tradierGetNormalizedForExpiration(symbol: string, expirationISO: string, today: Date): Promise<TradierNorm[]> {
  const s = symbol.replace(/^I:/, '');
  const { ok, data, error } = await tradierFetch<any>(`/markets/options/chains?symbol=${encodeURIComponent(s)}&expiration=${encodeURIComponent(expirationISO)}&greeks=true`);
  if (!ok) throw new Error(error || 'Tradier chains failed');
  const options = data?.options?.option;
  const list: any[] = Array.isArray(options) ? options : (options ? [options] : []);
  const norm: TradierNorm[] = [];
  for (const c of list) {
    const id = c?.symbol || c?.option_symbol || '';
    const strike = Number(c?.strike) || 0;
    const typeRaw = (c?.option_type || c?.type || '').toString().toUpperCase();
    const side: 'C' | 'P' = typeRaw.startsWith('C') ? 'C' : 'P';
    const exp = c?.expiration_date || expirationISO;
    const dte = calculateDTE(new Date(exp), today);
    const bid = typeof c?.bid === 'number' ? c.bid : undefined;
    const ask = typeof c?.ask === 'number' ? c.ask : undefined;
    const last = typeof c?.last === 'number' ? c.last : undefined;
    const oi = typeof c?.open_interest === 'number' ? c.open_interest : undefined;
    const g = c?.greeks || {};
    const iv = typeof g?.mid_iv === 'number' ? g.mid_iv : (typeof g?.iv === 'number' ? g.iv : undefined);
    const delta = typeof g?.delta === 'number' ? g.delta : undefined;
    const gamma = typeof g?.gamma === 'number' ? g.gamma : undefined;
    const theta = typeof g?.theta === 'number' ? g.theta : undefined;
    const vega = typeof g?.vega === 'number' ? g.vega : undefined;

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
  interval: 'daily' | 'weekly' | 'monthly' | '1min' | '5min' | '15min',
  startDate?: string,
  endDate?: string
): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]> {
  const s = symbol.replace(/^I:/, '');

  // For intraday bars, use timesales endpoint
  const isIntraday = ['1min', '5min', '15min'].includes(interval);

  let path: string;
  if (isIntraday) {
    // Intraday timesales: /markets/timesales?symbol=SPY&interval=5min&start=2024-01-01&end=2024-01-31
    const params = new URLSearchParams({
      symbol: s,
      interval: interval,
    });
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    path = `/markets/timesales?${params}`;
  } else {
    // Daily/weekly/monthly history: /markets/history?symbol=SPY&interval=daily&start=2024-01-01&end=2024-01-31
    const params = new URLSearchParams({
      symbol: s,
      interval: interval,
    });
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    path = `/markets/history?${params}`;
  }

  const { ok, data, error } = await tradierFetch<any>(path);
  if (!ok) throw new Error(error || 'Tradier history failed');

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
  return bars.map((bar: any) => {
    // Intraday uses 'timestamp' (epoch ms), daily uses 'date' (YYYY-MM-DD)
    let time: number;
    if (bar.timestamp) {
      time = Math.floor(bar.timestamp / 1000); // Convert ms to seconds
    } else if (bar.time) {
      time = Math.floor(new Date(bar.time).getTime() / 1000);
    } else if (bar.date) {
      time = Math.floor(new Date(bar.date).getTime() / 1000);
    } else {
      time = 0;
    }

    return {
      time,
      open: Number(bar.open) || 0,
      high: Number(bar.high) || 0,
      low: Number(bar.low) || 0,
      close: Number(bar.close) || 0,
      volume: Number(bar.volume) || 0,
    };
  }).filter(bar => bar.time > 0);
}
