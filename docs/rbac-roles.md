# ניהול תפקידים והרשאות (RBAC)

מסמך תחזוקה וביקורת אבטחה. מתאר את כלל הגישה לניהול תפקידים באפליקציה "הכיתה שלי", ובפרט מדוע פונקציות בדיקת התפקיד יושבות בסכימת `private` ולא ב-`public`.

## 1. מודל הנתונים

- `public.app_role` — enum: `admin`, `principal`, `teacher`, `secretary`.
- `public.user_roles` — טבלת התפקידים היחידה. עמודות עיקריות: `user_id`, `role`, `institution_id` (אופציונלי, לשיוך מוסדי), `created_at`, `updated_at`. אילוץ ייחודיות על `(user_id, role)`.

**כלל ברזל:** תפקידים לעולם לא נשמרים בטבלת `profiles`, בטבלת המשתמשים, ב-`user_metadata` של Supabase Auth, או בכל אחסון בצד הלקוח (localStorage / sessionStorage / state). כל אחד מהם ניתן לעריכה או להשפעה מצד המשתמש ופותח פתח להסלמת הרשאות (privilege escalation). התפקיד נקבע אך ורק משורה בטבלה בצד השרת.

## 2. פונקציות בדיקת התפקיד

| פונקציה | חתימה | תפקיד |
| --- | --- | --- |
| `private.has_role` | `(_user_id uuid, _role public.app_role) -> boolean` | האם למשתמש יש תפקיד גלובלי מסוים |
| `private.is_institution_admin` | `(_user_id uuid, _institution_id uuid) -> boolean` | האם המשתמש מנהל של אותו מוסד |

שתיהן `STABLE SECURITY DEFINER` עם `SET search_path = public`, והרשאות ההרצה שלהן: `REVOKE ... FROM PUBLIC` ולאחר מכן `GRANT EXECUTE` ל-`authenticated` ו-`service_role` בלבד.

## 3. למה `private.has_role()` ולא `public.has_role()`

שלוש סיבות, לפי סדר החשיבות:

1. **מניעת רקורסיה אינסופית ב-RLS.** מדיניות RLS על `public.user_roles` שמריצה בתוכה `SELECT` ישיר על `public.user_roles` גורמת ל-`infinite recursion detected in policy`. פונקציית `SECURITY DEFINER` רצה בהרשאות הבעלים ועוקפת את ה-RLS של הטבלה, ולכן שוברת את המעגל. זו הסיבה שהמדיניות `"Admins can manage roles in their institution"` קוראת ל-`private.is_institution_admin(...)` במקום ל-`EXISTS (SELECT 1 FROM public.user_roles ...)`.
2. **הפחתת שטח התקיפה דרך ה-Data API.** כל פונקציה בסכימת `public` נחשפת אוטומטית כ-RPC דרך PostgREST. פונקציית `SECURITY DEFINER` חשופה כזו מאפשרת לכל משתמש מחובר (ולעיתים גם אנונימי) לתשאל תפקידים של משתמשים אחרים — מנוע ה-scanner מסמן זאת כ-`security_definer_function_executable`. סכימת `private` אינה חשופה ב-Data API, ולכן הפונקציה זמינה ל-RLS ולקוד שרת אך לא ניתנת לקריאה ישירה מהדפדפן.
3. **ביקורת פשוטה.** כל לוגיקת ההכרעה "מי מורשה" מרוכזת בשתי פונקציות בסכימה אחת. ביקורת אבטחה יכולה לסרוק את `private` ולראות את כל נקודות ההכרעה, במקום לרדוף אחרי תתי-שאילתות משוכפלות בעשרות מדיניות RLS.

היסטוריה: הגרסה המקורית הייתה `public.has_role()`. היא הוסרה (`DROP FUNCTION`) לאחר שהסורק סימן אותה כניתנת להרצה על ידי `anon`/`authenticated`. אין להחזיר פונקציית בדיקת תפקיד לסכימת `public`.

## 4. אכיפה בצד השרת (Server Functions)

ה-RLS הוא שכבת ההגנה האחרונה, אך כל פעולה רגישה נבדקת גם בקוד. `src/lib/user-roles.functions.ts`:

- כל הפונקציות משתמשות ב-`.middleware([requireSupabaseAuth])`; הבדיקה מתבצעת מול `context.supabase` (RLS פעיל כמשתמש) ו-`context.userId`, ולעולם לא מול פרמטר שהגיע מהלקוח.
- `verifyAdmin()` נקראת בתחילת `listUsersWithRoles`, `assignRole` ו-`removeRole`, לפני כל עבודה מורשית.
- `supabaseAdmin` (service role, עוקף RLS) נטען **רק בתוך ה-handler** ורק אחרי `verifyAdmin()`. אין לייבא אותו ב-module scope של קובץ `*.functions.ts`.
- `bootstrapFirstAdmin` יוצר מנהל ראשון רק כאשר אין אף שורת `admin` בטבלה — פעולה חד-פעמית שנועדה להתקנה ראשונית.

## 5. כללי תחזוקה

1. תפקיד חדש → הוספה ל-`public.app_role` וכן ל-`roleSchema` ב-`src/lib/user-roles.functions.ts`. השניים חייבים להישאר מסונכרנים.
2. מדיניות RLS חדשה שתלויה בתפקיד → להשתמש ב-`private.has_role(auth.uid(), '<role>'::public.app_role)`. לא לכתוב `EXISTS` על `user_roles`.
3. פונקציית `SECURITY DEFINER` חדשה שמכריעה הרשאות → ליצור ב-`private`, עם `SET search_path`, `REVOKE ... FROM PUBLIC` ו-`GRANT EXECUTE` מצומצם.
4. אין להשתמש ב-`supabaseAdmin` כדי לבדוק אם הקורא הוא מנהל — הבדיקה חייבת לעבור דרך `context.supabase` (כלומר דרך RLS ו-`private.has_role`).
5. בדיקות תפקיד בממשק (`getMyRoles`, `isAdmin`) הן לצורכי תצוגה בלבד. הן לעולם אינן תחליף לאכיפה בשרת או ב-RLS.

## 6. צ'ק-ליסט לביקורת אבטחה

- [ ] אין `has_role` או פונקציית הכרעת הרשאות אחרת בסכימת `public`.
- [ ] `public.user_roles` עם RLS פעיל, ללא מדיניות שמתשאלת את `user_roles` ישירות.
- [ ] `GRANT` על `user_roles`: `SELECT` ל-`authenticated`, `ALL` ל-`service_role`, ללא `anon`.
- [ ] כל server function שמשנה תפקידים קוראת ל-`verifyAdmin()` לפני הפעולה.
- [ ] אין תפקידים ב-`profiles`, ב-`user_metadata` או באחסון בצד הלקוח.