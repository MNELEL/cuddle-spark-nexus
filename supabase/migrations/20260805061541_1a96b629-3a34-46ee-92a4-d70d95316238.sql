CREATE TABLE public.student_profiles (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  sensitive_flags text[] NOT NULL DEFAULT '{}',
  sensitive_notes text NOT NULL DEFAULT '',
  teaching_style_notes text NOT NULL DEFAULT '',
  handoff_notes text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_profiles_class ON public.student_profiles(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_profiles TO authenticated;
GRANT ALL ON public.student_profiles TO service_role;

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_profiles_owner_all"
ON public.student_profiles FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = student_profiles.class_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = student_profiles.class_id AND c.owner_id = auth.uid()));

CREATE POLICY "student_profiles_institution_admin_select"
ON public.student_profiles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.id = student_profiles.class_id
    AND c.institution_id IS NOT NULL
    AND private.is_institution_admin(auth.uid(), c.institution_id)
));

CREATE TRIGGER trg_student_profiles_touch
BEFORE UPDATE ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_student_profiles_not_archived
BEFORE INSERT OR UPDATE OR DELETE ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();