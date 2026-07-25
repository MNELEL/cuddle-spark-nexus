CREATE TABLE public.checklist_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  institution text NOT NULL,
  role text NOT NULL,
  email text NOT NULL,
  checklist_slug text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.checklist_leads TO anon, authenticated;
GRANT ALL ON public.checklist_leads TO service_role;

ALTER TABLE public.checklist_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a checklist lead"
  ON public.checklist_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(full_name) between 1 and 120
    AND length(institution) between 1 and 160
    AND length(role) between 1 and 60
    AND length(email) between 3 and 200
    AND length(checklist_slug) between 1 and 80
  );

CREATE INDEX checklist_leads_slug_created_idx
  ON public.checklist_leads (checklist_slug, created_at DESC);