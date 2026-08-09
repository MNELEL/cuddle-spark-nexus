ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS teacher_name text;

CREATE TABLE IF NOT EXISTS public.institution_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  title text NOT NULL DEFAULT 'melamed',
  phone text,
  email text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_staff TO authenticated;
GRANT ALL ON public.institution_staff TO service_role;

ALTER TABLE public.institution_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "institution members view staff"
ON public.institution_staff FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.institution_id = institution_staff.institution_id
));

CREATE POLICY "institution admins manage staff"
ON public.institution_staff FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.is_institution_admin(auth.uid(), institution_id))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.is_institution_admin(auth.uid(), institution_id));

CREATE INDEX IF NOT EXISTS institution_staff_institution_idx ON public.institution_staff(institution_id);

CREATE TRIGGER institution_staff_touch_updated_at
BEFORE UPDATE ON public.institution_staff
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
