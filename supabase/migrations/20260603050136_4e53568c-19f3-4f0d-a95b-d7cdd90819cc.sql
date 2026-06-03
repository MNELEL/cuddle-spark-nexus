
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.teaching_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  grade_level TEXT NOT NULL DEFAULT '',
  resource_type TEXT NOT NULL DEFAULT 'worksheet',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_path TEXT,
  mime_type TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  source_prompt TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_resources TO authenticated;
GRANT ALL ON public.teaching_resources TO service_role;
ALTER TABLE public.teaching_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY teaching_resources_owner_all ON public.teaching_resources
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_teaching_resources_owner ON public.teaching_resources(owner_id);
CREATE INDEX idx_teaching_resources_type ON public.teaching_resources(resource_type);
CREATE INDEX idx_teaching_resources_tags ON public.teaching_resources USING GIN(tags);
CREATE TRIGGER trg_teaching_resources_updated
BEFORE UPDATE ON public.teaching_resources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.resource_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_collections TO authenticated;
GRANT ALL ON public.resource_collections TO service_role;
ALTER TABLE public.resource_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_collections_owner_all ON public.resource_collections
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.resource_collection_items (
  collection_id UUID NOT NULL REFERENCES public.resource_collections(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.teaching_resources(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, resource_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_collection_items TO authenticated;
GRANT ALL ON public.resource_collection_items TO service_role;
ALTER TABLE public.resource_collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_collection_items_owner_all ON public.resource_collection_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.resource_collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.resource_collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()));

CREATE TABLE public.class_resource_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.teaching_resources(id) ON DELETE CASCADE,
  class_id UUID NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_resource_usage TO authenticated;
GRANT ALL ON public.class_resource_usage TO service_role;
ALTER TABLE public.class_resource_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY class_resource_usage_owner_all ON public.class_resource_usage
  FOR ALL USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.owner_id = auth.uid()));
CREATE INDEX idx_class_resource_usage_resource ON public.class_resource_usage(resource_id);
CREATE INDEX idx_class_resource_usage_class ON public.class_resource_usage(class_id);
