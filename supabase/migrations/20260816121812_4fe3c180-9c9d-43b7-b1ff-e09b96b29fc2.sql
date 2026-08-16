ALTER TABLE public.teaching_resources ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS teaching_resources_owner_hash_idx
  ON public.teaching_resources (owner_id, content_hash)
  WHERE content_hash IS NOT NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS grades_sheet_id text;