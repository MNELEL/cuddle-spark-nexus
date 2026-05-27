
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT ''::text,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminders_owner_all ON public.reminders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = reminders.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = reminders.class_id AND c.owner_id = auth.uid()));

CREATE TABLE public.behavior_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'participation',
  points integer NOT NULL DEFAULT 1,
  note text DEFAULT ''::text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.behavior_points TO authenticated;
GRANT ALL ON public.behavior_points TO service_role;
ALTER TABLE public.behavior_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY behavior_points_owner_all ON public.behavior_points FOR ALL
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = behavior_points.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = behavior_points.class_id AND c.owner_id = auth.uid()));

CREATE INDEX idx_reminders_class_student ON public.reminders(class_id, student_id);
CREATE INDEX idx_behavior_points_class_student ON public.behavior_points(class_id, student_id);
