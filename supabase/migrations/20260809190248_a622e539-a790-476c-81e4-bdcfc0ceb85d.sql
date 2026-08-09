DROP INDEX IF EXISTS public.brand_settings_institution_scope_key;
CREATE UNIQUE INDEX IF NOT EXISTS brand_settings_institution_id_key
  ON public.brand_settings (institution_id);