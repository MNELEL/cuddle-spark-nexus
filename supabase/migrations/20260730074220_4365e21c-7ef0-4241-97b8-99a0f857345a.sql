CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can manage roles in their institution" ON public.user_roles;

CREATE POLICY "Admins can manage roles in their institution"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
      AND NOT (ur.institution_id IS DISTINCT FROM user_roles.institution_id)
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
      AND NOT (ur.institution_id IS DISTINCT FROM user_roles.institution_id)
  )
);

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);