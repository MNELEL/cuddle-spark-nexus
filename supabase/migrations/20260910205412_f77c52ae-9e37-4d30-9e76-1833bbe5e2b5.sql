DROP POLICY IF EXISTS "Authenticated can read teacher meetings" ON public.teacher_meetings;
DROP POLICY IF EXISTS "Authenticated can insert teacher meetings" ON public.teacher_meetings;
DROP POLICY IF EXISTS "Authenticated can update teacher meetings" ON public.teacher_meetings;
DROP POLICY IF EXISTS "Authenticated can delete teacher meetings" ON public.teacher_meetings;

CREATE POLICY "Participants and institution admins can read meetings"
  ON public.teacher_meetings FOR SELECT TO authenticated
  USING (
    auth.uid() = teacher_id
    OR auth.uid() = admin_id
    OR private.is_institution_admin(auth.uid(), institution_id)
  );

CREATE POLICY "Institution admins can insert meetings"
  ON public.teacher_meetings FOR INSERT TO authenticated
  WITH CHECK (private.is_institution_admin(auth.uid(), institution_id));

CREATE POLICY "Institution admins can update meetings"
  ON public.teacher_meetings FOR UPDATE TO authenticated
  USING (private.is_institution_admin(auth.uid(), institution_id))
  WITH CHECK (private.is_institution_admin(auth.uid(), institution_id));

CREATE POLICY "Institution admins can delete meetings"
  ON public.teacher_meetings FOR DELETE TO authenticated
  USING (private.is_institution_admin(auth.uid(), institution_id));