-- Sync migration: documents DDL that was already applied manually via SQL.
-- Fully idempotent (IF NOT EXISTS / DO guards) so re-running is a no-op.

-- 1. institutions table
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.institutions TO authenticated;
GRANT ALL ON public.institutions TO service_role;

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='institutions' AND policyname='members can view their institution') THEN
    CREATE POLICY "members can view their institution"
      ON public.institutions FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.institution_id = institutions.id
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='institutions' AND policyname='platform admins view all institutions') THEN
    CREATE POLICY "platform admins view all institutions"
      ON public.institutions FOR SELECT TO authenticated
      USING (private.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='institutions' AND policyname='platform admins create institutions') THEN
    CREATE POLICY "platform admins create institutions"
      ON public.institutions FOR INSERT TO authenticated
      WITH CHECK (private.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='institutions' AND policyname='institution admins manage their institution') THEN
    CREATE POLICY "institution admins manage their institution"
      ON public.institutions FOR UPDATE TO authenticated
      USING (private.is_institution_admin(auth.uid(), institutions.id))
      WITH CHECK (private.is_institution_admin(auth.uid(), institutions.id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_institutions_updated_at') THEN
    CREATE TRIGGER update_institutions_updated_at
      BEFORE UPDATE ON public.institutions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2. classes: institution scoping columns + index + institution-admin read policy
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id);
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS parent_class_id uuid REFERENCES public.classes(id);

CREATE INDEX IF NOT EXISTS classes_institution_year_idx
  ON public.classes (institution_id, academic_year);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classes' AND policyname='institution admins view classes in their institution') THEN
    CREATE POLICY "institution admins view classes in their institution"
      ON public.classes FOR SELECT TO authenticated
      USING (
        classes.institution_id IS NOT NULL
        AND private.is_institution_admin(auth.uid(), classes.institution_id)
      );
  END IF;
END $$;

-- 3. user_roles.institution_id becomes a real foreign key
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_institution_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_institution_id_fkey
      FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
  END IF;
END $$;
