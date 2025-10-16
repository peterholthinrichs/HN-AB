-- Drop the restrictive policies that are blocking uploads
DROP POLICY IF EXISTS "Public can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can read documents" ON storage.objects;