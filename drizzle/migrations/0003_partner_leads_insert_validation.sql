DROP POLICY IF EXISTS "Anyone can submit a partner lead" ON public.partner_leads;
CREATE POLICY "Anyone can submit a valid partner lead"
ON public.partner_leads FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(btrim(institution_name)) BETWEEN 1 AND 160
  AND char_length(btrim(contact_name)) BETWEEN 1 AND 120
  AND institution_type IN ('school','cheder','yeshiva','district')
  AND char_length(email) <= 200
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (role IS NULL OR char_length(role) <= 120)
  AND (phone IS NULL OR char_length(phone) <= 40)
  AND (student_count IS NULL OR char_length(student_count) <= 20)
  AND (teacher_count IS NULL OR char_length(teacher_count) <= 20)
  AND (message IS NULL OR char_length(message) <= 2000)
  AND (user_agent IS NULL OR char_length(user_agent) <= 500)
);