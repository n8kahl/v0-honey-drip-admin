-- Migration: Add active_params column to strategy_definitions
-- Phase 7: Support for activated optimization parameters
--
-- Flow:
-- 1. Optimizer writes optimized params to pending_params
-- 2. Admin reviews and activates via API endpoint
-- 3. Activation copies pending_params → active_params
-- 4. Scanner loads active_params for runtime configuration

-- 1. Add active_params column
ALTER TABLE public.strategy_definitions
ADD COLUMN IF NOT EXISTS active_params jsonb;

-- 2. Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_strategy_definitions_active_params
ON public.strategy_definitions(id)
WHERE active_params IS NOT NULL;

-- 3. Add comments for documentation
COMMENT ON COLUMN public.strategy_definitions.active_params IS
  'Activated optimization parameters. Copied from pending_params when admin approves. Used by scanner at runtime.';

-- 4. Create function to activate pending params
CREATE OR REPLACE FUNCTION public.activate_strategy_params(strategy_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Copy pending_params to active_params
  UPDATE public.strategy_definitions
  SET
    active_params = pending_params,
    updated_at = now()
  WHERE id = strategy_id
    AND pending_params IS NOT NULL
  RETURNING active_params INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'No pending params found for strategy %', strategy_id;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to batch activate all pending params
CREATE OR REPLACE FUNCTION public.activate_all_pending_params()
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Copy pending_params to active_params for all strategies with pending params
  WITH updated AS (
    UPDATE public.strategy_definitions
    SET
      active_params = pending_params,
      updated_at = now()
    WHERE pending_params IS NOT NULL
      AND enabled = true
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End of migration.
