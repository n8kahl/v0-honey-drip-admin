-- Migration 015: Add TP/SL Settings to profiles
-- Purpose: Support configurable take profit and stop loss settings per user

-- Add TP mode column (replaces tp_strategy semantically)
-- 'percent': Use fixed percentage for TP/SL calculation
-- 'calculated': Use ATR-based or level-based calculation
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tp_mode TEXT DEFAULT 'percent'
  CHECK (tp_mode IN ('percent', 'calculated'));

-- Default TP percentage (50% = target is entry + 50% gain)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tp_percent NUMERIC DEFAULT 50
  CHECK (tp_percent > 0 AND tp_percent <= 500);

-- Default SL percentage (20% = stop is entry - 20% loss)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS sl_percent NUMERIC DEFAULT 20
  CHECK (sl_percent > 0 AND sl_percent <= 100);

-- TP near threshold (0.85 = 85% of target reached triggers "near TP" alert)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tp_near_threshold NUMERIC DEFAULT 0.85
  CHECK (tp_near_threshold > 0 AND tp_near_threshold < 1);

-- Auto-open trim dialog when near TP
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tp_auto_open_trim BOOLEAN DEFAULT true;

-- Comment on columns for documentation
COMMENT ON COLUMN profiles.tp_mode IS 'TP calculation mode: percent (fixed %) or calculated (ATR-based)';
COMMENT ON COLUMN profiles.tp_percent IS 'Default take profit percentage (e.g., 50 = +50% from entry)';
COMMENT ON COLUMN profiles.sl_percent IS 'Default stop loss percentage (e.g., 20 = -20% from entry)';
COMMENT ON COLUMN profiles.tp_near_threshold IS 'Threshold for "near TP" notification (0-1, e.g., 0.85 = 85% of target)';
COMMENT ON COLUMN profiles.tp_auto_open_trim IS 'Auto-open trim dialog when price approaches TP';
