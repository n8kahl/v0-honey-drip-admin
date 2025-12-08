-- Migration: Add voice_audio_feedback to profiles
-- Run this in Supabase SQL Editor

-- Add voice_audio_feedback column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS voice_audio_feedback BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN profiles.voice_audio_feedback IS 'Enable text-to-speech audio feedback for voice commands';
