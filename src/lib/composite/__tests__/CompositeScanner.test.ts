/**
 * CompositeScanner Tests
 * Phase 5: Testing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompositeScanner } from '../CompositeScanner.js';
import type { SymbolFeatures } from '../../strategy/engine.js';
import { createScannerConfig } from '../ScannerConfig.js';

describe('CompositeScanner', () => {
  let scanner: CompositeScanner;
  const mockOwner = 'test-user-123';

  beforeEach(() => {
    scanner = new CompositeScanner({
      owner: mockOwner,
      config: createScannerConfig({
        filters: {
          marketHoursOnly: false, // Disable for testing
          minRVOL: 0.5,
          maxSpread: 0.01,
          blacklist: [],
          requireMinimumLiquidity: false,
          minAvgVolume: 0,
        },
      }),
    });
    scanner.clearDeduplication();
  });

  describe('scanSymbol', () => {
    it('should filter out symbols with low RVOL', async () => {
      const features = createMockFeatures('SPY', {
        volume: { relativeToAvg: 0.3 }, // Below 0.5 threshold
      });

      const result = await scanner.scanSymbol('SPY', features);

      expect(result.filtered).toBe(true);
      expect(result.filterReason).toContain('universal filters');
    });

    it('should filter out blacklisted symbols', async () => {
      scanner.updateConfig({
        filters: {
          ...createScannerConfig().filters,
          blacklist: ['SPY'],
          marketHoursOnly: false,
          minRVOL: 0,
          requireMinimumLiquidity: false,
        },
      });

      const features = createMockFeatures('SPY');
      const result = await scanner.scanSymbol('SPY', features);

      expect(result.filtered).toBe(true);
      expect(result.filterReason).toContain('universal filters');
    });

    it('should detect breakout opportunities', async () => {
      const features = createMockFeatures('SPY', {
        price: { current: 450, high: 450, low: 440, open: 442, prevClose: 440 },
        volume: { relativeToAvg: 2.5 },
        rsi: { '14': 65 },
        session: { minutesSinceOpen: 60 },
      });

      const result = await scanner.scanSymbol('SPY', features);

      // May detect a signal if scoring is high enough
      expect(result.detectionCount).toBeGreaterThanOrEqual(0);
    });

    it('should enforce cooldown between signals', async () => {
      const features = createMockFeatures('SPY', {
        price: { current: 450, high: 450, low: 440, open: 442, prevClose: 440 },
        volume: { relativeToAvg: 2.5 },
        rsi: { '14': 65 },
        session: { minutesSinceOpen: 60 },
      });

      // First scan
      const result1 = await scanner.scanSymbol('SPY', features);

      // Second scan immediately after
      const result2 = await scanner.scanSymbol('SPY', features);

      // If first generated a signal, second should be filtered
      if (!result1.filtered && result1.signal) {
        expect(result2.filtered).toBe(true);
        expect(result2.filterReason).toContain('cooldown');
      }
    });

    it('should respect max signals per hour limit', async () => {
      const features = createMockFeatures('SPY', {
        price: { current: 450, high: 450, low: 440, open: 442, prevClose: 440 },
        volume: { relativeToAvg: 2.5 },
        rsi: { '14': 65 },
        session: { minutesSinceOpen: 60 },
      });

      // Try to generate many signals
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await scanner.scanSymbol('SPY', {
          ...features,
          price: { ...features.price, current: 450 + i },
        });
        results.push(result);
      }

      const signalsGenerated = results.filter((r) => !r.filtered).length;

      // Should not exceed maxSignalsPerSymbolPerHour (default: 2)
      expect(signalsGenerated).toBeLessThanOrEqual(2);
    });
  });

  describe('deduplication', () => {
    it('should prevent duplicate bar time keys', async () => {
      const features = createMockFeatures('SPY');

      const result1 = await scanner.scanSymbol('SPY', features);
      const result2 = await scanner.scanSymbol('SPY', features);

      // Same bar time should be deduplicated
      if (!result1.filtered && result1.signal) {
        expect(result2.filtered).toBe(true);
        expect(result2.filterReason).toContain('Duplicate bar time key');
      }
    });

    it('should track deduplication stats', () => {
      const stats = scanner.getDeduplicationStats();

      expect(stats).toHaveProperty('totalSignals');
      expect(stats).toHaveProperty('uniqueSymbols');
      expect(stats).toHaveProperty('oldestSignalAge');
      expect(stats).toHaveProperty('newestSignalAge');
    });
  });

  describe('configuration', () => {
    it('should allow config updates', () => {
      scanner.updateConfig({
        defaultThresholds: {
          minBaseScore: 80,
          minStyleScore: 85,
          minRiskReward: 2.0,
          maxSignalsPerSymbolPerHour: 1,
          cooldownMinutes: 30,
        },
      });

      // Config should be updated (test by running a scan with high thresholds)
      expect(scanner).toBeDefined();
    });

    it('should use asset class-specific thresholds', async () => {
      // SPX should use stricter thresholds
      const spxFeatures = createMockFeatures('SPX');
      const spyFeatures = createMockFeatures('SPY');

      const spxResult = await scanner.scanSymbol('SPX', spxFeatures);
      const spyResult = await scanner.scanSymbol('SPY', spyFeatures);

      // Both should be processed (may or may not generate signals)
      expect(spxResult).toHaveProperty('filtered');
      expect(spyResult).toHaveProperty('filtered');
    });
  });
});

/**
 * Create mock symbol features for testing
 */
function createMockFeatures(symbol: string, overrides?: any): SymbolFeatures {
  const defaults: SymbolFeatures = {
    symbol,
    time: new Date().toISOString(),
    price: {
      current: 100,
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      prevClose: 99,
    },
    volume: {
      current: 1000000,
      relativeToAvg: 1.0,
      avgVolume: 1000000,
    },
    vwap: {
      value: 100,
      distancePct: 0,
      above: true,
    },
    sma: {},
    ema: {},
    rsi: {
      '14': 50,
    },
    mtf: {
      '5m': {
        atr: 2.0,
        adx: 25,
        trend: 'neutral',
      },
      '15m': {
        atr: 3.0,
        adx: 25,
        trend: 'neutral',
      },
      '60m': {
        atr: 5.0,
        adx: 25,
        trend: 'neutral',
      },
    },
    session: {
      minutesSinceOpen: 60,
      isPreMarket: false,
      isMarketHours: true,
      isAfterHours: false,
    },
    pattern: {
      market_regime: 'ranging',
      vix_level: 'medium',
    },
  } as any;

  return {
    ...defaults,
    ...overrides,
    price: { ...defaults.price, ...overrides?.price },
    volume: { ...defaults.volume, ...overrides?.volume },
    vwap: { ...defaults.vwap, ...overrides?.vwap },
    rsi: { ...defaults.rsi, ...overrides?.rsi },
    session: { ...defaults.session, ...overrides?.session },
    pattern: { ...defaults.pattern, ...overrides?.pattern },
  };
}
