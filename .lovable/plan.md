# חיזוק אזור /settings — ארבעה שינויים

מה נבדק בקוד לפני התוכנית (עובדות, לא הנחות):
- `src/components/settings-tabs.tsx` — active state, `aria-current="page"` וניווט חצים RTL קיימים. **מחוץ להיקף, לא נוגעים.**
- אין בפרויקט `@testing-library/react`, `jsdom` או Playwright (לא ב-`package.json` ולא בקונפיג של vitest). כל קבצי הטסט הם או RLS מול DB אמיתי או לוגיקה טהורה/קריאת קבצים.
- `src/test/nav-settings.test.ts` קיים ובודק כבר את קישור ה-header ל-/settings, את הטאבים ואת ה-command palette — בקריאת קבצים (static), ללא render.
- 404: קיים `notFoundComponent` אחד בלבד ב-`src/routes/__root.tsx`, עם טקסט באנגלית ("Page not found" / "Go home"). אין `notFoundComponent` ב-`_authenticated.tsx` ואין splat route תחת settings — ולכן `/settings/xyz` אכן מגיע ל-404 הגנרי באנגלית.
- `logInfo` מ-`src/lib/logger.server.ts` כותב ל-`app_logs` (level/message/context/source/user_id) — אותו מנגנון שבו משתמשים `classes.functions.ts`, `access-requests`, `student-profiles`. אין צורך בטבלה חדשה.
- `brand.functions.ts` (`saveBrand`, `saveInstitutionBrand` עם `canEdit` בשרת), `security.functions.ts` (`setPin`, `disablePin`), `reminder-preferences.functions.ts` (`saveReminderPreferences`) — לאף אחד מהם אין כרגע audit log.

## 1. טסט כניסה ל-/settings — בלי תלות חדשה (החלטה ארכיטקטונית)

לא נוסיף `@testing-library/react` + `jsdom`. הסיבה: הסטאק הוא TanStack Start על Cloudflare Workers, וכל ראוט ההגדרות תלוי ב-router context, ב-server functions ובגייט `_authenticated` — render בתוך jsdom ידרוש mocking של כל השרשרת ויבדוק בעיקר את ה-mocks. אם בעתיד יידרש E2E אמיתי, הכלי הנכון הוא Playwright מול preview, וזו החלטה נפרדת (תלות + CI job) שכדאי לקחת בנפרד ולא כחלק מהשינוי הזה.

במקום זה מרחיבים את `src/test/nav-settings.test.ts` בשני כיוונים:
- **שכבת חוזה (קריאת קבצים):** שקישור ה-header קיים, שהטאבים general/security/reminders/docs מרונדרים דרך `SettingsTabs`, ושכל טאב מחובר לרכיב אמיתי בעמוד.
- **שכבת ריצה אמיתית (מול DB, בסגנון טסטי ה-RLS הקיימים):** משתמש טסט מ-`src/test/helpers.ts` (`createTestUser`), וקריאה לשאילתות ש-`getBrand`, `getMyTrialStatus`, `getSecurity` ו-`getReminderPreferences` מבצעים — כדי לוודא שהן מחזירות ברירת מחדל תקינה למשתמש חדש ולא זורקות. זה תופס את הכשל האמיתי של "מסך הגדרות ריק/שגיאה", בלי jsdom.

## 2. 404 ממותג בעברית לכל `/settings/*`

- ראוט splat חדש `src/routes/_authenticated.settings.$.tsx` שתופס כל תת-נתיב לא מוכר תחת settings.
- המסך: עברית RTL, טוקנים סמנטיים בלבד, כותרת "הדף לא נמצא באזור ההגדרות", הצגת הנתיב שהוקש, `SettingsTabs` למעלה כדי לא לאבד הקשר, וכפתור חזרה ל-/settings (+ קישור לדף הבית).
- `/settings` ללא `tab` נשאר כמו שהוא (`validateSearch` → general). לא נוגעים.

## 3. Audit log על שינויי הגדרות

`logInfo` עם `source: "settings_update"` בכל הנקודות הבאות — הודעה בעברית, `userId`, ו-context רזה בלבד (איזה טאב, אילו שדות השתנו). בלי ערכים רגישים:
- `saveBrand` — `{ tab: "brand", scope: "personal", fields: [...] }`
- `saveInstitutionBrand` — `{ tab: "brand", scope: "institution", institutionId, fields: [...] }`
- `setPin` / `disablePin` — `{ tab: "security", action: "pin_set" | "pin_disabled" }`. **אף פעם לא ה-PIN, לא hash ולא אורך.**
- `saveReminderPreferences` — `{ tab: "reminders", fields: [...] }`
- לוגיקת ההרשאות לא משתנה: `canEdit` של המוסד נשאר האכיפה היחידה, ושאר הטאבים נשארים "ההגדרות שלי" תחת גייט `_authenticated`. לא מוסיפים beforeLoad guard ולא נוגעים ב-RLS.

## 4. Breadcrumbs רק ב-brand ו-theme

- רכיב קטן `src/components/settings-breadcrumb.tsx` (nav + `aria-label="מסלול ניווט"`, `aria-current="page"` על הפריט הנוכחי): `הגדרות` (Link ל-/settings) ‹ `מותג` / `ערכת נושא`.
- נוסף ב-`_authenticated.settings.brand.tsx` וב-`_authenticated.settings.theme.tsx` בלבד, וגם במסך ה-404 החדש (`הגדרות ‹ לא נמצא`).
- אין breadcrumb ב-`/settings/index` ואין לטאבים הפנימיים — כפילות מול `SettingsTabs`.

## פרטים טכניים

| קובץ | שינוי |
|---|---|
| `src/routes/_authenticated.settings.$.tsx` | חדש — 404 ממותג ל-namespace ההגדרות |
| `src/components/settings-breadcrumb.tsx` | חדש |
| `src/routes/_authenticated.settings.brand.tsx` / `.theme.tsx` | הוספת breadcrumb |
| `src/lib/brand.functions.ts` | `logInfo` ב-`saveBrand` + `saveInstitutionBrand` |
| `src/lib/security.functions.ts` | `logInfo` ב-`setPin` + `disablePin` |
| `src/lib/reminder-preferences.functions.ts` | `logInfo` ב-`saveReminderPreferences` |
| `src/test/nav-settings.test.ts` | הרחבה: חוזה טאבים + טסט ריצה עם משתמש טסט |
| `src/lib/tool-registry.ts` (אם נדרש) | רישום/פטור לראוט ה-splat כדי ש-`route-link-coverage` יישאר ירוק |

- `logInfo` נטען דרך `await import("@/lib/logger.server")` בתוך ה-handler, כמו בשאר ה-functions, כדי לא לגרור מודול server-only ל-bundle של הקליינט.
- אימות בסוף: `bun run test` + `node scripts/check-route-links.mjs`.

## מחוץ להיקף
active-tab state (קיים), ברירת המחדל של `?tab`, שינויי RLS על `brand_settings` ודומותיה, והוספת Playwright/jsdom.