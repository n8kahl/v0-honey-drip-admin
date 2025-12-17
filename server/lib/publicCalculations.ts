/**
 * Public Calculations Library
 *
 * Shared calculation functions for public-facing endpoints.
 * CRITICAL: Properly handles 0 as a valid value (not falsy).
 *
 * These functions use nullish coalescing (?? and == null) instead of
 * falsy checks (|| and !) to correctly treat 0 as a valid numeric value.
 */

// ============================================================================
// P&L Calculations
// ============================================================================

/**
 * Calculate P&L percentage from entry and current/exit price.
 *
 * Rules:
 * - 0 is a VALID current price (e.g., worthless options)
 * - Entry price of 0 or null → returns null (can't divide by 0)
 * - Current price of null → returns null (no price to compare)
 * - Current price of 0 → returns -100% (worthless position)
 *
 * @param entry - Entry price (null/0 returns null)
 * @param current - Current or exit price (null returns null, 0 is valid)
 * @returns P&L percentage or null if calculation not possible
 */
export function calculatePnlPercent(
  entry: number | null | undefined,
  current: number | null | undefined
): number | null {
  // Entry must be a valid positive number (can't divide by 0 or null)
  if (entry == null || entry === 0) {
    return null;
  }

  // Current can be 0 (worthless), but not null/undefined
  if (current == null) {
    return null;
  }

  return ((current - entry) / entry) * 100;
}

// ============================================================================
// Progress Calculations
// ============================================================================

/**
 * Calculate progress toward a target as a percentage (0-100).
 *
 * Rules:
 * - 0 is a VALID current value
 * - Entry of 0 or null → returns null
 * - Current of null → returns null (0 is valid)
 * - Target of null → returns null
 * - If target == entry → returns 100 if current >= target, else 0
 * - Result is clamped to 0-100
 *
 * @param entry - Entry price (null/0 returns null)
 * @param current - Current price (null returns null, 0 is valid)
 * @param target - Target price (null returns null)
 * @returns Progress percentage (0-100) or null
 */
export function calculateProgressToTarget(
  entry: number | null | undefined,
  current: number | null | undefined,
  target: number | null | undefined
): number | null {
  // Entry must be a valid positive number
  if (entry == null || entry === 0) {
    return null;
  }

  // Current can be 0 (worthless), but not null/undefined
  if (current == null) {
    return null;
  }

  // Target must be defined
  if (target == null) {
    return null;
  }

  // Edge case: target equals entry (no movement needed)
  if (target === entry) {
    return current >= target ? 100 : 0;
  }

  // Calculate progress and clamp to 0-100
  const progress = ((current - entry) / (target - entry)) * 100;
  return Math.max(0, Math.min(100, progress));
}

// ============================================================================
// Time Calculations
// ============================================================================

/**
 * Get time elapsed since a timestamp in human-readable format.
 *
 * @param timestamp - ISO timestamp string or null
 * @param nowMs - Current time in milliseconds (injectable for testing)
 * @returns Human-readable elapsed time or null if no timestamp
 */
export function getTimeElapsed(
  timestamp: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (timestamp == null) {
    return null;
  }

  const ms = nowMs - new Date(timestamp).getTime();

  // Handle negative time (future timestamp)
  if (ms < 0) {
    return "0m";
  }

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// Price Selection Helpers
// ============================================================================

/**
 * Get the best available price for P&L calculation.
 *
 * Uses nullish coalescing (??) instead of || to handle 0 correctly.
 * 0 is a valid price (worthless option), so we only fall back on null/undefined.
 *
 * @param primary - Primary price (current_price)
 * @param fallback - Fallback price (exit_price or entry_price)
 * @returns The first non-null price, or null if both are null
 */
export function getBestPrice(
  primary: number | null | undefined,
  fallback: number | null | undefined
): number | null {
  // Use nullish coalescing: returns fallback only if primary is null/undefined
  // 0 is preserved as a valid value
  return primary ?? fallback ?? null;
}

// ============================================================================
// State Filtering Helpers
// ============================================================================

/**
 * Valid trade states for database filtering.
 * Includes both uppercase (legacy) and lowercase (new) variants.
 */
export const ACTIVE_TRADE_STATES = ["LOADED", "ENTERED", "loaded", "entered"] as const;

export const EXITED_TRADE_STATES = ["EXITED", "exited"] as const;

export const ALL_OPEN_STATES = [
  "LOADED",
  "ENTERED",
  "WATCHING",
  "loaded",
  "entered",
  "watching",
] as const;
