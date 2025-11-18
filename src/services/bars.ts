export type Bar = {
  timestamp: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
};

export type BarsResponse = {
  symbol: string;
  timespan: string;
  multiplier: number;
  from: string;
  to: string;
  adjusted: boolean;
  count: number;
  bars: Bar[];
};

const PROXY_TOKEN = (import.meta as any).env?.VITE_MASSIVE_PROXY_TOKEN as string | undefined;

export async function fetchBars(
  symbol: string,
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month',
  multiplier: number,
  from: string, // YYYY-MM-DD
  to: string, // YYYY-MM-DD
  limit = 500
): Promise<BarsResponse> {
  const qs = new URLSearchParams({
    symbol,
    timespan,
    multiplier: String(multiplier),
    from,
    to,
    limit: String(limit),
    adjusted: 'true',
    sort: 'asc',
  }).toString();

  const headers: Record<string, string> = {};
  if (PROXY_TOKEN) headers['x-massive-proxy-token'] = PROXY_TOKEN;

  const resp = await fetch(`/api/bars?${qs}`, { headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`[v0] /api/bars failed ${resp.status}: ${text}`);
  }

  return (await resp.json()) as BarsResponse;
}
