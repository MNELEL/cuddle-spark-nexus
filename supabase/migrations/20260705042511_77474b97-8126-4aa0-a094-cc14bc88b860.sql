CREATE POLICY "ingest_staging_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ingest-staging' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'ingest-staging' AND (storage.foldername(name))[1] = auth.uid()::text);