
CREATE EXTENSION IF NOT EXISTS vector;

-- columns on existing tables (embeddings + source link)
ALTER TABLE public.teaching_resources
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS source_transcript_id uuid;

ALTER TABLE public.weekly_bulletins
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- bulletin_resources: link resources used in a bulletin
CREATE TABLE IF NOT EXISTS public.bulletin_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id uuid NOT NULL REFERENCES public.weekly_bulletins(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.teaching_resources(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bulletin_id, resource_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulletin_resources TO authenticated;
GRANT ALL ON public.bulletin_resources TO service_role;
ALTER TABLE public.bulletin_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages bulletin_resources" ON public.bulletin_resources
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- lesson_transcripts: recordings -> transcript + summary
CREATE TABLE IF NOT EXISTS public.lesson_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  audio_path text,
  duration_seconds int,
  transcript text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending|transcribing|done|failed
  error text,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_transcripts TO authenticated;
GRANT ALL ON public.lesson_transcripts TO service_role;
ALTER TABLE public.lesson_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages lesson_transcripts" ON public.lesson_transcripts
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER lesson_transcripts_updated_at BEFORE UPDATE ON public.lesson_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- teacher_style_profile: per-user learned preferences
CREATE TABLE IF NOT EXISTS public.teacher_style_profile (
  user_id uuid PRIMARY KEY,
  preferred_subjects jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_resource_types jsonb NOT NULL DEFAULT '{}'::jsonb,
  avg_questions_per_worksheet numeric NOT NULL DEFAULT 0,
  avg_question_length numeric NOT NULL DEFAULT 0,
  tone_keywords text[] NOT NULL DEFAULT '{}',
  writing_style_sample text NOT NULL DEFAULT '',
  weekly_pace jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_count int NOT NULL DEFAULT 0,
  last_ai_summary text NOT NULL DEFAULT '',
  last_updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_style_profile TO authenticated;
GRANT ALL ON public.teacher_style_profile TO service_role;
ALTER TABLE public.teacher_style_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages style profile" ON public.teacher_style_profile
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- match function for resource recommendations
CREATE OR REPLACE FUNCTION public.match_resources(
  query_embedding vector(1536),
  owner uuid,
  match_count int DEFAULT 6,
  exclude_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, 1 - (r.embedding <=> query_embedding) AS similarity
  FROM public.teaching_resources r
  WHERE r.owner_id = owner
    AND r.embedding IS NOT NULL
    AND (exclude_id IS NULL OR r.id <> exclude_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- HNSW indexes (cosine)
CREATE INDEX IF NOT EXISTS teaching_resources_embedding_idx
  ON public.teaching_resources USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS weekly_bulletins_embedding_idx
  ON public.weekly_bulletins USING hnsw (embedding vector_cosine_ops);
