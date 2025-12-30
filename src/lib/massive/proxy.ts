import { massive } from "./index";

export class MassiveError extends Error {
  status: number;
  code?: "RATE_LIMIT";

  constructor(message: string, status: number, code?: "RATE_LIMIT") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function buildHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers ?? {});

  try {
    const tokenManager = massive.getTokenManager();
    const token = await tokenManager.getToken();
    headers.set("x-massive-proxy-token", token);
  } catch (error) {
    console.error("[v0] Failed to get ephemeral token:", error);
  }

  return headers;
}

export async function withMassiveProxyInit(init?: RequestInit): Promise<RequestInit> {
  return {
    ...init,
    headers: await buildHeaders(init),
  };
}

export async function massiveFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, await withMassiveProxyInit(init));

  if (!response.ok) {
    const text = await response.text();
    const method = (init?.method || "GET").toString().toUpperCase();
    const path =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? `${input.pathname}${input.search}`
          : String(input);
    console.error("[Massive proxy] HTTP error from /api/massive", {
      method,
      path,
      status: response.status,
      text,
    });

    const message = text || response.statusText || `HTTP ${response.status}`;
    const lowerMessage = message.toLowerCase();
    const isWrappedRateLimit =
      response.status === 502 &&
      (lowerMessage.includes("massive 429") || lowerMessage.includes("rate limit"));
    const isRateLimit =
      response.status === 429 ||
      lowerMessage.includes("massive 429") ||
      lowerMessage.includes("maximum requests per minute") ||
      isWrappedRateLimit;

    if (isRateLimit) {
      throw new MassiveError(message, 429, "RATE_LIMIT");
    }

    throw new MassiveError(message, response.status);
  }

  return response;
}

const API_BASE = "/api/massive";

async function fetchJSON(url: string) {
  const response = await fetch(url, await withMassiveProxyInit());
  if (!response.ok) {
    throw new Error(`Massive ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function encodeParams(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

// Removed legacy getStockBars(): app only uses indices + options endpoints.

export function getIndexBars(
  symbol: string,
  multiplier: number,
  timespan: string,
  from: string,
  to: string,
  limit = 250,
  adjusted = "true",
  sort = "asc"
) {
  const query = encodeParams({
    symbol,
    multiplier,
    timespan,
    from,
    to,
    limit,
    adjusted,
    sort,
  });
  return fetchJSON(`${API_BASE}/indices/bars?${query}`);
}

export function getOptionBars(
  ticker: string,
  multiplier: number,
  timespan: string,
  from: string,
  to: string,
  limit = 5000,
  adjusted = "true",
  sort = "asc"
) {
  const query = encodeParams({
    ticker,
    multiplier,
    timespan,
    from,
    to,
    limit,
    adjusted,
    sort,
  });
  return fetchJSON(`${API_BASE}/options/bars?${query}`);
}

// Tradier fallback removed - migrated to Massive-only architecture
