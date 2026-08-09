# סגירת פער A1 — כיסוי בדיקות אוטומטי (RLS + לוגיקה טהורה)

עבודת בדיקות בלבד. שום התנהגות קיימת לא משתנה. שני חילוצים (refactor) קטנים מסומנים בנפרד וטעונים אישור מפורש.

## מה אומת לפני התוכנית

- `src/test/helpers.ts` כבר מספק `hasTestEnv`, `adminClient()`, `createTestUser()`, `deleteTestUser()`, `createClassFor()` — התוספות ישתמשו בו כמו שהוא, עם עוד helper אחד (`grantRole`) לתפקידים.
- הקובץ הנכון להתראות ארכוב הוא `src/lib/notifications.functions.ts` (מייצא `listUnreadClassNotifications`, `markNotificationRead`) — אין `class-notifications.functions.ts`.
- `requireSupabaseAuth` דורש הקשר HTTP אמיתי, ולכן כל בדיקת DB תרוץ ישירות מול הטבלה עם קליינט publishable מחובר (בדיוק כמו `rls-classes.test.ts`), ולא דרך ה-serverFn.
- מדיניות RLS קיימת (מ-`pg_policies`): `reminders_owner_all`, `behavior_points_owner_all`, `class_notifications_recipient_select/update` מוגדרות ל-`{public}`; `grade_weights_owner_all` ו-`user_roles` (צפייה בתפקידים שלי) ל-`{authenticated}`. הבדיקות יתעדו את ההתנהגות בפועל, לא ישנו מדיניות.
- הלוגיקה של מיזוג שדה-שדה בייבוא **קבורה בתוך** `.handler` של `commitRoster` (`src/lib/ingest.functions.ts`, סביב שורות 847-892) — נורמליזציה, מפתחות התאמה (`byId`/`byName`) ובניית ה-patch. לא ניתנת לייבוא כרגע.
- ה-circuit breaker ב-`src/lib/ai-gateway.server.ts` הוא state מודולרי פרטי (`breaker`, `openBreaker`, `breakerBlockedMessage`) — אך `callLovableAI` מיוצא, כך שאפשר לבדוק את המכונה דרכו עם `fetch` מזויף ושעונים מזויפים, בלי refactor.

## חלק 1 — בדיקות RLS/DB (תבנית `rls-*.test.ts`, `describe.skipIf(!hasTestEnv)`)

קבצים חדשים תחת `src/test/`:

1. `rls-students.test.ts` — בעלים קורא/מעדכן תלמיד בכיתה שלו; מורה אחר חסום ב-SELECT וב-UPDATE (כולל אימות שהשם לא השתנה); `anon` (קליינט publishable ללא התחברות) חסום לגמרי — אימות מפורש שה-REVOKE בתוקף; טריגר `sync_student_name` — הזנת `first_name`+`last_name` מסנכרנת את `name`, ועדכון חלקי לא מוחק אותו.
2. `rls-reminders.test.ts` — בעלים יוצר/קורא/מוחק תזכורת; מורה אחר חסום; `anon` חסום.
3. `rls-behavior-points.test.ts` — בעלים יוצר/קורא נקודות התנהגות; מורה אחר חסום; `anon` חסום.
4. `rls-grade-weights.test.ts` — בעלים יוצר/מעדכן משקל למקצוע; מורה אחר חסום מקריאה ומעדכון; `anon` חסום.
5. `rls-institutions.test.ts` — מוסד + שלושה משתמשים: `admin`, `principal`, ומורה רגיל (חבר במוסד ללא תפקיד ניהולי). נבדק: חבר רואה את המוסד שלו; `admin` ו-`principal` שניהם מצליחים לעדכן את המוסד ולנהל `user_roles` במוסד שלהם (זו ההוכחה ש-`private.is_institution_admin` מכסה את `principal`); מורה רגיל חסום מעדכון המוסד ומהוספת תפקידים; אף אחד לא רואה מוסד שאינו שלו.
6. `rls-class-notifications.test.ts` — התראה נוצרת עבור בעלים (fixture בשירות-שרת); הבעלים רואה אותה ומסמן `read_at`; משתמש אחר לא רואה אותה ולא יכול לסמן; אימות שאין INSERT/DELETE מהקליינט.

תוספת ל-`src/test/helpers.ts` (בדיקות בלבד, לא production): `createInstitution()`, `grantRole(user, role, institutionId)`, `anonClient()`, `createStudentFor()`.

## חלק 2 — בדיקות לוגיקה טהורה (ללא DB, רצות גם ב-CI בלי סודות)

1. `hebrew-date.test.ts` — `nextHebrewBirthday` עם `from` קבוע: יום הולדת "היום" מחזיר `daysUntil: 0`; גלישת 30 בכסלו ו-30 בחשוון לשנה שבה החודש קצר (1 בטבת/1 בכסלו); אדר בשנה פשוטה מול אדר א׳/ב׳ בשנה מעוברת; קלט לא תקין/ריק → `null`; `hebrewBirthdaysInRange` מחזיר תוצאה בתוך חלון ולא מחוצה לו; `daysUntilLabel` ("היום!"/"מחר"/"בעוד N ימים").
2. `student-field-validation.test.ts` — `validateNationalId` (ריק=תקין, 5-9 ספרות, קצר/ארוך מדי), `validatePhone` (9-10 ספרות, חייב להתחיל ב-0, מקפים מותרים), `validateBirthDate` (פורמט, תאריך לא קיים, שנה מחוץ לטווח), `phoneHref`/`whatsappHref`.
3. `grade-weighting.test.ts` — `weightMap`/`weightFor` (ברירת מחדל 1, מקצוע לא מוכר), `subjectAverages`, `weightedAverage` (משקלים שונים מול ממוצע פשוט), `weightedAverageByStudent`, `hasCustomWeights`.
4. `ai-gateway-breaker.test.ts` — דרך `callLovableAI` עם `vi.stubGlobal("fetch", ...)` ו-`vi.useFakeTimers()`: 429 פותח את המפסק ומחזיר הודעת מכסה; קריאה נוספת נכשלת מיד בלי fetch; אחרי 60 שניות מותרת בדיקה חוזרת אחת; 402 חוסם 5 דקות; הצלחה סוגרת את המפסק. `LOVABLE_API_KEY` מוזרק דרך `process.env` בתוך הטסט ומשוחזר אחריו.
5. `roster-merge.test.ts` — בודק את המיזוג שדה-שדה: התאמה לפי ת.ז., נפילה להתאמה לפי שם, שדות ריקים בקובץ לא מוחקים ערך קיים, פיצול `name` ל-`first_name`/`last_name`, ורשומה בלי התאמה מסומנת כהוספה. **תלוי בחילוץ שלהלן.**

## refactor שדורש אישור מפורש (שינוי קוד production)

חילוץ אחד בלבד, ללא שינוי התנהגות:

- מ-`src/lib/ingest.functions.ts` → קובץ חדש `src/lib/roster-merge.ts`, המייצא פונקציות טהורות: `normalizeName`, `digitsOnly`, `buildMatchIndex(existing)`, `studentFieldsFromRow(row)`, `mergePatch(fields)` ו-`resolveMatch(index, row)`. ה-`.handler` של `commitRoster` יקרא להן במקום לקוד המוטבע — אותם חישובים, אותה סדר פעולות, אותן שאילתות DB.

אם החילוץ לא מאושר: `roster-merge.test.ts` יורד מהתוכנית ושאר 4 קבצי הלוגיקה הטהורה + 6 קבצי ה-RLS מיושמים כרגיל.

## CI

`bun run test` הקיים תופס אוטומטית כל קובץ חדש. בלי סודות DB — 6 קבצי ה-RLS מדולגים ו-5 קבצי הלוגיקה הטהורה רצים במלואם. אין שינוי ל-`ci.yml`.
