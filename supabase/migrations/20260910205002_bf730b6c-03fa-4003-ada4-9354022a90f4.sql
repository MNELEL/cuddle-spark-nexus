CREATE TABLE public.teacher_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  summary text NOT NULL,
  action_items text,
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_meetings TO authenticated;
GRANT ALL ON public.teacher_meetings TO service_role;
REVOKE ALL ON public.teacher_meetings FROM anon;

ALTER TABLE public.teacher_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read teacher meetings"
  ON public.teacher_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert teacher meetings"
  ON public.teacher_meetings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update teacher meetings"
  ON public.teacher_meetings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete teacher meetings"
  ON public.teacher_meetings FOR DELETE TO authenticated USING (true);

CREATE INDEX teacher_meetings_scope_idx
  ON public.teacher_meetings (institution_id, teacher_id, meeting_date DESC);