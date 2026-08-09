ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS granted_role public.app_role,
  ADD COLUMN IF NOT EXISTS granted_institution_name text,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS seen_by_requester_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_access_request_requester_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.requested_role IS DISTINCT FROM OLD.requested_role
     OR NEW.granted_role IS DISTINCT FROM OLD.granted_role
     OR NEW.granted_institution_name IS DISTINCT FROM OLD.granted_institution_name
     OR NEW.review_note IS DISTINCT FROM OLD.review_note
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.institution_name IS DISTINCT FROM OLD.institution_name
     OR NEW.message IS DISTINCT FROM OLD.message
  THEN
    RAISE EXCEPTION 'רק מנהל מערכת יכול לעדכן את פרטי הבקשה';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_access_request_requester_update ON public.access_requests;
CREATE TRIGGER guard_access_request_requester_update
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_access_request_requester_update();

DROP POLICY IF EXISTS "requesters acknowledge own access request" ON public.access_requests;
CREATE POLICY "requesters acknowledge own access request"
  ON public.access_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);