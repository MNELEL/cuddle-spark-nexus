CREATE OR REPLACE FUNCTION public.match_resources(query_embedding extensions.vector, owner uuid, match_count integer DEFAULT 6, exclude_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT r.id, 1 - (r.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.teaching_resources r
  WHERE r.owner_id = owner
    AND r.embedding IS NOT NULL
    AND (exclude_id IS NULL OR r.id <> exclude_id)
  ORDER BY r.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT match_count;
$function$;