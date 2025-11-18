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
    return { ok: false, status: 500, error: 'TRADIER_ACCESS_TOKEN missing' };
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: text || `Tradier ${res.status}` };
  }
  const json = await res.json();
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
