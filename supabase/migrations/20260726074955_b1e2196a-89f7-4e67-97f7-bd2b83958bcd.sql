
CREATE TABLE public.certificate_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  teacher_note TEXT NOT NULL DEFAULT '',
  principal_note TEXT NOT NULL DEFAULT '',
  grade_overrides JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, period_key)
);

CREATE INDEX certificate_notes_class_period_idx ON public.certificate_notes (class_id, period_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_notes TO authenticated;
GRANT ALL ON public.certificate_notes TO service_role;

ALTER TABLE public.certificate_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificate_notes_owner_all ON public.certificate_notes
FOR ALL
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = certificate_notes.class_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = certificate_notes.class_id AND c.owner_id = auth.uid()));

CREATE TRIGGER update_certificate_notes_updated_at
BEFORE UPDATE ON public.certificate_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
