CREATE TABLE IF NOT EXISTS public.weekly_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_key TEXT NOT NULL CHECK (day_key IN ('sun','mon','tue','wed','thu')),
  hour SMALLINT NOT NULL CHECK (hour BETWEEN 6 AND 20),
  duration SMALLINT NOT NULL DEFAULT 1 CHECK (duration IN (1, 2)),
  title TEXT NOT NULL,
  subject TEXT,
  notes TEXT,
  library_item_id UUID REFERENCES public.teaching_resources(id) ON DELETE SET NULL,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_lessons TO authenticated;
GRANT ALL ON public.weekly_lessons TO service_role;
ALTER TABLE public.weekly_lessons ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS weekly_lessons_class_week_idx ON public.weekly_lessons(class_id, week_start);
DROP POLICY IF EXISTS "owners manage weekly_lessons" ON public.weekly_lessons;
CREATE POLICY "owners manage weekly_lessons"
  ON public.weekly_lessons FOR ALL
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = weekly_lessons.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = weekly_lessons.class_id AND c.owner_id = auth.uid()));
DROP TRIGGER IF EXISTS update_weekly_lessons_updated_at ON public.weekly_lessons;
CREATE TRIGGER update_weekly_lessons_updated_at
  BEFORE UPDATE ON public.weekly_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();