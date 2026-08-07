CREATE TABLE public.partner_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_name text NOT NULL,
  institution_type text NOT NULL DEFAULT 'school',
  contact_name text NOT NULL,
  role text,
  email text NOT NULL,
  phone text,
  student_count text,
  teacher_count text,
  demo_date date,
  message text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.partner_leads TO anon;
GRANT INSERT, SELECT ON public.partner_leads TO authenticated;
GRANT ALL ON public.partner_leads TO service_role;

ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a partner lead"
  ON public.partner_leads FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read partner leads"
  ON public.partner_leads FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX partner_leads_created_at_idx ON public.partner_leads (created_at DESC);