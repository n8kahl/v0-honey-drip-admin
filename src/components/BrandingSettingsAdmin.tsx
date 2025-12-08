/**
 * BrandingSettingsAdmin Component
 *
 * Super admin panel for managing white-label branding configuration.
 * Allows uploading custom logos, favicons, and setting brand colors.
 */

import { useState, useEffect, useRef } from "react";
import { HDCard } from "./hd/common/HDCard";
import { HDButton } from "./hd/common/HDButton";
import { useAppToast } from "../hooks/useAppToast";
import { useAuth } from "../contexts/AuthContext";
import { Palette, Upload, Image, Mail, RefreshCw, Eye } from "lucide-react";
import {
  loadResellerConfig,
  saveResellerConfig,
  uploadLogo,
  uploadFavicon,
  applyBrandingToDocument,
  type ResellerConfig,
} from "../lib/services/brandingService";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { applyBrandingTheme, defaultBrandingTheme } from "../lib/config/branding";

export function BrandingSettingsAdmin() {
  const toast = useAppToast();
  const { user } = useAuth();
  const [config, setConfig] = useState<ResellerConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [appName, setAppName] = useState("Honey Drip");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#f59e0b");
  const [supportEmail, setSupportEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [themePreview, setThemePreview] = useState({
    success: defaultBrandingTheme.success,
    warning: defaultBrandingTheme.warning,
    danger: defaultBrandingTheme.danger,
    borderHairline: defaultBrandingTheme.borderHairline,
    borderStrong: defaultBrandingTheme.borderStrong,
  });

  // File inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [user?.id]);

  const loadConfig = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await loadResellerConfig(user.id);
      if (data) {
        setConfig(data);
        setAppName(data.appName);
        setBrandPrimaryColor(data.brandPrimaryColor);
        setSupportEmail(data.supportEmail || "");
        setLogoUrl(data.logoUrl || "");
        setFaviconUrl(data.faviconUrl || "");
        setThemePreview((prev) => ({
          ...prev,
          success:
            getComputedStyle(document.documentElement)
              .getPropertyValue("--accent-positive")
              ?.trim() || prev.success,
          warning:
            getComputedStyle(document.documentElement)
              .getPropertyValue("--accent-warning")
              ?.trim() || prev.warning,
          danger:
            getComputedStyle(document.documentElement)
              .getPropertyValue("--accent-negative")
              ?.trim() || prev.danger,
          borderHairline:
            getComputedStyle(document.documentElement)
              .getPropertyValue("--border-hairline")
              ?.trim() || prev.borderHairline,
          borderStrong:
            getComputedStyle(document.documentElement)
              .getPropertyValue("--border-strong")
              ?.trim() || prev.borderStrong,
        }));
      }
    } catch (error) {
      console.error("[v0] Failed to load branding config:", error);
      toast.error("Failed to load branding settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("Not authenticated");
      return;
    }

    setSaving(true);
    try {
      const updated = await saveResellerConfig(user.id, {
        appName,
        brandPrimaryColor,
        supportEmail: supportEmail || null,
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
      });

      setConfig(updated);
      applyBrandingToDocument(updated);
      toast.success("Branding settings saved and applied.");
    } catch (error) {
      console.error("[v0] Failed to save branding config:", error);
      toast.error("Failed to save branding settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file size must be under 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file");
      return;
    }

    setUploadingLogo(true);
    try {
      const url = await uploadLogo(user.id, file);
      setLogoUrl(url);
      toast.success("Logo uploaded! Click Save to apply changes.");
    } catch (error) {
      console.error("[v0] Failed to upload logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file size (1MB max)
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Favicon file size must be under 1MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Favicon must be an image file");
      return;
    }

    setUploadingFavicon(true);
    try {
      const url = await uploadFavicon(user.id, file);
      setFaviconUrl(url);
      toast.success("Favicon uploaded! Click Save to apply changes.");
    } catch (error) {
      console.error("[v0] Failed to upload favicon:", error);
      toast.error("Failed to upload favicon");
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handlePreview = () => {
    if (config) {
      const previewConfig = {
        ...config,
        appName,
        brandPrimaryColor,
        supportEmail: supportEmail || null,
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
      };
      applyBrandingToDocument(previewConfig);
      toast.info("Preview applied to current session.");
    }
  };

  // Apply theme once when config loads so the admin page reflects saved branding
  useEffect(() => {
    if (config) {
      applyBrandingToDocument(config);
    }
  }, [config]);

  if (loading) {
    return (
      <HDCard>
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
        </div>
      </HDCard>
    );
  }

  return (
    <HDCard>
      <div className="space-y-4">
        {/* Header */}
        <div className="border-b border-[var(--border-hairline)] pb-3">
          <h3 className="text-lg font-medium text-[var(--text-high)] flex items-center gap-2">
            <Palette className="w-5 h-5" />
            White-Label Branding
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Customize the app name, logos, and brand colors for your reseller deployment.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <HDButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </HDButton>
          <HDButton variant="secondary" onClick={loadConfig} disabled={loading}>
            <RefreshCw className="w-4 h-4" />
            Reload
          </HDButton>
          <HDButton variant="ghost" onClick={handlePreview} disabled={!config}>
            <Eye className="w-4 h-4" />
            Preview
          </HDButton>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Theme preview (advanced) */}
          <div className="space-y-3 p-3 border border-[var(--border-hairline)] rounded-[var(--radius)] bg-[var(--surface-2)]/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-high)]">Theme Preview</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Adjust surfaces, text, and accents. Applies to this session (not persisted yet).
                </p>
              </div>
              <HDButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  applyBrandingTheme({
                    surface1: themePreview.surface1,
                    surface2: themePreview.surface2,
                    surface3: themePreview.surface3,
                    surface4: themePreview.surface4,
                    textHigh: themePreview.textHigh,
                    textMuted: themePreview.textMuted,
                    textSubtle: defaultBrandingTheme.textSubtle,
                    success: themePreview.success,
                    warning: themePreview.warning,
                    danger: themePreview.danger,
                    borderHairline: themePreview.borderHairline,
                    borderStrong: themePreview.borderStrong,
                    brandPrimary: brandPrimaryColor,
                    brandPrimaryHover: brandPrimaryColor,
                    brandPrimaryPressed: brandPrimaryColor,
                  });
                  toast.info("Theme applied to this session.");
                }}
              >
                Apply Theme
              </HDButton>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label>Surface 1</Label>
                <Input
                  type="color"
                  value={themePreview.surface1}
                  onChange={(e) => setThemePreview((p) => ({ ...p, surface1: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Surface 2</Label>
                <Input
                  type="color"
                  value={themePreview.surface2}
                  onChange={(e) => setThemePreview((p) => ({ ...p, surface2: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Surface 3</Label>
                <Input
                  type="color"
                  value={themePreview.surface3}
                  onChange={(e) => setThemePreview((p) => ({ ...p, surface3: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Surface 4</Label>
                <Input
                  type="color"
                  value={themePreview.surface4}
                  onChange={(e) => setThemePreview((p) => ({ ...p, surface4: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Text High</Label>
                <Input
                  type="color"
                  value={themePreview.textHigh}
                  onChange={(e) => setThemePreview((p) => ({ ...p, textHigh: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Text Muted</Label>
                <Input
                  type="color"
                  value={themePreview.textMuted}
                  onChange={(e) => setThemePreview((p) => ({ ...p, textMuted: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Success</Label>
                <Input
                  type="color"
                  value={themePreview.success}
                  onChange={(e) => setThemePreview((p) => ({ ...p, success: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Warning</Label>
                <Input
                  type="color"
                  value={themePreview.warning}
                  onChange={(e) => setThemePreview((p) => ({ ...p, warning: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Danger</Label>
                <Input
                  type="color"
                  value={themePreview.danger}
                  onChange={(e) => setThemePreview((p) => ({ ...p, danger: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Border Hairline</Label>
                <Input
                  type="color"
                  value={themePreview.borderHairline}
                  onChange={(e) =>
                    setThemePreview((p) => ({ ...p, borderHairline: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Border Strong</Label>
                <Input
                  type="color"
                  value={themePreview.borderStrong}
                  onChange={(e) => setThemePreview((p) => ({ ...p, borderStrong: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-[var(--radius)] border border-[var(--border-hairline)] bg-[var(--surface-1)]">
                <p className="text-[var(--text-high)] font-semibold mb-2">Preview</p>
                <div className="flex flex-col gap-2">
                  <button className="px-3 py-2 rounded bg-[var(--brand-primary)] text-[var(--bg-base)] text-sm font-medium">
                    Primary Button
                  </button>
                  <button className="px-3 py-2 rounded border border-[var(--border-strong)] text-[var(--text-high)] text-sm">
                    Secondary Button
                  </button>
                  <span className="inline-flex h-[22px] items-center justify-center gap-1.5 px-2.5 rounded-full border border-[var(--border-strong)] text-[10px] text-[var(--text-high)] bg-[var(--surface-3)]">
                    Pill Example
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-[var(--radius)] border border-[var(--border-hairline)] bg-[var(--surface-2)]">
                <p className="text-[var(--text-high)] font-semibold mb-2">Text & Borders</p>
                <div className="text-[var(--text-high)]">High contrast text</div>
                <div className="text-[var(--text-muted)]">Muted text</div>
                <div className="mt-2 h-10 rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2 flex items-center text-[var(--text-muted)]">
                  Input preview
                </div>
              </div>
            </div>
          </div>

          {/* App Name */}
          <div className="space-y-2">
            <Label htmlFor="appName" className="text-[var(--text-high)]">
              Application Name
            </Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g., Honey Drip"
              className="bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
            />
            <p className="text-xs text-[var(--text-muted)]">
              Displayed in header, page title, and authentication screens
            </p>
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label className="text-[var(--text-high)]">Logo</Label>
            <div className="flex items-center gap-3">
              {logoUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="w-12 h-12 rounded border border-[var(--border-hairline)] object-contain bg-[var(--surface-2)]"
                  />
                  <HDButton
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(logoUrl, "_blank")}
                  >
                    View
                  </HDButton>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <HDButton
                variant="secondary"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                <Upload className="w-4 h-4" />
                {uploadingLogo ? "Uploading..." : "Upload Logo"}
              </HDButton>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Recommended: 128x128px, PNG or SVG (max 5MB)
            </p>
          </div>

          {/* Favicon Upload */}
          <div className="space-y-2">
            <Label className="text-[var(--text-high)]">Favicon</Label>
            <div className="flex items-center gap-3">
              {faviconUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={faviconUrl}
                    alt="Favicon preview"
                    className="w-8 h-8 rounded border border-[var(--border-hairline)] object-contain bg-[var(--surface-2)]"
                  />
                  <HDButton
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(faviconUrl, "_blank")}
                  >
                    View
                  </HDButton>
                </div>
              )}
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/*"
                onChange={handleFaviconUpload}
                className="hidden"
              />
              <HDButton
                variant="secondary"
                onClick={() => faviconInputRef.current?.click()}
                disabled={uploadingFavicon}
              >
                <Image className="w-4 h-4" />
                {uploadingFavicon ? "Uploading..." : "Upload Favicon"}
              </HDButton>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Recommended: 32x32px, PNG or ICO (max 1MB)
            </p>
          </div>

          {/* Brand Color */}
          <div className="space-y-2">
            <Label htmlFor="brandColor" className="text-[var(--text-high)]">
              Primary Brand Color
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="brandColor"
                type="color"
                value={brandPrimaryColor}
                onChange={(e) => setBrandPrimaryColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                value={brandPrimaryColor}
                onChange={(e) => setBrandPrimaryColor(e.target.value)}
                placeholder="#f59e0b"
                className="flex-1 bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Used for buttons, accents, and interactive elements
            </p>
          </div>

          {/* Support Email */}
          <div className="space-y-2">
            <Label htmlFor="supportEmail" className="text-[var(--text-high)]">
              Support Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@yourdomain.com"
                className="pl-10 bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">Customer support contact email</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
          <h4 className="text-sm font-medium text-[var(--text-high)] mb-2">
            📋 Deployment Instructions
          </h4>
          <ul className="text-xs text-[var(--text-muted)] space-y-1">
            <li>• After saving, reload the page to see changes take effect</li>
            <li>• Logo appears in header navigation bar</li>
            <li>• Favicon appears in browser tabs and bookmarks</li>
            <li>• Brand color applies to buttons, links, and accents</li>
            <li>• All changes are specific to your deployment</li>
          </ul>
        </div>
      </div>
    </HDCard>
  );
}
