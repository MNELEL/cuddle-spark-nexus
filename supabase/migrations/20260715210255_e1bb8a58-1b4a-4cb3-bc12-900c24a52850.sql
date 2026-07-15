ALTER TABLE public.ingest_jobs DROP CONSTRAINT IF EXISTS ingest_jobs_kind_check;
ALTER TABLE public.ingest_jobs ADD CONSTRAINT ingest_jobs_kind_check
  CHECK (kind IN ('roster','resource','lesson_audio','auto'));