-- Migration 017: Add user settings and social media handles
-- Purpose: Complete user profile settings with persistence and social integration
-- Date: 2025-12-07

-- =====================================================
-- PART 1: Add user preference settings to profiles
-- =====================================================

-- Voice command settings
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT true;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS voice_require_confirmation BOOLEAN DEFAULT true;

-- Live data behavior settings
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS atr_multi_timeframe BOOLEAN DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS auto_infer_trade_type BOOLEAN DEFAULT true;

-- =====================================================
-- PART 2: Add social media handles to profiles
-- =====================================================

-- Twitter/X handle (without @)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS twitter_handle TEXT;

-- Instagram handle (without @)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

-- TikTok handle (without @)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tiktok_handle TEXT;

-- YouTube channel URL or handle
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS youtube_handle TEXT;

-- Social sharing preference (for future feature)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS social_sharing_enabled BOOLEAN DEFAULT false;

-- =====================================================
-- PART 3: Make Discord channels global (shared across admins)
-- =====================================================

-- Add is_global flag to discord_channels
-- When is_global = true, channel is visible to all authenticated users
ALTER TABLE discord_channels
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Create index for fast global channel lookup
CREATE INDEX IF NOT EXISTS idx_discord_channels_global
ON discord_channels(is_global)
WHERE is_global = true;

-- Update RLS policy to allow reading global channels
-- First, drop existing select policy if it exists
DROP POLICY IF EXISTS "Users can view own channels" ON discord_channels;
DROP POLICY IF EXISTS "Users can view own or global channels" ON discord_channels;

-- Create new policy that allows viewing own channels OR global channels
CREATE POLICY "Users can view own or global channels"
ON discord_channels FOR SELECT
USING (
  auth.uid() = user_id
  OR is_global = true
);

-- Note: INSERT/UPDATE/DELETE policies remain user-specific
-- Only channel owners can modify their channels

-- =====================================================
-- PART 4: Add comments for documentation
-- =====================================================

COMMENT ON COLUMN profiles.voice_enabled IS 'Enable voice command functionality';
COMMENT ON COLUMN profiles.voice_require_confirmation IS 'Require confirmation dialog for voice-triggered trades';
COMMENT ON COLUMN profiles.atr_multi_timeframe IS 'Use multi-timeframe ATR analysis for stop-loss levels';
COMMENT ON COLUMN profiles.auto_infer_trade_type IS 'Auto-classify trades as Scalp/Day/Swing/LEAP based on DTE';
COMMENT ON COLUMN profiles.twitter_handle IS 'Twitter/X handle without @ symbol';
COMMENT ON COLUMN profiles.instagram_handle IS 'Instagram handle without @ symbol';
COMMENT ON COLUMN profiles.tiktok_handle IS 'TikTok handle without @ symbol';
COMMENT ON COLUMN profiles.youtube_handle IS 'YouTube channel URL or handle';
COMMENT ON COLUMN profiles.social_sharing_enabled IS 'Allow automated sharing to connected social accounts (future feature)';
COMMENT ON COLUMN discord_channels.is_global IS 'If true, channel is visible to all authenticated users';
