CREATE TABLE public.app_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('debug','info','warn','error')),
  message text NOT NULL,
  context jsonb,
  source text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_logs_level_created_at_idx ON public.app_logs (level, created_at DESC);

GRANT ALL ON public.app_logs TO service_role;

ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) may read/write.