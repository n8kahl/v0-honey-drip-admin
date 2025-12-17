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
 * Aggregate minute bars into larger timeframe bars
 * Used for equities where Tradier doesn't support hourly bars directly
 */
function aggregateBars(bars: RawBar[], minutesPerBar: number): RawBar[] {
  if (bars.length === 0 || minutesPerBar <= 1) return bars;

  const aggregated: RawBar[] = [];
  const msPerBar = minutesPerBar * 60 * 1000;

  // Sort bars by timestamp
  const sorted = [...bars].sort((a, b) => a.t - b.t);

  let currentBucket: RawBar | null = null;
  let bucketStart = 0;

  for (const bar of sorted) {
    const barBucketStart = Math.floor(bar.t / msPerBar) * msPerBar;

    if (currentBucket === null || barBucketStart !== bucketStart) {
      // Start new bucket
      if (currentBucket) {
        aggregated.push(currentBucket);
      }
      bucketStart = barBucketStart;
      currentBucket = {
        t: barBucketStart,
        o: bar.o,
        h: bar.h,
        l: bar.l,
        c: bar.c,
        v: bar.v,
      };
    } else {
      // Extend current bucket
      currentBucket.h = Math.max(currentBucket.h, bar.h);
      currentBucket.l = Math.min(currentBucket.l, bar.l);
      currentBucket.c = bar.c; // Last close
      currentBucket.v += bar.v;
    }
  }

  if (currentBucket) {
    aggregated.push(currentBucket);
  }

  return aggregated;
}

/**
 * Provider-aware bar fetcher:
 * - Indices → Massive (unlimited indices plan, supports minute/hour/day)
 * - Equities → Tradier (we do NOT have Massive stocks)
 *
 * For equities with hourly timespan, we fetch 1-minute bars and aggregate
 * since Tradier doesn't support hourly intervals directly.
 */
export async function fetchBarsForRange(
  symbol: string,
  mult: number,
  timespan: Timespan,
  rangeDays = 7
): Promise<FetchBarsResult> {
  // Support minute and hour timespans
  if (timespan !== "minute" && timespan !== "hour") {
    throw new Error(`Unsupported timespan ${timespan}. Only "minute" and "hour" are wired for scanners.`);
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
  // For hourly bars, fetch 1-minute bars and aggregate (Tradier doesn't support hourly directly)
  const isHourly = timespan === "hour";
  const fetchMult = isHourly ? 1 : mult;
  const fetchInterval = `${fetchMult}min` as "1min" | "5min" | "15min";

  console.log(
    `[BarProvider] Using Tradier for ${clean} (${fetchInterval}${isHourly ? " → aggregating to hourly" : ""}) from ${from} to ${to}`
  );
  const provider: FetchBarsResult["source"] = "tradier-equity";
  try {
    const tradierBars = await tradierGetHistory(clean, fetchInterval, from, to);
    let normalized: RawBar[] = tradierBars
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

    // Aggregate to hourly if requested
    if (isHourly) {
      normalized = aggregateBars(normalized, mult * 60); // mult hours * 60 minutes
      console.log(`[BarProvider] Aggregated ${tradierBars.length} 1m bars → ${normalized.length} ${mult}h bars`);
    }

    return { source: provider, bars: normalized };
  } catch (err: any) {
    err.provider = provider;
    throw err;
  }
}
