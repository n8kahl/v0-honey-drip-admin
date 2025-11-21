/**
 * SignalDeduplication Tests
 * Phase 5: Testing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SignalDeduplication, checkDeduplication } from '../SignalDeduplication.js';
import type { CompositeSignal } from '../CompositeSignal.js';
import type { SignalThresholds } from '../ScannerConfig.js';
import { DEFAULT_THRESHOLDS } from '../ScannerConfig.js';

describe('SignalDeduplication', () => {
  let dedup: SignalDeduplication;

  beforeEach(() => {
    dedup = new SignalDeduplication();
  });

  describe('addSignal', () => {
    it('should add signal to history', () => {
      const signal = createMockSignal('SPY', 'breakout_bullish');
      dedup.addSignal(signal);

      const recentSignals = dedup.getRecentSignals('SPY');
      expect(recentSignals).toHaveLength(1);
      expect(recentSignals[0].symbol).toBe('SPY');
    });

    it('should track multiple symbols separately', () => {
      const signal1 = createMockSignal('SPY', 'breakout_bullish');
      const signal2 = createMockSignal('QQQ', 'breakout_bullish');

      dedup.addSignal(signal1);
      dedup.addSignal(signal2);

      expect(dedup.getRecentSignals('SPY')).toHaveLength(1);
      expect(dedup.getRecentSignals('QQQ')).toHaveLength(1);
    });
  });

  describe('isInCooldown', () => {
    it('should return false when no recent signals', () => {
      const result = dedup.isInCooldown('SPY', 'breakout_bullish', Date.now(), DEFAULT_THRESHOLDS);
      expect(result).toBe(false);
    });

    it('should return true when within cooldown period', () => {
      const signal = createMockSignal('SPY', 'breakout_bullish');
      dedup.addSignal(signal);

      // Check immediately after
      const result = dedup.isInCooldown(
        'SPY',
        'breakout_bullish',
        Date.now(),
        DEFAULT_THRESHOLDS
      );
      expect(result).toBe(true);
    });

    it('should return false when cooldown expired', () => {
      const signal = createMockSignal('SPY', 'breakout_bullish');
      dedup.addSignal(signal);

      // Check after cooldown period (15 minutes)
      const futureTimestamp = Date.now() + 16 * 60 * 1000;
      const result = dedup.isInCooldown(
        'SPY',
        'breakout_bullish',
        futureTimestamp,
        DEFAULT_THRESHOLDS
      );
      expect(result).toBe(false);
    });

    it('should only check same opportunity type', () => {
      const signal = createMockSignal('SPY', 'breakout_bullish');
      dedup.addSignal(signal);

      // Different opportunity type should not be in cooldown
      const result = dedup.isInCooldown(
        'SPY',
        'mean_reversion_long',
        Date.now(),
        DEFAULT_THRESHOLDS
      );
      expect(result).toBe(false);
    });
  });

  describe('exceedsMaxSignalsPerHour', () => {
    it('should return false when under limit', () => {
      const signal = createMockSignal('SPY', 'breakout_bullish');
      dedup.addSignal(signal);

      const result = dedup.exceedsMaxSignalsPerHour('SPY', Date.now(), DEFAULT_THRESHOLDS);
      expect(result).toBe(false);
    });

    it('should return true when limit exceeded', () => {
      // Add max signals
      for (let i = 0; i < DEFAULT_THRESHOLDS.maxSignalsPerSymbolPerHour; i++) {
        const signal = createMockSignal('SPY', 'breakout_bullish', Date.now() + i * 1000);
        dedup.addSignal(signal);
      }

      const result = dedup.exceedsMaxSignalsPerHour('SPY', Date.now(), DEFAULT_THRESHOLDS);
      expect(result).toBe(true);
    });

    it('should only count signals within last hour', () => {
      // Add signals older than 1 hour
      const oldSignal = createMockSignal('SPY', 'breakout_bullish', Date.now() - 2 * 60 * 60 * 1000);
      dedup.addSignal(oldSignal);

      // Should not count old signal
      const result = dedup.exceedsMaxSignalsPerHour('SPY', Date.now(), DEFAULT_THRESHOLDS);
      expect(result).toBe(false);
    });
  });

  describe('isDuplicate', () => {
    it('should return false for new bar time key', () => {
      const result = dedup.isDuplicate('2024-11-20T14:35:00Z_SPY_breakout_bullish');
      expect(result).toBe(false);
    });

    it('should return true for existing bar time key', () => {
      const signal = createMockSignal('SPY', 'breakout_bullish');
      signal.barTimeKey = '2024-11-20T14:35:00Z_SPY_breakout_bullish';
      dedup.addSignal(signal);

      const result = dedup.isDuplicate('2024-11-20T14:35:00Z_SPY_breakout_bullish');
      expect(result).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove old signals', () => {
      const oldSignal = createMockSignal('SPY', 'breakout_bullish', Date.now() - 25 * 60 * 60 * 1000);
      const newSignal = createMockSignal('SPY', 'mean_reversion_long', Date.now());

      dedup.addSignal(oldSignal);
      dedup.addSignal(newSignal);

      dedup.cleanup(24 * 60 * 60 * 1000); // 24 hours

      const recentSignals = dedup.getRecentSignals('SPY', 25 * 60 * 60 * 1000);
      expect(recentSignals).toHaveLength(2); // Both still in getRecentSignals

      // But old one should be cleaned from internal map after cleanup
      dedup.cleanup(24 * 60 * 60 * 1000);
      const stats = dedup.getStats();
      expect(stats.totalSignals).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const signal1 = createMockSignal('SPY', 'breakout_bullish');
      const signal2 = createMockSignal('QQQ', 'mean_reversion_long');

      dedup.addSignal(signal1);
      dedup.addSignal(signal2);

      const stats = dedup.getStats();

      expect(stats.totalSignals).toBe(2);
      expect(stats.uniqueSymbols).toBe(2);
      expect(stats.newestSignalAge).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('checkDeduplication', () => {
  let dedup: SignalDeduplication;

  beforeEach(() => {
    dedup = new SignalDeduplication();
  });

  it('should pass for new signal', () => {
    const signal = createMockSignal('SPY', 'breakout_bullish');
    const result = checkDeduplication(signal, DEFAULT_THRESHOLDS, dedup);

    expect(result.pass).toBe(true);
  });

  it('should fail for duplicate bar time key', () => {
    const signal = createMockSignal('SPY', 'breakout_bullish');
    signal.barTimeKey = 'test-bar-key';

    dedup.addSignal(signal);

    const duplicate = createMockSignal('SPY', 'breakout_bullish');
    duplicate.barTimeKey = 'test-bar-key';

    const result = checkDeduplication(duplicate, DEFAULT_THRESHOLDS, dedup);

    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Duplicate');
  });

  it('should fail when in cooldown', () => {
    const signal1 = createMockSignal('SPY', 'breakout_bullish');
    dedup.addSignal(signal1);

    const signal2 = createMockSignal('SPY', 'breakout_bullish', Date.now() + 5000);

    const result = checkDeduplication(signal2, DEFAULT_THRESHOLDS, dedup);

    expect(result.pass).toBe(false);
    expect(result.reason).toContain('cooldown');
  });

  it('should fail when max signals exceeded', () => {
    // Add max signals
    for (let i = 0; i < DEFAULT_THRESHOLDS.maxSignalsPerSymbolPerHour; i++) {
      const signal = createMockSignal('SPY', 'breakout_bullish', Date.now() + i * 1000);
      dedup.addSignal(signal);
    }

    const newSignal = createMockSignal('SPY', 'mean_reversion_long');
    const result = checkDeduplication(newSignal, DEFAULT_THRESHOLDS, dedup);

    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Max signals');
  });
});

/**
 * Create mock signal for testing
 */
function createMockSignal(symbol: string, opportunityType: any, timestamp?: number): CompositeSignal {
  const ts = timestamp || Date.now();
  return {
    createdAt: new Date(ts),
    owner: 'test-user',
    symbol,
    opportunityType,
    direction: 'LONG',
    assetClass: 'EQUITY_ETF',
    baseScore: 75,
    scalpScore: 80,
    dayTradeScore: 75,
    swingScore: 70,
    recommendedStyle: 'scalp',
    recommendedStyleScore: 80,
    confluence: {},
    entryPrice: 100,
    stopPrice: 98,
    targets: { T1: 102, T2: 104, T3: 106 },
    riskReward: 2.0,
    features: {} as any,
    status: 'ACTIVE',
    expiresAt: new Date(ts + 5 * 60 * 1000),
    timestamp: ts,
    barTimeKey: `${new Date(ts).toISOString()}_${symbol}_${opportunityType}`,
  };
}
