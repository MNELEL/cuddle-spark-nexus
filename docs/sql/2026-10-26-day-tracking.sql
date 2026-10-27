-- מעקב יומי ושבועי לכיתה — הורץ ידנית ב-SQL של Lovable Cloud ב-26/10/2026.
-- הקובץ נשמר כתיעוד כדי שאפשר יהיה לשחזר את המבנה. כל טבלה: RLS פעיל, בעלות דרך classes.owner_id, בלי גישת anon.
-- דירוגים: 1 = חלש, 2 = בינוני, 3 = טוב.

-- 1. סדר היום של הכיתה (נוצר אוטומטית בפעם הראשונה שפותחים את המסך היומי)
create table public.class_day_slots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  label text not null,
  order_index smallint not null default 0,
  rated boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index class_day_slots_class_idx on public.class_day_slots (class_id, order_index);
alter table public.class_day_slots enable row level security;
create policy class_day_slots_owner_all on public.class_day_slots for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_day_slots.class_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_day_slots.class_id and c.owner_id = auth.uid()));
revoke all on public.class_day_slots from anon;

-- 2. דירוג לכל תלמיד בכל שעה
create table public.session_ratings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  slot_id uuid not null references public.class_day_slots(id) on delete cascade,
  date date not null,
  readiness smallint not null default 3 check (readiness between 1 and 3),
  listening smallint not null default 3 check (listening between 1 and 3),
  behavior smallint not null default 3 check (behavior between 1 and 3),
  work_done smallint not null default 3 check (work_done between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date, slot_id)
);
create index session_ratings_class_date_idx on public.session_ratings (class_id, date);
create index session_ratings_student_date_idx on public.session_ratings (student_id, date);
alter table public.session_ratings enable row level security;
create policy session_ratings_owner_all on public.session_ratings for all to authenticated
  using (exists (select 1 from public.classes c where c.id = session_ratings.class_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = session_ratings.class_id and c.owner_id = auth.uid()));
revoke all on public.session_ratings from anon;

-- 3. חוסרים (כלי כתיבה, ספרים) ואירועים חריגים. בונוסים נשמרים ב-behavior_points עם category = 'bonus'
create table public.daily_student_events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('missing_writing','missing_books','exceptional')),
  note text,
  created_at timestamptz not null default now()
);
create index daily_student_events_class_date_idx on public.daily_student_events (class_id, date);
create index daily_student_events_student_idx on public.daily_student_events (student_id, date);
alter table public.daily_student_events enable row level security;
create policy daily_student_events_owner_all on public.daily_student_events for all to authenticated
  using (exists (select 1 from public.classes c where c.id = daily_student_events.class_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = daily_student_events.class_id and c.owner_id = auth.uid()));
revoke all on public.daily_student_events from anon;

-- 4. הגדרות שבועיות לכיתה (מקצוע החתימה של השבוע)
create table public.weekly_class_settings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  week_start date not null,
  signature_subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, week_start)
);
alter table public.weekly_class_settings enable row level security;
create policy weekly_class_settings_owner_all on public.weekly_class_settings for all to authenticated
  using (exists (select 1 from public.classes c where c.id = weekly_class_settings.class_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = weekly_class_settings.class_id and c.owner_id = auth.uid()));
revoke all on public.weekly_class_settings from anon;

-- 5. רשומה שבועית לכל תלמיד (חתימת הורים, דבר תורה)
create table public.weekly_student_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  week_start date not null,
  parent_signed boolean not null default false,
  dvar_torah_delivered boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, week_start)
);
create index weekly_student_records_class_week_idx on public.weekly_student_records (class_id, week_start);
alter table public.weekly_student_records enable row level security;
create policy weekly_student_records_owner_all on public.weekly_student_records for all to authenticated
  using (exists (select 1 from public.classes c where c.id = weekly_student_records.class_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = weekly_student_records.class_id and c.owner_id = auth.uid()));
revoke all on public.weekly_student_records from anon;

-- 6. סוג מוסד (תלמוד תורה / חיידר / ישיבה) למסך "בית הספר". הורץ ב-26/10/2026.
-- ברירת המחדל מתאימה למוסד הקיים. תואר מלמד (רב, ר״מ ועוד) כבר שמור ב-institution_staff.title.
alter table public.institutions
  add column if not exists kind text not null default 'talmud_torah'
  check (kind in ('talmud_torah','cheder','yeshiva'));

-- 7. קריטריונים מוגדרים לכל שעה (הורץ ב-26/10/2026). הוספה בלבד, בלי לפגוע בנתונים קיימים.
-- class_day_slots.criteria: מערך של {key, label}, לפי הסדר שבו העמודות מוצגות. ריק = שעה בלי דירוג.
-- session_ratings.scores: אובייקט {key: 1|2|3}. העמודות הקבועות הישנות (readiness, listening, behavior, work_done)
-- נשארו בינתיים כדי שהקוד הקודם ימשיך לעבוד; הקוד החדש קורא מהן רק כשאין scores.
alter table public.class_day_slots add column if not exists criteria jsonb not null default '[]'::jsonb;
alter table public.session_ratings add column if not exists scores jsonb not null default '{}'::jsonb;

update public.session_ratings
set scores = jsonb_build_object('readiness', readiness, 'listening', listening, 'behavior', behavior, 'work_done', work_done)
where scores = '{}'::jsonb;

update public.class_day_slots
set criteria = case
  when label = 'תפילה' then '[{"key":"behavior","label":"התנהגות"},{"key":"prayer","label":"תפילה"}]'::jsonb
  else '[{"key":"readiness","label":"מוכנות"},{"key":"listening","label":"הקשבה"},{"key":"behavior","label":"התנהגות"},{"key":"work_done","label":"עבודות"}]'::jsonb
end
where rated = true and criteria = '[]'::jsonb;

-- ניקוי עתידי, רק אחרי שהקוד החדש באוויר ונבדק (פעולה בלתי הפיכה):
-- alter table public.session_ratings drop column readiness, drop column listening, drop column behavior, drop column work_done;

-- 8. סדר ידני של תלמידים (הורץ ב-26/10/2026). null = עדיין בלי מקום קבוע; מוצג בסוף, לפי שם.
alter table public.students add column if not exists sort_order integer;

-- 9. ברירת מחדל חדשה לשעה: ציון אחד בלי קטגוריות (criteria = []), שנשמר ב-scores תחת המפתח 'overall'.
-- פיצול לקטגוריות נעשה ב"עריכת עמודות". הקוד החדש מציג שעה בלי קטגוריות כעמודה אחת (הישן הסתיר אותה).
-- להרצה רק אחרי שהקוד החדש באוויר: איפוס שעות שעדיין במבנה ארבע-הקטגוריות המקורי (לא נוגע בתפילה ובשעות ששונו ידנית).
-- הנתונים שנשמרו בעבר לא נמחקים. בעמודה אחת מוצג הציון הנמוך ביותר מבין הקטגוריות שנשמרו באותו יום.
-- update public.class_day_slots s set criteria = '[]'::jsonb
-- from public.classes c
-- where c.id = s.class_id and c.owner_id = '<מזהה הבעלים>' and s.rated = true and s.label <> 'תפילה'
--   and s.criteria = '[{"key":"readiness","label":"מוכנות"},{"key":"listening","label":"הקשבה"},{"key":"behavior","label":"התנהגות"},{"key":"work_done","label":"עבודות"}]'::jsonb;

