CREATE TABLE public.contact_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_entries TO authenticated;
GRANT ALL ON public.contact_entries TO service_role;

ALTER TABLE public.contact_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_entries_owner_all" ON public.contact_entries
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX contact_entries_owner_idx ON public.contact_entries (owner_id, class_id, sort_order);

CREATE TRIGGER contact_entries_touch_updated_at
  BEFORE UPDATE ON public.contact_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();