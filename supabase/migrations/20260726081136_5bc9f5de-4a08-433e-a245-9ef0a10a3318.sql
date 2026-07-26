
CREATE TYPE public.class_event_type AS ENUM ('birthday','exam','trip','holiday','meeting','other');

CREATE TABLE public.class_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type public.class_event_type NOT NULL DEFAULT 'other',
  date DATE NOT NULL,
  end_date DATE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  notes TEXT,
  color TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX class_events_class_date_idx ON public.class_events(class_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_events TO authenticated;
GRANT ALL ON public.class_events TO service_role;

ALTER TABLE public.class_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage class_events"
  ON public.class_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_events.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_events.class_id AND c.owner_id = auth.uid()));

CREATE TRIGGER update_class_events_updated_at
  BEFORE UPDATE ON public.class_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
