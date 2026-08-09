CREATE TABLE public.trial_extension_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  institution_name text,
  message text,
  requested_days integer NOT NULL DEFAULT 30 CHECK (requested_days > 0 AND requested_days <= 730),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  granted_days integer,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.trial_extension_requests TO authenticated;
GRANT ALL ON public.trial_extension_requests TO service_role;
REVOKE ALL ON public.trial_extension_requests FROM anon;

ALTER TABLE public.trial_extension_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own trial request" ON public.trial_extension_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own trial requests" ON public.trial_extension_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "managers read trial requests" ON public.trial_extension_requests
  FOR SELECT TO authenticated USING (
    private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'principal'::app_role)
  );

CREATE POLICY "admins review trial requests" ON public.trial_extension_requests
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trial_extension_requests_touch_updated_at
  BEFORE UPDATE ON public.trial_extension_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE UNIQUE INDEX trial_extension_requests_one_pending_idx
  ON public.trial_extension_requests (user_id) WHERE status = 'pending';

CREATE INDEX trial_extension_requests_status_idx
  ON public.trial_extension_requests (status, created_at DESC);