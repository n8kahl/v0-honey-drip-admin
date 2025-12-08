/**
 * ProfileSettings Component
 * User profile and social media configuration with database persistence
 */

import { useEffect, useState } from "react";
import { User, Loader2 } from "lucide-react";
import { HDCard } from "../hd/common/HDCard";
import { useUserSettings } from "../../hooks/useUserSettings";
import { useAppToast } from "../../hooks/useAppToast";

export function ProfileSettings() {
  const { profile, isLoading, updateProfile } = useUserSettings();
  const toast = useAppToast();

  // Local state for optimistic UI
  const [displayName, setDisplayName] = useState("");
  const [discordHandle, setDiscordHandle] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [youtubeHandle, setYoutubeHandle] = useState("");
  const [socialSharingEnabled, setSocialSharingEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with profile when loaded
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setDiscordHandle(profile.discordHandle);
      setTwitterHandle(profile.twitterHandle);
      setInstagramHandle(profile.instagramHandle);
      setTiktokHandle(profile.tiktokHandle);
      setYoutubeHandle(profile.youtubeHandle);
      setSocialSharingEnabled(profile.socialSharingEnabled);
    }
  }, [profile]);

  const handleSave = async (updates: Partial<typeof profile>) => {
    setIsSaving(true);
    try {
      await updateProfile(updates);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSocialSharingToggle = async (checked: boolean) => {
    setSocialSharingEnabled(checked);
    await handleSave({ socialSharingEnabled: checked });
  };

  if (isLoading) {
    return (
      <section>
        <HDCard>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        </HDCard>
      </section>
    );
  }

  return (
    <section>
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[var(--text-high)] mb-1">Profile & Social</h2>
                {isSaving && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
                )}
              </div>
              <p className="text-[var(--text-muted)] text-xs">
                Configure your display name and social media handles.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-[var(--text-muted)] text-sm mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => handleSave({ displayName })}
                placeholder="Your trading name"
                className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)] placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* Discord Handle */}
            <div>
              <label className="block text-[var(--text-muted)] text-sm mb-2">Discord Handle</label>
              <input
                type="text"
                value={discordHandle}
                onChange={(e) => setDiscordHandle(e.target.value)}
                onBlur={() => handleSave({ discordHandle })}
                placeholder="@username"
                className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)] placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* Social Media Handles */}
            <div className="border-t border-[var(--border-hairline)] pt-4">
              <h3 className="text-[var(--text-high)] text-sm font-medium mb-3">Social Media</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--text-muted)] text-xs mb-2">Twitter / X</label>
                  <input
                    type="text"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value)}
                    onBlur={() => handleSave({ twitterHandle })}
                    placeholder="@username"
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)] placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] text-xs mb-2">Instagram</label>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    onBlur={() => handleSave({ instagramHandle })}
                    placeholder="@username"
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)] placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] text-xs mb-2">TikTok</label>
                  <input
                    type="text"
                    value={tiktokHandle}
                    onChange={(e) => setTiktokHandle(e.target.value)}
                    onBlur={() => handleSave({ tiktokHandle })}
                    placeholder="@username"
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)] placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] text-xs mb-2">YouTube</label>
                  <input
                    type="text"
                    value={youtubeHandle}
                    onChange={(e) => setYoutubeHandle(e.target.value)}
                    onBlur={() => handleSave({ youtubeHandle })}
                    placeholder="@channel"
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>
            </div>

            {/* Social Sharing Toggle */}
            <div className="border-t border-[var(--border-hairline)] pt-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={socialSharingEnabled}
                  onChange={(e) => handleSocialSharingToggle(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                    Enable Social Sharing
                  </span>
                  <p className="text-[var(--text-muted)] text-xs mt-0.5">
                    Allow sharing trade alerts to your connected social media accounts
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </HDCard>
    </section>
  );
}
