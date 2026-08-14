ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS teaching_notes text;

REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;