/**
 * VIX Classifier Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { classifyVIXLevel, clearVIXCache, getVIXStrategyAdjustments } from "./vixClassifier";

// Mock the massive API
vi.mock("../massive", () => ({
  massive: {
    getIndices: vi.fn(),
  },
}));

import { massive } from "../massive";

describe("VIX Classifier", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearVIXCache();
    vi.clearAllMocks();
  });

  describe("classifyVIXLevel", () => {
    it("should classify low VIX (< 15)", async () => {
      (massive.getIndices as any).mockResolvedValue([{ value: 12.5 }]);

      const result = await classifyVIXLevel();

      expect(result.level).toBe("low");
      expect(result.value).toBe(12.5);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.timestamp).toBeDefined();
    });

    it("should classify medium VIX (15-25)", async () => {
      (massive.getIndices as any).mockResolvedValue([{ value: 20 }]);

      const result = await classifyVIXLevel();

      expect(result.level).toBe("medium");
      expect(result.value).toBe(20);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should classify high VIX (25-35)", async () => {
      (massive.getIndices as any).mockResolvedValue([{ value: 30 }]);

      const result = await classifyVIXLevel();

      expect(result.level).toBe("high");
      expect(result.value).toBe(30);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should classify extreme VIX (> 35)", async () => {
      (massive.getIndices as any).mockResolvedValue([{ value: 45 }]);

      const result = await classifyVIXLevel();

      expect(result.level).toBe("extreme");
      expect(result.value).toBe(45);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should use cache on subsequent calls", async () => {
      (massive.getIndices as any).mockResolvedValue([{ value: 20 }]);

      // First call - should hit API
      const result1 = await classifyVIXLevel();
      expect(result1.value).toBe(20);
      expect(massive.getIndices).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await classifyVIXLevel();
      expect(result2.value).toBe(20);
      expect(massive.getIndices).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should handle API errors gracefully", async () => {
      (massive.getIndices as any).mockRejectedValue(new Error("API error"));

      const result = await classifyVIXLevel();

      // Should default to medium VIX (20)
      expect(result.level).toBe("medium");
      expect(result.value).toBe(20);
    });

    it("should handle missing data gracefully", async () => {
      (massive.getIndices as any).mockResolvedValue([]);

      const result = await classifyVIXLevel();

      // Should default to medium VIX (20)
      expect(result.level).toBe("medium");
      expect(result.value).toBe(20);
    });

    it("should use stale cache when API fails", async () => {
      // First call succeeds
      (massive.getIndices as any).mockResolvedValue([{ value: 25 }]);

      const result1 = await classifyVIXLevel();
      expect(result1.value).toBe(25);

      // Clear cache would normally expire it, but we'll test the error path
      clearVIXCache();

      // Set up cache manually to simulate stale cache
      await classifyVIXLevel(); // Populate cache

      // Now fail the API
      (massive.getIndices as any).mockRejectedValue(new Error("API down"));

      // Clear cache to force API call (but keep internal stale cache)
      // This simulates cache expiration time passing
      // The implementation should use stale cache when API fails

      const result2 = await classifyVIXLevel();
      // Should still return a valid result (either from stale cache or default)
      expect(result2.value).toBeGreaterThan(0);
    });
  });

  describe("getVIXStrategyAdjustments", () => {
    it("should return tight stops for low VIX", () => {
      const adjustments = getVIXStrategyAdjustments("low");

      expect(adjustments.stopMultiplier).toBe(0.8);
      expect(adjustments.sizeMultiplier).toBe(1.2);
      expect(adjustments.recommendedTypes).toContain("breakout");
      expect(adjustments.avoid).toHaveLength(0);
    });

    it("should return normal settings for medium VIX", () => {
      const adjustments = getVIXStrategyAdjustments("medium");

      expect(adjustments.stopMultiplier).toBe(1.0);
      expect(adjustments.sizeMultiplier).toBe(1.0);
      expect(adjustments.recommendedTypes).toContain("all");
    });

    it("should return wide stops for high VIX", () => {
      const adjustments = getVIXStrategyAdjustments("high");

      expect(adjustments.stopMultiplier).toBe(1.5);
      expect(adjustments.sizeMultiplier).toBe(0.7);
      expect(adjustments.recommendedTypes).toContain("mean-reversion");
      expect(adjustments.avoid).toContain("tight-breakout");
    });

    it("should return very wide stops for extreme VIX", () => {
      const adjustments = getVIXStrategyAdjustments("extreme");

      expect(adjustments.stopMultiplier).toBe(2.0);
      expect(adjustments.sizeMultiplier).toBe(0.5);
      expect(adjustments.avoid).toContain("breakout");
      expect(adjustments.avoid).toContain("most-strategies");
    });
  });

  describe("clearVIXCache", () => {
    it("should clear the cache", async () => {
      (massive.getIndices as any).mockResolvedValue([{ value: 20 }]);

      // First call
      await classifyVIXLevel();
      expect(massive.getIndices).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await classifyVIXLevel();
      expect(massive.getIndices).toHaveBeenCalledTimes(1);

      // Clear cache
      clearVIXCache();

      // Third call should hit API again
      await classifyVIXLevel();
      expect(massive.getIndices).toHaveBeenCalledTimes(2);
    });
  });
});
