# בדיקת סינון recipient דרך כלי ה-MCP

## מה חסר כרגey
הטסטים ב-`src/test/notifications-flow.test.ts` מכסים את סינון ה-recipient בשכבת ה-DB (מסלול `notifications.functions.ts`), אבל אין כלי MCP שטוען התראות כיתה — ולכן אין מה לבדוק במסלול ה-MCP. כדי לוודא שהסינון פועל גם דרך ה-MCP, נוסיף כלי קריאה אחד ונבדוק אותו מקצה-לקצה מול ה-DB האמיתי.

## מה נבנה

### 1. כלי MCP חדש: `list_notifications`
קובץ חדש `src/lib/mcp/tools/list-notifications.ts` באותו דפוס של `list-reminders.ts`:
- קלט: `only_unread` (בוליאני, אופציונלי), `limit` (אופציונלי, ברירת מחדל 20).
- **אין** פרמטר recipient בקלט — הזהות נגזרת מהטוקן המאומת (`ctx.getUserId()`), בדיוק כמו בשאר הכלים.
- שאילתה דרך `supabaseForUser(ctx)` עם `.eq("recipient_id", ctx.getUserId())`, `.is("read_at", null)` כשמבקשים רק לא-נקראות, ומיון יורד לפי `created_at`.
- מחזיר `structuredContent: { notifications: [...] }`, שגיאות כ-`isError`.
- רישום ב-`src/lib/mcp/index.ts` לצד ששת הכלים הקיימים, ואז הרצת אימות המניפסט.

### 2. טסט אינטגרציה מקצה-לקצה
הרחבת `src/test/notifications-flow.test.ts` (משתמשת בשורות ובמשתמשים שכבר נוצרים ב-`beforeAll`) עם בלוק `describe` פנימי למסלול ה-MCP:
- מוק קטן של `ToolContext` שמחזיר `isAuthenticated() === true`, `getUserId()` ו-`getToken()` מהסשן האמיתי של המשתמש הטסטי (`user.client.auth.getSession()`), ומריץ את ה-handler של הכלי ישירות.
- מקרי הבדיקה:
  1. `owner` מקבל דרך הכלי בדיוק את ההתראות שלו (ולא של `other`), עם אותה ספירה כמו במסלול ה-DB.
  2. **recipient לא תואם** — הרצת ה-handler עם טוקן של `owner` אך הקשר שמדמה בקשה ל-recipient אחר (`getUserId()` של `other`) מחזירה אפס תוצאות, כי RLS על הטוקן חוסמת גם כשה-filter מצביע למישהו אחר.
  3. recipient לא קיים (uuid מקרי) — אפס תוצאות, ללא שגיאה.
  4. `principal` (institution_admin) שמריץ את הכלי מקבל אפס תוצאות, גם כשההתראות שייכות למורה במוסד שלו.
  5. ללא טוקן / לא מאומת — הכלי מחזיר `isError` ולא נוגע ב-DB.

## הערות טכניות
- הטסטים מדולגים אוטומטית ללא משתני סביבה (`describe.skipIf(!hasTestEnv)`), כמו שאר החבילה.
- אין שינוי סכימה, אין מיגרציה, אין שינוי הרשאות.
- בסיום: הרצת כל חבילת הטסטים (כרגע 91 מקרים) ואימות מניפסט ה-MCP.
