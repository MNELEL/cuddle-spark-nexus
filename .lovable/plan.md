# פרטי תלמיד מלאים, מיון רשימה, ויום הולדת עברי

## מה נמצא בבדיקה (לפני התכנון)

- טבלת `students` **כבר** מכילה: `national_id`, `birth_date`, `address`, `father_name/id/phone`, `mother_name/id/phone`, `has_special_accommodation`. חסרים רק `first_name` / `last_name`.
- `upsertStudent` ב-`src/lib/students.functions.ts` מקבל היום רק `name, notes, height, row_pref, corner_pref, accommodation*` — כל השדות האישיים **לא נשמרים** דרך הטופס.
- `commitRoster` ב-`src/lib/ingest.functions.ts` **כן** שומר את כל השדות האישיים, אבל עושה `insert` בלבד — אין מיזוג לתלמיד קיים, ולכן ייבוא חוזר יוצר כפילויות. אין בו `first_name/last_name`.
- `@hebcal/core` בשימוש **רק** ב-`src/routes/_authenticated.calendar.$classId.tsx` (HDate/renderGematriya/HebrewCalendar) — אין wrapper משותף. `src/lib/year-rollover.ts` אכן מחשב רק שנה עברית ולא ייגע.
- `student-file-sheet.tsx` כולל 4 טאבים: מסמכים, הורים, משמעת, "פרופיל תלמיד" (מידע רגיש). לכן הטאב החדש ייקרא **"פרטי קשר"** — אין התנגשות.
- הרשאות: המדיניות על `students` היא `students_owner_all` ל-`ALL` אבל מוגדרת ל-`public` (כולל anon), ול-`anon` יש GRANT מלא על הטבלה. הרשאת `auth.uid()` חוסמת בפועל, אבל זו הגנה חלשה יותר מ-`student_profiles` שמוגדרת `TO authenticated` בלבד + מדיניות נפרדת למנהל מוסד.

## תוכנית

### 1. Guard על classId
`src/lib/class-id-guard.ts` חדש: `isValidClassId(v)` (בדיקת UUID). בכל מסך כיתה (`classes.$classId`, `calendar`, `analytics`, `tracking`, `parents`) — `enabled: isValidClassId(classId)` בכל `useQuery`, ובמידה ולא תקין תוצג הודעה ידידותית "כיתה לא נמצאה" עם קישור חזרה לרשימת הכיתות, במקום שגיאת Zod אדומה.

### 2. שם פרטי ושם משפחה
- Migration: הוספת `first_name`, `last_name` (text, nullable) ל-`students`, backfill חד-פעמי מ-`name` (מילה ראשונה = פרטי, השאר = משפחה; מילה אחת → `last_name` ריק), אינדקסים על `(class_id, last_name)` ו-`(class_id, first_name)`, וטריגר BEFORE INSERT/UPDATE שמסנכרן `name` מהשניים כשהם מלאים — כדי שהושבה, ציונים, דוחות ו-`seating-logic` ימשיכו לעבוד ללא שינוי.
- `upsertStudent`: הרחבת הסכימה לכל השדות (first/last name, ת.ז., תאריך לידה, כתובת, הורים) כ-`.nullable().optional()`.
- `StudentDialog`: שני שדות שם נפרדים במקום שדה יחיד.

### 3. מיון רשימת התלמידים
בורר מיון בראש טאב "תלמידים": שם פרטי · שם משפחה · תאריך יום הולדת (לפי יום ההולדת העברי הקרוב) · ציון (גבוה→נמוך, מבוסס `computeStudentScore` הקיים) · מקום ישיבה. המיון בצד הלקוח, והבחירה נשמרת ב-localStorage במפתח לפי `classId`.

### 4. סיכום בכרטיס StudentRow
שורת פרטים קומפקטית: ת.ז. · תאריך לידה + התאריך העברי · כתובת · אב + טלפון · אם + טלפון. הטלפונים כקישורי `tel:`/וואטסאפ. שדות ריקים לא מוצגים כלל.

### 5. טאב "פרטי קשר" בתיק התלמיד + הידוק הרשאות
- טאב חמישי "פרטי קשר" (נפרד וברור מול "פרופיל תלמיד" הרגיש) עם עריכת: שם פרטי/משפחה, ת.ז., תאריך לידה, כתובת, שם/ת.ז./טלפון של אב ואם.
- ולידציה בצד הלקוח: ת.ז. 5–9 ספרות, טלפון 9–10 ספרות שמתחיל ב-0, תאריך תקין ובטווח סביר — באותה לוגיקה כמו `roster-review-table.tsx` (תחלץ למודול משותף `src/lib/student-field-validation.ts`).
- Migration אבטחה: `REVOKE ALL ON public.students FROM anon`, החלפת `students_owner_all` במדיניות `TO authenticated` בלבד, והוספת מדיניות SELECT למנהל מוסד באמצעות `private.is_institution_admin` — כך שההגנה על השדות האישיים לפחות ברמת `student_profiles`.

### 6. יום הולדת עברי
`src/lib/hebrew-date.ts` חדש (בלי לגעת ב-`year-rollover.ts`, ובלי לשנות את מסך היומן הקיים מעבר לשילוב):
- `toHebrewDateLabel(iso)` — למשל "י״ב בכסלו" (דרך `HDate.renderGematriya`).
- `nextHebrewBirthday(iso)` — מציאת התאריך הלועזי הבא שבו חל אותו יום+חודש עברי, עם טיפול בגבולות: 30 בחשוון/כסלו בשנה שבה החודש חסר (גלישה ל-1 בכסלו/טבת), ואדר בשנה פשוטה מול אדר א׳/ב׳ במעוברת.
- `daysUntil(iso)` → "היום!" / "בעוד X ימים".
- שימוש: בכרטיס ובתיק התלמיד; באנר "ימי הולדת קרובים" (14 ימים) בראש טאב תלמידים; וביומן הכיתה — ימי הולדת עבריים כאירועים **מחושבים** שמתמזגים לרשימת האירועים, ללא שמירה ב-DB.

### 7. ייבוא (/ingest)
- הוספת `first_name`/`last_name` לסכימת `commitRoster` (או פיצול בשרת מ-`name`).
- מיזוג במקום כפילות: לפני ההכנסה, שליפת התלמידים הקיימים בכיתה והתאמה לפי `national_id` (עדיפות ראשונה) ואחריה לפי `name` מנורמל — התאמה → `update` של השדות הלא-ריקים בלבד; אין התאמה → `insert`. הפונקציה תחזיר `{ inserted, updated }` וה-UI יציג "נוספו X, עודכנו Y".

## מחוץ להיקף
`student_profiles`, `seating-logic`, `year-rollover.ts`.
