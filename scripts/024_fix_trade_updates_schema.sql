-- Migration 024: Fix trade_updates schema
-- Purpose: Ensure trade_updates table has the correct schema for the current codebase
-- Date: December 2025
--
-- Background: The trade_updates table had different schemas in different migration files.
-- The older schema (001_create_tables.sql) used 'action' column with 'quantity' NOT NULL
-- The newer schema (001_create_schema.sql) uses 'type' column with 'message' NOT NULL
-- This migration ensures the production database matches the codebase expectations.

-- Step 1: Check if 'action' column exists (old schema) and 'type' doesn't exist
-- If so, rename 'action' to 'type'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_updates' AND column_name = 'action'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_updates' AND column_name = 'type'
  ) THEN
    -- Rename action to type
    ALTER TABLE public.trade_updates RENAME COLUMN action TO type;

    -- Drop old constraint if exists
    ALTER TABLE public.trade_updates DROP CONSTRAINT IF EXISTS trade_updates_action_check;
  END IF;
END $$;

-- Step 2: Add 'type' column if it doesn't exist
ALTER TABLE public.trade_updates
ADD COLUMN IF NOT EXISTS type TEXT;

-- Step 3: Add or update CHECK constraint for 'type' column
ALTER TABLE public.trade_updates DROP CONSTRAINT IF EXISTS trade_updates_type_check;
ALTER TABLE public.trade_updates
ADD CONSTRAINT trade_updates_type_check
CHECK (type IN ('enter', 'trim', 'update', 'update-sl', 'trail-stop', 'add', 'exit'));

-- Step 4: Add 'message' column if it doesn't exist
ALTER TABLE public.trade_updates
ADD COLUMN IF NOT EXISTS message TEXT;

-- Step 5: Add 'timestamp' column if it doesn't exist
ALTER TABLE public.trade_updates
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 6: Add 'pnl_percent' column if it doesn't exist
ALTER TABLE public.trade_updates
ADD COLUMN IF NOT EXISTS pnl_percent NUMERIC;

-- Step 7: Make quantity nullable (it was NOT NULL in old schema but new schema doesn't use it)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_updates'
    AND column_name = 'quantity'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.trade_updates ALTER COLUMN quantity DROP NOT NULL;
  END IF;
END $$;

-- Step 8: Set default values for message column for existing rows
UPDATE public.trade_updates SET message = type || ' action' WHERE message IS NULL;

-- Step 9: Now make message NOT NULL
DO $$
BEGIN
  -- Only add NOT NULL if column allows null
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_updates'
    AND column_name = 'message'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.trade_updates ALTER COLUMN message SET NOT NULL;
  END IF;
END $$;

-- Step 10: Ensure proper index exists
CREATE INDEX IF NOT EXISTS idx_trade_updates_trade_id ON public.trade_updates(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_updates_timestamp ON public.trade_updates(timestamp DESC);

-- Step 11: Verify RLS policies exist
DO $$
BEGIN
  -- Create select policy if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trade_updates'
    AND policyname LIKE '%select%'
  ) THEN
    CREATE POLICY "trade_updates_select_own" ON public.trade_updates
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- Create insert policy if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trade_updates'
    AND policyname LIKE '%insert%'
  ) THEN
    CREATE POLICY "trade_updates_insert_own" ON public.trade_updates
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE public.trade_updates IS 'Trade action history: entries, trims, exits, etc.';
COMMENT ON COLUMN public.trade_updates.type IS 'Action type: enter, trim, update, update-sl, trail-stop, add, exit';
COMMENT ON COLUMN public.trade_updates.message IS 'Human-readable description of the action';
COMMENT ON COLUMN public.trade_updates.pnl_percent IS 'P&L percentage at time of action';
