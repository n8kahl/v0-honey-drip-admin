import fetch, { Response } from 'node-fetch';
import { URL } from 'url';

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || '';
const MASSIVE_BASE_URL = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const USER_AGENT = 'HD-Options-Admin/1.0 (+railway)';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
interface MassiveRequestOptions {
  method?: Method;
  body?: any;
  timeoutMs?: number;
  retries?: number;
}

function buildUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl.replace(/^\/+/, ''), `${MASSIVE_BASE_URL}/`).href;
}

function buildHeaders(): Record<string, string> {
  if (!MASSIVE_API_KEY) throw new Error('MASSIVE_API_KEY not configured');
  return {
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/json',
    Authorization: `Bearer ${MASSIVE_API_KEY}`,
    'X-API-Key': MASSIVE_API_KEY,
  };
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function callMassive(pathOrUrl: string, opts: MassiveRequestOptions = {}) {
  const {
    method = 'GET',
    body,
    timeoutMs = 15_000,
    retries = 2,
  } = opts;

  const url = buildUrl(pathOrUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const attempt = async (n: number): Promise<any> => {
    try {
      const res = await fetch(url, {
        method,
        headers: buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if ((res.status === 429 || res.status >= 500) && n < retries) {
        const retryAfter = Number(res.headers.get('retry-after') || 0);
        const backoff = retryAfter > 0 ? retryAfter * 1000 : 250 * (2 ** n) + Math.random() * 150;
        await new Promise((r) => setTimeout(r, backoff));
        return attempt(n + 1);
      }

      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const msg = data?.error || res.statusText;
        throw new Error(`Massive ${res.status}: ${msg}`);
      }
      return data;
    } catch (err) {
      if (n < retries) return attempt(n + 1);
      throw err;
    }
  };

  try {
    return await attempt(0);
  } finally {
    clearTimeout(timer);
  }
}

export async function getOptionChain(underlying: string, params?: Record<string, string | number>) {
  const qs = new URLSearchParams({ limit: '250', ...(params || {}) }).toString();
  return callMassive(`/v3/snapshot/options/${encodeURIComponent(underlying)}?${qs}`);
}

export async function listOptionContracts(filters: Record<string, string>) {
  const qs = new URLSearchParams(filters).toString();
  return callMassive(`/v3/reference/options/contracts?${qs}`);
}

export async function getIndicesSnapshot(tickers: string[]) {
  const clean = tickers.map((t) => t.replace(/^I:/, '')).join(',');
  return callMassive(`/v3/snapshot/indices?tickers=${encodeURIComponent(clean)}`);
}
