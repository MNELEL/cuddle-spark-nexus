
CREATE POLICY tr_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'teaching-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY tr_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'teaching-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY tr_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'teaching-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY tr_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'teaching-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
