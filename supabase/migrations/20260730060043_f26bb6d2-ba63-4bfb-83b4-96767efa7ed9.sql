ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.classes ADD CONSTRAINT classes_status_check CHECK (status IN ('active','archived'));