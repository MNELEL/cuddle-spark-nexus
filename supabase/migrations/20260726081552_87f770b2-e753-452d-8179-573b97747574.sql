
ALTER TABLE public.students
  ADD COLUMN has_special_accommodation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN accommodation_note TEXT;

ALTER TABLE public.classes
  ADD COLUMN room_objects JSONB NOT NULL DEFAULT '[]'::jsonb;
