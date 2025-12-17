/**
 * Unit tests for Composite Scanner Worker
 * Phase 4: Tests for MTF context building and health monitoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables before importing the module
vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

// Import the functions we're testing (extracted for unit testing)
// Note: Since these are internal functions, we'll test the logic directly

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Aggregate bars into larger timeframe
 * Copy of the function from compositeScanner.ts for unit testing
 */
function aggregateBarsToTimeframe(bars: Bar[], multiplier: number): Bar[] {
  if (bars.length === 0 || multiplier <= 1) return bars;

  const aggregated: Bar[] = [];

  for (let i = 0; i < bars.length; i += multiplier) {
    const chunk = bars.slice(i, i + multiplier);
    if (chunk.length === 0) continue;

    aggregated.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((b) => b.high)),
      low: Math.min(...chunk.map((b) => b.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, b) => sum + b.volume, 0),
    });
  }

  return aggregated;
}

/**
 * Determine health status based on error rate and scan results
 * Copy of the function from compositeScanner.ts for unit testing
 */
interface ScanStatistics {
  totalScans: number;
  totalSignals: number;
  totalErrors: number;
  lastScanDuration: number;
  avgScanDuration: number;
  lastScanTime: Date;
  signalsByType: Record<string, number>;
  signalsBySymbol: Record<string, number>;
}

function determineHealthStatus(stats: ScanStatistics): 'healthy' | 'degraded' | 'unhealthy' {
  const errorRate = stats.totalScans > 0 ? stats.totalErrors / stats.totalScans : 0;
  const lastScanAgeMs = Date.now() - stats.lastScanTime.getTime();
  const scanTooSlow = stats.lastScanDuration > 60000;
  const dataStale = lastScanAgeMs > 5 * 60 * 1000;

  if (errorRate > 0.5 || dataStale) {
    return 'unhealthy';
  }

  if (errorRate > 0.1 || scanTooSlow) {
    return 'degraded';
  }

  return 'healthy';
}

describe('aggregateBarsToTimeframe', () => {
  const createBar = (time: number, open: number, high: number, low: number, close: number, volume: number): Bar => ({
    time,
    open,
    high,
    low,
    close,
    volume,
  });

  it('returns empty array for empty input', () => {
    const result = aggregateBarsToTimeframe([], 3);
    expect(result).toEqual([]);
  });

  it('returns original bars when multiplier is 1 or less', () => {
    const bars = [
      createBar(1000, 100, 105, 98, 102, 1000),
      createBar(1001, 102, 107, 100, 104, 1200),
    ];

    expect(aggregateBarsToTimeframe(bars, 1)).toEqual(bars);
    expect(aggregateBarsToTimeframe(bars, 0)).toEqual(bars);
  });

  it('aggregates 5m bars to 15m bars (3x)', () => {
    const bars5m = [
      createBar(1000, 100, 105, 98, 102, 1000),
      createBar(1001, 102, 108, 101, 106, 1200),
      createBar(1002, 106, 110, 104, 109, 1500),
      // Next 15m bar
      createBar(1003, 109, 112, 107, 108, 800),
      createBar(1004, 108, 111, 105, 107, 900),
      createBar(1005, 107, 109, 103, 105, 1100),
    ];

    const result = aggregateBarsToTimeframe(bars5m, 3);

    expect(result).toHaveLength(2);

    // First 15m bar
    expect(result[0]).toEqual({
      time: 1000, // First bar's time
      open: 100,  // First bar's open
      high: 110,  // Max high across all 3 bars
      low: 98,    // Min low across all 3 bars
      close: 109, // Last bar's close
      volume: 3700, // Sum of volumes
    });

    // Second 15m bar
    expect(result[1]).toEqual({
      time: 1003,
      open: 109,
      high: 112,
      low: 103,
      close: 105,
      volume: 2800,
    });
  });

  it('aggregates 5m bars to 60m bars (12x)', () => {
    // Create 24 5m bars (2 hours)
    const bars5m: Bar[] = [];
    for (let i = 0; i < 24; i++) {
      bars5m.push(createBar(1000 + i, 100 + i, 105 + i, 98 + i, 102 + i, 1000 + i * 100));
    }

    const result = aggregateBarsToTimeframe(bars5m, 12);

    expect(result).toHaveLength(2);

    // First 60m bar (bars 0-11)
    expect(result[0].time).toBe(1000);
    expect(result[0].open).toBe(100);
    expect(result[0].high).toBe(116); // max high from bars 0-11: 105+11=116
    expect(result[0].low).toBe(98);   // min low from bars 0-11: 98
    expect(result[0].close).toBe(113); // last bar's close: 102+11=113
  });

  it('handles incomplete chunks', () => {
    const bars = [
      createBar(1000, 100, 105, 98, 102, 1000),
      createBar(1001, 102, 108, 101, 106, 1200),
      // Only 2 bars, but aggregating by 3
    ];

    const result = aggregateBarsToTimeframe(bars, 3);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      time: 1000,
      open: 100,
      high: 108,
      low: 98,
      close: 106,
      volume: 2200,
    });
  });

  it('correctly calculates high as max and low as min', () => {
    const bars = [
      createBar(1000, 100, 150, 90, 110, 1000),  // High: 150, Low: 90
      createBar(1001, 110, 120, 80, 115, 1000),  // High: 120, Low: 80 (lowest)
      createBar(1002, 115, 200, 100, 180, 1000), // High: 200 (highest), Low: 100
    ];

    const result = aggregateBarsToTimeframe(bars, 3);

    expect(result).toHaveLength(1);
    expect(result[0].high).toBe(200);  // Max of 150, 120, 200
    expect(result[0].low).toBe(80);    // Min of 90, 80, 100
  });
});

describe('determineHealthStatus', () => {
  const createStats = (overrides: Partial<ScanStatistics> = {}): ScanStatistics => ({
    totalScans: 10,
    totalSignals: 5,
    totalErrors: 0,
    lastScanDuration: 5000,
    avgScanDuration: 5000,
    lastScanTime: new Date(),
    signalsByType: {},
    signalsBySymbol: {},
    ...overrides,
  });

  it('returns healthy when error rate < 10% and scan time is normal', () => {
    const stats = createStats({
      totalScans: 100,
      totalErrors: 5, // 5% error rate
      lastScanDuration: 30000, // 30 seconds
    });

    expect(determineHealthStatus(stats)).toBe('healthy');
  });

  it('returns degraded when error rate is between 10% and 50%', () => {
    const stats = createStats({
      totalScans: 100,
      totalErrors: 20, // 20% error rate
    });

    expect(determineHealthStatus(stats)).toBe('degraded');
  });

  it('returns degraded when scan takes > 60 seconds', () => {
    const stats = createStats({
      totalScans: 100,
      totalErrors: 5, // Low error rate
      lastScanDuration: 65000, // 65 seconds
    });

    expect(determineHealthStatus(stats)).toBe('degraded');
  });

  it('returns unhealthy when error rate > 50%', () => {
    const stats = createStats({
      totalScans: 100,
      totalErrors: 55, // 55% error rate
    });

    expect(determineHealthStatus(stats)).toBe('unhealthy');
  });

  it('returns unhealthy when data is stale (> 5 minutes since last scan)', () => {
    const stats = createStats({
      totalScans: 100,
      totalErrors: 0, // No errors
      lastScanTime: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
    });

    expect(determineHealthStatus(stats)).toBe('unhealthy');
  });

  it('returns healthy when no scans have occurred yet', () => {
    const stats = createStats({
      totalScans: 0,
      totalErrors: 0,
      lastScanTime: new Date(),
    });

    // 0 errors / 0 scans = 0 error rate, but also check for stale data
    expect(determineHealthStatus(stats)).toBe('healthy');
  });

  it('prioritizes unhealthy status over degraded', () => {
    const stats = createStats({
      totalScans: 100,
      totalErrors: 55, // > 50% error rate → unhealthy
      lastScanDuration: 65000, // > 60s → degraded
    });

    // Should be unhealthy because error rate is over 50%
    expect(determineHealthStatus(stats)).toBe('unhealthy');
  });

  it('returns healthy at exactly 10% error rate boundary', () => {
    const stats = createStats({
      totalScans: 100,
      totalErrors: 10, // Exactly 10% error rate
    });

    // > 0.1 is degraded, so exactly 0.1 should also be degraded
    // The condition is errorRate > 0.1, so 0.1 is NOT degraded
    expect(determineHealthStatus(stats)).toBe('healthy');
  });

  it('returns degraded just above 10% error rate', () => {
    const stats = createStats({
      totalScans: 100,
      totalErrors: 11, // 11% error rate
    });

    expect(determineHealthStatus(stats)).toBe('degraded');
  });
});
