/**
 * Unit tests for Confidence Scoring
 * Phase 1.4: Data availability-based confidence adjustment
 */

import { describe, it, expect } from "vitest";
import {
  extractDataAvailability,
  calculateDataConfidence,
  applyConfidenceToScore,
  shouldFilterLowConfidence,
  getConfidenceLevel,
  calculateWeekendConfidence,
  formatConfidenceResult,
  DEFAULT_DATA_WEIGHTS,
  type DataAvailability,
} from "../ConfidenceScoring";

describe("ConfidenceScoring", () => {
  describe("extractDataAvailability", () => {
    it("extracts availability from complete features", () => {
      const features = {
        symbol: "SPY",
        time: "2025-01-15T10:00:00",
        price: { current: 595.0, prev: 594.5 },
        volume: { current: 1000000, avg: 800000, relativeToAvg: 1.25 },
        vwap: { value: 594.8, distancePct: 0.03 },
        rsi: { "14": 55 },
        ema: { "21": 593.5 },
        flow: { flowScore: 75, flowBias: "bullish" },
        pattern: {
          orbHigh: 596.0,
          orbLow: 593.5,
          swingHigh: 598.0,
          swingLow: 590.0,
          vix_level: "medium",
          market_regime: "trending",
        },
        session: { isRegularHours: true, minutesSinceOpen: 30 },
        mtf: {
          "5m": { price: { current: 595.0 }, atr: 1.5 },
          "15m": { price: { current: 595.0 } },
        },
      } as any;

      const availability = extractDataAvailability(features);

      expect(availability.price).toBe(true);
      expect(availability.volume).toBe(true);
      expect(availability.vwap).toBe(true);
      expect(availability.rsi).toBe(true);
      expect(availability.atr).toBe(true);
      expect(availability.flow).toBe(true);
      expect(availability.mtf_5m).toBe(true);
      expect(availability.vixLevel).toBe(true);
      expect(availability.marketRegime).toBe(true);
    });

    it("detects missing data correctly", () => {
      const features = {
        symbol: "SPY",
        time: "2025-01-15T10:00:00",
        price: { current: 595.0 },
        // Missing: volume, vwap, rsi, ema, flow, etc.
        mtf: {},
        pattern: {},
        session: {},
      } as any;

      const availability = extractDataAvailability(features);

      expect(availability.price).toBe(true);
      expect(availability.volume).toBe(false);
      expect(availability.vwap).toBe(false);
      expect(availability.flow).toBe(false);
      expect(availability.mtf_5m).toBe(false);
    });
  });

  describe("calculateDataConfidence", () => {
    it("returns high confidence for complete data", () => {
      const availability: DataAvailability = {
        price: true,
        priceChange: true,
        volume: true,
        volumeAvg: true,
        relativeVolume: true,
        vwap: true,
        vwapDistance: true,
        rsi: true,
        ema: true,
        atr: true,
        mtf_1m: true,
        mtf_5m: true,
        mtf_15m: true,
        mtf_60m: true,
        flow: true,
        flowScore: true,
        flowBias: true,
        orb: true,
        priorDayLevels: true,
        swingLevels: true,
        vixLevel: true,
        marketRegime: true,
        session: true,
      };

      const result = calculateDataConfidence(availability);

      expect(result.dataCompletenessScore).toBe(100);
      expect(result.adjustedConfidence).toBeGreaterThan(90);
      expect(result.missingCritical).toHaveLength(0);
    });

    it("returns low confidence when critical data missing", () => {
      const availability: DataAvailability = {
        price: false, // Critical missing!
        priceChange: false,
        volume: false, // Critical missing!
        volumeAvg: false,
        relativeVolume: false,
        vwap: false,
        vwapDistance: false,
        rsi: false,
        ema: false,
        atr: false, // Critical missing!
        mtf_1m: false,
        mtf_5m: false,
        mtf_15m: false,
        mtf_60m: false,
        flow: false,
        flowScore: false,
        flowBias: false,
        orb: false,
        priorDayLevels: false,
        swingLevels: false,
        vixLevel: false,
        marketRegime: false,
        session: false,
      };

      const result = calculateDataConfidence(availability);

      expect(result.dataCompletenessScore).toBe(0);
      expect(result.adjustedConfidence).toBeLessThan(50);
      expect(result.missingCritical).toContain("price");
      expect(result.missingCritical).toContain("volume");
      expect(result.warnings).toHaveLength(2); // Critical + low completeness
    });

    it("calculates category scores correctly", () => {
      const availability: DataAvailability = {
        price: true,
        priceChange: true,
        volume: true,
        volumeAvg: true,
        relativeVolume: true,
        vwap: false,
        vwapDistance: false,
        rsi: false,
        ema: false,
        atr: true,
        mtf_1m: false,
        mtf_5m: false,
        mtf_15m: false,
        mtf_60m: false,
        flow: false,
        flowScore: false,
        flowBias: false,
        orb: false,
        priorDayLevels: false,
        swingLevels: false,
        vixLevel: false,
        marketRegime: false,
        session: false,
      };

      const result = calculateDataConfidence(availability);

      // Price category should be 100%
      expect(result.categoryScores["price"].percent).toBe(100);

      // Volume category should be 100%
      expect(result.categoryScores["volume"].percent).toBe(100);

      // Technical should be partial (only ATR available)
      expect(result.categoryScores["technical"].percent).toBeGreaterThan(0);
      expect(result.categoryScores["technical"].percent).toBeLessThan(100);
    });
  });

  describe("applyConfidenceToScore", () => {
    it("does not reduce score with high confidence", () => {
      const confidence = calculateDataConfidence({
        price: true,
        priceChange: true,
        volume: true,
        volumeAvg: true,
        relativeVolume: true,
        vwap: true,
        vwapDistance: true,
        rsi: true,
        ema: true,
        atr: true,
        mtf_1m: true,
        mtf_5m: true,
        mtf_15m: true,
        mtf_60m: true,
        flow: true,
        flowScore: true,
        flowBias: true,
        orb: true,
        priorDayLevels: true,
        swingLevels: true,
        vixLevel: true,
        marketRegime: true,
        session: true,
      });

      const result = applyConfidenceToScore(80, confidence);

      expect(result.adjustedScore).toBeGreaterThanOrEqual(80);
      expect(result.wasReduced).toBe(false);
    });

    it("reduces score with low confidence", () => {
      const confidence = calculateDataConfidence({
        price: true,
        priceChange: false,
        volume: true,
        volumeAvg: false,
        relativeVolume: false,
        vwap: false,
        vwapDistance: false,
        rsi: false,
        ema: false,
        atr: true,
        mtf_1m: false,
        mtf_5m: false,
        mtf_15m: false,
        mtf_60m: false,
        flow: false,
        flowScore: false,
        flowBias: false,
        orb: false,
        priorDayLevels: false,
        swingLevels: false,
        vixLevel: false,
        marketRegime: false,
        session: false,
      });

      const result = applyConfidenceToScore(80, confidence);

      expect(result.adjustedScore).toBeLessThan(80);
      expect(result.wasReduced).toBe(true);
      expect(result.reasoning).toContain("reduced");
    });
  });

  describe("shouldFilterLowConfidence", () => {
    it("filters when confidence below threshold", () => {
      const confidence = calculateDataConfidence({
        price: true,
        priceChange: false,
        volume: false, // Critical missing
        volumeAvg: false,
        relativeVolume: false,
        vwap: false,
        vwapDistance: false,
        rsi: false,
        ema: false,
        atr: false, // Critical missing
        mtf_1m: false,
        mtf_5m: false,
        mtf_15m: false,
        mtf_60m: false,
        flow: false,
        flowScore: false,
        flowBias: false,
        orb: false,
        priorDayLevels: false,
        swingLevels: false,
        vixLevel: false,
        marketRegime: false,
        session: false,
      });

      const result = shouldFilterLowConfidence(confidence, 40);

      expect(result.filter).toBe(true);
      expect(result.reason).toContain("too low");
    });

    it("does not filter with adequate confidence", () => {
      const confidence = calculateDataConfidence({
        price: true,
        priceChange: true,
        volume: true,
        volumeAvg: true,
        relativeVolume: true,
        vwap: true,
        vwapDistance: true,
        rsi: true,
        ema: true,
        atr: true,
        mtf_1m: false,
        mtf_5m: true,
        mtf_15m: false,
        mtf_60m: false,
        flow: false,
        flowScore: false,
        flowBias: false,
        orb: false,
        priorDayLevels: true,
        swingLevels: false,
        vixLevel: true,
        marketRegime: true,
        session: true,
      });

      const result = shouldFilterLowConfidence(confidence, 40);

      expect(result.filter).toBe(false);
    });
  });

  describe("getConfidenceLevel", () => {
    it("returns correct levels", () => {
      expect(getConfidenceLevel(90)).toBe("high");
      expect(getConfidenceLevel(70)).toBe("medium");
      expect(getConfidenceLevel(50)).toBe("low");
      expect(getConfidenceLevel(30)).toBe("very_low");
    });
  });

  describe("calculateWeekendConfidence", () => {
    it("uses relaxed weights for weekend", () => {
      const features = {
        symbol: "SPY",
        time: "2025-01-18T10:00:00", // Weekend
        price: { current: 595.0, prevClose: 594.0, prev: 594.5 },
        // Missing live data typical for weekends
        volume: { current: 100000 }, // Some volume data
        vwap: {},
        flow: undefined,
        pattern: {
          swingHigh: 598.0,
          swingLow: 590.0,
        },
        mtf: {
          "5m": { price: { current: 595.0 }, atr: 1.5 },
        },
        session: {},
      } as any;

      const result = calculateWeekendConfidence(features);

      // Weekend confidence calculation should work and produce a score
      expect(result.adjustedConfidence).toBeGreaterThanOrEqual(0);
      expect(result.dataCompletenessScore).toBeGreaterThan(0);
    });
  });

  describe("formatConfidenceResult", () => {
    it("formats result for display", () => {
      const availability: DataAvailability = {
        price: true,
        priceChange: true,
        volume: true,
        volumeAvg: true,
        relativeVolume: true,
        vwap: true,
        vwapDistance: true,
        rsi: true,
        ema: true,
        atr: true,
        mtf_1m: false,
        mtf_5m: true,
        mtf_15m: false,
        mtf_60m: false,
        flow: false,
        flowScore: false,
        flowBias: false,
        orb: false,
        priorDayLevels: true,
        swingLevels: false,
        vixLevel: true,
        marketRegime: true,
        session: true,
      };

      const confidence = calculateDataConfidence(availability);
      const formatted = formatConfidenceResult(confidence);

      expect(formatted).toContain("Data Completeness");
      expect(formatted).toContain("Confidence");
      expect(formatted).toContain("Category Breakdown");
    });
  });
});
