ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

UPDATE public.profiles
SET trial_started_at = coalesce(trial_started_at, created_at, now()),
    trial_ends_at = coalesce(trial_ends_at, coalesce(created_at, now()) + interval '30 days')
WHERE trial_ends_at IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name, trial_started_at, trial_ends_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    now(),
    now() + interval '30 days'
  );
  return new;
end; $function$;