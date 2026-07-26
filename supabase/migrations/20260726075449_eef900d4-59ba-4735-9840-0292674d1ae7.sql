ALTER TABLE public.certificate_notes
  ADD COLUMN IF NOT EXISTS subjects JSONB,
  ADD COLUMN IF NOT EXISTS conducts JSONB;