-- Migration 029: Add contract_key column for canonical contract tracking
--
-- This adds a contract_key column to the trades table for:
-- - Joining trades with signals and outcomes
-- - Grouping performance by contract
-- - Supporting backtest aggregation
--
-- Format examples:
--   STK:SPY         (stock)
--   FUT:ES:2026-03  (futures)
--   OPT:SPY:2026-02-19:510:C  (options)

-- Add contract_key column
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS contract_key TEXT;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_trades_contract_key
ON trades(contract_key);

-- Add index for contract_key + user_id (common query pattern)
CREATE INDEX IF NOT EXISTS idx_trades_contract_key_user
ON trades(user_id, contract_key);

-- Backfill contract_key for existing trades based on contract JSONB
-- This extracts data from the existing contract column
UPDATE trades
SET contract_key =
  CASE
    -- Options: OPT:SYMBOL:EXPIRY:STRIKE:TYPE
    WHEN contract IS NOT NULL
      AND contract->>'strike' IS NOT NULL
      AND (contract->>'expiry' IS NOT NULL OR contract->>'expiration' IS NOT NULL)
      AND (contract->>'type' IS NOT NULL OR contract->>'right' IS NOT NULL)
    THEN
      'OPT:' ||
      UPPER(COALESCE(contract->>'symbol', SUBSTRING(ticker FROM 3 FOR 10))) || ':' ||
      COALESCE(contract->>'expiry', contract->>'expiration') || ':' ||
      (contract->>'strike') || ':' ||
      COALESCE(contract->>'type', contract->>'right')
    -- Fall back to extracting from ticker for legacy records
    -- OCC format: O:SPY250219C00510000 -> extract SPY using regex
    WHEN ticker LIKE 'O:%' AND strike IS NOT NULL AND expiration IS NOT NULL AND contract_type IS NOT NULL
    THEN
      'OPT:' ||
      UPPER(REGEXP_REPLACE(ticker, '^O:([A-Z]+)[0-9].*$', '\1')) || ':' ||
      expiration || ':' ||
      strike || ':' ||
      contract_type
    ELSE NULL
  END
WHERE contract_key IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN trades.contract_key IS
  'Canonical contract key for tracking. Format: OPT:SYMBOL:EXPIRY:STRIKE:TYPE or STK:SYMBOL or FUT:SYMBOL:EXPIRY';
