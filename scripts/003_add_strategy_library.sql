-- Migration: Strategy Library + Signals
-- NOTE: Replace YOUR_CORE_OWNER_UUID with your actual core library owner user UUID before running.
-- This migration creates strategy_definitions and strategy_signals tables with RLS, indexes,
-- updated_at trigger, and policies for public read of enabled strategies.

-- Enable required extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid

-- 1. Tables -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_definitions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  owner               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                text NOT NULL,
  slug                text NOT NULL,
  description         text,
  category            text NOT NULL,
  underlying_scope    text NOT NULL,
  time_window         jsonb, -- { start: 'HH:MM', end: 'HH:MM', timezone: 'America/New_York' }
  bar_timeframe       text NOT NULL,
  entry_side          text NOT NULL,
  options_play_type   text,
  conditions          jsonb NOT NULL,
  alert_behavior      jsonb NOT NULL,
  cooldown_minutes    int DEFAULT 5,  -- minimal cooldown between repeated signals
  once_per_session    boolean NOT NULL DEFAULT false,
  last_fired_at       timestamptz,    -- updated by scanner when a signal fires
  is_core_library     boolean NOT NULL DEFAULT false,
  enabled             boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.strategy_signals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  symbol       text NOT NULL,
  strategy_id  uuid NOT NULL REFERENCES public.strategy_definitions(id) ON DELETE CASCADE,
  owner        uuid NOT NULL, -- mirrors strategy owner for now
  confidence   numeric,
  payload      jsonb,
  status       text NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | ACKED | DISMISSED
  -- Optional bar time key for idempotency (e.g., 2025-11-17T09:35:00Z_1m). Not enforced yet.
  bar_time_key text
);

-- 2. Basic Constraints & Indexes --------------------------------------------
ALTER TABLE public.strategy_definitions ADD CONSTRAINT strategy_definitions_slug_unique UNIQUE (slug);

-- Slug safety (lowercase, url-friendly). This is optional; comment out if not desired.
-- ALTER TABLE public.strategy_definitions ADD CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9\-]+$');

CREATE INDEX IF NOT EXISTS strategy_definitions_owner_enabled_idx ON public.strategy_definitions(owner, enabled);
CREATE INDEX IF NOT EXISTS strategy_definitions_is_core_enabled_idx ON public.strategy_definitions(is_core_library, enabled);
CREATE INDEX IF NOT EXISTS strategy_definitions_last_fired_idx ON public.strategy_definitions(last_fired_at DESC);

CREATE INDEX IF NOT EXISTS strategy_signals_symbol_strategy_created_idx ON public.strategy_signals(symbol, strategy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS strategy_signals_owner_created_idx ON public.strategy_signals(owner, created_at DESC);
CREATE INDEX IF NOT EXISTS strategy_signals_status_idx ON public.strategy_signals(status);
-- Partial index for active signals fast lookup
CREATE INDEX IF NOT EXISTS strategy_signals_active_partial_idx ON public.strategy_signals(strategy_id, symbol) WHERE status = 'ACTIVE';

-- Unique constraint for same bar to prevent duplicates (scanner now reliably sets bar_time_key)
CREATE UNIQUE INDEX IF NOT EXISTS strategy_signals_unique_bar ON public.strategy_signals(symbol, strategy_id, bar_time_key) WHERE bar_time_key IS NOT NULL;

-- 3. updated_at Trigger ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_strategy_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_strategy_definitions_updated_at ON public.strategy_definitions;
CREATE TRIGGER trg_strategy_definitions_updated_at
BEFORE UPDATE ON public.strategy_definitions
FOR EACH ROW EXECUTE FUNCTION public.set_strategy_definitions_updated_at();

-- 4. Row Level Security ------------------------------------------------------
ALTER TABLE public.strategy_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_signals ENABLE ROW LEVEL SECURITY;

-- 5. Policies: strategy_definitions -----------------------------------------
-- SELECT: any authenticated user may read enabled strategies OR their own disabled ones.
CREATE POLICY strategy_definitions_select ON public.strategy_definitions
FOR SELECT
USING (
  auth.role() = 'authenticated' AND (
    enabled = true OR owner = auth.uid()
  )
);

-- INSERT: only owner can insert their strategies.
CREATE POLICY strategy_definitions_insert ON public.strategy_definitions
FOR INSERT
WITH CHECK ( owner = auth.uid() );

-- UPDATE: owner can modify; core library rows only modifiable by core owner.
CREATE POLICY strategy_definitions_update ON public.strategy_definitions
FOR UPDATE
USING (
  owner = auth.uid() AND (
    is_core_library = false OR owner = auth.uid() -- core rows: owner must be core owner
  )
) WITH CHECK (
  owner = auth.uid() AND (
    is_core_library = false OR owner = auth.uid()
  )
);

-- DELETE: same restriction as update.
CREATE POLICY strategy_definitions_delete ON public.strategy_definitions
FOR DELETE
USING (
  owner = auth.uid() AND (
    is_core_library = false OR owner = auth.uid()
  )
);

-- 6. Policies: strategy_signals ---------------------------------------------
-- SELECT: only owner sees their signals.
CREATE POLICY strategy_signals_select ON public.strategy_signals
FOR SELECT USING ( owner = auth.uid() );

-- INSERT: only owner inserts (scanner on behalf of user should use service role or user session).
CREATE POLICY strategy_signals_insert ON public.strategy_signals
FOR INSERT WITH CHECK ( owner = auth.uid() );

-- UPDATE: owner only.
CREATE POLICY strategy_signals_update ON public.strategy_signals
FOR UPDATE USING ( owner = auth.uid() ) WITH CHECK ( owner = auth.uid() );

-- DELETE: owner only.
CREATE POLICY strategy_signals_delete ON public.strategy_signals
FOR DELETE USING ( owner = auth.uid() );

-- 7. TODO: Replace core owner logic (currently identical owner check). If you want ONE specific UUID to modify core strategies:
-- Example:
-- ALTER TABLE public.strategy_definitions ADD COLUMN core_owner uuid; -- (optional)
-- Then adjust policies to check owner = core_owner when is_core_library = true.
-- Or replace conditions above with: (is_core_library = false OR auth.uid() = 'YOUR_CORE_OWNER_UUID').

-- 8. (Optional) Retention Policy Placeholder --------------------------------
-- CREATE OR REPLACE FUNCTION public.prune_old_strategy_signals()
-- RETURNS void AS $$
-- DELETE FROM public.strategy_signals WHERE created_at < now() - interval '30 days';
-- $$ LANGUAGE sql;
-- Schedule via Supabase cron or external job runner.

-- End of migration.
