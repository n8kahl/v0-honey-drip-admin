/**
 * useUserSettings Hook
 * Centralized hook for managing user profile settings with database persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export interface UserProfile {
  id: string;
  displayName: string;
  discordHandle: string;
  avatarUrl: string;
  // Social media
  twitterHandle: string;
  instagramHandle: string;
  tiktokHandle: string;
  youtubeHandle: string;
  socialSharingEnabled: boolean;
  // Voice settings
  voiceEnabled: boolean;
  voiceRequireConfirmation: boolean;
  // Live data behavior
  atrMultiTimeframe: boolean;
  autoInferTradeType: boolean;
  // TP/SL settings
  tpMode: 'percent' | 'calculated';
  tpPercent: number;
  slPercent: number;
  tpNearThreshold: number;
  tpAutoOpenTrim: boolean;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PROFILE: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  displayName: '',
  discordHandle: '',
  avatarUrl: '',
  twitterHandle: '',
  instagramHandle: '',
  tiktokHandle: '',
  youtubeHandle: '',
  socialSharingEnabled: false,
  voiceEnabled: true,
  voiceRequireConfirmation: true,
  atrMultiTimeframe: false,
  autoInferTradeType: true,
  tpMode: 'percent',
  tpPercent: 50,
  slPercent: 20,
  tpNearThreshold: 0.85,
  tpAutoOpenTrim: true,
};

interface UseUserSettingsReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  refreshProfile: () => Promise<void>;
}

export function useUserSettings(): UseUserSettingsReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load profile from database
  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        // Profile doesn't exist, create it
        if (fetchError.code === 'PGRST116') {
          const newProfile = {
            id: user.id,
            display_name: user.email?.split('@')[0] || 'Trader',
            ...mapToSnakeCase(DEFAULT_PROFILE),
          };

          const { data: created, error: createError } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .single();

          if (createError) throw createError;
          setProfile(mapToCamelCase(created));
        } else {
          throw fetchError;
        }
      } else {
        setProfile(mapToCamelCase(data));
      }
    } catch (err) {
      console.error('[useUserSettings] Failed to load profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Update profile in database
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user?.id) {
      throw new Error('Not authenticated');
    }

    try {
      const snakeCaseUpdates = mapToSnakeCase(updates);
      snakeCaseUpdates.updated_at = new Date().toISOString();

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(snakeCaseUpdates)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setProfile(mapToCamelCase(data));
    } catch (err) {
      console.error('[useUserSettings] Failed to update profile:', err);
      throw err;
    }
  }, [user?.id]);

  // Upload avatar to Supabase Storage
  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    if (!user?.id) {
      throw new Error('Not authenticated');
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Image must be less than 2MB');
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      // Update profile with new avatar URL
      await updateProfile({ avatarUrl });

      return avatarUrl;
    } catch (err) {
      console.error('[useUserSettings] Failed to upload avatar:', err);
      throw err;
    }
  }, [user?.id, updateProfile]);

  // Load profile on mount and user change
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    uploadAvatar,
    refreshProfile: loadProfile,
  };
}

// Helper to convert camelCase to snake_case for DB
function mapToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

// Helper to convert snake_case to camelCase for frontend
function mapToCamelCase(obj: Record<string, any>): UserProfile {
  return {
    id: obj.id,
    displayName: obj.display_name || '',
    discordHandle: obj.discord_handle || '',
    avatarUrl: obj.avatar_url || '',
    twitterHandle: obj.twitter_handle || '',
    instagramHandle: obj.instagram_handle || '',
    tiktokHandle: obj.tiktok_handle || '',
    youtubeHandle: obj.youtube_handle || '',
    socialSharingEnabled: obj.social_sharing_enabled ?? false,
    voiceEnabled: obj.voice_enabled ?? true,
    voiceRequireConfirmation: obj.voice_require_confirmation ?? true,
    atrMultiTimeframe: obj.atr_multi_timeframe ?? false,
    autoInferTradeType: obj.auto_infer_trade_type ?? true,
    tpMode: obj.tp_mode || 'percent',
    tpPercent: obj.tp_percent ?? 50,
    slPercent: obj.sl_percent ?? 20,
    tpNearThreshold: obj.tp_near_threshold ?? 0.85,
    tpAutoOpenTrim: obj.tp_auto_open_trim ?? true,
    createdAt: obj.created_at,
    updatedAt: obj.updated_at,
  };
}
