import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBarsForRange } from "./barProvider.js";

const mockGetIndexAggregates = vi.fn();

vi.mock("../../massive/client.js", () => ({
  getIndexAggregates: (...args: any[]) => mockGetIndexAggregates(...args),
}));
// Tradier mock removed - migrated to Massive-only architecture

describe("fetchBarsForRange", () => {
  beforeEach(() => {
    mockGetIndexAggregates.mockReset();
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

  it("routes stocks to Massive with massive-stocks source", async () => {
    mockGetIndexAggregates.mockResolvedValueOnce([
      { t: 1700000000000, o: 10, h: 11, l: 9, c: 10.5, v: 1000 },
    ]);

    const result = await fetchBarsForRange("MSFT", 5, "minute", 1);

    expect(result.source).toBe("massive-stocks");
    expect(result.bars).toEqual([{ t: 1700000000000, o: 10, h: 11, l: 9, c: 10.5, v: 1000 }]);
    expect(mockGetIndexAggregates).toHaveBeenCalledTimes(1);
  });
});
