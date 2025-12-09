/**
 * useBranding Hook
 *
 * Loads and applies branding configuration from Super Admin settings.
 * Provides reactive access to branding values with defaults.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  loadResellerConfig,
  applyBrandingToDocument,
  type ResellerConfig,
} from '../lib/services/brandingService';
import {
  branding as defaultBranding,
  defaultBrandingTheme,
  type BrandingTheme,
} from '../lib/config/branding';
import { getContrastTextColor } from '../ui/semantics';

export interface BrandingValues {
  // Core identity
  appName: string;
  logoUrl: string;
  faviconUrl: string | null;
  supportEmail: string | null;

  // Colors
  brandPrimaryColor: string;
  brandPrimaryHover: string;
  brandPrimaryPressed: string;

  // Computed
  brandTextColor: 'black' | 'white';

  // Full theme (for advanced usage)
  theme: BrandingTheme;
}

export interface UseBrandingReturn {
  branding: BrandingValues;
  config: ResellerConfig | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

/**
 * Hook to load and apply branding configuration
 *
 * Usage:
 * ```tsx
 * const { branding, isLoading } = useBranding();
 *
 * // Use branding values
 * <img src={branding.logoUrl} alt={branding.appName} />
 * <button style={{ backgroundColor: branding.brandPrimaryColor }}>
 *   <span style={{ color: branding.brandTextColor }}>Click</span>
 * </button>
 * ```
 */
export function useBranding(): UseBrandingReturn {
  const { user } = useAuth();
  const [config, setConfig] = useState<ResellerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load branding config on mount and when user changes
  const loadBranding = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const resellerConfig = await loadResellerConfig(user.id);
      setConfig(resellerConfig);

      // Apply to document immediately
      if (resellerConfig) {
        applyBrandingToDocument(resellerConfig);
      }
    } catch (err) {
      console.error('[useBranding] Failed to load config:', err);
      setError(err instanceof Error ? err : new Error('Failed to load branding'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, [user?.id]);

  // Compute branding values with defaults
  const branding = useMemo<BrandingValues>(() => {
    const primaryColor = config?.brandPrimaryColor || defaultBrandingTheme.brandPrimary;

    // Compute hover/pressed states
    const adjustBrightness = (hex: string, percent: number): string => {
      const cleanHex = hex.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);

      const adjust = (val: number) => {
        const adjusted = val + (val * percent) / 100;
        return Math.max(0, Math.min(255, Math.round(adjusted)));
      };

      const newR = adjust(r).toString(16).padStart(2, '0');
      const newG = adjust(g).toString(16).padStart(2, '0');
      const newB = adjust(b).toString(16).padStart(2, '0');

      return `#${newR}${newG}${newB}`;
    };

    const hoverColor = adjustBrightness(primaryColor, 10);
    const pressedColor = adjustBrightness(primaryColor, -10);

    return {
      // Core identity
      appName: config?.appName || defaultBranding.appName,
      logoUrl: config?.logoUrl || defaultBranding.logoUrl,
      faviconUrl: config?.faviconUrl || defaultBranding.faviconUrl,
      supportEmail: config?.supportEmail || defaultBranding.supportEmail,

      // Colors
      brandPrimaryColor: primaryColor,
      brandPrimaryHover: hoverColor,
      brandPrimaryPressed: pressedColor,

      // Computed contrast color for text on brand backgrounds
      brandTextColor: getContrastTextColor(primaryColor),

      // Full theme
      theme: {
        ...defaultBrandingTheme,
        brandPrimary: primaryColor,
        brandPrimaryHover: hoverColor,
        brandPrimaryPressed: pressedColor,
      },
    };
  }, [config]);

  return {
    branding,
    config,
    isLoading,
    error,
    reload: loadBranding,
  };
}

/**
 * Apply branding CSS variables to :root
 *
 * Call this at app initialization to ensure CSS variables are set.
 * Typically called in App.tsx or a top-level layout component.
 *
 * @param branding - Branding values to apply
 */
export function applyBrandingCSSVars(branding: BrandingValues): void {
  const root = document.documentElement;

  root.style.setProperty('--brand-primary', branding.brandPrimaryColor);
  root.style.setProperty('--brand-primary-hover', branding.brandPrimaryHover);
  root.style.setProperty('--brand-primary-pressed', branding.brandPrimaryPressed);
}

/**
 * Get CSS variable value for brand color
 */
export function getBrandVar(varName: 'primary' | 'hover' | 'pressed'): string {
  const vars = {
    primary: 'var(--brand-primary)',
    hover: 'var(--brand-primary-hover)',
    pressed: 'var(--brand-primary-pressed)',
  };
  return vars[varName];
}
