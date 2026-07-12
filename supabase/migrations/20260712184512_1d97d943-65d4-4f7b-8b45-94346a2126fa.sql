-- Add UPDATE policy for lesson-recordings bucket scoped to owner folder
CREATE POLICY "Teachers can update their own lesson recordings"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lesson-recordings' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'lesson-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Move pgvector extension out of public schema into dedicated 'extensions' schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION vector SET SCHEMA extensions;