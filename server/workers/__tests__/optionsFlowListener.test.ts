/**
 * Unit tests for Options Flow Listener symbol selection logic
 *
 * Tests the pure functions for:
 * - Symbol normalization (uppercase, deduplication)
 * - Safety limits (max symbols)
 * - Merging multiple symbol sources
 * - Equality comparison for change detection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeSymbols,
  applySymbolLimit,
  mergeSymbolSources,
  symbolsAreEqual,
} from "../optionsFlowListener";

describe("normalizeSymbols", () => {
  it("uppercases all symbols", () => {
    const input = ["spy", "Qqq", "IWM"];
    const result = normalizeSymbols(input);
    expect(result).toEqual(["IWM", "QQQ", "SPY"]);
  });

  it("removes duplicates", () => {
    const input = ["SPY", "spy", "SPY", "QQQ"];
    const result = normalizeSymbols(input);
    expect(result).toEqual(["QQQ", "SPY"]);
  });

  it("trims whitespace", () => {
    const input = [" SPY ", "QQQ  ", "  IWM"];
    const result = normalizeSymbols(input);
    expect(result).toEqual(["IWM", "QQQ", "SPY"]);
  });

  it("filters out empty/null values", () => {
    const input = ["SPY", "", null as unknown as string, undefined as unknown as string, "QQQ"];
    const result = normalizeSymbols(input);
    expect(result).toEqual(["QQQ", "SPY"]);
  });

  it("returns sorted array", () => {
    const input = ["TSLA", "AMD", "NVDA", "AAPL"];
    const result = normalizeSymbols(input);
    expect(result).toEqual(["AAPL", "AMD", "NVDA", "TSLA"]);
  });

  it("handles empty array", () => {
    const result = normalizeSymbols([]);
    expect(result).toEqual([]);
  });
});

describe("applySymbolLimit", () => {
  it("returns same array if under limit", () => {
    const input = ["SPY", "QQQ", "IWM"];
    const result = applySymbolLimit(input, 10);
    expect(result).toEqual(input);
  });

  it("returns same array if exactly at limit", () => {
    const input = ["SPY", "QQQ", "IWM"];
    const result = applySymbolLimit(input, 3);
    expect(result).toEqual(input);
  });

  it("truncates array if over limit", () => {
    const input = ["SPY", "QQQ", "IWM", "AAPL", "MSFT"];
    const result = applySymbolLimit(input, 3);
    expect(result).toEqual(["SPY", "QQQ", "IWM"]);
    expect(result.length).toBe(3);
  });

  it("handles limit of 1", () => {
    const input = ["SPY", "QQQ", "IWM"];
    const result = applySymbolLimit(input, 1);
    expect(result).toEqual(["SPY"]);
  });

  it("handles empty array", () => {
    const result = applySymbolLimit([], 10);
    expect(result).toEqual([]);
  });
});

describe("mergeSymbolSources", () => {
  it("merges multiple sources", () => {
    const source1 = ["SPY", "QQQ"];
    const source2 = ["IWM", "AAPL"];
    const result = mergeSymbolSources([source1, source2], 50);
    expect(result).toContain("SPY");
    expect(result).toContain("QQQ");
    expect(result).toContain("IWM");
    expect(result).toContain("AAPL");
  });

  it("deduplicates across sources", () => {
    const source1 = ["SPY", "QQQ"];
    const source2 = ["SPY", "IWM"]; // SPY duplicate
    const result = mergeSymbolSources([source1, source2], 50);
    expect(result).toEqual(["IWM", "QQQ", "SPY"]);
    expect(result.filter((s) => s === "SPY").length).toBe(1);
  });

  it("normalizes across sources", () => {
    const source1 = ["spy", "qqq"];
    const source2 = ["SPY", "iwm"]; // Mixed case
    const result = mergeSymbolSources([source1, source2], 50);
    expect(result).toEqual(["IWM", "QQQ", "SPY"]);
  });

  it("applies limit after merging", () => {
    const source1 = ["SPY", "QQQ", "IWM"];
    const source2 = ["AAPL", "MSFT", "GOOGL"];
    const result = mergeSymbolSources([source1, source2], 4);
    expect(result.length).toBe(4);
  });

  it("handles empty sources", () => {
    const result = mergeSymbolSources([[], []], 50);
    expect(result).toEqual([]);
  });

  it("handles mixed empty and non-empty sources", () => {
    const result = mergeSymbolSources([["SPY"], [], ["QQQ"]], 50);
    expect(result).toEqual(["QQQ", "SPY"]);
  });
});

describe("symbolsAreEqual", () => {
  it("returns true for identical arrays", () => {
    const a = ["SPY", "QQQ", "IWM"];
    const b = ["SPY", "QQQ", "IWM"];
    expect(symbolsAreEqual(a, b)).toBe(true);
  });

  it("returns true for same symbols in different order", () => {
    const a = ["SPY", "QQQ", "IWM"];
    const b = ["IWM", "SPY", "QQQ"];
    expect(symbolsAreEqual(a, b)).toBe(true);
  });

  it("returns false for different lengths", () => {
    const a = ["SPY", "QQQ"];
    const b = ["SPY", "QQQ", "IWM"];
    expect(symbolsAreEqual(a, b)).toBe(false);
  });

  it("returns false for different symbols", () => {
    const a = ["SPY", "QQQ", "IWM"];
    const b = ["SPY", "QQQ", "AAPL"];
    expect(symbolsAreEqual(a, b)).toBe(false);
  });

  it("returns true for empty arrays", () => {
    expect(symbolsAreEqual([], [])).toBe(true);
  });

  it("handles single element arrays", () => {
    expect(symbolsAreEqual(["SPY"], ["SPY"])).toBe(true);
    expect(symbolsAreEqual(["SPY"], ["QQQ"])).toBe(false);
  });
});

describe("Integration scenarios", () => {
  it("handles typical watchlist + trades merge", () => {
    const watchlistSymbols = ["SPY", "QQQ", "TSLA", "AAPL"];
    const tradeSymbols = ["SPY", "NVDA"]; // SPY is duplicate
    const defaultSymbols = ["SPX", "NDX", "SPY", "QQQ", "IWM"]; // SPY, QQQ duplicates

    const result = mergeSymbolSources([watchlistSymbols, tradeSymbols, defaultSymbols], 50);

    // Should contain all unique symbols
    expect(result).toContain("SPY");
    expect(result).toContain("QQQ");
    expect(result).toContain("TSLA");
    expect(result).toContain("AAPL");
    expect(result).toContain("NVDA");
    expect(result).toContain("SPX");
    expect(result).toContain("NDX");
    expect(result).toContain("IWM");

    // Should be 8 unique symbols
    expect(result.length).toBe(8);
  });

  it("respects safety limit for large watchlists", () => {
    // Simulate a large watchlist
    const largeWatchlist = Array.from({ length: 100 }, (_, i) => `SYM${i}`);
    const trades = ["EXTRA1", "EXTRA2"];
    const defaults = ["SPY", "QQQ"];

    const result = mergeSymbolSources([largeWatchlist, trades, defaults], 50);

    expect(result.length).toBe(50);
  });

  it("detects when symbol list changes", () => {
    const original = ["SPY", "QQQ", "IWM"];
    const unchanged = ["IWM", "SPY", "QQQ"]; // Same symbols, different order
    const added = ["SPY", "QQQ", "IWM", "AAPL"]; // Added AAPL
    const removed = ["SPY", "QQQ"]; // Removed IWM
    const replaced = ["SPY", "QQQ", "AAPL"]; // Replaced IWM with AAPL

    expect(symbolsAreEqual(original, unchanged)).toBe(true);
    expect(symbolsAreEqual(original, added)).toBe(false);
    expect(symbolsAreEqual(original, removed)).toBe(false);
    expect(symbolsAreEqual(original, replaced)).toBe(false);
  });

  it("handles ticker parsing for options symbols", () => {
    // Simulates the ticker parsing logic from loadDynamicSymbols
    const tickers = [
      "O:SPY250117C00622000",
      "O:TSLA250117P00400000",
      "O:AAPL250117C00200000",
      "INVALID_TICKER",
      null as unknown as string,
    ];

    const symbols = tickers
      .map((ticker) => {
        if (!ticker) return null;
        const match = ticker.match(/^O:([A-Z]+)/);
        return match ? match[1] : null;
      })
      .filter((s): s is string => s !== null);

    expect(symbols).toEqual(["SPY", "TSLA", "AAPL"]);
  });
});
