-- Baseline: document tables that were created manually in SQL and had no migration file.
-- All statements are idempotent; on the existing database this only tightens anon grants.

CREATE TABLE IF NOT EXISTS public.curriculum_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  subject text NOT NULL,
  title text NOT NULL,
  order_index integer,
  estimated_lessons integer,
  priority text NOT NULL DEFAULT 'core' CHECK (priority IN ('core','optional')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  completed_at date,
  actual_lessons_used integer,
  linked_resource_ids uuid[] DEFAULT '{}'::uuid[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_pacing_settings (
  class_id uuid PRIMARY KEY,
  buffer_percent numeric NOT NULL DEFAULT 15,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academic_calendar_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  type text NOT NULL CHECK (type IN ('institution_break','unexpected_closure','extra_session')),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.curriculum_history_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  source_year integer NOT NULL,
  subject text NOT NULL,
  unit_title text NOT NULL,
  estimated_start_date date,
  estimated_end_date date,
  lessons_count integer,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  source_resource_ids uuid[] DEFAULT '{}'::uuid[],
  raw_ai_notes text,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pacing_recalc_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  days_remaining integer,
  days_elapsed integer,
  units_behind_count integer,
  units_ahead_count integer,
  buffer_percent numeric NOT NULL DEFAULT 15,
  ai_recommendation text
);

CREATE TABLE IF NOT EXISTS public.seating_wizard_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  weight_academic integer NOT NULL DEFAULT 25 CHECK (weight_academic BETWEEN 0 AND 100),
  weight_behavioral integer NOT NULL DEFAULT 25 CHECK (weight_behavioral BETWEEN 0 AND 100),
  weight_social integer NOT NULL DEFAULT 25 CHECK (weight_social BETWEEN 0 AND 100),
  balance_height boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_pacing_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_calendar_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_history_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_recalc_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_wizard_prefs TO authenticated;

GRANT ALL ON public.curriculum_units TO service_role;
GRANT ALL ON public.class_pacing_settings TO service_role;
GRANT ALL ON public.academic_calendar_overrides TO service_role;
GRANT ALL ON public.curriculum_history_snapshots TO service_role;
GRANT ALL ON public.pacing_recalc_log TO service_role;
GRANT ALL ON public.seating_wizard_prefs TO service_role;

-- defense in depth: no anonymous access to any of these tables
REVOKE ALL ON public.curriculum_units FROM anon;
REVOKE ALL ON public.class_pacing_settings FROM anon;
REVOKE ALL ON public.academic_calendar_overrides FROM anon;
REVOKE ALL ON public.curriculum_history_snapshots FROM anon;
REVOKE ALL ON public.pacing_recalc_log FROM anon;
REVOKE ALL ON public.seating_wizard_prefs FROM anon;

ALTER TABLE public.curriculum_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_pacing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_calendar_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_history_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacing_recalc_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_wizard_prefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_units' AND policyname='curriculum_units_owner_all') THEN
    CREATE POLICY "curriculum_units_owner_all" ON public.curriculum_units FOR ALL
      USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = curriculum_units.class_id AND c.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = curriculum_units.class_id AND c.owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='class_pacing_settings' AND policyname='class_pacing_settings_owner_all') THEN
    CREATE POLICY "class_pacing_settings_owner_all" ON public.class_pacing_settings FOR ALL
      USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_pacing_settings.class_id AND c.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_pacing_settings.class_id AND c.owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='academic_calendar_overrides' AND policyname='academic_calendar_overrides_owner_all') THEN
    CREATE POLICY "academic_calendar_overrides_owner_all" ON public.academic_calendar_overrides FOR ALL
      USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = academic_calendar_overrides.class_id AND c.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = academic_calendar_overrides.class_id AND c.owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_history_snapshots' AND policyname='curriculum_history_snapshots_owner_all') THEN
    CREATE POLICY "curriculum_history_snapshots_owner_all" ON public.curriculum_history_snapshots FOR ALL
      USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = curriculum_history_snapshots.class_id AND c.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = curriculum_history_snapshots.class_id AND c.owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pacing_recalc_log' AND policyname='pacing_recalc_log_owner_all') THEN
    CREATE POLICY "pacing_recalc_log_owner_all" ON public.pacing_recalc_log FOR ALL
      USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = pacing_recalc_log.class_id AND c.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = pacing_recalc_log.class_id AND c.owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seating_wizard_prefs' AND policyname='Users manage their own wizard prefs') THEN
    CREATE POLICY "Users manage their own wizard prefs" ON public.seating_wizard_prefs FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;