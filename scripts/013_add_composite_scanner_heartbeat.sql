-- ============================================================================
-- Migration: Add Composite Scanner Heartbeat Record
-- Purpose: Ensure composite scanner has a heartbeat record for health checks
-- Created: 2025-11-23
-- ============================================================================

-- Insert composite scanner heartbeat record (if it doesn't exist)
INSERT INTO public.scanner_heartbeat (id, last_scan, signals_detected, status, metadata)
VALUES (
  'composite_scanner',
  NOW(),
  0,
  'initializing',
  '{"version": "2.0", "description": "Composite signal scanner worker (Phase 5+)", "features": ["multi-detector", "confluence-scoring", "weekend-support"]}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW(),
  metadata = EXCLUDED.metadata;

-- Verify both scanner records exist
SELECT
  id,
  last_scan,
  signals_detected,
  status,
  (NOW() - last_scan) AS age,
  metadata->>'description' AS description
FROM public.scanner_heartbeat
ORDER BY id;
