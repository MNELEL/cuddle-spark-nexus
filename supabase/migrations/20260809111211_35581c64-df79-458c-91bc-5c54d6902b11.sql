-- 1. new columns
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- 2. one-time backfill from existing name
ALTER TABLE public.students DISABLE TRIGGER trg_students_not_archived;

UPDATE public.students
SET
  first_name = NULLIF(split_part(btrim(name), ' ', 1), ''),
  last_name  = NULLIF(btrim(substr(btrim(name), length(split_part(btrim(name), ' ', 1)) + 1)), '')
WHERE first_name IS NULL AND last_name IS NULL;

ALTER TABLE public.students ENABLE TRIGGER trg_students_not_archived;

-- 3. keep name in sync with first/last name
CREATE OR REPLACE FUNCTION public.sync_student_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NULLIF(btrim(coalesce(NEW.first_name, '')), '') IS NOT NULL
     OR NULLIF(btrim(coalesce(NEW.last_name, '')), '') IS NOT NULL THEN
    NEW.name := btrim(
      concat_ws(' ',
        NULLIF(btrim(coalesce(NEW.first_name, '')), ''),
        NULLIF(btrim(coalesce(NEW.last_name, '')), '')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_sync_name ON public.students;
CREATE TRIGGER trg_students_sync_name
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.sync_student_name();

-- 4. sorting indexes
CREATE INDEX IF NOT EXISTS students_class_last_name_idx ON public.students (class_id, last_name);
CREATE INDEX IF NOT EXISTS students_class_first_name_idx ON public.students (class_id, first_name);

-- 5. harden access: no anon, authenticated-only owner policy + institution admin read
REVOKE ALL ON public.students FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

DROP POLICY IF EXISTS students_owner_all ON public.students;
CREATE POLICY students_owner_all ON public.students
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = students.class_id AND c.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = students.class_id AND c.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS students_institution_admin_select ON public.students;
CREATE POLICY students_institution_admin_select ON public.students
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = students.class_id
      AND c.institution_id IS NOT NULL
      AND private.is_institution_admin(auth.uid(), c.institution_id)
  ));