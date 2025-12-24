/**
 * Public Formatters
 *
 * Utility functions for formatting and normalizing data in public-facing components.
 * These functions handle edge cases, null values, and type normalization.
 */

import type { PublicContract, PublicContractType } from "@/types/public";

// ============================================================================
// Contract Type Normalization
// ============================================================================

/**
 * Normalize contract type to canonical "C" | "P" format.
 *
 * Handles variations:
 * - "C", "c", "call", "Call", "CALL" -> "C"
 * - "P", "p", "put", "Put", "PUT" -> "P"
 *
 * @param input - Contract type in any format
 * @returns Normalized "C" | "P" or null if invalid
 */
export function normalizeContractType(input: string | null | undefined): PublicContractType | null {
  if (input == null || input === "") {
    return null;
  }

  const normalized = input.toLowerCase().trim();

  if (normalized === "c" || normalized === "call") {
    return "C";
  }

  if (normalized === "p" || normalized === "put") {
    return "P";
  }

  return null;
}

/**
 * Get display label for contract type
 *
 * @param type - Contract type ("C" | "P")
 * @param short - If true, return "C"/"P"; if false, return "CALL"/"PUT"
 */
export function getContractTypeLabel(
  type: PublicContractType | null | undefined,
  short = false
): string {
  if (!type) return "";

  if (short) {
    return type;
  }

  return type === "C" ? "CALL" : "PUT";
}

// ============================================================================
// Money Formatting
// ============================================================================

/**
 * Format a number as currency.
 *
 * @param value - The value to format
 * @param options - Formatting options
 * @returns Formatted string like "$1,234.56" or "-" if null
 */
export function formatMoney(
  value: number | null | undefined,
  options: {
    decimals?: number;
    showSign?: boolean;
    emptyValue?: string;
  } = {}
): string {
  const { decimals = 2, showSign = false, emptyValue = "-" } = options;

  if (value == null) {
    return emptyValue;
  }

  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const sign = value < 0 ? "-" : showSign && value > 0 ? "+" : "";

  return `${sign}$${formatted}`;
}

/**
 * Format a price value (typically for options premiums)
 *
 * @param value - Price value
 * @returns Formatted string like "$1.23" or "-"
 */
export function formatPrice(value: number | null | undefined): string {
  return formatMoney(value, { decimals: 2 });
}

// ============================================================================
// Percentage Formatting
// ============================================================================

/**
 * Format a number as a percentage.
 *
 * @param value - The percentage value (e.g., 15.5 for 15.5%)
 * @param options - Formatting options
 * @returns Formatted string like "+15.5%" or "-" if null
 */
export function formatPct(
  value: number | null | undefined,
  options: {
    decimals?: number;
    showSign?: boolean;
    emptyValue?: string;
  } = {}
): string {
  const { decimals = 1, showSign = true, emptyValue = "-" } = options;

  if (value == null) {
    return emptyValue;
  }

  const sign = value > 0 && showSign ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format P&L percentage with color-aware sign
 *
 * @param value - P&L percentage
 * @returns Object with formatted string and color class
 */
export function formatPnlPct(value: number | null | undefined): {
  text: string;
  colorClass: string;
  isPositive: boolean;
} {
  if (value == null) {
    return {
      text: "-",
      colorClass: "text-[var(--text-muted)]",
      isPositive: false,
    };
  }

  const isPositive = value >= 0;
  return {
    text: formatPct(value, { showSign: true }),
    colorClass: isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]",
    isPositive,
  };
}

// ============================================================================
// Contract Label Formatting
// ============================================================================

/**
 * Format a contract for display (e.g., "$595 CALL" or "$590P")
 *
 * @param contract - Contract object
 * @param options - Formatting options
 * @returns Formatted string like "$595 CALL" or ""
 */
export function formatContractLabel(
  contract: PublicContract | null | undefined,
  options: {
    short?: boolean;
    includeExpiry?: boolean;
  } = {}
): string {
  const { short = false, includeExpiry = false } = options;

  if (!contract || contract.strike == null) {
    return "";
  }

  const strike = `$${contract.strike}`;
  const typeLabel = getContractTypeLabel(contract.type, short);

  let label = short ? `${strike}${typeLabel}` : `${strike} ${typeLabel}`;

  if (includeExpiry && contract.expiry) {
    const expiryLabel = formatExpiry(contract.expiry);
    label += ` ${expiryLabel}`;
  }

  return label.trim();
}

/**
 * Format expiration date with DTE calculation
 *
 * @param expiry - ISO date string or YYYY-MM-DD
 * @returns Formatted string like "0DTE", "3DTE", "Dec 20"
 */
export function formatExpiry(expiry: string | null | undefined): string {
  if (!expiry) {
    return "";
  }

  try {
    const date = new Date(expiry);
    const now = new Date();

    // Reset time to compare just dates
    const expiryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffMs = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "0DTE";
    if (diffDays === 1) return "1DTE";
    if (diffDays <= 7) return `${diffDays}DTE`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return expiry;
  }
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago")
 *
 * @param timestamp - ISO timestamp string or Date
 * @returns Formatted string like "5m ago" or "just now"
 */
export function formatTimeAgo(timestamp: string | Date | null | undefined): string {
  if (!timestamp) {
    return "";
  }

  try {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle future timestamps
    if (diffMs < 0) {
      return "just now";
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return diffSeconds <= 5 ? "just now" : `${diffSeconds}s ago`;
    }

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    if (diffHours < 24) {
      const mins = diffMinutes % 60;
      return mins > 0 ? `${diffHours}h ${mins}m ago` : `${diffHours}h ago`;
    }

    if (diffDays === 1) {
      return "yesterday";
    }

    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    // For older, show actual date
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Format a timestamp for alert feed display (e.g., "9:30 AM")
 *
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string
 */
export function formatAlertTime(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return "";
  }

  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/**
 * Format duration in trade (e.g., "10m", "2h 30m", "3d")
 *
 * @param startTime - ISO timestamp of trade start
 * @param endTime - ISO timestamp of end (defaults to now)
 * @returns Formatted duration string
 */
export function formatTradeDuration(
  startTime: string | null | undefined,
  endTime?: string | null
): string {
  if (!startTime) {
    return "";
  }

  try {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();

    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 0) {
      return "0m";
    }

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d`;
    }

    if (hours > 0) {
      const remainingMins = minutes % 60;
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    }

    return `${minutes}m`;
  } catch {
    return "";
  }
}

// ============================================================================
// Win Rate Formatting
// ============================================================================

/**
 * Format win rate as percentage
 *
 * @param wins - Number of wins
 * @param total - Total trades
 * @returns Formatted percentage string
 */
export function formatWinRate(wins: number, total: number): string {
  if (total === 0) {
    return "0%";
  }

  const rate = (wins / total) * 100;
  return `${rate.toFixed(0)}%`;
}

/**
 * Get win/loss record string
 *
 * @param wins - Number of wins
 * @param losses - Number of losses
 * @returns String like "5W/2L"
 */
export function formatWinLossRecord(wins: number, losses: number): string {
  return `${wins}W/${losses}L`;
}

// ============================================================================
// Freshness Display
// ============================================================================

/**
 * Get freshness indicator state
 *
 * @param updatedAt - Last update timestamp
 * @param thresholdMs - Staleness threshold in ms (default 5 seconds)
 * @returns Object with isStale flag and formatted time
 */
export function getFreshnessState(
  updatedAt: Date | null | undefined,
  thresholdMs = 5000
): {
  isStale: boolean;
  timeAgo: string;
  statusText: string;
} {
  if (!updatedAt) {
    return {
      isStale: true,
      timeAgo: "never",
      statusText: "Loading...",
    };
  }

  const diffMs = Date.now() - updatedAt.getTime();
  const isStale = diffMs > thresholdMs;

  return {
    isStale,
    timeAgo: formatTimeAgo(updatedAt),
    statusText: isStale ? "Reconnecting..." : "Live",
  };
}
