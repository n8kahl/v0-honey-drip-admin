/**
 * Signal Deduplication
 * Phase 5: Cooldown Tracking
 *
 * Prevents duplicate signals and enforces cooldown periods
 */

import type { CompositeSignal } from './CompositeSignal.js';
import type { OpportunityType } from './OpportunityDetector.js';
import type { SignalThresholds } from './ScannerConfig.js';

/**
 * Recent signal record for cooldown tracking
 */
export interface RecentSignalRecord {
  symbol: string;
  opportunityType: OpportunityType;
  timestamp: number; // Unix timestamp
  barTimeKey: string;
}

/**
 * Signal deduplication manager
 */
export class SignalDeduplication {
  private recentSignals: Map<string, RecentSignalRecord[]> = new Map();
  private readonly maxHistorySize = 1000; // Max signals to keep in memory
  private readonly cleanupIntervalMs = 60000; // Cleanup every minute

  constructor() {
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Add a signal to recent history
   *
   * @param signal - Signal to add
   */
  addSignal(signal: CompositeSignal): void {
    const record: RecentSignalRecord = {
      symbol: signal.symbol,
      opportunityType: signal.opportunityType,
      timestamp: signal.timestamp,
      barTimeKey: signal.barTimeKey || '',
    };

    // Get or create array for this symbol
    let symbolSignals = this.recentSignals.get(signal.symbol);
    if (!symbolSignals) {
      symbolSignals = [];
      this.recentSignals.set(signal.symbol, symbolSignals);
    }

    // Add new signal
    symbolSignals.push(record);

    // Trim if too large
    if (symbolSignals.length > 100) {
      symbolSignals.shift(); // Remove oldest
    }
  }

  /**
   * Check if signal should be filtered due to cooldown
   *
   * @param symbol - Symbol
   * @param opportunityType - Opportunity type
   * @param currentTimestamp - Current timestamp
   * @param thresholds - Signal thresholds
   * @returns True if signal should be filtered (in cooldown)
   */
  isInCooldown(
    symbol: string,
    opportunityType: OpportunityType,
    currentTimestamp: number,
    thresholds: SignalThresholds
  ): boolean {
    const symbolSignals = this.recentSignals.get(symbol);
    if (!symbolSignals || symbolSignals.length === 0) {
      return false; // No recent signals
    }

    // Find most recent signal for this symbol+type
    const lastSignal = symbolSignals
      .filter((s) => s.opportunityType === opportunityType)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (!lastSignal) {
      return false; // No signals of this type
    }

    // Check cooldown
    const timeSinceLastSignal = (currentTimestamp - lastSignal.timestamp) / 1000 / 60; // minutes
    return timeSinceLastSignal < thresholds.cooldownMinutes;
  }

  /**
   * Check if max signals per hour exceeded
   *
   * @param symbol - Symbol
   * @param currentTimestamp - Current timestamp
   * @param thresholds - Signal thresholds
   * @returns True if max signals exceeded
   */
  exceedsMaxSignalsPerHour(
    symbol: string,
    currentTimestamp: number,
    thresholds: SignalThresholds
  ): boolean {
    const symbolSignals = this.recentSignals.get(symbol);
    if (!symbolSignals || symbolSignals.length === 0) {
      return false;
    }

    // Count signals in last hour
    const oneHourAgo = currentTimestamp - 60 * 60 * 1000;
    const signalsInLastHour = symbolSignals.filter((s) => s.timestamp >= oneHourAgo).length;

    return signalsInLastHour >= thresholds.maxSignalsPerSymbolPerHour;
  }

  /**
   * Check if bar time key already exists (duplicate signal)
   *
   * @param barTimeKey - Bar time key to check
   * @returns True if duplicate
   */
  isDuplicate(barTimeKey: string): boolean {
    for (const symbolSignals of this.recentSignals.values()) {
      if (symbolSignals.some((s) => s.barTimeKey === barTimeKey)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get recent signals for a symbol
   *
   * @param symbol - Symbol
   * @param maxAge - Max age in milliseconds (default: 1 hour)
   * @returns Recent signals
   */
  getRecentSignals(symbol: string, maxAge: number = 60 * 60 * 1000): RecentSignalRecord[] {
    const symbolSignals = this.recentSignals.get(symbol);
    if (!symbolSignals) {
      return [];
    }

    const cutoff = Date.now() - maxAge;
    return symbolSignals.filter((s) => s.timestamp >= cutoff);
  }

  /**
   * Get all recent signals across all symbols
   *
   * @param maxAge - Max age in milliseconds (default: 1 hour)
   * @returns Recent signals
   */
  getAllRecentSignals(maxAge: number = 60 * 60 * 1000): RecentSignalRecord[] {
    const cutoff = Date.now() - maxAge;
    const allSignals: RecentSignalRecord[] = [];

    for (const symbolSignals of this.recentSignals.values()) {
      allSignals.push(...symbolSignals.filter((s) => s.timestamp >= cutoff));
    }

    return allSignals.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear all recent signals (for testing)
   */
  clear(): void {
    this.recentSignals.clear();
  }

  /**
   * Clear signals for a specific symbol
   *
   * @param symbol - Symbol to clear
   */
  clearSymbol(symbol: string): void {
    this.recentSignals.delete(symbol);
  }

  /**
   * Clean up old signals
   *
   * @param maxAge - Max age in milliseconds (default: 24 hours)
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;

    for (const [symbol, signals] of this.recentSignals.entries()) {
      const filtered = signals.filter((s) => s.timestamp >= cutoff);

      if (filtered.length === 0) {
        this.recentSignals.delete(symbol);
      } else {
        this.recentSignals.set(symbol, filtered);
      }
    }

    // Trim total size if too large
    const totalSignals = Array.from(this.recentSignals.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    if (totalSignals > this.maxHistorySize) {
      // Remove oldest signals
      const allSignals: Array<{ symbol: string; signal: RecentSignalRecord }> = [];

      for (const [symbol, signals] of this.recentSignals.entries()) {
        for (const signal of signals) {
          allSignals.push({ symbol, signal });
        }
      }

      // Sort by timestamp (oldest first)
      allSignals.sort((a, b) => a.signal.timestamp - b.signal.timestamp);

      // Remove oldest until under limit
      const toRemove = totalSignals - this.maxHistorySize;
      const removed = allSignals.slice(0, toRemove);

      for (const { symbol, signal } of removed) {
        const symbolSignals = this.recentSignals.get(symbol);
        if (symbolSignals) {
          const index = symbolSignals.findIndex((s) => s.barTimeKey === signal.barTimeKey);
          if (index !== -1) {
            symbolSignals.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Get statistics
   *
   * @returns Deduplication statistics
   */
  getStats(): {
    totalSignals: number;
    uniqueSymbols: number;
    oldestSignalAge: number;
    newestSignalAge: number;
  } {
    let totalSignals = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const signals of this.recentSignals.values()) {
      totalSignals += signals.length;

      for (const signal of signals) {
        oldestTimestamp = Math.min(oldestTimestamp, signal.timestamp);
        newestTimestamp = Math.max(newestTimestamp, signal.timestamp);
      }
    }

    const now = Date.now();

    return {
      totalSignals,
      uniqueSymbols: this.recentSignals.size,
      oldestSignalAge: oldestTimestamp === Infinity ? 0 : now - oldestTimestamp,
      newestSignalAge: newestTimestamp === 0 ? 0 : now - newestTimestamp,
    };
  }
}

/**
 * Check if signal meets all deduplication criteria
 *
 * @param signal - Proposed signal
 * @param thresholds - Signal thresholds
 * @param deduplication - Deduplication manager
 * @returns Object with pass/fail and reason
 */
export function checkDeduplication(
  signal: CompositeSignal,
  thresholds: SignalThresholds,
  deduplication: SignalDeduplication
): { pass: boolean; reason?: string } {
  // Check if duplicate bar time key
  if (signal.barTimeKey && deduplication.isDuplicate(signal.barTimeKey)) {
    return { pass: false, reason: 'Duplicate bar time key' };
  }

  // Check cooldown
  if (
    deduplication.isInCooldown(
      signal.symbol,
      signal.opportunityType,
      signal.timestamp,
      thresholds
    )
  ) {
    return {
      pass: false,
      reason: `In cooldown (${thresholds.cooldownMinutes} minutes)`,
    };
  }

  // Check max signals per hour
  if (deduplication.exceedsMaxSignalsPerHour(signal.symbol, signal.timestamp, thresholds)) {
    return {
      pass: false,
      reason: `Max signals per hour exceeded (${thresholds.maxSignalsPerSymbolPerHour})`,
    };
  }

  return { pass: true };
}
