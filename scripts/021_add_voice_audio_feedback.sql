-- Migration: Add voice settings to profiles
-- Run this in Supabase SQL Editor

-- Add voice_audio_feedback column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS voice_audio_feedback BOOLEAN DEFAULT true;

-- Add voice_engine column to profiles table (webspeech or whisper)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS voice_engine TEXT DEFAULT 'webspeech';

-- Add check constraint to ensure valid voice engine values
ALTER TABLE profiles
ADD CONSTRAINT voice_engine_check CHECK (voice_engine IN ('webspeech', 'whisper'));

-- Add comments
COMMENT ON COLUMN profiles.voice_audio_feedback IS 'Enable text-to-speech audio feedback for voice commands';
COMMENT ON COLUMN profiles.voice_engine IS 'Voice recognition engine: webspeech (default, fast) or whisper (accurate, offline)';
