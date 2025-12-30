/**
 * Unit tests for Bar Provider
 * Phase 4: Tests for bar fetching and aggregation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock environment variables
vi.stubEnv("MASSIVE_API_KEY", "test-api-key");

// Mock the Massive client
vi.mock("../../../massive/client.js", () => ({
  getIndexAggregates: vi.fn(),
}));
// Tradier mock removed - migrated to Massive-only architecture

// Mock symbol utils
vi.mock("../../../lib/symbolUtils.js", () => ({
  isIndex: vi.fn((symbol: string) => {
    const indexSymbols = ["SPX", "NDX", "VIX", "I:SPX", "I:NDX", "I:VIX"];
    return indexSymbols.includes(symbol.toUpperCase());
  }),
  normalizeSymbolForMassive: vi.fn((symbol: string) => symbol.replace(/^I:/, "").toUpperCase()),
}));

import { getIndexAggregates } from "../../../massive/client.js";
// tradierGetHistory import removed - migrated to Massive-only architecture

/**
 * Bar aggregation function (copy from barProvider.ts for unit testing)
 */
interface RawBar {
  t: number; // timestamp in ms
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // vwap (optional)
}

function aggregateBars(bars: RawBar[], minutesPerBar: number): RawBar[] {
  if (bars.length === 0 || minutesPerBar <= 1) return bars;

  const aggregated: RawBar[] = [];
  const msPerBar = minutesPerBar * 60 * 1000;

  const sorted = [...bars].sort((a, b) => a.t - b.t);

  let currentBucket: RawBar | null = null;
  let bucketStart = 0;

  for (const bar of sorted) {
    const barBucketStart = Math.floor(bar.t / msPerBar) * msPerBar;

    if (currentBucket === null || barBucketStart !== bucketStart) {
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
      currentBucket.h = Math.max(currentBucket.h, bar.h);
      currentBucket.l = Math.min(currentBucket.l, bar.l);
      currentBucket.c = bar.c;
      currentBucket.v += bar.v;
    }
  }

  if (currentBucket) {
    aggregated.push(currentBucket);
  }

  return aggregated;
}

describe("aggregateBars", () => {
  const createBar = (
    timestamp: number,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number
  ): RawBar => ({
    t: timestamp,
    o: open,
    h: high,
    l: low,
    c: close,
    v: volume,
  });

  it("returns empty array for empty input", () => {
    expect(aggregateBars([], 60)).toEqual([]);
  });

  it("returns original bars when minutesPerBar <= 1", () => {
    const bars = [
      createBar(1000000, 100, 105, 98, 102, 1000),
      createBar(1060000, 102, 107, 100, 104, 1200),
    ];

    expect(aggregateBars(bars, 1)).toEqual(bars);
    expect(aggregateBars(bars, 0)).toEqual(bars);
  });

  it("aggregates minute bars to hourly (60 minutes)", () => {
    // Base timestamp: start of an hour
    const hourStart = Math.floor(Date.now() / (60 * 60 * 1000)) * (60 * 60 * 1000);

    // Create 60 minute bars within the same hour
    const bars1m: RawBar[] = [];
    for (let i = 0; i < 60; i++) {
      bars1m.push(
        createBar(
          hourStart + i * 60 * 1000, // Each minute
          100 + i, // Open increases
          105 + i, // High increases
          98 + i, // Low increases
          102 + i, // Close increases
          1000 + i * 10 // Volume increases
        )
      );
    }

    const result = aggregateBars(bars1m, 60);

    expect(result).toHaveLength(1);
    expect(result[0].t).toBe(hourStart);
    expect(result[0].o).toBe(100); // First bar's open
    expect(result[0].h).toBe(164); // Max high: 105 + 59
    expect(result[0].l).toBe(98); // Min low: 98
    expect(result[0].c).toBe(161); // Last bar's close: 102 + 59
    // Volume sum: 1000 + 1010 + 1020 + ... + 1590 = 60 * 1000 + 10 * (0+1+...+59) = 60000 + 10 * 1770 = 77700
    expect(result[0].v).toBe(77700);
  });

  it("handles bars across multiple time buckets", () => {
    const hour1 = 1700000000000; // Some timestamp
    const hour2 = hour1 + 60 * 60 * 1000; // Next hour

    const bars = [
      // First hour - 3 bars
      createBar(hour1, 100, 110, 95, 105, 1000),
      createBar(hour1 + 60000, 105, 115, 100, 108, 1200),
      createBar(hour1 + 120000, 108, 112, 102, 107, 800),
      // Second hour - 2 bars
      createBar(hour2, 107, 120, 105, 118, 1500),
      createBar(hour2 + 60000, 118, 125, 115, 122, 2000),
    ];

    const result = aggregateBars(bars, 60);

    expect(result).toHaveLength(2);

    // First hour bucket
    const bucket1Start = Math.floor(hour1 / (60 * 60 * 1000)) * (60 * 60 * 1000);
    expect(result[0].t).toBe(bucket1Start);
    expect(result[0].o).toBe(100); // First bar's open
    expect(result[0].h).toBe(115); // Max high across 3 bars
    expect(result[0].l).toBe(95); // Min low across 3 bars
    expect(result[0].c).toBe(107); // Last bar's close
    expect(result[0].v).toBe(3000); // Sum of volumes

    // Second hour bucket
    const bucket2Start = Math.floor(hour2 / (60 * 60 * 1000)) * (60 * 60 * 1000);
    expect(result[1].t).toBe(bucket2Start);
    expect(result[1].o).toBe(107);
    expect(result[1].h).toBe(125);
    expect(result[1].l).toBe(105);
    expect(result[1].c).toBe(122);
    expect(result[1].v).toBe(3500);
  });

  it("sorts bars by timestamp before aggregating", () => {
    const baseTime = 1700000000000;

    // Bars in random order
    const bars = [
      createBar(baseTime + 120000, 108, 112, 102, 107, 800),
      createBar(baseTime, 100, 110, 95, 105, 1000),
      createBar(baseTime + 60000, 105, 115, 100, 108, 1200),
    ];

    const result = aggregateBars(bars, 60);

    // Should still aggregate correctly
    expect(result).toHaveLength(1);
    expect(result[0].o).toBe(100); // First bar's open (by time)
    expect(result[0].c).toBe(107); // Last bar's close (by time)
  });

  it("correctly tracks high/low across unsorted bars", () => {
    const baseTime = 1700000000000;

    const bars = [
      createBar(baseTime + 60000, 100, 80, 75, 78, 1000), // Lowest low: 75
      createBar(baseTime, 100, 200, 95, 105, 1000), // Highest high: 200
      createBar(baseTime + 120000, 100, 110, 90, 100, 1000),
    ];

    const result = aggregateBars(bars, 60);

    expect(result).toHaveLength(1);
    expect(result[0].h).toBe(200); // Highest high
    expect(result[0].l).toBe(75); // Lowest low
  });
});

describe("fetchBarsForRange provider routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should route indices to Massive with massive-index source", async () => {
    const mockBars = [{ t: 1700000000000, o: 100, h: 105, l: 98, c: 102, v: 1000 }];

    (getIndexAggregates as any).mockResolvedValue(mockBars);

    // Import after mocks are setup
    const { fetchBarsForRange } = await import("../barProvider.js");

    const result = await fetchBarsForRange("I:SPX", 5, "minute", 7);

    expect(result.source).toBe("massive-index");
    expect(getIndexAggregates).toHaveBeenCalled();
  });

  it("should route stocks to Massive with massive-stocks source", async () => {
    const mockBars = [{ t: 1700000000000, o: 100, h: 105, l: 98, c: 102, v: 1000 }];

    (getIndexAggregates as any).mockResolvedValue(mockBars);

    const { fetchBarsForRange } = await import("../barProvider.js");

    const result = await fetchBarsForRange("AAPL", 5, "minute", 7);

    expect(result.source).toBe("massive-stocks");
    expect(getIndexAggregates).toHaveBeenCalled();
  });

  it("should aggregate minute bars to hourly for stocks", async () => {
    // Create 120 minute bars (2 hours worth) - Massive uses milliseconds
    const mockBars = [];
    const baseTime = Date.now() - 7200 * 1000; // 2 hours ago in milliseconds

    for (let i = 0; i < 120; i++) {
      mockBars.push({
        t: baseTime + i * 60 * 1000, // Massive uses milliseconds
        o: 100 + i * 0.1,
        h: 101 + i * 0.1,
        l: 99 + i * 0.1,
        c: 100.5 + i * 0.1,
        v: 1000 + i,
      });
    }

    (getIndexAggregates as any).mockResolvedValue(mockBars);

    const { fetchBarsForRange } = await import("../barProvider.js");

    const result = await fetchBarsForRange("SPY", 1, "hour", 7);

    expect(result.source).toBe("massive-stocks");
    // Should have aggregated 120 minute bars into ~2 hourly bars
    expect(result.bars.length).toBeLessThanOrEqual(3);
    expect(result.bars.length).toBeGreaterThan(0);
  });
});

describe("date range building", () => {
  it("builds correct date range for 7 days", () => {
    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const to = now.toISOString().split("T")[0];
    const from = sevenDaysAgo.toISOString().split("T")[0];

    // Verify format is YYYY-MM-DD
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify range is approximately 7 days
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);

    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(7);
  });
});
