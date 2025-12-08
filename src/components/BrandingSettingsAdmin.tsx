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
