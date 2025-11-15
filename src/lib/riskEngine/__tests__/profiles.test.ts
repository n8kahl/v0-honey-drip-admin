import { inferTradeTypeByDTE, DEFAULT_DTE_THRESHOLDS } from '../profiles';

describe('inferTradeTypeByDTE', () => {
  const now = new Date('2024-01-15T10:00:00Z');

  it('should classify 0 DTE as SCALP', () => {
    const expiration = new Date('2024-01-15T21:00:00Z'); // Same day, 11 hours away
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('SCALP');
  });

  it('should classify 1 DTE as SCALP', () => {
    const expiration = new Date('2024-01-16T21:00:00Z'); // Next day
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('SCALP');
  });

  it('should classify 2 DTE as SCALP', () => {
    const expiration = new Date('2024-01-17T21:00:00Z'); // 2 days away
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('SCALP');
  });

  it('should classify 3 DTE as DAY', () => {
    const expiration = new Date('2024-01-18T21:00:00Z'); // 3 days away
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('DAY');
  });

  it('should classify 14 DTE as DAY', () => {
    const expiration = new Date('2024-01-29T21:00:00Z'); // 14 days away
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('DAY');
  });

  it('should classify 15 DTE as SWING', () => {
    const expiration = new Date('2024-01-30T21:00:00Z'); // 15 days away
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('SWING');
  });

  it('should classify 60 DTE as SWING', () => {
    const expiration = new Date('2024-03-15T21:00:00Z'); // ~60 days away
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('SWING');
  });

  it('should classify 61 DTE as LEAP', () => {
    const expiration = new Date('2024-03-16T21:00:00Z'); // ~61 days away
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('LEAP');
  });

  it('should classify 365 DTE as LEAP', () => {
    const expiration = new Date('2025-01-15T21:00:00Z'); // 1 year away
    const result = inferTradeTypeByDTE(expiration.toISOString(), now);
    expect(result).toBe('LEAP');
  });

  it('should use custom thresholds', () => {
    const expiration = new Date('2024-01-20T21:00:00Z'); // 5 days away
    const customThresholds = { scalp: 5, day: 20, swing: 90 };
    const result = inferTradeTypeByDTE(expiration.toISOString(), now, customThresholds);
    expect(result).toBe('SCALP'); // With custom threshold, 5 DTE is still SCALP
  });
});
