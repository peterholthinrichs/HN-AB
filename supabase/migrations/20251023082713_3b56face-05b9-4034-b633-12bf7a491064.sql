-- Allow public users to list documents in the documents bucket
CREATE POLICY "Public can list documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');