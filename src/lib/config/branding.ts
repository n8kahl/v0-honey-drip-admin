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

export interface BrandingTheme {
  // Core brand colors
  brandPrimary: string;
  brandPrimaryHover: string;
  brandPrimaryPressed: string;
  success: string;
  warning: string;
  danger: string;

  // Surfaces
  surface1: string;
  surface2: string;
  surface3: string;
  surface4: string;

  // Borders
  borderHairline: string;
  borderStrong: string;

  // Text
  textHigh: string;
  textMuted: string;
  textSubtle: string;
}

export const defaultBrandingTheme: BrandingTheme = {
  brandPrimary: "#E2B714",
  brandPrimaryHover: "#F0C520",
  brandPrimaryPressed: "#D4A912",
  success: "#22c55e",
  warning: "#fbbf24",
  danger: "#ef4444",
  surface1: "#111216",
  surface2: "#16181C",
  surface3: "#1C1E23",
  surface4: "#0F1115",
  borderHairline: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  textHigh: "#EBEDF0",
  textMuted: "#9CA3AF",
  textSubtle: "#6B7280",
};

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
   * Favicon URL
   */
  faviconUrl: import.meta.env.VITE_FAVICON_URL || "/favicon.svg",

  /**
   * Short app name for compact displays
   */
  shortName: import.meta.env.VITE_APP_NAME?.split(" ")[0] || "HD",

  /**
   * Full application title for browser tab
   */
  title: `${import.meta.env.VITE_APP_NAME || "Honey Drip"} Trading Dashboard`,

  /**
   * Support email for customer inquiries
   */
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || "support@honeydrip.com",

  /**
   * Brand primary color (hex format)
   */
  brandPrimaryColor: import.meta.env.VITE_BRAND_PRIMARY_COLOR || "#f59e0b",
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

/**
 * Apply a branding theme to document-level CSS variables
 */
export function applyBrandingTheme(theme: Partial<BrandingTheme>): void {
  const merged = { ...defaultBrandingTheme, ...theme };
  const root = document.documentElement;

  root.style.setProperty("--brand-primary", merged.brandPrimary);
  root.style.setProperty("--brand-primary-hover", merged.brandPrimaryHover);
  root.style.setProperty("--brand-primary-pressed", merged.brandPrimaryPressed);
  root.style.setProperty("--accent-positive", merged.success);
  root.style.setProperty("--accent-warning", merged.warning);
  root.style.setProperty("--accent-negative", merged.danger);
  root.style.setProperty("--surface-1", merged.surface1);
  root.style.setProperty("--surface-2", merged.surface2);
  root.style.setProperty("--surface-3", merged.surface3);
  root.style.setProperty("--surface-4", merged.surface4);
  root.style.setProperty("--border-hairline", merged.borderHairline);
  root.style.setProperty("--border-strong", merged.borderStrong);
  root.style.setProperty("--text-high", merged.textHigh);
  root.style.setProperty("--text-muted", merged.textMuted);
  root.style.setProperty("--text-subtle", merged.textSubtle);
}
