-- Migration: 010_add_contract_fields
-- Purpose: Add contract-specific fields to trades table for options trading
-- Date: November 22, 2025

-- Add contract-related columns to trades table
ALTER TABLE public.trades
ADD COLUMN IF NOT EXISTS contract_type TEXT CHECK (contract_type IN ('C', 'P', 'CALL', 'PUT', NULL)),
ADD COLUMN IF NOT EXISTS strike NUMERIC,
ADD COLUMN IF NOT EXISTS expiration TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.trades.contract_type IS 'Contract type: C (Call), P (Put), CALL, or PUT';
COMMENT ON COLUMN public.trades.strike IS 'Strike price for options contracts';
COMMENT ON COLUMN public.trades.expiration IS 'Expiration date for options contracts (YYYY-MM-DD format)';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_contract_type
  ON public.trades(contract_type)
  WHERE contract_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_strike
  ON public.trades(strike)
  WHERE strike IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_expiration
  ON public.trades(expiration)
  WHERE expiration IS NOT NULL;

-- Verify RLS is enabled
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
