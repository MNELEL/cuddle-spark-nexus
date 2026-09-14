ALTER TABLE public.student_portfolio_items
  DROP CONSTRAINT IF EXISTS student_portfolio_items_kind_check;

ALTER TABLE public.student_portfolio_items
  ADD CONSTRAINT student_portfolio_items_kind_check
  CHECK (kind = ANY (ARRAY['achievement'::text, 'difficulty'::text, 'assessment'::text, 'milestone'::text, 'note'::text, 'meeting'::text]));

ALTER TABLE public.student_portfolio_items
  ADD COLUMN IF NOT EXISTS source_meeting_id uuid REFERENCES public.teacher_meetings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS student_portfolio_items_source_meeting_idx
  ON public.student_portfolio_items (source_meeting_id);
