DROP FUNCTION IF EXISTS public.match_resource_chunks(extensions.vector, uuid, integer);

CREATE OR REPLACE FUNCTION public.match_resource_chunks(
  query_embedding extensions.vector,
  match_count integer DEFAULT 8
)
RETURNS TABLE(resource_id uuid, chunk_index integer, content text, similarity double precision)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT c.resource_id, c.chunk_index, c.content,
         1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.resource_chunks c
  WHERE c.owner_id = auth.uid() AND c.embedding IS NOT NULL
  ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_resource_chunks(extensions.vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_resource_chunks(extensions.vector, integer) TO authenticated, service_role;