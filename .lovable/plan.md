## מה נבנה

### 1) תיקוני רספונסיב ב-320px (`grid + min-w-0 + shrink-0`)
החלפת `flex items-center justify-between` בשורות שמכילות טקסט + ווידג'ט קבוע, לפי הדפוס:
`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between` עם `min-w-0`/`truncate` לטקסט ו-`shrink-0` לכפתורים/אווטרים.

הקבצים שיתוקנו (כותרות עמודים + שורות פנימיות שעדיין על הדפוס הישן):
- `src/routes/_authenticated.tsx` (כותרת ההידר — לוגו + מייל + פעולות)
- `src/routes/_authenticated.classes.$classId.display.tsx` (כותרת המסך + שורת הכפתורים שנדחסת ב-320px)
- `src/routes/_authenticated.classes.$classId.tsx` (שורות `CardContent` בשורות 252, 447)
- `src/routes/_authenticated.classes.index.tsx` (כרטיסי הכיתות)
- `src/routes/_authenticated.gamification.$classId.tsx` (שורות 139, 247, 372, 543, 593)
- `src/routes/_authenticated.parents.$classId.tsx` (שורה 122 — flex-wrap בלי min-w-0)
- `src/routes/_authenticated.resources.tsx` (שורות 108, 138, 302)
- `src/routes/_authenticated.daily.$classId.tsx` ו-`_authenticated.reports.$classId.tsx` (שורות הכותרת והפעולות)
- `src/routes/_authenticated.bulletins.$classId.tsx` (שורות 144, 159)
- `src/routes/_authenticated.toolkit.tsx` (שורה 219)
- `src/routes/blog.index.tsx`, `blog.digital-hall-pass-guide.tsx`, `index.tsx` (כותרות עליונות)
- `src/routes/p.$token.tsx` (כותרת השיתוף + כרטיסי הציונים)

הרכיב `parent-email-composer.tsx` כבר עבר לדפוס החדש — לא ניגע בו.

### 2) מסך נעילה + ניהול PIN לפי משתמש (Lovable Cloud)

**סכמה (migration חדש):**
```sql
create table public.app_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_enabled boolean not null default false,
  pin_hash text,            -- SHA-256 hex של PIN+salt
  pin_salt text,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.app_security to authenticated;
grant all on public.app_security to service_role;
alter table public.app_security enable row level security;
create policy "own row" on public.app_security
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Server functions** (`src/lib/security.functions.ts`, עם `requireSupabaseAuth`):
- `getSecurity()` → `{ pin_enabled, has_pin }` (לא מחזיר hash).
- `setPin({ pin })` → מגריל salt, שומר hash, מפעיל `pin_enabled=true`.
- `disablePin()` → מאפס שדות ומכבה.
- `verifyPin({ pin })` → boolean.

**Tab "אבטחה" ב-Toolkit** (`/toolkit?tab=security` — הוספת טאב נוסף לטאבס הקיים בקובץ הכלים):
- Switch להפעלה/כיבוי הנעילה.
- בעת הפעלה: שדה PIN בן 4 ספרות + אימות → שמירה.
- כאשר מופעל: כפתור "שנה PIN" שמציג את אותו דיאלוג שוב, וכפתור "כבה נעילה" שמבקש PIN לאישור.
- ולידציה ב-zod (4 ספרות בלבד, רק `\d{4}`).

**מסך נעילה** (`src/components/pin-lock-screen.tsx`):
- Overlay מלא במסך שמופיע אחרי הכניסה של AuthLayout אם `pin_enabled && !unlockedInSession`.
- מצב סשן נשמר ב-`sessionStorage` (`ca_pin_unlocked=1`), כך שאחרי רענון/חזרה מהרקע צריך להזין שוב.
- כפתור "כניסה מהירה" שהוזכר: יציג את 4 הספרות הנוכחיות (קריאה ממקור אמת מוצפן — לא מאחסנים PIN גלוי). במקום זאת — תווית בולטת "הזן את ה-PIN הנוכחי שלך" + שדה אינטראקטיבי. **הערה:** אחסון PIN בכתב גלוי מנוגד לאבטחה ולכן לא יבוצע; אם חשוב להציג את ה-PIN, ניתן לעשות זאת רק במסך ההגדרות לאחר אימות מחודש של המשתמש. נוודא בהמשך אם זה מקובל.
- שילוב ב-`src/routes/_authenticated.tsx` עם React Query (`useQuery(['security'])`) כדי לא לעכב SSR.

### 3) כיוונון ערכת Midnight Slate + Amber
- Theme חדש `midnight-slate` ב-`src/styles.css`: `--background: oklch(0.18 0.02 250)`, `--card: oklch(0.22 0.025 250)`, `--foreground: oklch(0.96 0.01 80)`, `--primary` = amber, `--ring` = amber-glow, `--border` עם opacity נמוכה.
- צללים ו-transitions מותאמים: `--shadow-elegant`, `--shadow-glow-amber`, ו-`--transition-smooth: cubic-bezier(.2,.8,.2,1)`.
- הוספת המוטיב לרשימת ה-themes ב-`src/components/theme-switcher.tsx` (אם קיים) כברירת מחדל למסך הנעילה.
- וידוא שכל הטוקנים ב-`@theme inline`.

### 4) עטיפת Capacitor ל-Android

הערה חשובה: TanStack Start (SSR) לא נארז native ישירות. הגישה: build סטטי (`npm run build` עם output ל-`dist/client`) → Capacitor עוטף את ה-`webDir`. בפועל לא נריץ build כאן — נכין רק את התצורה כך שתוכל למשוך לוקאלית את הקוד מ-GitHub ולהריץ:

קבצים חדשים:
- `capacitor.config.ts` — `appId: studio.classalign.app`, `appName: ClassAlign Studio`, `webDir: dist/client`, `server.url: https://cuddle-spark-nexus.lovable.app` (אופציה לפיתוח), `android.allowMixedContent: false`.
- `android/` יווצר רק על המכונה המקומית עם `npx cap add android`.
- `src/assets/app-icon/` — אייקון 1024×1024 לאפליקציה ואייקון adaptive (foreground + background) + splash 2732×2732, נוצר עם `imagegen` בסגנון Midnight Slate + Amber.
- `RELEASE_ANDROID.md` — מדריך צעד-אחר-צעד: הורדה מ-GitHub, `bun i`, `bun run build`, `npx cap add android`, `npx cap sync`, פתיחה ב-Android Studio, חתימת `release.keystore`, יצירת AAB, ו-checklist של Google Play (Privacy URL, תיאור קצר/ארוך, תיוג גילאים, screenshots פר גודל מסך).

**Privacy & Support pages:**
- `src/routes/privacy.tsx` ו-`src/routes/support.tsx` — דפים סטטיים פומביים עם copy ספציפי לאפליקציה (לא generic), מתואמים לטוקנים. הכותב הוא בעל האפליקציה ומסומן כך, ללא הצהרות תאימות שלא ניתנו לי.

**צילומי מסך ותיאורים** — *לא ניתן לייצר בתוך Lovable*: צילומי המסך עבור Play Store וכן apk חתום דורשים הרצה ב-Android Studio במכונה שלך. אספק את התיאור הקצר (≤80 תווים) והתיאור הארוך (≤4000 תווים) בעברית כקובץ `STORE_LISTING.md`.

## מה לא נעשה כאן ולמה
- בנייה אמיתית של APK/AAB — דורשת Android SDK + חתימה מקומית.
- ייצור צילומי מסך פר מכשיר — דורש אמולטור.
- אחסון PIN כטקסט גלוי לכפתור "כניסה מהירה" — נמנע מסיבות אבטחה. במקום זאת הכפתור פותח דיאלוג הזנה אם תאשר.

## סדר הביצוע
1. תיקוני רספונסיב (סטטי, ללא backend).
2. Migration `app_security` + GRANT/RLS + server functions + טאב אבטחה + Overlay נעילה.
3. כיוונון theme Midnight Slate + Amber.
4. דפי Privacy/Support + `capacitor.config.ts` + אייקונים + `RELEASE_ANDROID.md` + `STORE_LISTING.md`.