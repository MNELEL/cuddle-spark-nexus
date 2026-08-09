ALTER TABLE public.sound_preferences
  ADD COLUMN IF NOT EXISTS duration_scale numeric NOT NULL DEFAULT 1;

ALTER TABLE public.sound_preferences
  ADD CONSTRAINT sound_preferences_duration_scale_range
  CHECK (duration_scale >= 0.5 AND duration_scale <= 5);

CREATE TABLE public.custom_sounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'audio/mpeg',
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_sounds TO authenticated;
GRANT ALL ON public.custom_sounds TO service_role;

ALTER TABLE public.custom_sounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their custom sounds"
  ON public.custom_sounds FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER custom_sounds_touch_updated_at
  BEFORE UPDATE ON public.custom_sounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners read own custom sound files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'custom-sounds' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners upload own custom sound files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'custom-sounds' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners delete own custom sound files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'custom-sounds' AND (storage.foldername(name))[1] = auth.uid()::text);