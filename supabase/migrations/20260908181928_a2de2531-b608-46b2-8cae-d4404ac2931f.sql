CREATE TABLE public.daily_log_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL,
  approver_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_log_approvals TO authenticated;
GRANT ALL ON public.daily_log_approvals TO service_role;

ALTER TABLE public.daily_log_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their daily log approvals"
ON public.daily_log_approvals
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE INDEX daily_log_approvals_class_date_idx
  ON public.daily_log_approvals (class_id, date);

CREATE TRIGGER daily_log_approvals_updated_at
  BEFORE UPDATE ON public.daily_log_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();