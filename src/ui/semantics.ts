/**
 * Semantic Style Helpers
 *
 * Provides consistent styling for P&L, scores, trade states, and metrics.
 * All colors reference CSS variables for branding compatibility.
 */

import { cn } from '../lib/utils';
import type { TradeState } from '../types';

// ============================================================================
// P&L Styling
// ============================================================================

export interface PnlStyle {
  className: string;
  style?: React.CSSProperties;
}

/**
 * Get styling for P&L percentage display
 * @param pnlPct - P&L percentage (positive = profit, negative = loss)
 */
export function getPnlStyle(pnlPct: number | undefined | null): PnlStyle {
  if (pnlPct == null) {
    return { className: 'text-[var(--text-muted)]' };
  }
  if (pnlPct > 0) {
    return { className: 'text-[var(--accent-positive)]' };
  }
  if (pnlPct < 0) {
    return { className: 'text-[var(--accent-negative)]' };
  }
  return { className: 'text-[var(--text-muted)]' };
}

// ============================================================================
// Score Styling
// ============================================================================

export interface ScoreStyle {
  className: string;
  label: string;
  bgClassName: string;
}

/**
 * Get styling for 0-100 scores (readiness, confluence, quality)
 * @param score - Score from 0 to 100
 */
export function getScoreStyle(score: number | undefined | null): ScoreStyle {
  if (score == null) {
    return {
      className: 'text-[var(--text-muted)]',
      bgClassName: 'bg-[var(--surface-2)]',
      label: '—',
    };
  }
  if (score >= 70) {
    return {
      className: 'text-[var(--accent-positive)]',
      bgClassName: 'bg-[var(--accent-positive)]/10',
      label: 'Strong',
    };
  }
  if (score >= 50) {
    return {
      className: 'text-[var(--brand-primary)]',
      bgClassName: 'bg-[var(--brand-primary)]/10',
      label: 'Moderate',
    };
  }
  if (score >= 30) {
    return {
      className: 'text-[var(--data-stale)]',
      bgClassName: 'bg-[var(--data-stale)]/10',
      label: 'Weak',
    };
  }
  return {
    className: 'text-[var(--accent-negative)]',
    bgClassName: 'bg-[var(--accent-negative)]/10',
    label: 'Poor',
  };
}

// ============================================================================
// Trade State Styling
// ============================================================================

export interface StateStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

/**
 * Get styling for trade state badges
 * @param state - Trade state (WATCHING, LOADED, ENTERED, EXITED)
 */
export function getStateStyle(state: TradeState | undefined | null): StateStyle {
  const styles: Record<TradeState, StateStyle> = {
    WATCHING: {
      bg: 'bg-[var(--state-watching)]/10',
      text: 'text-[var(--state-watching)]',
      border: 'border-[var(--state-watching)]/30',
      label: 'Watching',
    },
    LOADED: {
      bg: 'bg-[var(--state-loaded)]/10',
      text: 'text-[var(--state-loaded)]',
      border: 'border-[var(--state-loaded)]/30',
      label: 'Loaded',
    },
    ENTERED: {
      bg: 'bg-[var(--state-entered)]/10',
      text: 'text-[var(--state-entered)]',
      border: 'border-[var(--state-entered)]/30',
      label: 'Entered',
    },
    EXITED: {
      bg: 'bg-[var(--state-exited)]/10',
      text: 'text-[var(--state-exited)]',
      border: 'border-[var(--state-exited)]/30',
      label: 'Exited',
    },
  };

  return styles[state || 'WATCHING'] || styles.WATCHING;
}

// ============================================================================
// Chip/Badge Styling
// ============================================================================

export type ChipKind = 'success' | 'warn' | 'fail' | 'info' | 'neutral' | 'brand';

/**
 * Get chip/badge styling by semantic kind
 * @param kind - Semantic type of chip
 */
export function chipStyle(kind: ChipKind): string {
  const variants: Record<ChipKind, string> = {
    success: 'bg-[var(--accent-positive)]/10 text-[var(--accent-positive)] border-[var(--accent-positive)]/30',
    warn: 'bg-[var(--data-stale)]/10 text-[var(--data-stale)] border-[var(--data-stale)]/30',
    fail: 'bg-[var(--accent-negative)]/10 text-[var(--accent-negative)] border-[var(--accent-negative)]/30',
    info: 'bg-[var(--accent-info)]/10 text-[var(--accent-info)] border-[var(--accent-info)]/30',
    neutral: 'bg-[var(--surface-3)] text-[var(--text-muted)] border-[var(--border-hairline)]',
    brand: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/30',
  };

  return cn(
    'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
    variants[kind]
  );
}

/**
 * Get chip kind based on a value threshold
 */
export function getChipKindForValue(
  value: number,
  thresholds: { success: number; warn: number }
): ChipKind {
  if (value >= thresholds.success) return 'success';
  if (value >= thresholds.warn) return 'warn';
  return 'fail';
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format price with $ prefix
 * @param n - Price value
 * @param decimals - Number of decimal places (default: 2)
 */
export function fmtPrice(n: number | undefined | null, decimals = 2): string {
  if (n == null || isNaN(n)) return '—';
  return `$${n.toFixed(decimals)}`;
}

/**
 * Format percentage with + prefix for positive values
 * @param n - Percentage value
 * @param decimals - Number of decimal places (default: 1)
 */
export function fmtPct(n: number | undefined | null, decimals = 1): string {
  if (n == null || isNaN(n)) return '—';
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(decimals)}%`;
}

/**
 * Format a generic metric value with optional unit
 * @param value - Metric value
 * @param unit - Optional unit suffix (e.g., 'x', '%', 'ms')
 * @param decimals - Number of decimal places (default: 2)
 */
export function fmtMetric(
  value: number | undefined | null,
  unit?: string,
  decimals = 2
): string {
  if (value == null || isNaN(value)) return '—';
  return `${value.toFixed(decimals)}${unit || ''}`;
}

/**
 * Format time remaining in human-readable form
 * @param ms - Milliseconds remaining
 */
export function fmtTimeLeft(ms: number | undefined | null): string {
  if (ms == null || isNaN(ms) || ms < 0) return '—';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Format DTE (days to expiration) with color context
 * @param dte - Days to expiration
 */
export function fmtDTE(dte: number | undefined | null): { text: string; className: string } {
  if (dte == null || isNaN(dte)) {
    return { text: '—', className: 'text-[var(--text-muted)]' };
  }

  const text = dte === 0 ? '0DTE' : `${dte}DTE`;

  if (dte === 0) {
    return { text, className: 'text-[var(--accent-negative)]' };
  }
  if (dte <= 2) {
    return { text, className: 'text-[var(--data-stale)]' };
  }
  return { text, className: 'text-[var(--text-muted)]' };
}

/**
 * Format delta with sign
 * @param delta - Delta value (-1 to 1)
 */
export function fmtDelta(delta: number | undefined | null): string {
  if (delta == null || isNaN(delta)) return '—';
  return delta.toFixed(2);
}

/**
 * Format spread with percentage
 * @param bid - Bid price
 * @param ask - Ask price
 */
export function fmtSpread(
  bid: number | undefined | null,
  ask: number | undefined | null
): { absolute: string; percent: string; isWide: boolean } {
  if (bid == null || ask == null || isNaN(bid) || isNaN(ask)) {
    return { absolute: '—', percent: '—', isWide: false };
  }

  const spread = ask - bid;
  const mid = (bid + ask) / 2;
  const percent = mid > 0 ? (spread / mid) * 100 : 0;

  return {
    absolute: `$${spread.toFixed(2)}`,
    percent: `${percent.toFixed(1)}%`,
    isWide: percent > 5, // >5% spread is considered wide
  };
}

// ============================================================================
// Animation Helpers
// ============================================================================

/**
 * Get animation class for metric value changes
 * @param hasChanged - Whether the value has changed
 */
export function getTickAnimation(hasChanged: boolean): string {
  return hasChanged ? 'animate-metric-tick' : '';
}

/**
 * Get loading skeleton class
 */
export function getSkeletonClass(): string {
  return 'animate-shimmer rounded';
}

/**
 * Get crossfade animation class for panel transitions
 */
export function getCrossfadeClass(): string {
  return 'animate-crossfade';
}

// ============================================================================
// Contrast Helper (for brand buttons)
// ============================================================================

/**
 * Determine if text should be black or white based on background color
 * @param hexColor - Hex color string (e.g., '#E2B714')
 */
export function getContrastTextColor(hexColor: string): 'black' | 'white' {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? 'black' : 'white';
}
