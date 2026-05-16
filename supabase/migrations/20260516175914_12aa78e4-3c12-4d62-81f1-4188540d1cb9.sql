
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_owner_all ON public.attendance FOR ALL
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance.class_id AND c.owner_id = auth.uid()));
CREATE INDEX idx_attendance_class_date ON public.attendance(class_id, date DESC);

CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  value NUMERIC NOT NULL,
  max_value NUMERIC NOT NULL DEFAULT 100,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY grades_owner_all ON public.grades FOR ALL
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = grades.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = grades.class_id AND c.owner_id = auth.uid()));
CREATE INDEX idx_grades_class_date ON public.grades(class_id, date DESC);
CREATE INDEX idx_grades_student ON public.grades(student_id);
