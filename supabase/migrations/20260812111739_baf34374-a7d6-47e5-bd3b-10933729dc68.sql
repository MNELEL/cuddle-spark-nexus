CREATE TABLE public.ingest_ai_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid,
  resource_id uuid,
  resource_title text NOT NULL DEFAULT '',
  suggested_topic_id uuid,
  suggested_topic_name text NOT NULL DEFAULT '',
  topic_confidence numeric NOT NULL DEFAULT 0,
  confidence_threshold numeric NOT NULL DEFAULT 0.6,
  suggested_collection_ids uuid[] NOT NULL DEFAULT '{}',
  final_topic_id uuid,
  final_collection_ids uuid[] NOT NULL DEFAULT '{}',
  topic_changed boolean NOT NULL DEFAULT false,
  collections_changed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ingest_ai_suggestions TO authenticated;
GRANT ALL ON public.ingest_ai_suggestions TO service_role;
ALTER TABLE public.ingest_ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingest_ai_suggestions_select_own" ON public.ingest_ai_suggestions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "ingest_ai_suggestions_insert_own" ON public.ingest_ai_suggestions
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_ingest_ai_suggestions_owner_created
  ON public.ingest_ai_suggestions (owner_id, created_at DESC);

CREATE TABLE public.ingest_ai_settings (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_confidence_threshold numeric NOT NULL DEFAULT 0.6,
  collection_confidence_threshold numeric NOT NULL DEFAULT 0.6,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ingest_ai_settings TO authenticated;
GRANT ALL ON public.ingest_ai_settings TO service_role;
ALTER TABLE public.ingest_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingest_ai_settings_own" ON public.ingest_ai_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER ingest_ai_settings_touch
  BEFORE UPDATE ON public.ingest_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();