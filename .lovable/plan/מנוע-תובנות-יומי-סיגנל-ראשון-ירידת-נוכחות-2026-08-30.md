# מנוע תובנות יומי — סיגנל ראשון: ירידת נוכחות

מוסיף שכבת "תובנות יומיות" למסך התובנות הקיים: המערכת סורקת את הנוכחות של כל התלמידים בכל הכיתות שלך, מזהה תלמידים שהנוכחות שלהם צנחה בשבוע האחרון, ומציגה התראה עם קישור ישר למסך המעקב של הכיתה. הרענון ידני בלבד — אין תהליך אוטומטי בשלב הזה, ואין מסך חדש.

## מה המורה יראה

בראש `/insights`, מעל "תקציר AI", יופיע כרטיס "תובנות יומיות":

- כפתור "רענן תובנות" שמריץ את הסריקה ומעדכן את הרשימה.
- כל תובנה בכרטיס צבעוני לפי חומרה (אדום = חמור, כתום = בינוני), עם שם התלמיד, שם הכיתה, ותיאור בעברית שכולל את האחוזים בפועל — למשל "הנוכחות ירדה מ-95% ל-60% בשבוע האחרון".
- כפתור "עבור לפעולה" שפותח את מסך המעקב של הכיתה, וכפתור X שמסלק את ההתראה.
- כשאין התראות: "אין התראות כרגע — הכל תקין" (הכרטיס נשאר במקום).

## הלוגיקה של הזיהוי

עבור כל תלמיד בכל כיתה של המורה המחובר:

```text
חלון קצר : 7 הימים האחרונים        → יחס נוכחות א'
חלון בסיס: 30 הימים שלפניהם        → יחס נוכחות ב'
יחס נוכחות = (present + late) / סך רשומות הנוכחות בחלון
תנאי: לפחות 3 ימי רישום בחלון הקצר, וגם ירידה של 25 נקודות אחוז ומעלה
חומרה: ירידה מעל 50 נק"א → high · אחרת → medium
```

לפני יצירת תובנה נבדק שאין כבר תובנה פעילה מסוג `attendance_decline` לאותו תלמיד מ-7 הימים האחרונים, כדי שרענון חוזר לא ייצור כפילויות.

## פירוט טכני

**1. מיגרציה — טבלה `public.orchestrator_insights`**

עמודות: `owner_id` (מפנה למשתמש), `class_id` (מפנה לכיתה), `student_id` (מפנה לתלמיד, אופציונלי), `insight_type` (ברירת מחדל `attendance_decline`), `severity` (`low`/`medium`/`high` עם CHECK), `title`, `description`, `suggested_action`, `action_link`, `is_dismissed` (ברירת מחדל false), `created_at`.

- `GRANT SELECT, UPDATE ... TO authenticated`, `GRANT ALL ... TO service_role`, ואחר כך `REVOKE ALL ... FROM anon`.
- RLS מופעל; מדיניות SELECT ו-UPDATE בלבד ל-`owner_id = auth.uid()`. אין מדיניות INSERT/DELETE ללקוח — כתיבה רק מהשרת.
- אינדקס על `(owner_id, is_dismissed, created_at desc)` ואינדקס על `(student_id, insight_type, created_at desc)` כדי שבדיקת הכפילויות תהיה זולה.

**2. קובץ חדש `src/lib/orchestrator.functions.ts`** — שלוש server functions עם `requireSupabaseAuth`:

- `generateDailyBriefing` — ללא פרמטרים. שולפת את כיתות המורה (מדלגת על כיתות בארכיון), את התלמידים, ואת רשומות הנוכחות של 37 הימים האחרונים בשאילתה אחת לכל כיתה; מחשבת את שני היחסים בקוד, מסננת כפילויות, ומכניסה את התובנות. ההכנסה נעשית עם `supabaseAdmin` שנטען בתוך ה-handler (`await import("@/integrations/supabase/client.server")`) כי אין מדיניות INSERT ללקוח — ה-`owner_id` נלקח מ-`context.userId` ולא מקלט. מחזירה `{ created, scanned }`.
- `listDailyBriefing` — קוראת דרך `context.supabase` (RLS) את התובנות עם `is_dismissed = false`, ממוינות לפי severity (high לפני medium לפני low, מיון בקוד) ואז `created_at` יורד, בצירוף שם הכיתה ושם התלמיד.
- `dismissInsight` — מקבלת `id`, מעדכנת `is_dismissed = true` דרך `context.supabase` עם תנאי `owner_id = context.userId` (וגם RLS מגבה את זה), ומחזירה שגיאה בעברית אם לא עודכנה שורה.

חישוב היחסים ותנאי ההתראה יופרדו לפונקציה טהורה ב-`src/lib/attendance-decline.ts` כדי שאפשר יהיה לכסות אותה בבדיקות אוטומטיות (`src/test/attendance-decline.test.ts`): מקרה ירידה חמורה, ירידה בינונית, פחות מ-3 ימי רישום, ושינוי קטן מ-25 נק"א שלא מייצר התראה.

**3. עדכון `src/routes/_authenticated.insights.tsx`**

כרטיס `DailyBriefingCard` חדש בראש העמוד, מעל "תקציר AI", בסגנון הקיים (Card/CardHeader/CardTitle, RTL, אייקון `Bell`): `useQuery` ל-`listDailyBriefing`, `useMutation` ל-`generateDailyBriefing` (עם toast של מספר התובנות שנוצרו) ול-`dismissInsight` (עם עדכון אופטימי), וכפתור "עבור לפעולה" שמנווט ל-`action_link` דרך `useNavigate`. ה-`action_link` מיוצר כ-`/classes/{classId}?tab=tracking` — מסך הכיתה כבר קורא את פרמטר `tab`, כך שהקישור נופל ישר על לשונית המעקב.

לא נוסף מסך חדש, לא נוסף cron, ולא משתנה שאר תוכן העמוד.
