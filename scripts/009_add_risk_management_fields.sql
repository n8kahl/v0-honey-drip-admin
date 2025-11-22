-- Migration: 009_add_risk_management_fields
-- Purpose: Add missing risk management columns to trades table and expand trade_updates action types
-- Date: November 22, 2025

-- Add missing columns to trades table for comprehensive risk management
-- These columns support the Trade Persistence System Phase 4 implementation
ALTER TABLE public.trades
ADD COLUMN IF NOT EXISTS target_price numeric,
ADD COLUMN IF NOT EXISTS stop_loss numeric,
ADD COLUMN IF NOT EXISTS current_price numeric,
ADD COLUMN IF NOT EXISTS move_percent numeric;

-- Add comments for clarity
COMMENT ON COLUMN public.trades.target_price IS 'Target exit price for the trade';
COMMENT ON COLUMN public.trades.stop_loss IS 'Stop loss price for risk management';
COMMENT ON COLUMN public.trades.current_price IS 'Current price of the underlying asset';
COMMENT ON COLUMN public.trades.move_percent IS 'Percentage move from entry price';

-- Expand trade_updates action constraint to include all supported actions
-- Old constraint only supported: entry, trim, add, exit, stop_update
-- New constraint adds: update-sl, trail-stop, tp_near for more granular trade tracking
ALTER TABLE public.trade_updates
DROP CONSTRAINT IF EXISTS trade_updates_action_check;

ALTER TABLE public.trade_updates
ADD CONSTRAINT trade_updates_action_check
CHECK (action = ANY (ARRAY[
  'entry'::text,
  'trim'::text,
  'add'::text,
  'exit'::text,
  'stop_update'::text,
  'update-sl'::text,
  'trail-stop'::text,
  'tp_near'::text
]));

-- Add indexes for performance on commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_trades_target_price
  ON public.trades(target_price)
  WHERE target_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_stop_loss
  ON public.trades(stop_loss)
  WHERE stop_loss IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_current_price
  ON public.trades(current_price)
  WHERE current_price IS NOT NULL;

-- Update RLS policies if needed (should already be in place from 008)
-- The trades table should already have RLS enabled from previous migrations

-- Verify RLS is enabled
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Ensure RLS policies exist for the new columns
-- (policies from 008_add_trade_discord_channels.sql should already cover these)
