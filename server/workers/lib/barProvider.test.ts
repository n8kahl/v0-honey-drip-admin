import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBarsForRange } from "./barProvider.js";

const mockGetIndexAggregates = vi.fn();
const mockTradierGetHistory = vi.fn();

vi.mock("../../massive/client.js", () => ({
  getIndexAggregates: (...args: any[]) => mockGetIndexAggregates(...args),
}));

vi.mock("../../vendors/tradier.js", () => ({
  tradierGetHistory: (...args: any[]) => mockTradierGetHistory(...args),
}));

describe("fetchBarsForRange", () => {
  beforeEach(() => {
    mockGetIndexAggregates.mockReset();
    mockTradierGetHistory.mockReset();
  });

  it("routes indices to Massive and normalizes symbol", async () => {
    mockGetIndexAggregates.mockResolvedValueOnce([
      { t: 1700000000000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 },
    ]);

    const result = await fetchBarsForRange("SPX", 5, "minute", 1);

    expect(result.source).toBe("massive-index");
    expect(result.bars).toHaveLength(1);
    expect(mockGetIndexAggregates).toHaveBeenCalledTimes(1);
    // Massive expects the I: prefix for indices
    expect(mockGetIndexAggregates.mock.calls[0][0]).toBe("I:SPX");
  });

  it("routes equities to Tradier and normalizes bar shape", async () => {
    mockTradierGetHistory.mockResolvedValueOnce([
      { time: 1700000000, open: 10, high: 11, low: 9, close: 10.5, volume: 1000 },
    ]);

    const result = await fetchBarsForRange("MSFT", 5, "minute", 1);

    expect(result.source).toBe("tradier-equity");
    expect(result.bars).toEqual([{ t: 1700000000 * 1000, o: 10, h: 11, l: 9, c: 10.5, v: 1000 }]);
    expect(mockTradierGetHistory).toHaveBeenCalledTimes(1);
    expect(mockGetIndexAggregates).not.toHaveBeenCalled();
  });
});
