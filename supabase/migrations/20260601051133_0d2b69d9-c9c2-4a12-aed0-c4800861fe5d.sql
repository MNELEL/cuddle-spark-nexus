CREATE TABLE public.weekly_bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  digest_summary text NOT NULL DEFAULT '',
  study_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  recap_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  weekly_riddle text NOT NULL DEFAULT '',
  weekly_riddle_answer text NOT NULL DEFAULT '',
  activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX weekly_bulletins_class_idx ON public.weekly_bulletins(class_id, start_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_bulletins TO authenticated;
GRANT ALL ON public.weekly_bulletins TO service_role;

ALTER TABLE public.weekly_bulletins ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekly_bulletins_owner_all
ON public.weekly_bulletins
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = weekly_bulletins.class_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = weekly_bulletins.class_id AND c.owner_id = auth.uid()));