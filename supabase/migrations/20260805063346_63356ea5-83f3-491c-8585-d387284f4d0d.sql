CREATE OR REPLACE FUNCTION private.is_institution_admin(_user_id uuid, _institution_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin'::app_role, 'principal'::app_role)
      AND ur.institution_id IS NOT DISTINCT FROM _institution_id
  );
$function$;