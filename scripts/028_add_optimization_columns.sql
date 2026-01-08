-- Migration: Add Optimization Columns to strategy_definitions
-- Phase 4: Production-Ready GA Optimizer
--
-- Adds columns for automated parameter optimization:
-- - auto_optimize: Flag to enable/disable optimization for a strategy
-- - pending_params: JSON blob of optimized params awaiting user approval
-- - last_optimized_at: Timestamp of last successful optimization run
-- - baseline_expectancy: Cached expectancy before optimization (for comparison)

-- 1. Add new columns
ALTER TABLE public.strategy_definitions
ADD COLUMN IF NOT EXISTS auto_optimize boolean NOT NULL DEFAULT false;

ALTER TABLE public.strategy_definitions
ADD COLUMN IF NOT EXISTS pending_params jsonb;

ALTER TABLE public.strategy_definitions
ADD COLUMN IF NOT EXISTS last_optimized_at timestamptz;

ALTER TABLE public.strategy_definitions
ADD COLUMN IF NOT EXISTS baseline_expectancy numeric;

-- 2. Add index for optimizer queries (find strategies needing optimization)
CREATE INDEX IF NOT EXISTS idx_strategy_definitions_auto_optimize
ON public.strategy_definitions(auto_optimize, enabled)
WHERE auto_optimize = true AND enabled = true;

-- 3. Add comments for documentation
COMMENT ON COLUMN public.strategy_definitions.auto_optimize IS
  'If true, the GA optimizer will include this strategy in optimization runs';

COMMENT ON COLUMN public.strategy_definitions.pending_params IS
  'JSON blob of optimized parameters awaiting user approval. Structure: { riskReward: {...}, consensus: {...} }';

COMMENT ON COLUMN public.strategy_definitions.last_optimized_at IS
  'Timestamp of the last successful optimization run for this strategy';

COMMENT ON COLUMN public.strategy_definitions.baseline_expectancy IS
  'Cached baseline expectancy (before optimization) for comparison. Updated each optimization run.';

-- 4. (Optional) Enable auto_optimize for core library strategies by default
-- Uncomment to enable:
-- UPDATE public.strategy_definitions
-- SET auto_optimize = true
-- WHERE is_core_library = true AND enabled = true;

-- End of migration.
