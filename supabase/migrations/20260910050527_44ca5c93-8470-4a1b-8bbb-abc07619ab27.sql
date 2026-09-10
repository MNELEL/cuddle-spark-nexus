ALTER TABLE public.seating_configs
  ADD COLUMN IF NOT EXISTS score integer,
  ADD COLUMN IF NOT EXISTS violation_count integer;