/**
 * Branding Configuration
 *
 * Centralized configuration for white-labeling the application.
 * All branding-related values should be read from this module.
 *
 * Environment Variables:
 * - VITE_APP_NAME: Application name (default: "Honey Drip")
 * - VITE_APP_LOGO_URL: Custom logo URL (default: Honey Drip logo)
 * - VITE_ENABLE_KCU: Enable KCU LTP strategies (default: false)
 */

// Default Honey Drip logo (hosted on Vercel blob storage)
const DEFAULT_LOGO_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hdn-l492QBW7lTUL3waoOAnhU3p8Ep7YNp.png";

/**
 * Branding configuration object
 */
export const branding = {
  /**
   * Application name displayed in UI
   */
  appName: import.meta.env.VITE_APP_NAME || "Honey Drip",

  /**
   * Application logo URL
   */
  logoUrl: import.meta.env.VITE_APP_LOGO_URL || DEFAULT_LOGO_URL,

  /**
   * Short app name for compact displays
   */
  shortName: import.meta.env.VITE_APP_NAME?.split(" ")[0] || "HD",

  /**
   * Full application title for browser tab
   */
  title: `${import.meta.env.VITE_APP_NAME || "Honey Drip"} Trading Dashboard`,
} as const;

/**
 * Feature flags configuration
 */
export const features = {
  /**
   * Enable KCU LTP Strategy detectors
   * When true, adds 8 additional detectors to the scanner:
   * - EMA Bounce (long/short)
   * - VWAP Standard (long/short)
   * - King & Queen (long/short)
   * - ORB Breakout (long/short)
   */
  enableKCU: import.meta.env.VITE_ENABLE_KCU === "true",

  /**
   * Use unified options chain endpoint
   */
  useUnifiedChain: import.meta.env.VITE_USE_UNIFIED_CHAIN !== "false",
} as const;

/**
 * CSS variables for brand colors
 * These can be overridden in globals.css or via CSS custom properties
 */
export const brandColors = {
  primary: "var(--brand-primary)",
  primaryHover: "var(--brand-primary-hover)",
  primaryPressed: "var(--brand-primary-pressed)",
} as const;

/**
 * Helper to check if KCU is enabled
 */
export function isKCUEnabled(): boolean {
  return features.enableKCU;
}

/**
 * Get app logo with fallback
 */
export function getAppLogo(): string {
  return branding.logoUrl;
}

/**
 * Get app name
 */
export function getAppName(): string {
  return branding.appName;
}
