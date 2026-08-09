ALTER TABLE public.students ADD COLUMN IF NOT EXISTS middle_name text;

CREATE OR REPLACE FUNCTION public.sync_student_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NULLIF(btrim(coalesce(NEW.first_name, '')), '') IS NOT NULL
     OR NULLIF(btrim(coalesce(NEW.middle_name, '')), '') IS NOT NULL
     OR NULLIF(btrim(coalesce(NEW.last_name, '')), '') IS NOT NULL THEN
    NEW.name := btrim(
      concat_ws(' ',
        NULLIF(btrim(coalesce(NEW.first_name, '')), ''),
        NULLIF(btrim(coalesce(NEW.middle_name, '')), ''),
        NULLIF(btrim(coalesce(NEW.last_name, '')), '')
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;