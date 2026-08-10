# הרחבת אבטחה ובדיקות סביב student_profiles

## תיקון עובדתי לפני הכל (נבדק עכשיו ב-DB ובקוד)

שלוש מהנחות הרקע כבר לא נכונות, וזה משנה את היקף העבודה:

1. **אין כרגע אף GRANT ל-anon על שום טבלה ב-public.** בדיקה של `information_schema.role_table_grants` החזירה אפס שורות ל-anon. כלומר אין גישה ציבורית קיימת שאפשר לשבור — כל הדפים הציבוריים (`/c/$slug`, `/p/$token`) עוברים דרך server functions, לא דרך anon ישירות.
2. **`src/test/` כבר קיימת עם 19 קבצי בדיקה**, כולל `rls-student-profiles.test.ts` ו-`helpers.ts` (יצירת משתמשי בדיקה, `grantRole`, `createInstitution`).
3. **`.github/workflows/ci.yml` כבר קיים ומקיף**: bun install + נעילת lockfile, `check:tanstack`, `bunx tsgo --noEmit`, `bun run test` עם ה-secrets, production build, SBOM, ועוד job שמחייב DB credentials. גם `release.yml`, `dependabot*.yml` קיימים.

מה שכן נכון ופתוח: **default privileges ברמת הסכימה** — `pg_default_acl` מראה שגם `postgres` וגם `supabase_admin` מעניקים ל-anon את כל הרשאות הטבלה על **כל טבלה חדשה** ב-public. זו הפרצה האמיתית שנשארה.

מדיניות ה-RLS הקיימת על `student_profiles` (אושרה מול `pg_policies`):
- `student_profiles_owner_all` — ALL ל-authenticated, דרך `classes.owner_id = auth.uid()`.
- `student_profiles_institution_admin_select` — **SELECT בלבד** למנהל מוסד. כלומר "מנהל צופה, לא כותב" הוא באמת המצב בפועל.

## מה נעשה — 5 חלקים

### 1. מיגרציה: ביטול default privileges ל-anon ב-public
`ALTER DEFAULT PRIVILEGES` עבור שני התפקידים שמופיעים ב-`pg_default_acl` (postgres ו-supabase_admin, כל אחד בנפרד), REVOKE ALL ל-anon על TABLES ועל SEQUENCES ב-public. FUNCTIONS נשארות כמו שהן (EXECUTE ל-anon נדרש לפונקציות ציבוריות עתידיות; לא נוגעים).
בטוח להריץ גלובלית כי אין anon grants בפועל היום. אחרי המיגרציה, כל טבלה ציבורית עתידית תדרוש `GRANT SELECT ... TO anon` מפורש — זה הרצוי.

### 2. סקריפט אודיט הרשאות — הרצה עכשיו + שמירה לעתיד
`scripts/check-table-grants.mjs` בסטייל הסקריפטים הקיימים (`check-route-links.mjs`), עם `bun run check:grants` ב-package.json ו-step חדש ב-`ci.yml`:
- שאילתה על `information_schema.role_table_grants` — כל טבלה ב-public עם grant ל-anon שאינה ברשימת היתר מפורשת (allowlist בראש הסקריפט, כרגע ריקה).
- שאילתה על `pg_class.relrowsecurity` — כל טבלה ב-public בלי RLS.
- שאילתה על `pg_policies` — טבלאות עם RLS אך בלי אף policy (נעולות בשקט).
- exit code 1 עם דוח קריא. הסקריפט מדלג בהצלחה כשאין credentials (כמו שאר הטסטים), כדי לא לשבור מכונות מקומיות.
תמונת מצב ראשונה תודפס בהרצה בזמן המימוש, עם דגש על `student_profiles, students, classes, student_relations`.

### 3. CI — הרחבה, לא בנייה מאפס
`ci.yml` קיים. נוסיף רק:
- step `bun run check:grants` (חלק 2) ב-job ה-build.
- job `student-profiles-guard` בתבנית ה-`notifications-guard` הקיים: **מחייב** DB credentials ומריץ `vitest run src/test/rls-student-profiles.test.ts` — כך שהבדיקה הרגישה לא תעבור בשקט על ידי skip.
- `bun run check:seo` + `check:routes` אם הם עוד לא ב-CI (נאמת בזמן המימוש).

### 4. הרחבת בדיקות ה-RLS ל-student_profiles
`src/test/rls-student-profiles.test.ts` קיים אך מכסה רק owner-can ו-other-teacher-cannot, ומשתמש בדגל לא חוקי (`"health"`, לא ברשימת `SENSITIVE_FLAGS`). נשכתב אותו לכיסוי מלא, עם `helpers.ts` הקיים:
- **anon** (`anonClient()`): SELECT מחזיר 0 שורות, וגם INSERT/UPDATE/DELETE נכשלים — כולל לאחר המיגרציה מחלק 1.
- **owner**: INSERT/SELECT/UPDATE/DELETE עוברים.
- **מלמד אחר, לא במוסד**: כל ארבע הפעולות חסומות.
- **מנהל מוסד** (`createInstitution` + `grantRole(user,'principal',institutionId)` + שיוך הכיתה למוסד): SELECT עובד; UPDATE/INSERT/DELETE **לא** משנים כלום — זהו התיעוד המחייב של "מנהל צופה, לא כותב".
- **דגלים**: רק ערכים מ-`SENSITIVE_FLAGS`.
ניהול secrets: אין שינוי בגישה — `src/test/helpers.ts` קורא `SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY` מהסביבה, ו-`hasTestEnv` מדלג בהיעדרן. ב-CI הם מוזרקים כ-GitHub Secrets (כבר מוגדר). מקומית — קובץ `.env` לא מגיע ל-git. אפס מפתחות בקוד.

### 5. תאריך עדכון + יומן אודיט ל-student_profiles
א. **`updated_at` בתצוגה** — `student-file-sheet.tsx` כבר מציג "עודכן: <תאריך>" בלשונית ההעברה. נוסיף גם שעה, ונוסיף שורת "עודכן לאחרונה" לכל תלמיד במסמך המסירה ב-`src/lib/pdf/handoff-report-pdf.ts` (הנתון כבר מוחזר מ-`listClassProfiles`).

ב. **יומן** — לפי התבנית הקיימת: `AUDIT_SOURCE_STUDENT_PROFILES = "student_profiles.audit"` ב-`src/lib/audit-sources.ts`, וכתיבה דרך `logger.server.ts` הקיים (`app_logs`).

**המלמצה: לתעד רק כתיבות, לא צפיות.** `upsertStudentProfile` יכתוב `action: 'update'` עם `student_id`, `class_id`, `viewer_user_id`. לא נתעד `view`, כי `getStudentProfile` נקרא בכל פתיחת גיליון תלמיד — זה יוצר כתיבת DB לכל רינדור, מנפח את `app_logs` באלפי שורות רעש בשבוע, ומקשה למצוא את השינויים שבאמת חשובים. אם בעתיד יידרש מעקב צפיות (למשל דרישת רגולציה), הדרך הנכונה היא לוג צפייה מקובץ — שורה אחת לכל צירוף משתמש+תלמיד+יום — ולא שורה לכל קריאה. נוסיף גם `action: 'handoff_report'` על הפקת מסמך המסירה, שהיא פעולת ייצוא מידע רגיש ולכן שווה תיעוד.

ג. תצוגת היומן: קריאה ל-`app_logs` מסוננת ב-`source` (בדיוק כמו `listRoleAuditLog`), בכרטיס בדשבורד המוסד. ללא טבלה חדשה.

## פירוט טכני
- מיגרציה אחת (חלק 1). ללא טבלאות חדשות בשום חלק.
- קבצים חדשים: `scripts/check-table-grants.mjs`.
- קבצים בעריכה: `package.json`, `.github/workflows/ci.yml`, `src/test/rls-student-profiles.test.ts`, `src/lib/audit-sources.ts`, `src/lib/student-profiles.functions.ts`, `src/lib/pdf/handoff-report-pdf.ts`, `src/components/student-file-sheet.tsx`, וכרטיס יומן בדשבורד המוסד.
- אימות בסיום: `bun run check:grants`, `bun run test`, `bunx tsgo --noEmit`.
