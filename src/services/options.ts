import { Contract } from "../types";

export type NormalizedChain = {
  symbol: string;
  price: number;
  asOf: string;
  expirations: Array<{
    date: string;
    dte: number;
    atmStrike: number;
    calls: Array<Norm>;
    puts: Array<Norm>;
  }>;
};

export type Norm = {
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

function toContract(n: Norm): Contract {
  const expiryDate = new Date(n.expiration);
  const mid = n.bid && n.ask ? (n.bid + n.ask) / 2 : (n.last ?? 0);
  return {
    id: n.id,
    strike: n.strike,
    expiry: n.expiration,
    expiryDate,
    daysToExpiry: n.dte,
    type: n.type,
    mid: Number.isFinite(mid) ? mid : 0,
    bid: n.bid ?? 0,
    ask: n.ask ?? 0,
    volume: 0,
    openInterest: n.oi ?? 0,
    delta: n.delta,
    gamma: n.gamma,
    theta: n.theta,
    vega: n.vega,
    iv: n.iv,
  };
}

type ChainQueryOptions = {
  window?: number;
  endDate?: string;
  strikeWindow?: number;
  provider?: "massive" | "tradier";
  tokenManager?: { getToken: () => Promise<string> };
};

/**
 * Fetch options chain with ephemeral token authentication
 */
export async function fetchNormalizedChain(
  symbol: string,
  windowOrOpts?: number | ChainQueryOptions
): Promise<Contract[]> {
  const opts: ChainQueryOptions =
    typeof windowOrOpts === "number" ? { window: windowOrOpts } : (windowOrOpts ?? {});
  const qs = new URLSearchParams({ symbol });
  if (typeof opts.window === "number" && Number.isFinite(opts.window) && opts.window > 0) {
    qs.set("window", String(opts.window));
  }
  if (opts.strikeWindow && Number.isFinite(opts.strikeWindow))
    qs.set("strikeWindow", String(opts.strikeWindow));
  if (opts.endDate) qs.set("endDate", opts.endDate);
  if (opts.provider) qs.set("provider", opts.provider);
  const headers: Record<string, string> = {};

  // Get ephemeral token if tokenManager provided
  if (opts.tokenManager) {
    const token = await opts.tokenManager.getToken();
    headers["x-massive-proxy-token"] = token;
  }

  const resp = await fetch(`/api/options/chain?${qs.toString()}`, { headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`[v0] /api/options/chain failed ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as NormalizedChain;
  const contracts: Contract[] = [];
  for (const exp of data.expirations) {
    for (const n of exp.calls) contracts.push(toContract(n));
    for (const n of exp.puts) contracts.push(toContract(n));
  }
  return contracts;
}
