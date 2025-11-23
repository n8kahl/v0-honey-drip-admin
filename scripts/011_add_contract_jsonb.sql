-- Migration: Add contract JSONB column to trades table
-- Purpose: Store full contract object (bid, ask, volume, Greeks, etc.) for persistence
-- This allows trades to be revisited with their original contract setup
-- and fresh market data can be fetched when the trade is accessed

-- Add contract column as JSONB
ALTER TABLE trades ADD COLUMN IF NOT EXISTS contract JSONB;

-- Add index for better query performance on contract-related searches
CREATE INDEX IF NOT EXISTS idx_trades_contract ON trades USING GIN (contract);

-- Add comment to document the schema
COMMENT ON COLUMN trades.contract IS 'Full contract object stored as JSONB containing: id, strike, expiry, expiryDate, daysToExpiry, type (C/P), mid, bid, ask, volume, openInterest, delta, gamma, theta, vega, impliedVolatility';
