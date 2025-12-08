-- Add performance indexes for trade queries by state
-- This optimizes filtering trades by LOADED/ENTERED/EXITED states

-- Single-column index on state for basic queries
CREATE INDEX IF NOT EXISTS idx_trades_state 
ON trades(state);

-- Composite index for user + state queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_trades_user_state 
ON trades(user_id, state);

-- Add comment for documentation
COMMENT ON INDEX idx_trades_state IS 
  'Optimizes queries filtering trades by state (WATCHING, LOADED, ENTERED, EXITED)';

COMMENT ON INDEX idx_trades_user_state IS 
  'Optimizes user-specific trade queries by state (e.g., get all entered trades for user)';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully added state indexes to trades table';
END $$;
