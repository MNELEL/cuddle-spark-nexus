ALTER TABLE public.students ADD COLUMN IF NOT EXISTS person_key uuid;

ALTER TABLE public.students DISABLE TRIGGER trg_students_not_archived;

UPDATE public.students SET person_key = gen_random_uuid() WHERE person_key IS NULL;

WITH RECURSIVE chain AS (
  SELECT c.id AS root_id, c.id AS class_id, 0 AS depth
  FROM public.classes c
  WHERE c.parent_class_id IS NULL
  UNION ALL
  SELECT ch.root_id, c.id, ch.depth + 1
  FROM public.classes c
  JOIN chain ch ON c.parent_class_id = ch.class_id
),
members AS (
  SELECT ch.root_id, ch.depth, s.id AS student_id, s.name, s.person_key
  FROM chain ch
  JOIN public.students s ON s.class_id = ch.class_id
),
oldest AS (
  SELECT DISTINCT ON (root_id, name) root_id, name, person_key
  FROM members
  ORDER BY root_id, name, depth ASC, student_id ASC
)
UPDATE public.students s
SET person_key = o.person_key
FROM members m
JOIN oldest o ON o.root_id = m.root_id AND o.name = m.name
WHERE s.id = m.student_id AND s.person_key IS DISTINCT FROM o.person_key;

ALTER TABLE public.students ENABLE TRIGGER trg_students_not_archived;

ALTER TABLE public.students ALTER COLUMN person_key SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN person_key SET DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS students_person_key_idx ON public.students (person_key);