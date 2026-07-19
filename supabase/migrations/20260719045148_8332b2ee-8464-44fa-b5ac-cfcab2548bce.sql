ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_headline text,
  ADD COLUMN IF NOT EXISTS public_description text;

CREATE INDEX IF NOT EXISTS classes_public_slug_idx ON public.classes(public_slug) WHERE public_enabled = true;