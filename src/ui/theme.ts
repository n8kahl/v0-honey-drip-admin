/**
 * Theme System
 *
 * Provides typed access to CSS variables and theme utilities.
 * All colors are bound to CSS variables set in globals.css and
 * can be dynamically updated via Super Admin branding settings.
 */

// ============================================================================
// CSS Variable Getters
// ============================================================================

/**
 * Get a CSS variable value
 * @param name - Variable name without the -- prefix
 */
export function cssVar(name: string): string {
  return `var(--${name})`;
}

/**
 * Get a CSS variable with opacity
 * @param name - Variable name without the -- prefix
 * @param opacity - Opacity value (0-1)
 */
export function cssVarAlpha(name: string, opacity: number): string {
  return `var(--${name}) / ${opacity}`;
}

// ============================================================================
// Theme Token Constants (for reference, actual values in globals.css)
// ============================================================================

export const theme = {
  // Backgrounds
  bg: {
    base: cssVar("bg-base"),
    surface1: cssVar("surface-1"),
    surface2: cssVar("surface-2"),
    surface3: cssVar("surface-3"),
  },

  // Borders
  border: {
    hairline: cssVar("border-hairline"),
    focus: cssVar("border-focus"),
  },

  // Text
  text: {
    high: cssVar("text-high"),
    med: cssVar("text-med"),
    muted: cssVar("text-muted"),
    faint: cssVar("text-faint"),
  },

  // Brand
  brand: {
    primary: cssVar("brand-primary"),
    primaryHover: cssVar("brand-primary-hover"),
    primaryPressed: cssVar("brand-primary-pressed"),
  },

  // Status / Accents
  accent: {
    positive: cssVar("accent-positive"),
    positiveBg: cssVar("accent-positive-bg"),
    negative: cssVar("accent-negative"),
    negativeBg: cssVar("accent-negative-bg"),
    info: cssVar("accent-info"),
    infoBg: cssVar("accent-info-bg"),
    warning: cssVar("data-stale"), // Amber/yellow for warnings
  },

  // Trade States
  state: {
    watching: cssVar("state-watching"),
    loaded: cssVar("state-loaded"),
    entered: cssVar("state-entered"),
    exited: cssVar("state-exited"),
    invalid: cssVar("state-invalid"),
  },

  // Trade Types
  tradeType: {
    scalp: cssVar("trade-scalp"),
    scalpBg: cssVar("trade-scalp-bg"),
    day: cssVar("trade-day"),
    dayBg: cssVar("trade-day-bg"),
    swing: cssVar("trade-swing"),
    swingBg: cssVar("trade-swing-bg"),
    leap: cssVar("trade-leap"),
    leapBg: cssVar("trade-leap-bg"),
  },

  // Session
  session: {
    premarket: cssVar("session-premarket"),
    open: cssVar("session-open"),
    afterhours: cssVar("session-afterhours"),
    closed: cssVar("session-closed"),
  },

  // Chart
  chart: {
    emaPrimary: cssVar("chart-ema-primary"),
    emaSecondary: cssVar("chart-ema-secondary"),
    itmBackground: cssVar("itm-background"),
    zebraStripe: cssVar("zebra-stripe"),
  },

  // Spacing (8px grid)
  space: {
    1: cssVar("space-1"), // 4px
    2: cssVar("space-2"), // 8px
    3: cssVar("space-3"), // 12px
    4: cssVar("space-4"), // 16px
    5: cssVar("space-5"), // 20px
    6: cssVar("space-6"), // 24px
    8: cssVar("space-8"), // 32px
  },

  // Radius
  radius: {
    default: cssVar("radius"), // 4px
    lg: cssVar("radius-lg"), // 6px
  },

  // Shadows
  shadow: {
    sm: cssVar("shadow-sm"),
    md: cssVar("shadow-md"),
    lg: cssVar("shadow-lg"),
  },
} as const;

// ============================================================================
// Animation Classes (reference for use with cn())
// ============================================================================

export const animations = {
  // Loading states
  shimmer: "animate-shimmer",
  subtlePulse: "animate-subtle-pulse",

  // Value changes
  metricTick: "animate-metric-tick",
  metricTickFlash: "animate-metric-tick-flash",
  pnlBump: "animate-pnl-bump",

  // Panel transitions
  crossfade: "animate-crossfade",
  crossfadeScale: "animate-crossfade-scale",
  fadeInUp: "animate-fade-in-up",
  slideInRight: "animate-slide-in-right",
  slideUp: "animate-slide-up",

  // Flash effects
  flashGreen: "animate-flash-green",
  flashRed: "animate-flash-red",
  flashWarning: "animate-flash-warning",
  flashUrgent: "animate-flash-urgent",
  flashCritical: "animate-flash-critical",
  flashPositive: "animate-flash-positive",

  // Pulse effects
  pulseGreen: "animate-pulse-green",
  pulseRed: "animate-pulse-red",
  statePulse: "animate-state-pulse",
  discPulse: "animate-disc-pulse",
  slowFlash: "animate-slow-flash",

  // Chart
  chartDraw: "animate-chart-draw",
  chartTransition: "animate-chart-transition",
  sparklineDraw: "animate-sparkline-draw",

  // Interactive
  hoverLift: "hover-lift",
  hoverLiftSm: "hover-lift-sm",
  btnPress: "btn-press",
  focusRing: "focus-ring",

  // Stagger
  staggerIn: "animate-stagger-in",

  // Checkmark
  checkmarkDraw: "animate-checkmark-draw",
  checkmarkPulse: "animate-checkmark-pulse",

  // Collapse
  collapse: "transition-collapse",
  collapseFast: "transition-collapse-fast",
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type ThemeToken = typeof theme;
export type AnimationClass = (typeof animations)[keyof typeof animations];
