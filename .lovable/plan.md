# תוכנית תיקוני UI — Breadcrumb ל-/settings ותרגום מסכי 404/שגיאה

## סקירה
שתי משימות UI קטנות ללא migration וללא HITL:
1. להחליף את ה-breadcrumb המוטעה של "ארגז כלים › הגדרות" ב-/settings ובתתי-הנתיבים שלו ב-breadcrumb ייעודי שמבוסס על הלשונית הפנימית.
2. לתרגם את מסכי ה-404 והשגיאה הגלובליים ב-`src/routes/__root.tsx` לעברית, ולכוון את כפתורי "בית" ל-/classes (נקודת הכניסה האמיתית של המערכת).

## קבצים שיישתנו

### 1. `src/components/tool-breadcrumbs.tsx`
- להוסיף בדיקה בתחילת `ToolBreadcrumbs`:
  - אם `pathname.startsWith('/settings')` — להחזיר `null`.
- התוצאה: עמודי /settings/... לא יציגו יותר את ה-breadcrumb של "ארגז כלים › הגדרות".

### 2. `src/components/settings-tabs.tsx`
- לייצא מיפוי חדש: `SETTINGS_TAB_LABELS: Record<SettingsTabId | 'brand' | 'theme', string>` שמבוסס על המערך הקיים `TABS` (לשימוש חוזר במקום שכפול מחרוזות).
- דוגמה:
  - `general` → "כללי"
  - `security` → "אבטחה"
  - `reminders` → "תזכורות"
  - `docs` → "מסמכים"
  - `brand` → "מיתוג"
  - `theme` → "ערכת נושא"

### 3. `src/routes/_authenticated.settings.index.tsx`
- לייבא מהקומפוננטות הקיימות:
  - `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbPage`, `BreadcrumbSeparator` מ-`@/components/ui/breadcrumb`
  - `SETTINGS_TAB_LABELS` מ-`@/components/settings-tabs`
- להוסיף breadcrumb ייעודי בראש הדף, לפני הכותרת "הגדרות".
- מבנה ה-breadcrumb:
  - "הגדרות" כטקסט (לא קישור, כי אנחנו כבר בעמוד זה) — ישתמש ב-`BreadcrumbPage` או `span` לפי ה-API.
  - `BreadcrumbSeparator` מסובב 180° (כבר קיים ב-tool-breadcrumbs).
  - שם הלשונית הנוכחית לפי `SETTINGS_TAB_LABELS[tab]` כ-`BreadcrumbPage`.
- לשמור על `dir="rtl"` ועיצוב Tailwind קיים.

### 4. `src/routes/_authenticated.settings.brand.tsx`
- לייבא את הרכיבים הנדרשים מ-`@/components/ui/breadcrumb` ואת `SETTINGS_TAB_LABELS` מ-`@/components/settings-tabs`.
- להוסיף breadcrumb ייעודי בראש הדף:
  - "הגדרות" כקישור ל-/settings (בעזרת `BreadcrumbLink` ו-`Link` מ-`@tanstack/react-router`).
  - `BreadcrumbSeparator` מסובב 180°.
  - "מיתוג" כ-`BreadcrumbPage` (מ-`SETTINGS_TAB_LABELS.brand`).

### 5. `src/routes/_authenticated.settings.theme.tsx`
- זהה לקובץ ה-brand, אך עם:
  - `BreadcrumbPage` → "ערכת נושא" (מ-`SETTINGS_TAB_LABELS.theme`).

### 6. `src/routes/__root.tsx`
#### `NotFoundComponent`
- לשמור על "404" כמו שהוא.
- כותרת: "הדף שחיפשת לא נמצא".
- תיאור: "ייתכן שהקישור שגוי או שהדף הוסר".
- כפתור: "חזרה לדף הבית" — יקשר ל-/classes במקום /.

#### `ErrorComponent`
- כותרת: "הדף לא נטען".
- תיאור: "משהו השתבש. אפשר לנסות שוב או לחזור לדף הבית".
- כפתור ראשון (Try again): "נסה שוב".
- כפתור שני (Go home): "חזרה לדף הבית" — יקשר ל-/classes במקום /.

## קבצים שייוצרו
- אין.

## מigration / HITL
- אין.

## בדיקות שיבוצעו לאחר אישור
- בניית הפרויקט (`bun run build` או בדיקת TypeScript) — וידוא שאין שגיאות import/טיפוסים.
- ניווט ל-/settings, /settings?tab=security, /settings/brand, /settings/theme — וידוא שה-breadcrumb מוצג נכון ושאין breadcrumb של "ארגז כלים".
- ניווט לכתובת לא קיימת — וידוא שמסך ה-404 מוצג בעברית ומפנה ל-/classes.
- הדמיית שגיאה (אם ניתן) — וידוא שמסך השגיאה מוצג בעברית ומפנה ל-/classes.
