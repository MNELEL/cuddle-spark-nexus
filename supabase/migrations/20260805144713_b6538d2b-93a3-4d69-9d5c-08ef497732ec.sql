ALTER TABLE public.teaching_resources
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium';

CREATE OR REPLACE FUNCTION public.validate_resource_difficulty()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.difficulty IS NULL OR NEW.difficulty NOT IN ('easy','medium','hard') THEN
    RAISE EXCEPTION 'INVALID_DIFFICULTY';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teaching_resources_difficulty ON public.teaching_resources;
CREATE TRIGGER trg_teaching_resources_difficulty
  BEFORE INSERT OR UPDATE ON public.teaching_resources
  FOR EACH ROW EXECUTE FUNCTION public.validate_resource_difficulty();

CREATE INDEX IF NOT EXISTS idx_teaching_resources_owner_favorite
  ON public.teaching_resources (owner_id, is_favorite);