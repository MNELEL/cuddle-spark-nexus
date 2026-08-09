-- Extend brand_settings to support institution-level branding alongside per-user branding.
ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS locked_fields text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.brand_settings ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_brand_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope NOT IN ('user', 'institution') THEN
    RAISE EXCEPTION 'INVALID_BRAND_SCOPE';
  END IF;
  IF NEW.scope = 'user' AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'BRAND_USER_SCOPE_REQUIRES_USER';
  END IF;
  IF NEW.scope = 'institution' AND NEW.institution_id IS NULL THEN
    RAISE EXCEPTION 'BRAND_INSTITUTION_SCOPE_REQUIRES_INSTITUTION';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_settings_scope ON public.brand_settings;
CREATE TRIGGER trg_brand_settings_scope
  BEFORE INSERT OR UPDATE ON public.brand_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_brand_scope();

CREATE UNIQUE INDEX IF NOT EXISTS brand_settings_user_scope_key
  ON public.brand_settings (user_id) WHERE scope = 'user';
CREATE UNIQUE INDEX IF NOT EXISTS brand_settings_institution_scope_key
  ON public.brand_settings (institution_id) WHERE scope = 'institution';

-- Institution-scoped branding: readable by any member of the institution,
-- writable only by an institution admin (admin / principal).
DROP POLICY IF EXISTS "institution members can view institution brand" ON public.brand_settings;
CREATE POLICY "institution members can view institution brand"
  ON public.brand_settings FOR SELECT TO authenticated
  USING (
    scope = 'institution'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.institution_id = brand_settings.institution_id
    )
  );

DROP POLICY IF EXISTS "institution admins can insert institution brand" ON public.brand_settings;
CREATE POLICY "institution admins can insert institution brand"
  ON public.brand_settings FOR INSERT TO authenticated
  WITH CHECK (
    scope = 'institution'
    AND institution_id IS NOT NULL
    AND private.is_institution_admin(auth.uid(), institution_id)
  );

DROP POLICY IF EXISTS "institution admins can update institution brand" ON public.brand_settings;
CREATE POLICY "institution admins can update institution brand"
  ON public.brand_settings FOR UPDATE TO authenticated
  USING (scope = 'institution' AND private.is_institution_admin(auth.uid(), institution_id))
  WITH CHECK (scope = 'institution' AND private.is_institution_admin(auth.uid(), institution_id));

DROP POLICY IF EXISTS "institution admins can delete institution brand" ON public.brand_settings;
CREATE POLICY "institution admins can delete institution brand"
  ON public.brand_settings FOR DELETE TO authenticated
  USING (scope = 'institution' AND private.is_institution_admin(auth.uid(), institution_id));