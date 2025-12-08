import { getIndexAggregates } from "../../massive/client.js";
import { isIndex, normalizeSymbolForMassive } from "../../lib/symbolUtils.js";
import { tradierGetHistory } from "../../vendors/tradier.js";

type Timespan = "minute" | "hour" | "day";

export type RawBar = { t: number; o: number; h: number; l: number; c: number; v: number };

export type FetchBarsResult = { bars: RawBar[]; source: "massive-index" | "tradier-equity" };

function buildDateRange(daysBack: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

/**
 * Provider-aware bar fetcher:
 * - Indices → Massive (unlimited indices plan)
 * - Equities → Tradier (we do NOT have Massive stocks)
 */
export async function fetchBarsForRange(
  symbol: string,
  mult: number,
  timespan: Timespan,
  rangeDays = 7
): Promise<FetchBarsResult> {
  if (timespan !== "minute") {
    throw new Error(`Unsupported timespan ${timespan}. Only "minute" is wired for scanners.`);
  }

  const { from, to } = buildDateRange(rangeDays);
  const clean = symbol.replace(/^I:/, "").toUpperCase();

  if (isIndex(symbol)) {
    const normalized = normalizeSymbolForMassive(symbol);
    console.log(
      `[BarProvider] Using Massive indices for ${clean} (${mult}${timespan}) from ${from} to ${to}`
    );
    const rawBars = await getIndexAggregates(normalized, mult, timespan, from, to);
    return { source: "massive-index", bars: rawBars };
  }

  // Equities: always route to Tradier
  const interval = `${mult}min` as "1min" | "5min" | "15min";
  console.log(
    `[BarProvider] Using Tradier for ${clean} (${interval}) from ${from} to ${to} (Massive stocks not enabled)`
  );
  const tradierBars = await tradierGetHistory(clean, interval, from, to);
  const normalized: RawBar[] = tradierBars.map((bar) => ({
    t: bar.time * 1000,
    o: bar.open,
    h: bar.high,
    l: bar.low,
    c: bar.close,
    v: bar.volume,
  }));
  return { source: "tradier-equity", bars: normalized };
}
