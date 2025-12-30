import { getIndexAggregates } from "../../massive/client.js";
import { isIndex, normalizeSymbolForMassive } from "../../lib/symbolUtils.js";
// Tradier import removed - migrated to Massive-only architecture

const MASSIVE_MIN_DELAY_MS = 350; // ~3 rps max
let massiveQueue: Promise<number> = Promise.resolve(0);

type Timespan = "minute" | "hour" | "day";

export type RawBar = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
};

export type FetchBarsResult = { bars: RawBar[]; source: "massive-index" | "massive-stocks" };

async function throttleMassive<T>(task: () => Promise<T>): Promise<T> {
  massiveQueue = massiveQueue.then(async (lastStart) => {
    const now = Date.now();
    const elapsed = now - lastStart;
    if (elapsed < MASSIVE_MIN_DELAY_MS) {
      await new Promise((r) => setTimeout(r, MASSIVE_MIN_DELAY_MS - elapsed));
    }
    return Date.now();
  });

  await massiveQueue.catch(() => Date.now());
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
 * - All symbols now use Massive.com (Tradier removed)
 * - Indices use I: prefix, stocks use raw symbol
 *
 * For hourly timespan, we fetch 1-minute bars and aggregate
 * since Massive may not support hourly for all symbols directly.
 */
export async function fetchBarsForRange(
  symbol: string,
  mult: number,
  timespan: Timespan,
  rangeDays = 7
): Promise<FetchBarsResult> {
  // Support minute and hour timespans
  if (timespan !== "minute" && timespan !== "hour") {
    throw new Error(
      `Unsupported timespan ${timespan}. Only "minute" and "hour" are wired for scanners.`
    );
  }

  const { from, to } = buildDateRange(rangeDays);
  const clean = symbol.replace(/^I:/, "").toUpperCase();
  const isIndexSymbol = isIndex(symbol);
  const normalized = normalizeSymbolForMassive(symbol);
  const provider: FetchBarsResult["source"] = isIndexSymbol ? "massive-index" : "massive-stocks";

  // For hourly bars, fetch minute bars and aggregate
  const isHourly = timespan === "hour";
  const fetchMult = isHourly ? 1 : mult;
  const fetchTimespan: Timespan = isHourly ? "minute" : timespan;

  console.log(
    `[BarProvider] Using Massive for ${clean} (${fetchMult}${fetchTimespan}${isHourly ? " → aggregating to hourly" : ""}) from ${from} to ${to}`
  );

  try {
    const rawBars = await throttleMassive(() =>
      getIndexAggregates(normalized, fetchMult, fetchTimespan, from, to)
    );

    let bars: RawBar[] = rawBars;

    // Aggregate to hourly if requested
    if (isHourly && rawBars.length > 0) {
      bars = aggregateBars(rawBars, mult * 60); // mult hours * 60 minutes
      console.log(
        `[BarProvider] Aggregated ${rawBars.length} 1m bars → ${bars.length} ${mult}h bars`
      );
    }

    return { source: provider, bars };
  } catch (err: any) {
    err.provider = provider;
    throw err;
  }
}
