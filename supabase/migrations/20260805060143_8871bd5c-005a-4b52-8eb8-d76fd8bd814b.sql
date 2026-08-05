CREATE OR REPLACE FUNCTION private.class_is_archived(_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = _class_id AND c.status = 'archived'
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_class_not_archived()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_class_id := OLD.class_id;
  ELSE
    v_class_id := NEW.class_id;
  END IF;

  IF v_class_id IS NOT NULL AND private.class_is_archived(v_class_id) THEN
    RAISE EXCEPTION 'CLASS_ARCHIVED_READONLY';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.class_id IS DISTINCT FROM NEW.class_id
     AND OLD.class_id IS NOT NULL AND private.class_is_archived(OLD.class_id) THEN
    RAISE EXCEPTION 'CLASS_ARCHIVED_READONLY';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_archived_class_readonly()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'archived' THEN
      RAISE EXCEPTION 'CLASS_ARCHIVED_READONLY';
    END IF;
    RETURN OLD;
  END IF;

  -- allow only a status change (restore/archive) on an archived class
  IF OLD.status = 'archived' AND NEW.status = 'archived' THEN
    IF (NEW.name, NEW.grid_cols, NEW.grid_rows, NEW.hidden_seats, NEW.room_objects,
        NEW.public_slug, NEW.public_enabled, NEW.public_headline, NEW.public_description,
        NEW.academic_year, NEW.institution_id, NEW.parent_class_id)
       IS DISTINCT FROM
       (OLD.name, OLD.grid_cols, OLD.grid_rows, OLD.hidden_seats, OLD.room_objects,
        OLD.public_slug, OLD.public_enabled, OLD.public_headline, OLD.public_description,
        OLD.academic_year, OLD.institution_id, OLD.parent_class_id)
    THEN
      RAISE EXCEPTION 'CLASS_ARCHIVED_READONLY';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classes_archived_readonly ON public.classes;
CREATE TRIGGER trg_classes_archived_readonly
  BEFORE UPDATE OR DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_archived_class_readonly();

DROP TRIGGER IF EXISTS trg_students_not_archived ON public.students;
CREATE TRIGGER trg_students_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

DROP TRIGGER IF EXISTS trg_grades_not_archived ON public.grades;
CREATE TRIGGER trg_grades_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

DROP TRIGGER IF EXISTS trg_attendance_not_archived ON public.attendance;
CREATE TRIGGER trg_attendance_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

DROP TRIGGER IF EXISTS trg_behavior_points_not_archived ON public.behavior_points;
CREATE TRIGGER trg_behavior_points_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.behavior_points
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

DROP TRIGGER IF EXISTS trg_discipline_events_not_archived ON public.discipline_events;
CREATE TRIGGER trg_discipline_events_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.discipline_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

DROP TRIGGER IF EXISTS trg_class_events_not_archived ON public.class_events;
CREATE TRIGGER trg_class_events_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.class_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

DROP TRIGGER IF EXISTS trg_weekly_lessons_not_archived ON public.weekly_lessons;
CREATE TRIGGER trg_weekly_lessons_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_lessons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

DROP TRIGGER IF EXISTS trg_student_relations_not_archived ON public.student_relations;
CREATE TRIGGER trg_student_relations_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.student_relations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

DROP TRIGGER IF EXISTS trg_groups_not_archived ON public.groups;
CREATE TRIGGER trg_groups_not_archived
  BEFORE INSERT OR UPDATE OR DELETE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_not_archived();

REVOKE ALL ON FUNCTION public.enforce_class_not_archived() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_archived_class_readonly() FROM anon, authenticated;