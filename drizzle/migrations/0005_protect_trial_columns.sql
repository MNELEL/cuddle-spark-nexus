CREATE OR REPLACE FUNCTION public.guard_profile_trial_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.trial_started_at := now();
      NEW.trial_ends_at := now() + interval '30 days';
    ELSIF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
       OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at THEN
      IF OLD.trial_ends_at IS NULL THEN
        NEW.trial_started_at := now();
        NEW.trial_ends_at := now() + interval '30 days';
      ELSE
        NEW.trial_started_at := OLD.trial_started_at;
        NEW.trial_ends_at := OLD.trial_ends_at;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_profile_trial_columns ON public.profiles;
CREATE TRIGGER guard_profile_trial_columns BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_trial_columns();