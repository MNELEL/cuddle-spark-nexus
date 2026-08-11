create extension if not exists vector with schema extensions;

CREATE TABLE public.resource_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.teaching_resources(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding extensions.vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_chunks TO authenticated;
GRANT ALL ON public.resource_chunks TO service_role;

ALTER TABLE public.resource_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their resource chunks"
ON public.resource_chunks FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE INDEX resource_chunks_resource_idx ON public.resource_chunks (resource_id, chunk_index);
CREATE INDEX resource_chunks_embedding_idx ON public.resource_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE TRIGGER trg_resource_chunks_touch
BEFORE UPDATE ON public.resource_chunks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.match_resource_chunks(
  query_embedding extensions.vector,
  owner uuid,
  match_count integer DEFAULT 8
)
RETURNS TABLE(resource_id uuid, chunk_index integer, content text, similarity double precision)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT c.resource_id, c.chunk_index, c.content,
         1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.resource_chunks c
  WHERE c.owner_id = owner AND c.embedding IS NOT NULL
  ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT match_count;
$$;