CREATE TABLE public.generator_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_id uuid REFERENCES public.teaching_resources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generator_versions TO authenticated;
GRANT ALL ON public.generator_versions TO service_role;
REVOKE ALL ON public.generator_versions FROM anon;

ALTER TABLE public.generator_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their generator versions"
ON public.generator_versions FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX generator_versions_owner_kind_idx
  ON public.generator_versions (owner_id, kind, created_at DESC);

CREATE TRIGGER generator_versions_updated_at
BEFORE UPDATE ON public.generator_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();