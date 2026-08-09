DROP POLICY IF EXISTS "brand_own" ON public.brand_settings;
CREATE POLICY "brand_own"
  ON public.brand_settings FOR ALL TO authenticated
  USING (scope = 'user' AND auth.uid() = user_id)
  WITH CHECK (scope = 'user' AND auth.uid() = user_id);