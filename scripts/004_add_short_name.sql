-- Migration: Add short_name to strategy_definitions
-- Run this after 003_add_strategy_library.sql

-- Add short_name column
ALTER TABLE public.strategy_definitions 
ADD COLUMN IF NOT EXISTS short_name text;

-- Add comment
COMMENT ON COLUMN public.strategy_definitions.short_name IS 'Short display name for badges (e.g., ORB, VWR, EMA). Max 3-4 characters recommended.';

-- Update existing strategies with short names based on their slugs
UPDATE public.strategy_definitions
SET short_name = CASE
  WHEN slug LIKE '%orb%' THEN 'ORB'
  WHEN slug LIKE '%vwap%' OR slug LIKE '%vwr%' THEN 'VWR'
  WHEN slug LIKE '%ema-bounce%' OR slug LIKE '%ema-rejection%' THEN 'EMA'
  WHEN slug LIKE '%cloud%' THEN 'CLD'
  WHEN slug LIKE '%fib%' THEN 'FIB'
  WHEN slug LIKE '%range%' THEN 'RNG'
  ELSE UPPER(LEFT(slug, 3))
END
WHERE short_name IS NULL;
