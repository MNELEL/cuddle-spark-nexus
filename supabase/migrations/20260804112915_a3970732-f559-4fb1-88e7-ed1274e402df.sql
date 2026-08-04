DROP TRIGGER IF EXISTS trg_recalc_pacing_on_override ON public.academic_calendar_overrides;
DROP FUNCTION IF EXISTS public.trigger_recalculate_pacing_on_override();