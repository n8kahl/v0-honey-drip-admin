import { massive } from "../lib/massive";

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

export async function fetchBars(
  symbol: string,
  timespan: "minute" | "hour" | "day" | "week" | "month",
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
    adjusted: "true",
    sort: "asc",
  }).toString();

  // Get fresh token from token manager
  const tokenManager = massive.getTokenManager();
  const token = await tokenManager.getToken();

  const headers: Record<string, string> = {};
  if (token) headers["x-massive-proxy-token"] = token;

  const resp = await fetch(`/api/bars?${qs}`, { headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`[v0] /api/bars failed ${resp.status}: ${text}`);
  }

  return (await resp.json()) as BarsResponse;
}
