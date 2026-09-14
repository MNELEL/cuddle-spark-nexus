ALTER TABLE public.student_portfolio_items
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;