
-- student_documents
CREATE TABLE public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text DEFAULT '',
  file_path text,
  mime_type text,
  file_size integer,
  school_year text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_documents_student ON public.student_documents(student_id);
CREATE INDEX idx_student_documents_class ON public.student_documents(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_documents TO authenticated;
GRANT ALL ON public.student_documents TO service_role;
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_documents_owner_all" ON public.student_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = student_documents.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = student_documents.class_id AND c.owner_id = auth.uid()));

-- parent_communications
CREATE TABLE public.parent_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  channel text NOT NULL DEFAULT 'phone',
  subject text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  follow_up_date date,
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_parent_communications_student ON public.parent_communications(student_id);
CREATE INDEX idx_parent_communications_class ON public.parent_communications(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_communications TO authenticated;
GRANT ALL ON public.parent_communications TO service_role;
ALTER TABLE public.parent_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent_communications_owner_all" ON public.parent_communications FOR ALL
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = parent_communications.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = parent_communications.class_id AND c.owner_id = auth.uid()));

-- discipline_events
CREATE TABLE public.discipline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'positive',
  category text NOT NULL DEFAULT 'general',
  severity integer NOT NULL DEFAULT 1,
  description text NOT NULL DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  parents_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_discipline_events_student ON public.discipline_events(student_id);
CREATE INDEX idx_discipline_events_class ON public.discipline_events(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discipline_events TO authenticated;
GRANT ALL ON public.discipline_events TO service_role;
ALTER TABLE public.discipline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discipline_events_owner_all" ON public.discipline_events FOR ALL
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = discipline_events.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = discipline_events.class_id AND c.owner_id = auth.uid()));

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('student-files', 'student-files', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: path format is "<class_id>/<student_id>/<filename>"
CREATE POLICY "student_files_owner_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-files' AND
    EXISTS (SELECT 1 FROM classes c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
  );

CREATE POLICY "student_files_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-files' AND
    EXISTS (SELECT 1 FROM classes c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
  );

CREATE POLICY "student_files_owner_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-files' AND
    EXISTS (SELECT 1 FROM classes c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
  );

CREATE POLICY "student_files_owner_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'student-files' AND
    EXISTS (SELECT 1 FROM classes c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
  );
