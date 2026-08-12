CREATE TABLE public.resource_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.teaching_resources(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX resource_versions_resource_created_idx
  ON public.resource_versions (resource_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.resource_versions TO authenticated;
GRANT ALL ON public.resource_versions TO service_role;

ALTER TABLE public.resource_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their resource versions"
  ON public.resource_versions FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can add resource versions"
  ON public.resource_versions FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their resource versions"
  ON public.resource_versions FOR DELETE TO authenticated
  USING (owner_id = auth.uid());