-- Migration 017: Add challenge enhancements
-- Adds archive support and indexes for challenges
-- Date: 2025-12-07

-- Add archived_at column for soft delete
ALTER TABLE challenges
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for active challenges (non-archived)
CREATE INDEX IF NOT EXISTS idx_challenges_active
ON challenges(user_id)
WHERE archived_at IS NULL AND is_active = true;

-- Add index for archived challenges
CREATE INDEX IF NOT EXISTS idx_challenges_archived
ON challenges(user_id, archived_at)
WHERE archived_at IS NOT NULL;

-- Comment on column for documentation
COMMENT ON COLUMN challenges.archived_at IS 'Timestamp when challenge was archived (soft delete). NULL means active.';
