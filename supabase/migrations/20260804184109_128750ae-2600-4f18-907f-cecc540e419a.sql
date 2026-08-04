CREATE TABLE public.grade_weights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  weight numeric NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 10),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject)
);

CREATE INDEX grade_weights_class_id_idx ON public.grade_weights (class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_weights TO authenticated;
GRANT ALL ON public.grade_weights TO service_role;

ALTER TABLE public.grade_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_weights_owner_all" ON public.grade_weights
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = grade_weights.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = grade_weights.class_id AND c.owner_id = auth.uid()));

CREATE TRIGGER grade_weights_updated_at
  BEFORE UPDATE ON public.grade_weights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();