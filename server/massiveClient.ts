import fetch, { Headers, type RequestInit } from 'node-fetch';

const MASSIVE_BASE_URL = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const API_KEY = process.env.MASSIVE_API_KEY;

function buildHeaders() {
  if (!API_KEY) throw new Error('MASSIVE_API_KEY is not set');
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${API_KEY}`);
  headers.set('X-API-Key', API_KEY);
  headers.set('User-Agent', 'Honeydrip-Admin/1.0');
  headers.set('Content-Type', 'application/json');
  return headers;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function callMassive(path: string, init: RequestInit = {}, tries = 3): Promise<Response> {
  if (!API_KEY) throw new Error('MASSIVE_API_KEY is not configured');
  const url = path.startsWith('http') ? path : `${MASSIVE_BASE_URL}${path}`;
  const headers = buildHeaders();
  if (init.headers) {
    for (const [key, value] of Object.entries(init.headers as Record<string, unknown>)) {
      headers.set(key, String(value));
    }
  }

  let lastError: any;
  for (let attempt = 0; attempt < tries; attempt++) {
    const { signal, done } = withTimeout(10_000);
    try {
      const response = await fetch(url, { ...init, headers, signal });
      done();

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After') || '1');
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (response.status >= 500 && response.status < 600) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(500 * (attempt + 1), 2000)));
        continue;
      }

      return response;
    } catch (error) {
      done();
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(500 * (attempt + 1), 2000)));
    }
  }

  throw lastError || new Error('callMassive: failed to reach Massive');
}

export async function getIndexAggregates(
  ticker: string,
  mult: number,
  timespan: 'minute' | 'hour' | 'day',
  from: string,
  to: string
) {
  const path = `/v2/aggs/ticker/${encodeURIComponent(
    ticker
  )}/range/${mult}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000`;
  const res = await callMassive(path);
  if (!res.ok) {
    throw new Error(`Massive error ${res.status}`);
  }
  return res.json();
}

export async function getOptionChain(underlying: string, limit = 250) {
  const capped = Math.min(limit, 250);
  const path = `/v3/snapshot/options/${encodeURIComponent(underlying)}?limit=${capped}`;
  const res = await callMassive(path);
  if (!res.ok) {
    throw new Error(`Massive error ${res.status}`);
  }
  return res.json();
}

export async function listOptionContracts(filters: Record<string, string>) {
  const qs = new URLSearchParams(filters).toString();
  const res = await callMassive(`/v3/reference/options/contracts?${qs}`);
  if (!res.ok) {
    throw new Error(`Massive error ${res.status}`);
  }
  return res.json();
}

export async function getIndicesSnapshot(tickers: string[]) {
  const clean = tickers.map((t) => t.replace(/^I:/, '')).join(',');
  const res = await callMassive(`/v3/snapshot/indices?tickers=${encodeURIComponent(clean)}`);
  if (!res.ok) {
    throw new Error(`Massive error ${res.status}`);
  }
  return res.json();
}
