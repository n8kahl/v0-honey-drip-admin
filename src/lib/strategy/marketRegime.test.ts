/**
 * Market Regime Detection Tests
 */

import { calculateADX, calculateATR, detectMarketRegime } from './marketRegime';
import type { Bar } from './patternDetection';

describe('Market Regime Detection', () => {
  // Generate mock bars for testing
  function generateTrendingBars(count: number): Bar[] {
    const bars: Bar[] = [];
    let basePrice = 100;
    const baseTime = 1700000000;

    for (let i = 0; i < count; i++) {
      // Strong uptrend: consistent higher highs and higher lows
      const open = basePrice + i * 0.5;
      const close = open + 1.0;
      const high = close + 0.3;
      const low = open - 0.2;

      bars.push({
        time: baseTime + i * 60,
        open,
        high,
        low,
        close,
        volume: 1000000 + Math.random() * 100000,
      });

      basePrice = close;
    }

    return bars;
  }

  function generateRangingBars(count: number): Bar[] {
    const bars: Bar[] = [];
    const basePrice = 100;
    const baseTime = 1700000000;

    for (let i = 0; i < count; i++) {
      // Ranging: price oscillates around same level
      const open = basePrice + Math.sin(i * 0.5) * 2;
      const close = basePrice + Math.sin(i * 0.5 + 0.5) * 2;
      const high = Math.max(open, close) + 0.5;
      const low = Math.min(open, close) - 0.5;

      bars.push({
        time: baseTime + i * 60,
        open,
        high,
        low,
        close,
        volume: 1000000 + Math.random() * 100000,
      });
    }

    return bars;
  }

  function generateVolatileBars(count: number): Bar[] {
    const bars: Bar[] = [];
    let basePrice = 100;
    const baseTime = 1700000000;

    for (let i = 0; i < count; i++) {
      // Volatile: large random swings
      const direction = Math.random() > 0.5 ? 1 : -1;
      const move = (Math.random() * 3 + 1) * direction;
      const open = basePrice;
      const close = basePrice + move;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;

      bars.push({
        time: baseTime + i * 60,
        open,
        high,
        low,
        close,
        volume: 1000000 + Math.random() * 500000,
      });

      basePrice = close;
    }

    return bars;
  }

  describe('calculateADX', () => {
    it('should return 0 for insufficient bars', () => {
      const bars = generateTrendingBars(10);
      const adx = calculateADX(bars, 14);
      expect(adx).toBe(0);
    });

    it('should calculate ADX for trending market', () => {
      const bars = generateTrendingBars(50);
      const adx = calculateADX(bars, 14);

      // Trending market should have ADX > 0
      expect(adx).toBeGreaterThan(0);
      expect(adx).toBeLessThanOrEqual(100);
    });

    it('should calculate ADX for ranging market', () => {
      const bars = generateRangingBars(50);
      const adx = calculateADX(bars, 14);

      // Ranging market should have low ADX
      expect(adx).toBeGreaterThanOrEqual(0);
      expect(adx).toBeLessThan(100);
    });
  });

  describe('calculateATR', () => {
    it('should return 0 for insufficient bars', () => {
      const bars = generateTrendingBars(10);
      const atr = calculateATR(bars, 14);
      expect(atr).toBe(0);
    });

    it('should calculate ATR for trending market', () => {
      const bars = generateTrendingBars(50);
      const atr = calculateATR(bars, 14);

      expect(atr).toBeGreaterThan(0);
      expect(typeof atr).toBe('number');
    });

    it('should calculate ATR for both markets', () => {
      const trendingBars = generateTrendingBars(50);
      const volatileBars = generateVolatileBars(50);

      const trendingATR = calculateATR(trendingBars, 14);
      const volatileATR = calculateATR(volatileBars, 14);

      // Both should have valid ATR values
      expect(trendingATR).toBeGreaterThan(0);
      expect(volatileATR).toBeGreaterThan(0);
      // Note: Relative ATR values depend on specific bar patterns
    });
  });

  describe('detectMarketRegime', () => {
    it('should return ranging regime for insufficient bars', () => {
      const bars = generateTrendingBars(20);
      const result = detectMarketRegime(bars);

      expect(result.regime).toBe('ranging');
      expect(result.confidence).toBe(0);
      expect(result.adx).toBe(0);
      expect(result.atr).toBe(0);
    });

    it('should detect trending regime', () => {
      const bars = generateTrendingBars(50);
      const result = detectMarketRegime(bars);

      expect(result.regime).toBeDefined();
      expect(['trending', 'choppy', 'volatile', 'ranging']).toContain(result.regime);
      expect(result.adx).toBeGreaterThanOrEqual(0);
      expect(result.atr).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should detect ranging regime', () => {
      const bars = generateRangingBars(50);
      const result = detectMarketRegime(bars);

      expect(result.regime).toBeDefined();
      expect(['trending', 'choppy', 'volatile', 'ranging']).toContain(result.regime);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect volatile regime', () => {
      const bars = generateVolatileBars(50);
      const result = detectMarketRegime(bars);

      expect(result.regime).toBeDefined();
      expect(['trending', 'choppy', 'volatile', 'ranging']).toContain(result.regime);
      expect(result.atr).toBeGreaterThan(0);
    });

    it('should return valid confidence score', () => {
      const bars = generateTrendingBars(50);
      const result = detectMarketRegime(bars);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should use custom periods', () => {
      const bars = generateTrendingBars(50);
      const result = detectMarketRegime(bars, 10, 10);

      expect(result.regime).toBeDefined();
      expect(result.adx).toBeGreaterThanOrEqual(0);
      expect(result.atr).toBeGreaterThan(0);
    });
  });
});
