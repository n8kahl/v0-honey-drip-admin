const MASSIVE_BASE_URL = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const API_KEY = process.env.MASSIVE_API_KEY;

export interface CallMassiveResult<T> {
  ok: boolean;
  status: number;
  error?: string;
  data: T;
}

function buildHeaders(): Record<string, string> {
  if (!API_KEY) throw new Error('MASSIVE_API_KEY is not configured');
  return {
    Authorization: `Bearer ${API_KEY}`,
    'X-API-Key': API_KEY,
    'User-Agent': 'Honeydrip-Admin/1.0',
    'Content-Type': 'application/json',
  };
}

function flattenHeaders(source?: RequestInit['headers']): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!source) return headers;

  if (Array.isArray(source)) {
    for (const [key, value] of source) {
      headers[key] = String(value);
    }
    return headers;
  }

  if (typeof source === 'object') {
    const withForEach = source as { forEach?: (cb: (value: string, key: string) => void) => void };
    if (withForEach.forEach) {
      withForEach.forEach((value, key) => {
        headers[key] = String(value);
      });
      return headers;
    }

    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        headers[key] = String(value);
      }
    }
  }

  return headers;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

function parseJson<T>(input: string): T {
  if (!input) return {} as T;
  try {
    return JSON.parse(input) as T;
  } catch {
    return input as unknown as T;
  }
}

export async function callMassive<T>(
  path: string,
  init: RequestInit = {},
  tries = 3
): Promise<CallMassiveResult<T>> {
  if (!API_KEY) throw new Error('MASSIVE_API_KEY is not configured');
  const url = path.startsWith('http') ? path : `${MASSIVE_BASE_URL}${path}`;
  const { headers: initHeaders, ...restInit } = init;
  const headers = { ...buildHeaders(), ...flattenHeaders(initHeaders) };

  let lastError: any;
  let lastResponse: CallMassiveResult<T> | null = null;

  for (let attempt = 0; attempt < tries; attempt++) {
    const { signal, done } = withTimeout(10_000);
    try {
      const response = await fetch(url, {
        ...restInit,
        headers,
        signal,
      });
      done();

      const text = await response.text();
      const payload = parseJson<T>(text);
      const error =
        typeof payload === 'object' && payload && 'error' in payload
          ? ((payload as any).error as string | undefined)
          : undefined;
      const result: CallMassiveResult<T> = {
        ok: response.ok,
        status: response.status,
        error,
        data: payload,
      };

      lastResponse = result;

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After') || '1');
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (response.status >= 500 && response.status < 600) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(500 * (attempt + 1), 2000)));
        continue;
      }

      return result;
    } catch (error) {
      done();
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(500 * (attempt + 1), 2000)));
    }
  }

  if (lastResponse && !lastResponse.ok) {
    throw new Error(`Massive ${lastResponse.status}: ${lastResponse.error ?? 'request failed'}`);
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
  const res = await callMassive<{ results?: any[]; [key: string]: any }>(path);
  if (!res.ok) {
    throw new Error(`Massive error ${res.status}: ${res.error ?? 'failed to fetch aggregates'}`);
  }
  const payload = res.data;
  const results = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];
  return results.map((bar) => ({
    t: bar.t,
    o: bar.o,
    h: bar.h,
    l: bar.l,
    c: bar.c,
    v: bar.v,
    vw: bar.vw,
  }));
}

export async function getOptionChain(underlying: string, limit?: number) {
  const normalizedLimit =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : 250;
  const path = `/v3/snapshot/options/${encodeURIComponent(underlying)}?limit=${normalizedLimit}`;
  const res = await callMassive<any>(path);
  if (!res.ok) {
    throw new Error(`Massive error ${res.status}: ${res.error ?? 'failed to fetch option chain'}`);
  }
  return res.data;
}

export async function listOptionContracts(filters: Record<string, string>) {
  const qs = new URLSearchParams(filters).toString();
  const res = await callMassive<any>(`/v3/reference/options/contracts?${qs}`);
  if (!res.ok) {
    throw new Error(`Massive error ${res.status}: ${res.error ?? 'failed to list contracts'}`);
  }
  return res.data;
}

export async function getIndicesSnapshot(tickers: string[]) {
  const clean = tickers.map((t) => t.replace(/^I:/, '')).join(',');
  const res = await callMassive<any>(`/v3/snapshot/indices?tickers=${encodeURIComponent(clean)}`);
  if (!res.ok) {
    throw new Error(`Massive error ${res.status}: ${res.error ?? 'failed to fetch indices snapshot'}`);
  }
  return res.data;
}
