/**
 * Detector Utilities
 * Shared helper functions for all detectors
 */

import type { SymbolFeatures } from "../../strategy/engine.js";

/**
 * Check if we should allow signals outside regular market hours
 *
 * Returns true if:
 * 1. ALLOW_WEEKEND_SIGNALS environment variable is set to 'true', OR
 * 2. We're analyzing historical data (features has timestamp but not in regular hours)
 *
 * This enables weekend/evening analysis while maintaining market hours filtering
 * during live trading.
 */
export function shouldAllowNonRegularHours(features: SymbolFeatures): boolean {
  // Check environment variable for explicit weekend mode
  if (process.env.ALLOW_WEEKEND_SIGNALS === "true") {
    return true;
  }

  // Check if we're analyzing historical data
  // Historical analysis has a timestamp/time but isRegularHours may be false
  // BacktestEngine sets features.time (ISO string), live sets features.timestamp
  const hasTimestamp = !!(features.time || (features as any).timestamp);
  // CRITICAL FIX: Explicitly check for false (undefined means unknown, not "not regular hours")
  const isNotRegularHours = features.session?.isRegularHours === false;

  if (hasTimestamp && isNotRegularHours) {
    return true; // Historical/weekend analysis mode
  }

  return false; // Normal mode - enforce market hours
}

/**
 * Check if detector should run based on market hours
 *
 * Returns true if:
 * - It's regular market hours, OR
 * - Weekend signals are allowed (via env var or historical mode)
 *
 * Returns false if:
 * - It's NOT regular hours AND weekend signals are not allowed
 */
export function shouldRunDetector(features: SymbolFeatures): boolean {
  // If in regular hours, always run
  if (features.session?.isRegularHours === true) {
    return true;
  }

  // If NOT in regular hours, check if weekend mode is enabled
  return shouldAllowNonRegularHours(features);
}
