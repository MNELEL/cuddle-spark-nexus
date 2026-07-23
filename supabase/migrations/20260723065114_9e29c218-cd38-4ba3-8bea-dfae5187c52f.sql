REVOKE EXECUTE ON FUNCTION public.export_my_data() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_resources(extensions.vector, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;