CREATE OR REPLACE FUNCTION private.is_institution_admin(_user_id uuid, _institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'::app_role
      AND ur.institution_id IS NOT DISTINCT FROM _institution_id
  );
$$;

REVOKE ALL ON FUNCTION private.is_institution_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Admins can manage roles in their institution" ON public.user_roles;

CREATE POLICY "Admins can manage roles in their institution"
ON public.user_roles
FOR ALL
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.is_institution_admin(auth.uid(), institution_id)
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.is_institution_admin(auth.uid(), institution_id)
);