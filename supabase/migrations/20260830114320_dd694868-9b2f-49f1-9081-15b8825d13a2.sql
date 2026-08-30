CREATE TABLE public.orchestrator_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  insight_type text NOT NULL DEFAULT 'attendance_decline',
  severity text NOT NULL CHECK (severity IN ('low','medium','high')),
  title text NOT NULL,
  description text NOT NULL,
  suggested_action text,
  action_link text,
  is_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.orchestrator_insights TO authenticated;
GRANT ALL ON public.orchestrator_insights TO service_role;

ALTER TABLE public.orchestrator_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_insights"
  ON public.orchestrator_insights FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "owner_update_insights"
  ON public.orchestrator_insights FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_orchestrator_insights_owner_active
  ON public.orchestrator_insights (owner_id, is_dismissed, created_at DESC);

CREATE INDEX idx_orchestrator_insights_student_type
  ON public.orchestrator_insights (student_id, insight_type, created_at DESC);

REVOKE ALL ON public.orchestrator_insights FROM anon;