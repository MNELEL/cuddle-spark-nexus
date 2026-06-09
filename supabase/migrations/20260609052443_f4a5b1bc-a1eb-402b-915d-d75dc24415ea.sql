
REVOKE EXECUTE ON FUNCTION public.match_resources(vector, uuid, int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_resources(vector, uuid, int, uuid) TO service_role;
