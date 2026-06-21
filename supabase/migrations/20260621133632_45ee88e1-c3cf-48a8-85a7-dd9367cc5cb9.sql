CREATE TABLE public.app_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_enabled boolean NOT NULL DEFAULT false,
  pin_hash text,
  pin_salt text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_security TO authenticated;
GRANT ALL ON public.app_security TO service_role;
ALTER TABLE public.app_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own row select" ON public.app_security FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own row insert" ON public.app_security FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own row update" ON public.app_security FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own row delete" ON public.app_security FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER app_security_updated_at BEFORE UPDATE ON public.app_security FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();