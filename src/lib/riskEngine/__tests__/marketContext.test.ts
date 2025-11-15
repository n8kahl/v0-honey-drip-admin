import {
  getMarketStatus,
  calculatePremarketLevels,
  calculateORB,
  calculatePriorPeriodHL,
  calculateVWAPWithBands,
  calculateBollingerBands,
} from '../marketContext';
import { Bar } from '../types';

describe('getMarketStatus', () => {
  it('should detect market open during regular hours', () => {
    const marketOpen = new Date('2024-01-15T10:30:00'); // Monday 10:30 AM
    const result = getMarketStatus(marketOpen);
    expect(result.status).toBe('open');
  });

  it('should detect pre-market', () => {
    const preMarket = new Date('2024-01-15T08:00:00'); // Monday 8:00 AM
    const result = getMarketStatus(preMarket);
    expect(result.status).toBe('pre');
  });

  it('should detect post-market', () => {
    const postMarket = new Date('2024-01-15T17:00:00'); // Monday 5:00 PM
    const result = getMarketStatus(postMarket);
    expect(result.status).toBe('post');
  });

  it('should detect market closed on weekends', () => {
    const saturday = new Date('2024-01-13T10:30:00'); // Saturday
    const result = getMarketStatus(saturday);
    expect(result.status).toBe('closed');
  });
});

describe('calculatePremarketLevels', () => {
  it('should calculate high and low from bars', () => {
    const bars: Bar[] = [
      { timestamp: 1, open: 100, high: 105, low: 98, close: 102, volume: 1000 },
      { timestamp: 2, open: 102, high: 107, low: 101, close: 106, volume: 1200 },
      { timestamp: 3, open: 106, high: 108, low: 104, close: 105, volume: 1100 },
    ];
    const result = calculatePremarketLevels(bars);
    expect(result.high).toBe(108);
    expect(result.low).toBe(98);
  });
});

describe('calculateORB', () => {
  it('should calculate ORB from first N minutes', () => {
    const bars: Bar[] = Array.from({ length: 30 }, (_, i) => ({
      timestamp: i,
      open: 100 + i,
      high: 100 + i + 2,
      low: 100 + i - 1,
      close: 100 + i + 1,
      volume: 1000,
    }));
    const result = calculateORB(bars, 15);
    // First 15 bars: high should be from bar 14 (116), low from bar 0 (99)
    expect(result.high).toBe(116); // 100 + 14 + 2
    expect(result.low).toBe(99);   // 100 + 0 - 1
  });
});

describe('calculateVWAPWithBands', () => {
  it('should calculate VWAP and bands', () => {
    const bars: Bar[] = [
      { timestamp: 1, open: 100, high: 105, low: 98, close: 102, volume: 1000 },
      { timestamp: 2, open: 102, high: 107, low: 101, close: 106, volume: 1200 },
      { timestamp: 3, open: 106, high: 108, low: 104, close: 105, volume: 1100 },
    ];
    const result = calculateVWAPWithBands(bars);
    expect(result.vwap).toBeGreaterThan(0);
    expect(result.upperBand).toBeGreaterThan(result.vwap);
    expect(result.lowerBand).toBeLessThan(result.vwap);
    expect(result.stdDev).toBeGreaterThan(0);
  });
});

describe('calculateBollingerBands', () => {
  it('should calculate Bollinger Bands', () => {
    const bars: Bar[] = Array.from({ length: 25 }, (_, i) => ({
      timestamp: i,
      open: 100 + i,
      high: 100 + i + 2,
      low: 100 + i - 1,
      close: 100 + i + 1,
      volume: 1000,
    }));
    const result = calculateBollingerBands(bars, 20, 2);
    expect(result.middle).toBeGreaterThan(0);
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.lower).toBeLessThan(result.middle);
  });
});
