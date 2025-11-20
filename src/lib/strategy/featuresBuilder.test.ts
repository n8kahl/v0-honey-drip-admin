/**
 * Feature Builder Test - Phase 1 Verification
 *
 * Verifies that all required fields are populated correctly,
 * especially the newly wired divergence detection features.
 */

import { buildSymbolFeatures } from './featuresBuilder';
import type { Bar } from './patternDetection';
import type { RawMTFContext } from './featuresBuilder';

describe('buildSymbolFeatures - Phase 1', () => {
  // Mock historical bars (20 bars for divergence detection)
  const mockBars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
    time: 1700000000 + i * 60, // 1-minute intervals
    open: 450 + Math.random() * 5,
    high: 452 + Math.random() * 5,
    low: 448 + Math.random() * 5,
    close: 450 + Math.random() * 5,
    volume: 1000000 + Math.random() * 500000,
  }));

  // Mock MTF context with RSI data across timeframes
  const mockMTF: RawMTFContext = {
    '1m': {
      price: { current: 450.25, open: 450.00, high: 450.50, low: 449.80, prev: 450.00 },
      vwap: { value: 450.10, distancePct: 0.03, prev: 450.05 },
      ema: { '9': 450.15, '20': 449.90 },
      rsi: { '14': 55.2 },
      atr: 2.5,
    },
    '5m': {
      price: { current: 450.25, open: 450.00, high: 450.60, low: 449.70, prev: 450.10 },
      vwap: { value: 450.12, distancePct: 0.03, prev: 450.08 },
      ema: { '9': 450.20, '20': 450.00 },
      rsi: { '14': 52.8 },
      atr: 3.2,
    },
    '15m': {
      price: { current: 450.25, open: 449.90, high: 451.00, low: 449.50, prev: 450.20 },
      vwap: { value: 450.15, distancePct: 0.02, prev: 450.10 },
      ema: { '9': 450.25, '20': 450.10 },
      rsi: { '14': 54.5 },
      atr: 4.1,
    },
    '60m': {
      price: { current: 450.25, open: 449.50, high: 451.50, low: 449.00, prev: 450.50 },
      vwap: { value: 450.20, distancePct: 0.01, prev: 450.15 },
      ema: { '9': 450.30, '20': 450.20 },
      rsi: { '14': 53.2 },
      atr: 5.5,
    },
  };

  it('should populate all core pattern fields', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
    });

    // Core pattern fields
    expect(features.pattern).toBeDefined();
    expect(features.pattern?.isPatientCandle).toBeDefined();
    expect(features.pattern?.orbHigh).toBeDefined();
    expect(features.pattern?.orbLow).toBeDefined();
    expect(features.pattern?.swingHigh).toBeDefined();
    expect(features.pattern?.swingLow).toBeDefined();
    expect(features.pattern?.fib618).toBeDefined();
    expect(features.pattern?.fib500).toBeDefined();
    expect(features.pattern?.nearFib618).toBeDefined();
    expect(features.pattern?.nearFib500).toBeDefined();
    expect(features.pattern?.consolidationHigh).toBeDefined();
    expect(features.pattern?.consolidationLow).toBeDefined();
    expect(features.pattern?.isConsolidation).toBeDefined();
    expect(features.pattern?.breakoutBullish).toBeDefined();
    expect(features.pattern?.breakoutBearish).toBeDefined();
    expect(features.pattern?.volumeSpike).toBeDefined();
  });

  it('should populate RSI divergence field (Phase 1 - NEW)', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
    });

    // NEW: RSI divergence detection
    expect(features.pattern?.rsi_divergence_5m).toBeDefined();
    expect(typeof features.pattern?.rsi_divergence_5m).toBe('boolean');
  });

  it('should populate MTF divergence field (Phase 1 - NEW)', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
    });

    // NEW: Multi-timeframe divergence detection
    expect(features.pattern?.mtf_divergence_aligned).toBeDefined();
    expect(typeof features.pattern?.mtf_divergence_aligned).toBe('boolean');
  });

  it('should handle insufficient bars gracefully for divergence', () => {
    // Only 10 bars (< 20 required for divergence)
    const shortBars = mockBars.slice(0, 10);

    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: shortBars,
    });

    // Should still populate (will be false)
    expect(features.pattern?.rsi_divergence_5m).toBeDefined();
    expect(features.pattern?.rsi_divergence_5m).toBe(false);
  });

  it('should handle missing MTF data gracefully for MTF divergence', () => {
    // MTF with only 1 timeframe (< 2 required for MTF divergence)
    const limitedMTF: RawMTFContext = {
      '5m': mockMTF['5m']!,
    };

    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: limitedMTF,
      bars: mockBars,
    });

    // Should still populate (will be false)
    expect(features.pattern?.mtf_divergence_aligned).toBeDefined();
    expect(features.pattern?.mtf_divergence_aligned).toBe(false);
  });

  it('should populate flow fields when flow data provided', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
      flow: {
        sweepCount: 5,
        blockCount: 2,
        unusualActivity: true,
        flowScore: 75,
        flowBias: 'bullish',
        buyPressure: 65,
        largeTradeCount: 3,
        vwap: 450.15,
      },
    });

    expect(features.flow).toBeDefined();
    expect(features.flow?.sweepCount).toBe(5);
    expect(features.flow?.blockCount).toBe(2);
    expect(features.flow?.unusualActivity).toBe(true);
    expect(features.flow?.flowScore).toBe(75);
    expect(features.flow?.flowBias).toBe('bullish');
    expect(features.flow?.buyPressure).toBe(65);
  });

  it('should handle missing flow data gracefully (Phase 1 fix)', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
      flow: null, // No flow data
    });

    // Flow should be undefined, not throw errors
    expect(features.flow).toBeUndefined();

    // Other fields should still populate
    expect(features.pattern?.rsi_divergence_5m).toBeDefined();
    expect(features.pattern?.mtf_divergence_aligned).toBeDefined();
  });

  it('should populate volume RVOL correctly', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
    });

    expect(features.volume?.relativeToAvg).toBeDefined();
    expect(typeof features.volume?.relativeToAvg).toBe('number');
  });

  it('should populate market_regime field (Phase 2 - NEW)', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
    });

    // NEW: Market regime detection (requires 30+ bars)
    expect(features.pattern?.market_regime).toBeDefined();
    expect(['trending', 'choppy', 'volatile', 'ranging']).toContain(features.pattern?.market_regime);
  });

  it('should populate vix_level field when provided (Phase 2 - NEW)', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
      vixLevel: 'medium',
    });

    // NEW: VIX level classification
    expect(features.pattern?.vix_level).toBe('medium');
  });

  it('should handle missing vix_level gracefully', () => {
    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: mockBars,
      // vixLevel not provided
    });

    // Should be undefined, not throw errors
    expect(features.pattern?.vix_level).toBeUndefined();

    // Other fields should still populate
    expect(features.pattern?.market_regime).toBeDefined();
    expect(features.pattern?.rsi_divergence_5m).toBeDefined();
  });

  it('should handle insufficient bars for market regime', () => {
    // Only 10 bars (< 30 required for regime)
    const shortBars = mockBars.slice(0, 10);

    const features = buildSymbolFeatures({
      symbol: 'SPY',
      timeISO: '2024-11-20T14:30:00Z',
      primaryTf: '5m',
      mtf: mockMTF,
      bars: shortBars,
    });

    // Should default to 'ranging' when insufficient bars
    expect(features.pattern?.market_regime).toBe('ranging');
  });
});
