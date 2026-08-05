-- 1. Onboarding state on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Sound preferences
CREATE TABLE public.sound_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  sound_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  volume numeric NOT NULL DEFAULT 0.6,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (owner_id, event_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sound_preferences TO authenticated;
GRANT ALL ON public.sound_preferences TO service_role;
REVOKE ALL ON public.sound_preferences FROM anon;

ALTER TABLE public.sound_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sound preferences"
  ON public.sound_preferences FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER sound_preferences_updated_at
  BEFORE UPDATE ON public.sound_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Badges
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'award',
  color text NOT NULL DEFAULT 'amber',
  criteria text NOT NULL DEFAULT '',
  points_reward integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
REVOKE ALL ON public.badges FROM anon;

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own class badges"
  ON public.badges FOR ALL TO authenticated
  USING (class_id IN (SELECT c.id FROM public.classes c WHERE c.owner_id = auth.uid()))
  WITH CHECK (class_id IN (SELECT c.id FROM public.classes c WHERE c.owner_id = auth.uid()));

CREATE TRIGGER badges_updated_at
  BEFORE UPDATE ON public.badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_badges_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.badges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

-- 4. Badge awards
CREATE TABLE public.student_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  awarded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX student_badges_student_idx ON public.student_badges (student_id);
CREATE INDEX student_badges_class_idx ON public.student_badges (class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_badges TO authenticated;
GRANT ALL ON public.student_badges TO service_role;
REVOKE ALL ON public.student_badges FROM anon;

ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own class student badges"
  ON public.student_badges FOR ALL TO authenticated
  USING (class_id IN (SELECT c.id FROM public.classes c WHERE c.owner_id = auth.uid()))
  WITH CHECK (class_id IN (SELECT c.id FROM public.classes c WHERE c.owner_id = auth.uid()));

CREATE TRIGGER trg_student_badges_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.student_badges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();