-- ============================================================================
-- Migration: Add Scanner Heartbeat Table
-- Purpose: Track server-side scanner worker health and status
-- Created: 2025-11-19
-- ============================================================================

-- Create scanner_heartbeat table
CREATE TABLE IF NOT EXISTS public.scanner_heartbeat (
  id TEXT PRIMARY KEY,
  last_scan TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signals_detected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'healthy',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.scanner_heartbeat IS 'Tracks server-side scanner worker health and last scan timestamp';

-- Enable Row Level Security (though this is system-only data)
ALTER TABLE public.scanner_heartbeat ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to read/write
CREATE POLICY "Service role can manage scanner heartbeat"
  ON public.scanner_heartbeat
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to read (for health check visibility)
CREATE POLICY "Authenticated users can view scanner heartbeat"
  ON public.scanner_heartbeat
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index on last_scan for quick health checks
CREATE INDEX IF NOT EXISTS idx_scanner_heartbeat_last_scan
  ON public.scanner_heartbeat(last_scan DESC);

-- Insert initial heartbeat record
INSERT INTO public.scanner_heartbeat (id, last_scan, signals_detected, status, metadata)
VALUES (
  'main_scanner',
  NOW(),
  0,
  'initializing',
  '{"version": "1.0", "description": "Main signal scanner worker"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Optional: Add automatic signal cleanup function
-- ============================================================================

-- Function to clean up old signals (30 day retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_strategy_signals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.strategy_signals
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status != 'FILLED'; -- Keep filled signals for record-keeping

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % old strategy signals', deleted_count;

  RETURN deleted_count;
END;
$$;

-- Comment on function
COMMENT ON FUNCTION public.cleanup_old_strategy_signals()
IS 'Deletes strategy signals older than 30 days (except filled ones)';

-- ============================================================================
-- Note: Signal cleanup can be run manually or scheduled via:
-- 1. Supabase cron (if available in your plan)
-- 2. External cron job calling a Supabase function
-- 3. Within the scanner worker itself (recommended)
-- ============================================================================

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_old_strategy_signals() TO service_role;
