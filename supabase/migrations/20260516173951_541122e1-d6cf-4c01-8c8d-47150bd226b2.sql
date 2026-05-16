ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS seat_row integer,
  ADD COLUMN IF NOT EXISTS seat_col integer,
  ADD COLUMN IF NOT EXISTS seat_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS hidden_seats jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS students_seat_unique
  ON public.students (class_id, seat_row, seat_col)
  WHERE seat_row IS NOT NULL AND seat_col IS NOT NULL;