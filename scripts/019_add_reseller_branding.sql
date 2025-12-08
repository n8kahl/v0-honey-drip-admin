-- Migration 019: Add reseller branding configuration
-- Creates table for storing white-label branding configs managed by super admins
-- Date: 2025-12-07

-- Create reseller_configs table
CREATE TABLE IF NOT EXISTS reseller_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Branding fields
  app_name TEXT NOT NULL DEFAULT 'Honey Drip',
  logo_url TEXT,
  favicon_url TEXT,
  brand_primary_color TEXT DEFAULT '#f59e0b',
  support_email TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_reseller_configs_user_id
ON reseller_configs(user_id);

-- Enable RLS
ALTER TABLE reseller_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Super admins can read their own config
CREATE POLICY "reseller_configs_select" ON reseller_configs
  FOR SELECT
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_admin = true
    )
  );

-- RLS Policy: Super admins can insert their own config
CREATE POLICY "reseller_configs_insert" ON reseller_configs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_admin = true
    )
  );

-- RLS Policy: Super admins can update their own config
CREATE POLICY "reseller_configs_update" ON reseller_configs
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_admin = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_admin = true
    )
  );

-- RLS Policy: Super admins can delete their own config
CREATE POLICY "reseller_configs_delete" ON reseller_configs
  FOR DELETE
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_admin = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reseller_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER reseller_configs_updated_at
BEFORE UPDATE ON reseller_configs
FOR EACH ROW
EXECUTE FUNCTION update_reseller_configs_updated_at();

-- Add comments for documentation
COMMENT ON TABLE reseller_configs IS 'White-label branding configurations for resellers (super admin only)';
COMMENT ON COLUMN reseller_configs.user_id IS 'Super admin who owns this configuration';
COMMENT ON COLUMN reseller_configs.app_name IS 'Custom application name for white-label deployment';
COMMENT ON COLUMN reseller_configs.logo_url IS 'URL to custom logo (stored in Supabase Storage)';
COMMENT ON COLUMN reseller_configs.favicon_url IS 'URL to custom favicon (stored in Supabase Storage)';
COMMENT ON COLUMN reseller_configs.brand_primary_color IS 'Primary brand color in hex format (#f59e0b)';
COMMENT ON COLUMN reseller_configs.support_email IS 'Customer support email for this reseller';
