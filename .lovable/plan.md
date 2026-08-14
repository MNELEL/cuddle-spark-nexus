# רענון מסך "הכיתות שלי"

## מה ישתנה מבחינת המלמד

1. **שורת סטטיסטיקה בראש העמוד** — שלושה מדדים קומפקטיים: סה"כ תלמידים (בכיתות פעילות), כיתות פעילות (מתוך סה"כ), ופעולות ממתינות (עלונים בטיוטה + התראות ארכיון שלא נסגרו).
2. **כרטיס כיתה מועשר** — מספר תלמידים בפועל במקום/לצד גריד הדקורציה, תג "עלון בטיוטה" ותג "מבחן קרוב" (עד 14 יום) לכיתות שדורשות תשומת לב.
3. **בורר מיון** — לאחרונה (ברירת מחדל, כמו היום) / לפי שם א-ב / לפי מספר תלמידים (יורד). הבחירה נשמרת ב-localStorage.
4. **סדר עמוד חדש** — כיתות ראשונות: כותרת → שורת סטטיסטיקה → סרגל חיפוש/מיון/סטטוס → כרטיסי הכיתות. אחרי הכיתות: אשף כיתה חדשה, כרטיס ההתקדמות (Onboarding), כרטיס דשבורד המוסד, וטבלת השיוכים (ClassAssignmentsTable) בתוך אזור מתקפל ("ניהול ושיוכים") בתחתית. באנר התראות הארכיון נשאר למעלה כי הוא דורש פעולה.

## נתונים — מה נבדק ומה נדרש

`listClasses` מחזיר כרגע `select("*")` מ-`classes` בלבד: אין בו מספר תלמידים ואין מידע על עלונים. לכן המדדים החדשים לא ניתנים לחישוב מהנתונים הקיימים בלקוח.

הטבלאות הדרושות כבר קיימות עם השדות הנחוצים — **אין צורך בשינוי סכמה או מיגרציה**:
- `students.class_id` — לספירת תלמידים לכל כיתה.
- `weekly_bulletins.class_id` + `weekly_bulletins.status` (`draft` / `published`) — לתג "עלון בטיוטה".
- `class_events.class_id`, `event_type` (`exam` / `special_exam`), ותאריך האירוע — לתג "מבחן קרוב".

## תכנון טכני

### 1. `src/lib/classes.functions.ts`
פונקציית שרת חדשה `getClassesOverview` (במקום להרחיב את `listClasses`, כדי לא לשנות את החוזה של כל הצרכנים הקיימים):
- קוראת ל-`listClasses` הקיים או שולפת את אותן שורות, ואז שלוש שאילתות מקובצות עם `.in("class_id", ids)`:
  - `students` → `select("id, class_id")`, ספירה בזיכרון לפי `class_id`.
  - `weekly_bulletins` → `select("class_id").eq("status", "draft")`.
  - `class_events` → `select("class_id, event_type, <date>").in("event_type", ["exam","special_exam"])` בטווח היום עד +14 יום.
- מחזירה `{ classes, stats: { totalStudents, activeClasses, totalClasses, pendingActions }, perClass: Record<classId, { studentCount, draftBulletins, upcomingExams }> }`.
- RLS קיים כבר מגדיר מה המלמד רואה, ולכן אין צורך בהרשאות חדשות; שלוש שאילתות מקובצות בלבד — לא N+1.

### 2. `src/routes/_authenticated.classes.index.tsx` (עיקר השינוי)
- להחליף את `useQuery(["classes"])` בקריאה ל-`getClassesOverview` (`queryKey: ["classes-overview"]`), ולהמשיך להזרים את `classes` לאותה לוגיקת סינון קיימת. מוטציות מחיקה/ארכיון יבטלו גם את המפתח החדש.
- `StatsRow` — שלושה מדדים inline (טקסט + מספר `font-mono-tabular`), עם Skeleton בזמן טעינה.
- מיון: `useState<"recent"|"name"|"students">` + `Select` קטן ליד לשוניות הסטטוס; comparator ב-`useMemo` הקיים (recent = לוגיקת `rank` הקיימת, name = `localeCompare("he")`, students = מספר תלמידים יורד).
- כרטיס כיתה: להוסיף שורת "N תלמידים" ותגי `Badge` ל"עלון בטיוטה" / "מבחן קרוב" לפי `perClass`. `SeatFillGrid` מצטמצם לרמז ויזואלי קטן (או מוסר מהכרטיס) כדי לפנות מקום לנתון האמיתי — אחליט לפי הצפיפות בפועל ואשמור על מבט עקבי.
- סידור מחדש של ה-JSX לפי הסדר שלמעלה; `ClassAssignmentsTable` וכרטיס המוסד עוברים לתחתית תוך שימוש ב-`Collapsible` הקיים ב-`components/ui`.

### 3. בדיקות
בדיקת יחידה קטנה על פונקציות המיון/סיכום (אם אחלץ אותן ל-`src/lib/classes-overview.ts` כפונקציות טהורות) + הרצת `check-route-links` ו-`tsgo` כרגיל.

## קבצים שישתנו
- `src/routes/_authenticated.classes.index.tsx` — עיקר השינוי (סדר, סטטיסטיקה, מיון, תגים).
- `src/lib/classes.functions.ts` — הוספת `getClassesOverview`.
- `src/lib/classes-overview.ts` (חדש, קטן) — comparators וחישובי סיכום טהורים לבדיקה.
- `src/test/classes-overview.test.ts` (חדש) — בדיקות למיון ולסיכומים.

## מה לא ישתנה
- אין מיגרציות, אין שינוי סכמה, אין שינוי RLS/GRANT.
- `listClasses` נשאר כפי שהוא לכל שאר הצרכנים.
