REVOKE ALL ON FUNCTION public.enforce_class_not_archived() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_archived_class_readonly() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_class_not_archived() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_archived_class_readonly() TO service_role;