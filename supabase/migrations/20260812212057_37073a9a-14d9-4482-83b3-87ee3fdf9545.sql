CREATE TABLE public.class_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  body text CHECK (body IS NULL OR char_length(body) <= 2000),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_announcements_class_idx ON public.class_announcements(class_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_announcements TO authenticated;
GRANT ALL ON public.class_announcements TO service_role;
ALTER TABLE public.class_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_announcements_owner_all ON public.class_announcements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_announcements.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_announcements.class_id AND c.owner_id = auth.uid()));

CREATE POLICY class_announcements_institution_admin_select ON public.class_announcements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_announcements.class_id AND c.institution_id IS NOT NULL AND private.is_institution_admin(auth.uid(), c.institution_id)));

CREATE TRIGGER class_announcements_touch BEFORE UPDATE ON public.class_announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.class_announcement_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.class_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz,
  dismissed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_announcement_states TO authenticated;
GRANT ALL ON public.class_announcement_states TO service_role;
ALTER TABLE public.class_announcement_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_announcement_states_own_all ON public.class_announcement_states FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER class_announcement_states_touch BEFORE UPDATE ON public.class_announcement_states
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();