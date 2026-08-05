# דשבורד מנהל מוסד (principal) + תיקון הרשאות קריטי

## שלב 0 — תיקון `private.is_institution_admin` (migration, ראשון)

הפונקציה בודקת כיום `role = 'admin'` בלבד (אומת מול ה-DB), למרות שהיא ה-gate של:
- `classes` — policy "institution admins view classes in their institution"
- `student_profiles` — policy `student_profiles_institution_admin_select`
- `institutions` — policy UPDATE "institution admins manage their institution"
- `user_roles` — policy ALL "Admins can manage roles in their institution"

התיקון: `role IN ('admin','principal')` עם `institution_id IS NOT DISTINCT FROM _institution_id` (שאר הגוף נשאר זהה, כולל `SECURITY DEFINER` ו-`SET search_path`).

**תופעת לוואי שחשוב לדעת:** ה-policy על `user_roles` משתמשת באותה פונקציה, כך שאחרי התיקון principal יוכל לנהל תפקידים **בתוך המוסד שלו** ברמת ה-DB (לא בכל המערכת). זה מתיישב עם המשמעות של "מנהל מוסד", וה-UI של `user-management` נשאר חסום ל-admin בלבד בכל מקרה. אם לא רוצים את זה — אפצל את ה-policy הזו ל-`has_role(admin)` בלבד. ברירת המחדל בתוכנית: משאיר כפי שהוא.

`user_roles` ריקה (0 שורות) — אין נזק קיים ואין צורך ב-backfill.

## שלב 1 — endpoint-ים חדשים ל-principal

קובץ חדש `src/lib/institution-dashboard.functions.ts` (לא נוגע ב-`institutions.functions.ts` שנשאר admin-only). כולם `requireSupabaseAuth` + guard `verifyInstitutionAdmin(supabase, userId)` שקורא את `user_roles` של המשתמש עצמו (מותר לפי policy "Users can view their own roles") ומחזיר את `institution_id` של תפקיד `principal`/`admin` — **ה-institution נגזר מהטוקן ולא נשלח מהלקוח**.

1. `getMyInstitution` — מזהה/שם המוסד של המשתמש + התפקיד שלו. מחזיר `null` אם אינו principal.
2. `getInstitutionOverview` — מדדים: כיתות פעילות, כיתות בארכיון, סך תלמידים, מספר מלמדים ייחודיים (distinct `owner_id` של כיתות המוסד).
3. `listMyInstitutionClasses` — רשימת כיתות המוסד: שם, שנת לימוד עברית, סטטוס, מספר תלמידים, שם המלמד (display_name מ-`profiles`) — קריאה בלבד.
4. `listMyInstitutionAudit` — 20 רשומות אחרונות מ-`app_logs` במקורות ה-audit הקיימים, **מסונן ל-`context.institution_id` של המוסד שלו בלבד**.

הרשאות: קריאות `classes`/`student_profiles` עוברות דרך `context.supabase` (RLS כמשתמש) ולכן נשענות על שלב 0. ל-`profiles`/`app_logs`/`students` שאין להם policy מתאים ל-principal — טעינה דינמית של `supabaseAdmin` **בתוך ה-handler ואחרי אימות התפקיד**, עם החזרת שדות מינימליים בלבד (שם תצוגה, ספירות), בלי אימיילים ובלי PII של תלמידים.

לא נפתחות `listUsersWithRoles` / `assignRole` / `removeRole` / `listInstitutionClasses` / `listRoleAuditLog` ל-principal.

## שלב 2 — route חדש

`src/routes/_authenticated.institution.tsx` → `/institution`, כותרת "דשבורד המוסד שלי", RTL/shadcn באותו סגנון קיים, `noindex`.

מבנה:
- ארבעה כרטיסי מדדים (כיתות פעילות / בארכיון / תלמידים / מלמדים).
- טבלת כיתות עם חיפוש וסינון סטטוס וכפתור "צפייה" לכיתה — בלי מחיקה/ארכוב/עריכה (principal אינו הבעלים; מוטציות ייחסמו גם ב-RLS).
- כרטיס "יומן שינויים במוסד" (מסונן למוסד).
- מצב ללא הרשאה: כרטיס "אין לך הרשאת מנהל מוסד" עם קישור ל-`/classes` (בלי redirect אוטומטי), וכן מצבי skeleton/ריק/שגיאה.

## שלב 3 — שילוב ב-`/classes` בלי לשבור את זרימת המלמד

ב-`_authenticated.classes.index.tsx`: `useQuery` נוסף ל-`getMyInstitution` (עצמאי, לא חוסם רינדור). אם מוחזר מוסד — מוצג כרטיס דק מעל גריד הכיתות: "דשבורד המוסד שלי — <שם המוסד>" עם `Link` ל-`/institution`. אם `null` או כשל — לא מוצג כלום. אין שינוי בגריד, בחיפוש, באשף או בהרשאות המלמד, ואין שינוי בניתוב לפי role (נושא נפרד).

## פרטים טכניים
- קבצים: migration אחת; חדש `src/lib/institution-dashboard.functions.ts`; חדש `src/routes/_authenticated.institution.tsx`; עריכה נקודתית ב-`src/routes/_authenticated.classes.index.tsx`.
- `src/lib/audit-sources.ts` נשאר כפי שהוא ומשמש לסינון ה-audit.
- ללא שינוי סכימה — אין טבלאות או GRANTs חדשים.