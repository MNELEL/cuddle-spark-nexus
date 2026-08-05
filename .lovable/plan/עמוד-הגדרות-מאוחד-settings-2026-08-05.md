# עמוד "הגדרות" מאוחד (/settings)

## מה נבנה

עמוד הגדרות מרכזי אחד שמאגד את כל מה שכבר קיים אך מפוזר: מיתוג מוסד, אבטחה (PIN), העדפות תזכורות, ומצב תקופת הניסיון. בנוסף כפתור "הגדרות" קבוע ב-header העליון.

## מבנה העמוד

`/settings` — עמוד גלילה אחד עם כרטיסים (לא לשוניות), בסדר הזה:

1. **כרטיס מנוי / תקופת ניסיון** (חדש) — ימים שנותרו, תאריך סיום בעברית, תג מצב (פעיל / פג תוקף). מבוסס על `getMyTrialStatus` הקיים, ללא שינוי בלוגיקה.
2. **כרטיס מיתוג המוסד** — כרטיס ניווט קצר עם תצוגה מקדימה זעירה (שם מוסד + לוגו אם קיים דרך `useBrand`) וכפתור "עריכת מיתוג" → `/settings/brand`. התוכן עצמו נשאר ב-route הקיים.
3. **העדפות תזכורות** — `ReminderPreferencesCard` כמו שהוא.
4. **אבטחה** — `SecuritySettings` כמו שהוא.
5. **קישורים נוספים** — קיצורי דרך ל-"ארגז כלים" ול-"ספרייה" (וכן "ניהול משתמשים" למי שהוא אדמין), כדי שהעמוד לא יהיה מבוי סתום.

בחירה בכרטיסים ולא בלשוניות: יש כאן רק 4 מקטעים, כולם קצרים, וגלילה אחת מונעת "הסתרה" של האבטחה — שזו בדיוק הבעיה שדווחה.

## החלטה לגבי /toolkit — ההמלצה: אפשרות (א)

להעביר את הלשוניות "תזכורות" ו-"אבטחה" מ-`/toolkit` ל-`/settings` **לגמרי**, ובמקומן להשאיר ב-toolkit לשונית אחת "הגדרות" עם כרטיס קישור ל-`/settings` (באותו סטייל `ToolLinkGrid` שכבר קיים שם).

למה: הכפילות (ב) יוצרת שני מקומות לתחזק ומבלבלת את המשתמש לגבי "איפה ההגדרות האמיתיות"; (ג) משמר את הבעיה המקורית — ההגדרות ממשיכות להיות מוסתרות בתוך ארגז כלים. (א) שומר על נקודת כניסה אחת מוסמכת ולא שובר שום קישור: אף קישור בקוד לא מצביע ללשונית `#security` או `#reminders` — הן היו נגישות רק דרך העמוד עצמו.

הכרטיס "תבנית ומיתוג המוסד" בלשונית "מסמכים ותבניות" נשאר כמו שהוא (הקשר של הפקת מסמכים לגיטימי), וכך גם הקישור מ-`/certificates/$classId`.

## קבצים

חדש:
- `src/routes/_authenticated.settings.index.tsx` — `createFileRoute("/_authenticated/settings/")`, כתובת `/settings`. head עם title/description ייחודיים + `robots: noindex` (עמוד פרטי), בהתאם לתקן שקיים ב-`_authenticated.settings.brand.tsx`.
- `src/components/subscription-status-card.tsx` — כרטיס המנוי/ניסיון, קורא ל-`getMyTrialStatus` דרך `useServerFn` + `useQuery` (לא loader — הפונקציה מוגנת ב-`requireSupabaseAuth`). מטפל במצבי טעינה/שגיאה.

עדכון:
- `src/routes/_authenticated.tsx` — קישור "הגדרות" (אייקון `Settings`) בניווט ליד "העלאה חכמה", לפני הקישור לניהול משתמשים.
- `src/routes/_authenticated.toolkit.tsx` — מסירים את שתי הלשוניות `reminders` ו-`security` ואת שני ה-imports שלהן; מוסיפים לשונית `settings` עם כרטיס קישור ל-`/settings`.
- `src/components/global-command-palette.tsx` — מוסיפים פקודה "הגדרות" → `/settings`. הפקודה הקיימת "מיתוג מוסד" → `/settings/brand` נשארת בדיוק כפי שהיא.

ללא שינוי: `security-settings.tsx`, `reminder-preferences-card.tsx`, `trial.functions.ts`, `_authenticated.settings.brand.tsx`, ומסד הנתונים.

## הערות טכניות

- שם הקובץ `_authenticated.settings.index.tsx` נותן route ID `/_authenticated/settings/` — הוא חי לצד `/settings/brand` הקיים בלי route אב `settings.tsx`, ולכן אין צורך ב-layout/`<Outlet />` חדש ואין סיכון לשבור את `/settings/brand`.
- `src/routeTree.gen.ts` נוצר אוטומטית — לא נוגעים בו.
- תאריך הסיום יוצג עם `toLocaleDateString("he-IL")`; `daysLeft` מגיע מוכן מהשרת.
