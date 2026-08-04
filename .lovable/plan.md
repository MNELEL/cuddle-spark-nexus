# שקלול ציונים (Grade Weighting)

סגירת הפער האחרון: `MERGE_MEMORY.md` 1.1 / `docs/lms-gap-analysis.md` 6.

## מה נמצא בקוד היום (מאומת)

- `src/routes/_authenticated.analytics.$classId.tsx` — "סדר עדיפות למקצועות" נשמר ב-localStorage (`ca_subject_priority_<classId>`) ומשפיע רק על מיון `subjects` ועל בחירת 5 הסדרות בגרף הקו. `barData` מחשב ממוצע אריתמטי פשוט של אחוזים לכל מקצוע — אין שקלול ואין ממוצע כללי מוצג.
- `src/lib/tracking.functions.ts` — `listGrades` / `upsertGrade` / `deleteGrade`, כולם `requireSupabaseAuth` + `context.supabase` (RLS כמשתמש).
- מקומות נוספים שמחשבים ממוצע ציונים:
  - `src/routes/_authenticated.certificates.$classId.tsx` (`computeStudentRow`) — sum/max לכל מקצוע ואז תווית איכותית לכל מקצוע בנפרד. אין ממוצע-על.
  - `src/lib/reports.functions.ts` — `avgPct` לכל תלמיד (ממוצע פשוט של אחוזים).
  - `src/lib/performance-score.ts`, `src/lib/seating-wizard.functions.ts`, `src/lib/ai-pedagogical.functions.ts`, `src/lib/public-class.functions.ts` (ציבורי, `supabaseAdmin`), `src/routes/p.$token.tsx` (שיתוף להורים).

## החלטות שאני מציע

1. **נוסחה: שקלול בין-מקצועי, לא לכל ציון בנפרד.** קודם ממוצע פנימי לכל מקצוע (`sum(value)/sum(max)*100`, כמו בתעודות), ואז `sum(subjAvg_i * w_i) / sum(w_i)` על המקצועות שיש להם ציונים בלבד. כך תלמיד עם 12 בחנים בגמרא ומבחן אחד בהלכה לא מוטה — וזו גם הכוונה של "משקל מקצוע".
2. **מקום החישוב: לוגיקה משותפת ב-`src/lib/grade-weighting.ts`** (pure, בלי server/client) שמיוצאת גם ל-analytics (client) וגם ל-server functions. בלי כפילות חישוב.
3. **Fallback מלא לאחור:** מקצוע בלי שורת משקל = 1. אם אין אף שורה בכלל, כל המשקלים 1 והתוצאה מתלכדת מתמטית עם ממוצע-מקצועות. הערה חשובה: זה **לא** זהה בדיוק ל-`avgPct` הקיים ב-`reports.functions.ts`, שהוא ממוצע פשוט על כל הציונים (מוטה לפי כמות). לכן:
   - `analytics` — מציג ממוצע משוקלל חדש (פיצ'ר חדש, אין רגרסיה).
   - `reports` / `performance-score` / `seating-wizard` / `public-class` / `p.$token` — **לא נוגעים בשלב זה**. שינוי שם משנה מספרים היסטוריים ודוחות שהורים כבר ראו.
   - `certificates` — נוסיף שורת "ממוצע משוקלל" **אופציונלית** (רק כשקיימות שורות משקל לכיתה), התוויות לכל מקצוע נשארות כפי שהן.

## שלבי ביצוע

### 1. Migration — `public.grade_weights`
`id uuid pk`, `class_id uuid not null references public.classes(id) on delete cascade`, `subject text not null`, `weight numeric not null default 1 check (weight > 0 and weight <= 10)`, `created_at`, `updated_at`, `unique (class_id, subject)`.
- GRANT: `select, insert, update, delete` ל-`authenticated`; `all` ל-`service_role`; **ללא anon**.
- RLS on + policy יחיד `grade_weights_owner_all FOR ALL TO authenticated` בדפוס `grades_owner_all`: `exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())` ב-USING וב-WITH CHECK.
- טריגר `update_updated_at_column()` ל-`updated_at`.
- אינדקס על `class_id`.

### 2. Server functions ב-`src/lib/tracking.functions.ts`
- `listGradeWeights({ classId })` — POST, `requireSupabaseAuth`, מחזיר `[]` כשאין.
- `upsertGradeWeight({ classId, subject, weight })` — `subject: z.string().min(1).max(60)`, `weight: z.number().min(0.1).max(10)`, `upsert(..., { onConflict: "class_id,subject" })`.
- `deleteGradeWeight({ id })` — חזרה לברירת מחדל 1.
כולם באותו דפוס טיפול שגיאות של הקובץ (`console.error("[DB Error]", error)` + הודעה בעברית).

### 3. `src/lib/grade-weighting.ts` (חדש, pure)
- `subjectAverages(grades)` → `Map<subject, { pct, count }>` (sum/max).
- `weightFor(subject, weights)` → מספר, ברירת מחדל 1.
- `weightedAverage(grades, weights)` → `{ value: number | null, contributions: {subject, pct, weight, share}[] }`; `null` כשאין ציונים.
- `weightedAverageByStudent(grades, weights)` → `Map<student_id, number|null>`.
בלי React, בלי Supabase — נגיש לשני הצדדים.

### 4. UI ב-`_authenticated.analytics.$classId.tsx`
- `useQuery(["gradeWeights", classId])` + `useMutation` ל-upsert עם invalidate.
- כרטיס חדש **"משקל מקצועות"** ליד "סדר עדיפות למקצועות": שורה לכל מקצוע מ-`subjects`, `Input type=number` (step 0.1, טווח 0.1–10), שמירה ב-blur/debounce, כפתור "איפוס" (delete) לשורות שקיימות, והסבר: "משקל 2 = המקצוע נספר כפליים בממוצע הכללי. ללא הגדרה — כל המקצועות שווים."
- **כרטיס "ממוצע משוקלל"** מעל הגרפים: הממוצע לפי בחירת התלמיד הנוכחית (`all` = כל הכיתה), ולידו הממוצע הלא-משוקלל כהשוואה כשהם שונים, + פירוט תרומת כל מקצוע באחוזים.
- בגרף העמודות: תווית משקל (`×1.5`) ליד שם המקצוע ב-tooltip; גובה העמודה נשאר ממוצע המקצוע (לא לשקלל עמודה בודדת — זו הטעות הנפוצה).
- טיפול בקצה: אין ציונים → הודעה קיימת; יש ציונים ואין משקלים → הכרטיס מציג את הממוצע עם הערה "כל המקצועות בשקלול שווה".

### 5. `certificates` — תוספת אופציונלית
`computeStudentRow` יקבל `weights` (ברירת מחדל `[]`). כשיש שורות משקל לכיתה, נוסיף ל-`StudentRow` שדה `weightedAvg` ונציג אותו בכרטיס התלמיד ובייצוא ה-PDF כשורת "ממוצע משוקלל". כשאין משקלים — אין שינוי בפלט הקיים כלל.

### 6. תיעוד
עדכון `MERGE_MEMORY.md` 1.1 ו-`docs/lms-gap-analysis.md` 6 לסטטוס "מיושם", כולל הנוסחה שנבחרה והבחירה המכוונת לא לשנות דוחות היסטוריים.

## מה לא בתוכנית
- שקלול לפי סוג הערכה (בוחן/מבחן/עבודה) — אין עמודה כזו ב-`grades` היום.
- משקלים גלובליים חוצי-כיתות או לפי תקופה.
- שינוי `avgPct` בדוחות, בציון הביצועים, באשף הישיבה ובעמודים הציבוריים.

## שאלה אחת לפני מימוש
האם לאמץ את השקלול גם ב**דוח הפדגוגי** (`ai-pedagogical` / `_authenticated.pedagogical.$classId.tsx`), או להשאיר בשלב זה רק analytics + תעודות?