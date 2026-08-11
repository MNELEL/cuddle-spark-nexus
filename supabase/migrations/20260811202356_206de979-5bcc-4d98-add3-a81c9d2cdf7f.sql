ALTER TABLE public.weekly_bulletins
  ADD COLUMN status text NOT NULL DEFAULT 'draft',
  ADD COLUMN published_at timestamptz NULL;

ALTER TABLE public.weekly_bulletins
  ADD CONSTRAINT weekly_bulletins_status_check CHECK (status IN ('draft','published'));

CREATE TABLE public.weekly_bulletin_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bulletin_id uuid NOT NULL REFERENCES public.weekly_bulletins(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);

CREATE INDEX weekly_bulletin_versions_bulletin_idx
  ON public.weekly_bulletin_versions (bulletin_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_bulletin_versions TO authenticated;
GRANT ALL ON public.weekly_bulletin_versions TO service_role;
REVOKE ALL ON public.weekly_bulletin_versions FROM anon;

ALTER TABLE public.weekly_bulletin_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekly_bulletin_versions_owner_all
  ON public.weekly_bulletin_versions
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.weekly_bulletins b
    JOIN public.classes c ON c.id = b.class_id
    WHERE b.id = weekly_bulletin_versions.bulletin_id AND c.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.weekly_bulletins b
    JOIN public.classes c ON c.id = b.class_id
    WHERE b.id = weekly_bulletin_versions.bulletin_id AND c.owner_id = auth.uid()
  ));