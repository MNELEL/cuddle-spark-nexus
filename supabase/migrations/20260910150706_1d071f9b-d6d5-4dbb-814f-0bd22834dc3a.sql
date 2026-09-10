CREATE TABLE public.student_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  person_key uuid NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  school_year text,
  item_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_portfolio_items_kind_check CHECK (kind IN ('achievement','difficulty','assessment','milestone','note'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_portfolio_items TO authenticated;
GRANT ALL ON public.student_portfolio_items TO service_role;

ALTER TABLE public.student_portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own portfolio items"
ON public.student_portfolio_items FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX student_portfolio_items_person_key_idx ON public.student_portfolio_items (person_key);
CREATE INDEX student_portfolio_items_student_idx ON public.student_portfolio_items (student_id);

CREATE TRIGGER student_portfolio_items_touch
BEFORE UPDATE ON public.student_portfolio_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();