CREATE TABLE public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_image_note text,
  frame_style text NOT NULL DEFAULT 'double_border',
  corner_decoration text NOT NULL DEFAULT 'none',
  primary_color text NOT NULL DEFAULT '#334155',
  accent_color text NOT NULL DEFAULT '#d97706',
  title_font_weight text NOT NULL DEFAULT 'bold',
  title_alignment text NOT NULL DEFAULT 'center',
  layout_density text NOT NULL DEFAULT 'standard',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT certificate_templates_frame_style_check CHECK (frame_style = ANY (ARRAY['double_border','single_border','ornate','none'])),
  CONSTRAINT certificate_templates_corner_check CHECK (corner_decoration = ANY (ARRAY['none','flourish','rosette','seal'])),
  CONSTRAINT certificate_templates_weight_check CHECK (title_font_weight = ANY (ARRAY['bold','normal'])),
  CONSTRAINT certificate_templates_align_check CHECK (title_alignment = ANY (ARRAY['center','right'])),
  CONSTRAINT certificate_templates_density_check CHECK (layout_density = ANY (ARRAY['compact','standard','spacious'])),
  CONSTRAINT certificate_templates_primary_hex_check CHECK (primary_color ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT certificate_templates_accent_hex_check CHECK (accent_color ~* '^#[0-9a-f]{6}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_templates TO authenticated;
GRANT ALL ON public.certificate_templates TO service_role;

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their certificate templates"
ON public.certificate_templates FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.certificate_templates FROM anon;

CREATE INDEX certificate_templates_owner_created_idx
ON public.certificate_templates (owner_id, created_at DESC);