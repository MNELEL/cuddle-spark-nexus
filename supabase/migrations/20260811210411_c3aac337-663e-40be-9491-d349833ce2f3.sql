ALTER TABLE public.weekly_bulletins
  ADD COLUMN IF NOT EXISTS torah_dvar_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS torah_dvar_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS study_schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS honored_students jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS special_notices jsonb NOT NULL DEFAULT '[]'::jsonb;