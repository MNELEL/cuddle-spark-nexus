-- Fix ambiguous `name` reference inside storage.objects RLS policies for student-files bucket.
-- Inside the EXISTS subquery, unqualified `name` resolved to classes.name. We must reference storage.objects.name explicitly.

DROP POLICY IF EXISTS "student_files_select" ON storage.objects;
DROP POLICY IF EXISTS "student_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "student_files_update" ON storage.objects;
DROP POLICY IF EXISTS "student_files_delete" ON storage.objects;

CREATE POLICY "student_files_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-files' AND
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "student_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-files' AND
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "student_files_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'student-files' AND
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "student_files_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-files' AND
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.owner_id = auth.uid()
  )
);