ALTER TABLE public.lesson_transcripts
  ADD COLUMN IF NOT EXISTS part_group_id uuid,
  ADD COLUMN IF NOT EXISTS part_index integer,
  ADD COLUMN IF NOT EXISTS part_total integer;

CREATE INDEX IF NOT EXISTS lesson_transcripts_part_group_idx ON public.lesson_transcripts(part_group_id);

DO $$
DECLARE
  v_class uuid := '12422543-bfe7-46bb-ad9a-a20730e634f4';
  v_owner uuid := 'b32c933e-ae12-4586-92c3-2f365ab56f2e';
  v_date date := CURRENT_DATE;
  r record;
  i int := 0;
BEGIN
  FOR r IN SELECT id, name FROM public.students WHERE class_id = v_class ORDER BY name LIMIT 10 LOOP
    i := i + 1;

    INSERT INTO public.attendance (class_id, student_id, date, status, notes)
    SELECT v_class, r.id, v_date,
           CASE WHEN i = 3 THEN 'late' WHEN i = 7 THEN 'absent' ELSE 'present' END,
           CASE WHEN i = 3 THEN 'הגיע באיחור של עשר דקות' WHEN i = 7 THEN 'נעדר — הודעת הורים' ELSE '' END
    WHERE NOT EXISTS (
      SELECT 1 FROM public.attendance a WHERE a.student_id = r.id AND a.date = v_date
    );

    INSERT INTO public.grades (class_id, student_id, subject, value, max_value, date, notes)
    SELECT v_class, r.id, 'גמרא', 72 + (i * 2), 100, v_date, 'בחינה בעל פה על הסוגיה שנלמדה'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.grades g
      WHERE g.student_id = r.id AND g.date = v_date AND g.subject = 'גמרא'
    );

    INSERT INTO public.orchestrator_insights
      (owner_id, class_id, student_id, insight_type, severity, title, description, suggested_action, insight_date)
    SELECT v_owner, v_class, r.id, 'manual', CASE WHEN i = 7 THEN 'medium' ELSE 'low' END,
           'תיעוד יומי — ' || r.name,
           CASE
             WHEN i = 7 THEN 'נעדר היום; יש להשלים את הסוגיה שנלמדה ולוודא הבנה.'
             WHEN i = 3 THEN 'הגיע באיחור אך השתלב בלימוד והשיב נכון בחזרה.'
             ELSE 'השתתפות טובה בשיעור, חזר על הסוגיה בעל פה בצורה מסודרת.'
           END,
           CASE WHEN i = 7 THEN 'לתאם השלמה אישית מחר לפני התפילה' ELSE NULL END,
           v_date
    WHERE NOT EXISTS (
      SELECT 1 FROM public.orchestrator_insights o
      WHERE o.student_id = r.id AND o.insight_date = v_date AND o.insight_type = 'manual'
    );

    INSERT INTO public.daily_log_approvals (owner_id, class_id, student_id, date, approver_name, notes)
    SELECT v_owner, v_class, r.id, v_date, 'הרב המלמד',
           CASE WHEN i = 7 THEN 'אושר בהערה: נדרשת השלמה' ELSE 'התיעוד היומי נבדק ואושר' END
    WHERE NOT EXISTS (
      SELECT 1 FROM public.daily_log_approvals d WHERE d.student_id = r.id AND d.date = v_date
    );
  END LOOP;

  INSERT INTO public.daily_summaries (class_id, date, notes, created_by)
  SELECT v_class, v_date,
         'הכיתה סיימה את הסוגיה ונערכה חזרה בעל פה. עשרה תלמידים תועדו עם נוכחות, ציון, תובנה ואישור.',
         v_owner
  WHERE NOT EXISTS (
    SELECT 1 FROM public.daily_summaries s WHERE s.class_id = v_class AND s.date = v_date
  );
END $$;