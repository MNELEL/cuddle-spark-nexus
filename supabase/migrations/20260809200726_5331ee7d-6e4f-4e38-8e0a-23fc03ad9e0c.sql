-- 1. allow Friday/Saturday in the weekly board
ALTER TABLE public.weekly_lessons DROP CONSTRAINT IF EXISTS weekly_lessons_day_key_check;
ALTER TABLE public.weekly_lessons ADD CONSTRAINT weekly_lessons_day_key_check
  CHECK (day_key IN ('sun','mon','tue','wed','thu','fri','sat'));

-- 2. recurring weekly template
CREATE TABLE IF NOT EXISTS public.schedule_template_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_key text NOT NULL CHECK (day_key IN ('sun','mon','tue','wed','thu','fri','sat')),
  hour smallint NOT NULL CHECK (hour BETWEEN 6 AND 22),
  duration smallint NOT NULL DEFAULT 1 CHECK (duration BETWEEN 1 AND 4),
  title text NOT NULL,
  subject text,
  notes text,
  library_item_id uuid REFERENCES public.teaching_resources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_template_slots TO authenticated;
GRANT ALL ON public.schedule_template_slots TO service_role;
REVOKE ALL ON public.schedule_template_slots FROM anon;
ALTER TABLE public.schedule_template_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_template_slots_owner_all" ON public.schedule_template_slots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = schedule_template_slots.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = schedule_template_slots.class_id AND c.owner_id = auth.uid()));
CREATE TRIGGER trg_schedule_template_slots_touch BEFORE UPDATE ON public.schedule_template_slots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_schedule_template_slots_not_archived BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_template_slots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();
CREATE INDEX IF NOT EXISTS idx_schedule_template_slots_class ON public.schedule_template_slots(class_id, day_key, hour);

-- 3. per-class calendar settings
CREATE TABLE IF NOT EXISTS public.class_schedule_settings (
  class_id uuid PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  start_hour smallint NOT NULL DEFAULT 7 CHECK (start_hour BETWEEN 6 AND 22),
  end_hour smallint NOT NULL DEFAULT 16 CHECK (end_hour BETWEEN 6 AND 23),
  active_days text[] NOT NULL DEFAULT ARRAY['sun','mon','tue','wed','thu','fri']::text[],
  year_start_date date,
  year_end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedule_settings TO authenticated;
GRANT ALL ON public.class_schedule_settings TO service_role;
REVOKE ALL ON public.class_schedule_settings FROM anon;
ALTER TABLE public.class_schedule_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_schedule_settings_owner_all" ON public.class_schedule_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_schedule_settings.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_schedule_settings.class_id AND c.owner_id = auth.uid()));
CREATE TRIGGER trg_class_schedule_settings_touch BEFORE UPDATE ON public.class_schedule_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. duty types
CREATE TABLE IF NOT EXISTS public.class_duty_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'star',
  order_index smallint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_duty_types TO authenticated;
GRANT ALL ON public.class_duty_types TO service_role;
REVOKE ALL ON public.class_duty_types FROM anon;
ALTER TABLE public.class_duty_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_duty_types_owner_all" ON public.class_duty_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_duty_types.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_duty_types.class_id AND c.owner_id = auth.uid()));
CREATE TRIGGER trg_class_duty_types_touch BEFORE UPDATE ON public.class_duty_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_class_duty_types_not_archived BEFORE INSERT OR UPDATE OR DELETE ON public.class_duty_types
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

-- 5. duty assignments
CREATE TABLE IF NOT EXISTS public.class_duty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  duty_type_id uuid NOT NULL REFERENCES public.class_duty_types(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  date date NOT NULL,
  source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','manual')),
  done boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duty_type_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_duty_assignments TO authenticated;
GRANT ALL ON public.class_duty_assignments TO service_role;
REVOKE ALL ON public.class_duty_assignments FROM anon;
ALTER TABLE public.class_duty_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_duty_assignments_owner_all" ON public.class_duty_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_duty_assignments.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_duty_assignments.class_id AND c.owner_id = auth.uid()));
CREATE TRIGGER trg_class_duty_assignments_touch BEFORE UPDATE ON public.class_duty_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_class_duty_assignments_not_archived BEFORE INSERT OR UPDATE OR DELETE ON public.class_duty_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();
CREATE INDEX IF NOT EXISTS idx_class_duty_assignments_class_date ON public.class_duty_assignments(class_id, date);

-- 6. tasks / exams / pacing items
CREATE TABLE IF NOT EXISTS public.schedule_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'task' CHECK (kind IN ('task','exam','pacing')),
  title text NOT NULL,
  subject text,
  date date NOT NULL,
  hour smallint CHECK (hour BETWEEN 6 AND 22),
  notes text,
  curriculum_unit_id uuid REFERENCES public.curriculum_units(id) ON DELETE SET NULL,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_tasks TO authenticated;
GRANT ALL ON public.schedule_tasks TO service_role;
REVOKE ALL ON public.schedule_tasks FROM anon;
ALTER TABLE public.schedule_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_tasks_owner_all" ON public.schedule_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = schedule_tasks.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = schedule_tasks.class_id AND c.owner_id = auth.uid()));
CREATE TRIGGER trg_schedule_tasks_touch BEFORE UPDATE ON public.schedule_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_schedule_tasks_not_archived BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_class_date ON public.schedule_tasks(class_id, date);

-- 7. semester targets
CREATE TABLE IF NOT EXISTS public.semester_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  semester text NOT NULL CHECK (semester IN ('h1','h2')),
  subject text NOT NULL,
  target_units integer NOT NULL DEFAULT 0 CHECK (target_units >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, semester, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_targets TO authenticated;
GRANT ALL ON public.semester_targets TO service_role;
REVOKE ALL ON public.semester_targets FROM anon;
ALTER TABLE public.semester_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "semester_targets_owner_all" ON public.semester_targets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = semester_targets.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = semester_targets.class_id AND c.owner_id = auth.uid()));
CREATE TRIGGER trg_semester_targets_touch BEFORE UPDATE ON public.semester_targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_semester_targets_not_archived BEFORE INSERT OR UPDATE OR DELETE ON public.semester_targets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

-- 8. weekly notes / parasha override
CREATE TABLE IF NOT EXISTS public.class_week_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  parasha_override text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_week_notes TO authenticated;
GRANT ALL ON public.class_week_notes TO service_role;
REVOKE ALL ON public.class_week_notes FROM anon;
ALTER TABLE public.class_week_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_week_notes_owner_all" ON public.class_week_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_week_notes.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_week_notes.class_id AND c.owner_id = auth.uid()));
CREATE TRIGGER trg_class_week_notes_touch BEFORE UPDATE ON public.class_week_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_class_week_notes_not_archived BEFORE INSERT OR UPDATE OR DELETE ON public.class_week_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

-- 9. broaden calendar override types (late start / early end)
ALTER TABLE public.academic_calendar_overrides DROP CONSTRAINT IF EXISTS academic_calendar_overrides_type_check;
ALTER TABLE public.academic_calendar_overrides ADD CONSTRAINT academic_calendar_overrides_type_check
  CHECK (type IN ('institution_break','unexpected_closure','extra_session','late_start','early_end','holiday'));