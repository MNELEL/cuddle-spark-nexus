CREATE TABLE public.access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  requested_role app_role NOT NULL DEFAULT 'teacher',
  institution_name text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
REVOKE ALL ON public.access_requests FROM anon;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own access request" ON public.access_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own access request" ON public.access_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "managers read access requests" ON public.access_requests
  FOR SELECT TO authenticated USING (
    private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'principal'::app_role)
  );

CREATE POLICY "admins update access requests" ON public.access_requests
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete access requests" ON public.access_requests
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER access_requests_touch_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX access_requests_status_idx ON public.access_requests (status, created_at DESC);