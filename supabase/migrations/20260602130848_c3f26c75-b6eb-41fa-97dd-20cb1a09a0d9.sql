CREATE TABLE public.parent_share_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL,
  student_id UUID,
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_share_tokens TO authenticated;
GRANT ALL ON public.parent_share_tokens TO service_role;
ALTER TABLE public.parent_share_tokens ENABLE ROW LEVEL SECURITY;

-- Owners manage their tokens
CREATE POLICY parent_tokens_owner_all ON public.parent_share_tokens FOR ALL
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = parent_share_tokens.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = parent_share_tokens.class_id AND c.owner_id = auth.uid()));

CREATE INDEX idx_parent_tokens_token ON public.parent_share_tokens(token);
CREATE INDEX idx_parent_tokens_class ON public.parent_share_tokens(class_id);