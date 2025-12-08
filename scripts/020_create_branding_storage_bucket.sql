-- Storage Bucket Setup for Branding Assets
-- Run this in Supabase SQL Editor to create storage bucket for logos/favicons
-- Date: 2025-12-07

-- Create storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  true, -- Public bucket for serving assets
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read from branding bucket (public assets)
CREATE POLICY "branding_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'branding');

-- Policy: Super admins can upload to branding bucket
CREATE POLICY "branding_super_admin_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_admin = true
    )
  );

-- Policy: Super admins can update their own files
CREATE POLICY "branding_super_admin_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_admin = true
    )
  );

-- Policy: Super admins can delete their own files
CREATE POLICY "branding_super_admin_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_admin = true
    )
  );

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads. branding bucket contains white-label logos and favicons.';
