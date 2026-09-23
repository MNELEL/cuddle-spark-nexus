CREATE TABLE public.student_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  person_key uuid NOT NULL,
  student_id uuid,
  class_id uuid,
  start_date date,
  approved_at timestamptz,
  ai_summary text NOT NULL DEFAULT '',
  trends text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, person_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_summaries TO authenticated;
GRANT ALL ON public.student_summaries TO service_role;
REVOKE ALL ON public.student_summaries FROM anon;

ALTER TABLE public.student_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own summaries select" ON public.student_summaries
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own summaries insert" ON public.student_summaries
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own summaries update" ON public.student_summaries
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own summaries delete" ON public.student_summaries
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX student_summaries_person_key_idx ON public.student_summaries (person_key);

CREATE TRIGGER student_summaries_touch_updated_at
  BEFORE UPDATE ON public.student_summaries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();