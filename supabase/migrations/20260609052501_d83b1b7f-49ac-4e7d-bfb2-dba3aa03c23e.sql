
CREATE POLICY "lesson-recordings owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lesson-recordings owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lesson-recordings owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
