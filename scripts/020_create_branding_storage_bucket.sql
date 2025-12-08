-- Storage Bucket Setup for Branding Assets
-- Create this bucket through Supabase Dashboard instead of SQL
-- Date: 2025-12-07

/*
  IMPORTANT: Storage bucket policies must be created through the Supabase Dashboard UI.
  
  Follow these steps:
  
  1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/storage/buckets
  
  2. Click "New bucket"
     - Name: branding
     - Public bucket: YES (checked)
     - File size limit: 5 MB
     - Allowed MIME types: image/png, image/jpeg, image/svg+xml, image/x-icon, image/vnd.microsoft.icon
  
  3. Click on the "branding" bucket, then go to "Policies" tab
  
  4. Add these policies:
  
     Policy 1: Public Read
     - Policy name: branding_public_read
     - Allowed operation: SELECT
     - Target roles: public
     - USING expression: bucket_id = 'branding'
     
     Policy 2: Super Admin Insert
     - Policy name: branding_super_admin_insert  
     - Allowed operation: INSERT
     - Target roles: authenticated
     - WITH CHECK expression: 
       bucket_id = 'branding' AND 
       EXISTS (
         SELECT 1 FROM profiles 
         WHERE profiles.id = auth.uid() 
         AND profiles.is_super_admin = true
       )
     
     Policy 3: Super Admin Update
     - Policy name: branding_super_admin_update
     - Allowed operation: UPDATE
     - Target roles: authenticated
     - USING expression:
       bucket_id = 'branding' AND 
       EXISTS (
         SELECT 1 FROM profiles 
         WHERE profiles.id = auth.uid() 
         AND profiles.is_super_admin = true
       )
     
     Policy 4: Super Admin Delete
     - Policy name: branding_super_admin_delete
     - Allowed operation: DELETE
     - Target roles: authenticated
     - USING expression:
       bucket_id = 'branding' AND 
       EXISTS (
         SELECT 1 FROM profiles 
         WHERE profiles.id = auth.uid() 
         AND profiles.is_super_admin = true
       )
*/

-- Alternative: Create bucket via SQL (if you have permissions)
-- This may fail with "must be owner of table objects" error - use Dashboard instead
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO NOTHING;
