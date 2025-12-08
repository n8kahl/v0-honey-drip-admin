-- Add confluence_updated_at column to trades table
-- This tracks when confluence data was last calculated for each trade

ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS confluence_updated_at TIMESTAMPTZ;

-- Add index for performance on confluence queries
CREATE INDEX IF NOT EXISTS idx_trades_confluence_updated_at 
ON trades(confluence_updated_at);

-- Add comment for documentation
COMMENT ON COLUMN trades.confluence_updated_at IS 
  'Timestamp of last confluence calculation (MTF alignment + flow analysis)';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully added confluence_updated_at column to trades table';
END $$;
