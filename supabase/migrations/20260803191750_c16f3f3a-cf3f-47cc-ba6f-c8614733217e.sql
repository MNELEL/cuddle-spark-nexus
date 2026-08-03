REVOKE ALL ON FUNCTION public.recalculate_pacing(uuid, date[], date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_pacing(uuid, date[], date) TO service_role;

REVOKE ALL ON FUNCTION public.trigger_recalculate_pacing_on_override() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_pacing_on_override() TO service_role;