ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_preference text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IS NULL OR theme_preference IN ('modern','conservative','minimal','kitsch','mono','classalign','hakita-sheli'));