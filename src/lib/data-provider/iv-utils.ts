/**
 * Implied Volatility Normalization Utilities
 *
 * Handles conversion between different IV formats:
 * - Massive: Returns IV as decimal (0.35 = 35%)
 * - Tradier: Returns IV as percentage (35 = 35%)
 * - Internal format: Always stored as decimal (0.35)
 *
 * @module data-provider/iv-utils
 */

/**
 * Detect which format an IV value is in
 * @param iv - Raw IV value from API
 * @returns 'decimal' (0.35), 'percent' (35), or 'unknown'
 */
export function detectIVFormat(iv: number | undefined): 'decimal' | 'percent' | 'unknown' {
  if (iv === undefined || iv === null || !Number.isFinite(iv)) {
    return 'unknown';
  }

  // If IV is > 5, it's almost certainly a percentage (>500% volatility is extremely rare)
  if (iv > 5) {
    return 'percent';
  }

  // If IV is < 0.01, it's not realistic even as a decimal (< 1% is extremely rare for equities)
  if (iv < 0.0001) {
    return 'unknown';
  }

  // If IV is between 0.01 and 5, it could be decimal
  // This is the normal range for both formats
  // We need more context to decide - default to decimal as it's our internal format
  return 'decimal';
}

/**
 * Normalize IV to internal decimal format (0.35 = 35%)
 *
 * Automatically detects format and converts if needed.
 * If uncertain, assumes decimal format (internal standard).
 *
 * @param iv - Raw IV value from API
 * @param sourceProvider - Optional: 'massive' (decimal) or 'tradier' (percent) for explicit conversion
 * @returns IV in decimal format (0.35), or 0 if invalid
 */
export function normalizeIV(iv: number | undefined, sourceProvider?: 'massive' | 'tradier'): number {
  // Handle missing/invalid values
  if (iv === undefined || iv === null || !Number.isFinite(iv)) {
    return 0;
  }

  // Explicit format specified
  if (sourceProvider === 'tradier') {
    // Tradier returns as percentage: 35 → 0.35
    return iv > 0 ? iv / 100 : 0;
  }

  if (sourceProvider === 'massive') {
    // Massive returns as decimal: 0.35 → 0.35
    return iv;
  }

  // Auto-detect format
  const format = detectIVFormat(iv);

  if (format === 'percent') {
    // Convert percentage to decimal: 35 → 0.35
    return iv / 100;
  }

  if (format === 'decimal') {
    // Already in decimal format
    return iv;
  }

  // Unknown format, assume decimal (our internal standard)
  return iv;
}

/**
 * Convert IV from decimal format to percentage for display
 *
 * @param iv - IV in decimal format (0.35)
 * @returns IV as percentage (35)
 */
export function ivToPercent(iv: number): number {
  if (!Number.isFinite(iv)) return 0;
  return iv * 100;
}

/**
 * Convert IV from percentage format to decimal
 *
 * @param ivPercent - IV as percentage (35)
 * @returns IV in decimal format (0.35)
 */
export function ivFromPercent(ivPercent: number): number {
  if (!Number.isFinite(ivPercent)) return 0;
  return ivPercent / 100;
}

/**
 * Validate that IV is in a reasonable range
 *
 * @param iv - IV in decimal format (0.35)
 * @returns true if IV is in reasonable range for equities [0.01, 5.0]
 */
export function isReasonableIV(iv: number): boolean {
  // Reasonable range for equity options: 1% to 500% annual volatility
  return Number.isFinite(iv) && iv >= 0.01 && iv <= 5.0;
}

/**
 * Clamp IV to reasonable range
 *
 * @param iv - IV in decimal format (0.35)
 * @returns IV clamped to [0.01, 5.0]
 */
export function clampIV(iv: number): number {
  if (!Number.isFinite(iv)) return 0.20; // Default to 20% if invalid
  return Math.max(0.01, Math.min(5.0, iv));
}

/**
 * Detect IV anomalies that might indicate data errors
 *
 * @param iv - IV in decimal format (0.35)
 * @returns Object with anomaly detection results
 */
export function detectIVAnomalies(iv: number): {
  isAnomaly: boolean;
  reason?: string;
  severity: 'info' | 'warning' | 'error';
} {
  if (!Number.isFinite(iv)) {
    return { isAnomaly: true, reason: 'IV is not a finite number', severity: 'error' };
  }

  if (iv < 0.001) {
    return { isAnomaly: true, reason: 'IV < 0.1% (unrealistically low)', severity: 'error' };
  }

  if (iv > 10) {
    return { isAnomaly: true, reason: 'IV > 1000% (unrealistically high)', severity: 'error' };
  }

  if (iv < 0.01) {
    return { isAnomaly: true, reason: 'IV < 1% (very unusual for equities)', severity: 'warning' };
  }

  if (iv > 5) {
    return { isAnomaly: true, reason: 'IV > 500% (very unusual for equities)', severity: 'warning' };
  }

  return { isAnomaly: false, severity: 'info' };
}

/**
 * Format IV for display in UI
 *
 * @param iv - IV in decimal format (0.35)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "35.0%"
 */
export function formatIVForDisplay(iv: number, decimals: number = 1): string {
  if (!Number.isFinite(iv)) return 'N/A';
  const percent = ivToPercent(iv);
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Calculate IV as percentile (0-100) relative to historical range
 *
 * @param currentIV - Current IV in decimal format
 * @param minIV - Minimum IV from lookback period in decimal format
 * @param maxIV - Maximum IV from lookback period in decimal format
 * @returns Percentile (0-100) where 0 = min, 100 = max
 */
export function calculateIVPercentile(
  currentIV: number,
  minIV: number,
  maxIV: number
): number {
  if (!Number.isFinite(currentIV) || maxIV <= minIV) {
    return 50; // Default to middle if invalid
  }

  const range = maxIV - minIV;
  if (range === 0) return 50;

  const percentile = ((currentIV - minIV) / range) * 100;
  return Math.max(0, Math.min(100, percentile));
}

/**
 * Compare two IV values accounting for typical market moves
 *
 * @param iv1 - First IV in decimal format
 * @param iv2 - Second IV in decimal format
 * @returns Number of percentage points change (e.g., 0.35 to 0.40 = +5 points)
 */
export function calculateIVChange(iv1: number, iv2: number): number {
  if (!Number.isFinite(iv1) || !Number.isFinite(iv2)) return 0;
  return (iv2 - iv1) * 100; // In percentage points
}

/**
 * Detect IV crush (sharp drop in implied volatility)
 *
 * @param previousIV - Previous IV in decimal format
 * @param currentIV - Current IV in decimal format
 * @param thresholdPercent - Consider crush if drop > this % (default: 10%)
 * @returns true if IV crush detected
 */
export function detectIVCrush(
  previousIV: number,
  currentIV: number,
  thresholdPercent: number = 10
): boolean {
  if (!Number.isFinite(previousIV) || !Number.isFinite(currentIV) || previousIV <= 0) {
    return false;
  }

  const dropPercent = ((previousIV - currentIV) / previousIV) * 100;
  return dropPercent > thresholdPercent;
}

/**
 * Detect IV spike (sharp increase in implied volatility)
 *
 * @param previousIV - Previous IV in decimal format
 * @param currentIV - Current IV in decimal format
 * @param thresholdPercent - Consider spike if rise > this % (default: 10%)
 * @returns true if IV spike detected
 */
export function detectIVSpike(
  previousIV: number,
  currentIV: number,
  thresholdPercent: number = 10
): boolean {
  if (!Number.isFinite(previousIV) || !Number.isFinite(currentIV) || previousIV <= 0) {
    return false;
  }

  const risePercent = ((currentIV - previousIV) / previousIV) * 100;
  return risePercent > thresholdPercent;
}
