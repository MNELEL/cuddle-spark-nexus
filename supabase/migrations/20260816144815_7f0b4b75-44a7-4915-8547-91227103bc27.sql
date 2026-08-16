-- 1. precise minutes (15-min resolution) on the three schedule tables
ALTER TABLE public.weekly_lessons
  ADD COLUMN IF NOT EXISTS minute smallint NOT NULL DEFAULT 0;
ALTER TABLE public.schedule_template_slots
  ADD COLUMN IF NOT EXISTS minute smallint NOT NULL DEFAULT 0;
ALTER TABLE public.schedule_tasks
  ADD COLUMN IF NOT EXISTS minute smallint;

ALTER TABLE public.weekly_lessons
  ADD CONSTRAINT weekly_lessons_minute_quarter CHECK (minute IN (0, 15, 30, 45));
ALTER TABLE public.schedule_template_slots
  ADD CONSTRAINT schedule_template_slots_minute_quarter CHECK (minute IN (0, 15, 30, 45));
ALTER TABLE public.schedule_tasks
  ADD CONSTRAINT schedule_tasks_minute_quarter CHECK (minute IS NULL OR minute IN (0, 15, 30, 45));

ALTER TABLE public.weekly_lessons DROP CONSTRAINT IF EXISTS weekly_lessons_slot_unique;
DROP INDEX IF EXISTS public.weekly_lessons_slot_unique;
ALTER TABLE public.weekly_lessons
  ADD CONSTRAINT weekly_lessons_slot_unique UNIQUE (class_id, week_start, day_key, hour, minute);

ALTER TABLE public.schedule_template_slots DROP CONSTRAINT IF EXISTS schedule_template_slots_slot_unique;
DROP INDEX IF EXISTS public.schedule_template_slots_slot_unique;
ALTER TABLE public.schedule_template_slots
  ADD CONSTRAINT schedule_template_slots_slot_unique UNIQUE (class_id, day_key, hour, minute);

-- 2. recurring schedule rules (weekly day / rosh chodesh)
CREATE TABLE public.recurring_schedule_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('weekly_day', 'rosh_chodesh')),
  day_key text CHECK (day_key IN ('sun','mon','tue','wed','thu','fri','sat')),
  effect text NOT NULL CHECK (effect IN ('early_end', 'late_start', 'no_school')),
  hour smallint CHECK (hour IS NULL OR (hour >= 0 AND hour <= 23)),
  minute smallint NOT NULL DEFAULT 0 CHECK (minute IN (0, 15, 30, 45)),
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recurring_schedule_rules_class_idx
  ON public.recurring_schedule_rules (class_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_schedule_rules TO authenticated;
GRANT ALL ON public.recurring_schedule_rules TO service_role;

ALTER TABLE public.recurring_schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY recurring_schedule_rules_owner_all
  ON public.recurring_schedule_rules
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = recurring_schedule_rules.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = recurring_schedule_rules.class_id AND c.owner_id = auth.uid()));

CREATE TRIGGER recurring_schedule_rules_touch_updated_at
  BEFORE UPDATE ON public.recurring_schedule_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();