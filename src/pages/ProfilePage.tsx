/**
 * ProfilePage Component
 * User profile management with identity, social handles, and avatar
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Camera,
  AtSign,
  Mail,
  Calendar,
  Twitter,
  Instagram,
  Youtube,
  Share2,
  Sparkles,
  ArrowLeft,
  Check,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../hooks/useUserSettings';
import { useAppToast } from '../hooks/useAppToast';
import { HDButton } from '../components/hd/common/HDButton';
import { HDInput } from '../components/hd/common/HDInput';
import { HDCard } from '../components/hd/common/HDCard';
import { MobileWatermark } from '../components/MobileWatermark';
import { cn } from '../lib/utils';

// TikTok icon (not in lucide-react)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isLoading, updateProfile, uploadAvatar } = useUserSettings();
  const toast = useAppToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [youtubeHandle, setYoutubeHandle] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when profile loads
  useState(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setDiscordHandle(profile.discordHandle);
      setTwitterHandle(profile.twitterHandle);
      setInstagramHandle(profile.instagramHandle);
      setTiktokHandle(profile.tiktokHandle);
      setYoutubeHandle(profile.youtubeHandle);
    }
  });

  // Track changes
  const handleFieldChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  // Handle avatar upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      toast.success('Avatar updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        displayName,
        discordHandle,
        twitterHandle,
        instagramHandle,
        tiktokHandle,
        youtubeHandle,
      });
      setHasChanges(false);
      toast.success('Profile saved successfully');
    } catch (err) {
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Format date
  const formatMemberSince = (dateStr: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-[var(--bg-base)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] p-4 lg:p-6 overflow-y-auto bg-[var(--bg-base)] relative">
      <MobileWatermark />

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-[var(--radius)] hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[var(--text-high)] flex-1">Profile</h1>
          <HDButton
            variant="primary"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </HDButton>
        </div>

        <div className="space-y-6">
          {/* Avatar & Basic Info Card */}
          <HDCard>
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-[var(--brand-primary)] flex items-center justify-center overflow-hidden border-2 border-[var(--border-hairline)]">
                    {profile?.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-12 h-12 text-[var(--bg-base)]" />
                    )}
                  </div>
                  <button
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    className={cn(
                      "absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity",
                      isUploadingAvatar && "opacity-100"
                    )}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)]">Click to change</span>
              </div>

              {/* Basic Info */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                    Display Name
                  </label>
                  <HDInput
                    value={displayName}
                    onChange={handleFieldChange(setDisplayName)}
                    placeholder="Your trading alias"
                    icon={<User className="w-4 h-4" />}
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                    Discord Handle
                  </label>
                  <HDInput
                    value={discordHandle}
                    onChange={handleFieldChange(setDiscordHandle)}
                    placeholder="username#0000"
                    icon={<AtSign className="w-4 h-4" />}
                  />
                </div>
              </div>
            </div>

            {/* Account Info (Read-only) */}
            <div className="mt-6 pt-4 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs mb-1">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </div>
                <div className="text-[var(--text-high)] text-sm">
                  {user?.email || 'Not set'}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Member Since
                </div>
                <div className="text-[var(--text-high)] text-sm">
                  {formatMemberSince(profile?.createdAt || '')}
                </div>
              </div>
            </div>
          </HDCard>

          {/* Social Media Handles */}
          <HDCard>
            <div className="flex items-start gap-3 mb-4">
              <Share2 className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-[var(--text-high)] mb-1">Social Media</h2>
                <p className="text-[var(--text-muted)] text-xs">
                  Connect your social handles for trade sharing and community features.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Twitter/X */}
              <div>
                <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                  Twitter / X
                </label>
                <div className="relative">
                  <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <HDInput
                    value={twitterHandle}
                    onChange={handleFieldChange(setTwitterHandle)}
                    placeholder="username"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Instagram */}
              <div>
                <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                  Instagram
                </label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <HDInput
                    value={instagramHandle}
                    onChange={handleFieldChange(setInstagramHandle)}
                    placeholder="username"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* TikTok */}
              <div>
                <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                  TikTok
                </label>
                <div className="relative">
                  <TikTokIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <HDInput
                    value={tiktokHandle}
                    onChange={handleFieldChange(setTiktokHandle)}
                    placeholder="username"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* YouTube */}
              <div>
                <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                  YouTube
                </label>
                <div className="relative">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <HDInput
                    value={youtubeHandle}
                    onChange={handleFieldChange(setYoutubeHandle)}
                    placeholder="channel name or URL"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Social Sharing Coming Soon */}
            <div className="mt-6 pt-4 border-t border-[var(--border-hairline)]">
              <div className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-[var(--brand-primary)]/10">
                    <Sparkles className="w-5 h-5 text-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-[var(--text-high)] text-sm font-medium">
                      Auto-Share to Social
                    </h3>
                    <p className="text-[var(--text-muted)] text-xs">
                      Automatically share winning trades to your connected accounts
                    </p>
                  </div>
                </div>
                <button
                  disabled
                  className="px-4 py-2 rounded-[var(--radius)] bg-[var(--surface-3)] text-[var(--text-muted)] text-sm cursor-not-allowed opacity-60 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Coming Soon
                </button>
              </div>
            </div>
          </HDCard>

          {/* Danger Zone - Future */}
          {/* Can add account deletion, data export, etc. here later */}
        </div>
      </div>
    </div>
  );
}
