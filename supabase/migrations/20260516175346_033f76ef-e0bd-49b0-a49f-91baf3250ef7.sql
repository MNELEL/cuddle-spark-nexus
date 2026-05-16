
-- Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_owner_all ON public.groups FOR ALL
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = groups.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = groups.class_id AND c.owner_id = auth.uid()));
CREATE INDEX idx_groups_class ON public.groups(class_id);

-- Student-group membership
CREATE TABLE public.student_groups (
  student_id UUID NOT NULL,
  group_id UUID NOT NULL,
  PRIMARY KEY (student_id, group_id)
);
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_groups_owner_all ON public.student_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.classes c ON c.id = g.class_id
    WHERE g.id = student_groups.group_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.classes c ON c.id = g.class_id
    WHERE g.id = student_groups.group_id AND c.owner_id = auth.uid()));
CREATE INDEX idx_student_groups_group ON public.student_groups(group_id);

-- Saved seating configurations (snapshots)
CREATE TABLE public.seating_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  name TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seating_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY seating_configs_owner_all ON public.seating_configs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = seating_configs.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = seating_configs.class_id AND c.owner_id = auth.uid()));
CREATE INDEX idx_seating_configs_class ON public.seating_configs(class_id, created_at DESC);
