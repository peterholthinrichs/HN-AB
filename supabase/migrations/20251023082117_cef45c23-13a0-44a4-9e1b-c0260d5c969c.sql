-- Allow authenticated users to list documents in the documents bucket
CREATE POLICY "Authenticated users can list documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');