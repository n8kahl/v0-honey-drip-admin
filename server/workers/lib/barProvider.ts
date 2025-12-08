import { getIndexAggregates } from "../../massive/client.js";
import { isIndex, normalizeSymbolForMassive } from "../../lib/symbolUtils.js";
import { tradierGetHistory } from "../../vendors/tradier.js";

const MASSIVE_INDEX_MIN_DELAY_MS = 350; // ~3 rps max
let massiveIndexQueue: Promise<number> = Promise.resolve(0);

type Timespan = "minute" | "hour" | "day";

export type RawBar = { t: number; o: number; h: number; l: number; c: number; v: number };

export type FetchBarsResult = { bars: RawBar[]; source: "massive-index" | "tradier-equity" };

async function throttleMassiveIndex<T>(task: () => Promise<T>): Promise<T> {
  massiveIndexQueue = massiveIndexQueue.then(async (lastStart) => {
    const now = Date.now();
    const elapsed = now - lastStart;
    if (elapsed < MASSIVE_INDEX_MIN_DELAY_MS) {
      await new Promise((r) => setTimeout(r, MASSIVE_INDEX_MIN_DELAY_MS - elapsed));
    }
    return Date.now();
  });

  await massiveIndexQueue.catch(() => Date.now());
  return task();
}

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
    const provider: FetchBarsResult["source"] = "massive-index";
    const normalized = normalizeSymbolForMassive(symbol);
    console.log(
      `[BarProvider] Using Massive indices for ${clean} (${mult}${timespan}) from ${from} to ${to}`
    );
    try {
      const rawBars = await throttleMassiveIndex(() =>
        getIndexAggregates(normalized, mult, timespan, from, to)
      );
      return { source: provider, bars: rawBars };
    } catch (err: any) {
      err.provider = provider;
      throw err;
    }
  }

  // Equities: always route to Tradier
  const interval = `${mult}min` as "1min" | "5min" | "15min";
  console.log(
    `[BarProvider] Using Tradier for ${clean} (${interval}) from ${from} to ${to} (Massive stocks not enabled)`
  );
  const provider: FetchBarsResult["source"] = "tradier-equity";
  try {
    const tradierBars = await tradierGetHistory(clean, interval, from, to);
    const normalized: RawBar[] = tradierBars
      .map((bar) => {
        // bar.time is seconds; convert to ms for downstream consumers
        const tSeconds = Number(bar.time) || 0;
        if (!Number.isFinite(tSeconds) || tSeconds <= 0) return null;
        return {
          t: tSeconds * 1000,
          o: bar.open,
          h: bar.high,
          l: bar.low,
          c: bar.close,
          v: bar.volume,
        };
      })
      .filter(Boolean) as RawBar[];
    return { source: provider, bars: normalized };
  } catch (err: any) {
    err.provider = provider;
    throw err;
  }
}
