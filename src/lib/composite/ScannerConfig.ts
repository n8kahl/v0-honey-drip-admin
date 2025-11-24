/**
 * Scanner Configuration
 * Phase 5: Threshold Management
 *
 * Configurable thresholds and filters for signal generation
 */

import type { AssetClass, OpportunityType } from './OpportunityDetector.js';

/**
 * Signal generation thresholds
 */
export interface SignalThresholds {
  minBaseScore: number; // Minimum base score to generate signal (0-100)
  minStyleScore: number; // Minimum style score to generate signal (0-100)
  minRiskReward: number; // Minimum risk/reward ratio (e.g., 1.5 = 1.5:1)
  maxSignalsPerSymbolPerHour: number; // Max signals per symbol per hour
  cooldownMinutes: number; // Cooldown between signals for same symbol

  // Weekend/Evening overrides (optional)
  // VWAP and volume data unavailable on weekends, so scores are lower
  weekendMinBaseScore?: number; // Lower threshold for weekend analysis
  weekendMinStyleScore?: number; // Lower threshold for weekend analysis
}

/**
 * Universal pre-filters (applies before detection)
 */
export interface UniversalFilters {
  marketHoursOnly: boolean; // Only generate signals during market hours
  minRVOL: number; // Minimum relative volume (e.g., 0.8 = 80% of average)
  maxSpread: number; // Maximum bid-ask spread as % (e.g., 0.005 = 0.5%)
  blacklist: string[]; // Symbols to exclude
  requireMinimumLiquidity: boolean; // Require minimum liquidity
  minAvgVolume: number; // Minimum average daily volume
}

/**
 * Complete scanner configuration
 */
export interface ScannerConfig {
  // Thresholds
  defaultThresholds: SignalThresholds;
  assetClassThresholds: Partial<Record<AssetClass, SignalThresholds>>; // Override per asset class
  opportunityTypeThresholds: Partial<Record<OpportunityType, Partial<SignalThresholds>>>; // Override per type

  // Filters
  filters: UniversalFilters;

  // Options
  enableOptionsDataFetch: boolean; // Fetch options data for SPX/NDX
  detectorVersion: string; // Version string for tracking
  maxConcurrentScans: number; // Max concurrent symbol scans
}

/**
 * Default thresholds for all signals
 */
export const DEFAULT_THRESHOLDS: SignalThresholds = {
  minBaseScore: 70, // Only high-quality setups
  minStyleScore: 75, // Must be well-suited to style
  minRiskReward: 1.5, // Minimum 1.5:1 R:R
  maxSignalsPerSymbolPerHour: 2, // Avoid over-trading
  cooldownMinutes: 15, // 15-minute cooldown between signals
};

/**
 * SPX/NDX-specific thresholds (higher bar for indices)
 */
export const SPX_NDX_THRESHOLDS: SignalThresholds = {
  minBaseScore: 75, // Higher bar for indices (more selective)
  minStyleScore: 80,
  minRiskReward: 1.8, // Better R:R required
  maxSignalsPerSymbolPerHour: 3, // Can handle more signals (higher volume)
  cooldownMinutes: 10, // Shorter cooldown (faster-moving)
};

/**
 * Default universal filters
 */
export const DEFAULT_FILTERS: UniversalFilters = {
  marketHoursOnly: true, // Only scan during market hours (9:30-4:00 PM ET)
  minRVOL: 0.8, // At least 80% of average volume
  maxSpread: 0.005, // Max 0.5% spread for indices, 1% for stocks
  blacklist: [], // No blacklist by default
  requireMinimumLiquidity: true,
  minAvgVolume: 100000, // Minimum 100k avg daily volume
};

/**
 * Default scanner configuration
 */
export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  defaultThresholds: DEFAULT_THRESHOLDS,
  assetClassThresholds: {
    INDEX: SPX_NDX_THRESHOLDS, // SPX/NDX use stricter thresholds
  },
  opportunityTypeThresholds: {
    // Gamma strategies require higher scores
    gamma_squeeze_bullish: {
      minBaseScore: 75,
      minStyleScore: 80,
    },
    gamma_squeeze_bearish: {
      minBaseScore: 75,
      minStyleScore: 80,
    },
    gamma_flip_bullish: {
      minBaseScore: 80,
      minRiskReward: 2.0,
    },
    gamma_flip_bearish: {
      minBaseScore: 80,
      minRiskReward: 2.0,
    },
    eod_pin_setup: {
      minBaseScore: 80,
      minRiskReward: 2.0,
    },
  },
  filters: DEFAULT_FILTERS,
  enableOptionsDataFetch: true,
  detectorVersion: '1.0.0',
  maxConcurrentScans: 10,
};

/**
 * Get thresholds for a specific signal
 *
 * @param config - Scanner configuration
 * @param assetClass - Asset class
 * @param opportunityType - Opportunity type
 * @returns Merged thresholds
 */
export function getThresholdsForSignal(
  config: ScannerConfig,
  assetClass: AssetClass,
  opportunityType: OpportunityType
): SignalThresholds {
  // Start with defaults
  let thresholds = { ...config.defaultThresholds };

  // Apply asset class overrides
  if (config.assetClassThresholds[assetClass]) {
    thresholds = { ...thresholds, ...config.assetClassThresholds[assetClass] };
  }

  // Apply opportunity type overrides
  if (config.opportunityTypeThresholds[opportunityType]) {
    thresholds = { ...thresholds, ...config.opportunityTypeThresholds[opportunityType] };
  }

  return thresholds;
}

/**
 * Check if symbol passes universal filters
 *
 * @param symbol - Symbol
 * @param features - Symbol features
 * @param filters - Universal filters
 * @returns True if passes all filters
 */
export function passesUniversalFilters(
  symbol: string,
  features: any, // SymbolFeatures
  filters: UniversalFilters
): boolean {
  // Blacklist check
  if (filters.blacklist.includes(symbol)) {
    return false;
  }

  // Market hours check
  if (filters.marketHoursOnly) {
    const minutesSinceOpen = features.session?.minutesSinceOpen || 0;
    if (minutesSinceOpen < 0 || minutesSinceOpen >= 390) {
      // Before 9:30 AM or after 4:00 PM
      return false;
    }
  }

  // RVOL check
  const rvol = features.volume?.relativeToAvg || 0;
  if (rvol < filters.minRVOL) {
    return false;
  }

  // Spread check (if available)
  if (features.spread?.spreadPct !== undefined) {
    if (features.spread.spreadPct > filters.maxSpread) {
      return false;
    }
  }

  // Liquidity check
  if (filters.requireMinimumLiquidity) {
    const avgVolume = features.volume?.avgVolume || 0;
    if (avgVolume < filters.minAvgVolume) {
      return false;
    }
  }

  return true;
}

/**
 * Check if market is currently open
 *
 * @param date - Date to check (defaults to now)
 * @returns True if market is open
 */
export function isMarketOpen(date: Date = new Date()): boolean {
  const day = date.getDay();
  const hour = date.getHours();
  const minute = date.getMinutes();

  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }

  // Market hours: 9:30 AM - 4:00 PM ET
  const totalMinutes = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  return totalMinutes >= marketOpen && totalMinutes < marketClose;
}

/**
 * Create custom scanner config with overrides
 *
 * @param overrides - Partial config to override defaults
 * @returns Complete scanner config
 */
export function createScannerConfig(overrides: Partial<ScannerConfig> = {}): ScannerConfig {
  return {
    ...DEFAULT_SCANNER_CONFIG,
    ...overrides,
    filters: {
      ...DEFAULT_SCANNER_CONFIG.filters,
      ...(overrides.filters || {}),
    },
    defaultThresholds: {
      ...DEFAULT_SCANNER_CONFIG.defaultThresholds,
      ...(overrides.defaultThresholds || {}),
    },
  };
}
