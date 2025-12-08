/**
 * Branding Service
 *
 * Manages white-label branding configuration for resellers.
 * Provides functions to load/save branding settings and upload assets to Supabase Storage.
 */

import { createClient } from "../supabase/client";
import { applyBrandingTheme, defaultBrandingTheme } from "../config/branding";

const supabase = createClient();

export interface ResellerConfig {
  id: string;
  userId: string;
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandPrimaryColor: string;
  supportEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Load reseller branding configuration for the current user
 */
export async function loadResellerConfig(userId: string): Promise<ResellerConfig | null> {
  try {
    const { data, error } = await supabase
      .from("reseller_configs")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No config exists yet
        return null;
      }
      throw error;
    }

    return mapToCamelCase(data) as unknown as ResellerConfig;
  } catch (error) {
    console.error("[v0] Failed to load reseller config:", error);
    throw error;
  }
}

/**
 * Save or update reseller branding configuration
 */
export async function saveResellerConfig(
  userId: string,
  config: Partial<Omit<ResellerConfig, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<ResellerConfig> {
  try {
    const snakeConfig = mapToSnakeCase(config);

    // Check if config exists
    const existing = await loadResellerConfig(userId);

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from("reseller_configs")
        .update(snakeConfig)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return mapToCamelCase(data) as unknown as ResellerConfig;
    } else {
      // Create new
      const { data, error } = await supabase
        .from("reseller_configs")
        .insert({
          user_id: userId,
          ...snakeConfig,
        })
        .select()
        .single();

      if (error) throw error;
      return mapToCamelCase(data) as unknown as ResellerConfig;
    }
  } catch (error) {
    console.error("[v0] Failed to save reseller config:", error);
    throw error;
  }
}

/**
 * Upload logo image to Supabase Storage
 */
export async function uploadLogo(userId: string, file: File): Promise<string> {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `logo-${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from("branding").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("branding").getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error("[v0] Failed to upload logo:", error);
    throw error;
  }
}

/**
 * Upload favicon image to Supabase Storage
 */
export async function uploadFavicon(userId: string, file: File): Promise<string> {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `favicon-${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from("branding").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("branding").getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error("[v0] Failed to upload favicon:", error);
    throw error;
  }
}

/**
 * Delete old branding asset from storage
 */
export async function deleteBrandingAsset(url: string): Promise<void> {
  try {
    // Extract file path from public URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/branding/");
    if (pathParts.length < 2) return;

    const filePath = pathParts[1];

    const { error } = await supabase.storage.from("branding").remove([filePath]);

    if (error) throw error;
  } catch (error) {
    console.error("[v0] Failed to delete branding asset:", error);
    // Don't throw - this is cleanup, not critical
  }
}

/**
 * Apply branding configuration to the document
 * Updates CSS variables and page title
 */
export function applyBrandingToDocument(config: ResellerConfig | null): void {
  if (!config) return;

  try {
    // Base theme from defaults
    applyBrandingTheme({
      brandPrimary: config.brandPrimaryColor || defaultBrandingTheme.brandPrimary,
      brandPrimaryHover: adjustColor(
        config.brandPrimaryColor || defaultBrandingTheme.brandPrimary,
        -10
      ),
      brandPrimaryPressed: adjustColor(
        config.brandPrimaryColor || defaultBrandingTheme.brandPrimary,
        -20
      ),
      // Surfaces/text are intentionally left untouched to preserve light/dark
    });

    // Update page title
    if (config.appName) {
      document.title = `${config.appName} Trading Dashboard`;
    }

    // Update favicon
    if (config.faviconUrl) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) {
        link.href = config.faviconUrl;
      }
    }

    // Brand color is handled above; avoid overriding surfaces/text to keep light/dark intact
  } catch (error) {
    console.error("[v0] Failed to apply branding:", error);
  }
}

/**
 * Adjust color brightness (simple implementation)
 */
function adjustColor(color: string, percent: number): string {
  // Remove # if present
  const hex = color.replace("#", "");

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Adjust
  const adjust = (val: number) => {
    const adjusted = val + (val * percent) / 100;
    return Math.max(0, Math.min(255, Math.round(adjusted)));
  };

  const newR = adjust(r).toString(16).padStart(2, "0");
  const newG = adjust(g).toString(16).padStart(2, "0");
  const newB = adjust(b).toString(16).padStart(2, "0");

  return `#${newR}${newG}${newB}`;
}

// Helper: Convert snake_case to camelCase
function mapToCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj) return obj;

  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

// Helper: Convert camelCase to snake_case
function mapToSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj) return obj;

  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
}
