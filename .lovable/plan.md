
## מטרה
לאחד את כל התהליכים סביב שלושה עוגנים: **מיתוג מוסדי אחד** שמוטמע בכל פלט, **Smart Ingest אחד** לכל סוגי הקבצים כולל תעודות, ו**סיכום אוטומטי** בכל ניתוח AI.

## 1. מיתוג גלובלי (School Brand)

טבלה חדשה `brand_settings` (per user):
- `school_name`, `logo_url`, `header_line` (מוטו/כתובת), `principal_name_default`, `teacher_name_default`, `primary_color`

Bucket חדש `brand-assets` (public read) להעלאת לוגו.

מסך חדש `/settings/brand` (או טאב בהגדרות) — טופס עם:
- העלאת לוגו (drag-drop, preview)
- שם מוסד, שורת כותרת, פרטי מנהל/מחנך default
- תצוגה מקדימה חיה של header

Hook חדש `useBrand()` שטוען פעם אחת ומחזיר את כל השדות.

**שילוב בכל הפלטים:**

| מקום | שינוי |
|---|---|
| `src/lib/pdf/pdf-builder.ts` | פונקציה `drawBrandHeader(doc, brand)` — לוגו משמאל, שם מוסד במרכז, שורת כותרת מתחת |
| כל בוני ה־PDF (`certificate-pdf`, `bulletin-pdf`, `daily-class-pdf`, `class-report-pdf`, `lesson-summary-pdf`, `student-daily-pdf`, `question-bank-pdf`) | מקבלים `brand` ומקריאים ל־`drawBrandHeader` במקום כותרת מקומית |
| `parent-email-composer.tsx` + `parent-email-templates.ts` | header עם `<img src={logo}>` ושם מוסד |
| `/c/$slug`, `/p/$token` | הצגת לוגו + שם מוסד ב־hero |
| `_authenticated.tsx` (header המורה) | הצגת שם המוסד ולוגו קטן ב־nav |

מסכי ה־PDF יטענו את ה־brand פעם ולהעביר לכל בונה.

## 2. OCR תעודות (Certificate Photo → Auto-fill)

פונקציה חדשה `analyzeCertificatePhoto` ב־`ai-grades.functions.ts` (או קובץ ייעודי):
- מקבלת תמונה (base64) → Gemini vision
- מחזירה `{ studentName, subjects: [{subject, grade|label, note?}], summary }`
- summary = תיאור טקסטואלי קצר של מה שזוהה

בעמוד `/certificates/$classId`:
- כפתור חדש **"העלה צילום תעודה"** בכל כרטיס תלמיד
- לאחר זיהוי — matching אוטומטי של subjects קיימים + הוספת חדשים
- דיאלוג preview לאישור לפני החלה

## 3. איחוד Smart Ingest (One Category Hub)

היום מפוזר: `analyzeAuto` (ingest), `GradeAiImport` (grades tab), OCR ידני בכיתה.

**איחוד:** קטגוריה מאוחדת אחת ב־`src/lib/ingest.functions.ts` עם enum:
```
"auto" | "grades" | "certificate" | "roster" | "behavior" | "communication" | "lesson"
```

- מסך `/ingest` הופך ל־hub יחיד: העלאה → סיווג אוטומטי או ידני → הפניה למסך הרלוונטי
- `GradeAiImport` הופך ל־wrapper דק סביב `IngestHub` עם prefilled category
- הכפתור "העלה צילום תעודה" ב־`/certificates` משתמש באותו backend עם `category: "certificate"`
- מחיקת כפילויות: `grade-ai-import.tsx` מאבד את הלוגיקת AI שלו ומשתמש ב־hub

## 4. סיכום אוטומטי בכל ניתוח (Analysis Summary)

בכל server function שמחזירה תוצאות AI, נוסיף שדה `summary: string` (2-4 משפטים בעברית):
- `analyzeAuto`, `analyzeCertificatePhoto`, `analyzeGradesImage`, `analyzeLessonAudio`, `analyzeIngestFile`

בכל מסך שמציג תוצאות — קופסת "סיכום ניתוח" בראש עם ה־summary, לפני הטבלה.

## 5. שיפור עמוד הפקת תעודות

- כפתור **"+ הוסף מקצוע/נושא"** בכל תלמיד (כרגע חסר)
- שדה **"חומרים שנלמדו"** (textarea per subject)
- כפתור **"שכפל לכל הכיתה"** לחומרים/הערות משותפות
- Auto-save של השינויים ל־localStorage לפי `classId + period`

## פרטים טכניים

### Migration
```sql
CREATE TABLE public.brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  school_name text,
  logo_url text,
  header_line text,
  principal_name_default text,
  teacher_name_default text,
  primary_color text DEFAULT '#f59e0b',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- GRANT + RLS: user_id = auth.uid()
```
Storage bucket `brand-assets` (public), policy: user יכול להעלות/למחוק תחת `${user_id}/*`.

### קבצים חדשים
- `src/lib/brand.functions.ts` — get/save brand
- `src/hooks/use-brand.tsx` — React hook + query
- `src/routes/_authenticated.settings.brand.tsx` — טופס
- `src/lib/pdf/brand-header.ts` — `drawBrandHeader(doc, brand)` משותף
- `src/lib/ai-certificate.functions.ts` — OCR תעודות
- `src/components/ingest/unified-hub.tsx` — hub מרכזי

### קבצים שמשתנים
- כל `src/lib/pdf/*.ts` — קבלת `brand` בפרמטרים
- כל מסך שמפיק PDF — טעינת brand דרך `useBrand`
- `certificates/$classId` — כפתור העלאה, +מקצוע, חומרים
- `grade-ai-import.tsx`, `/ingest` — routing דרך hub
- כל AI function — הוספת `summary` ל־response

### סדר ביצוע
1. Migration + brand bucket
2. `brand.functions.ts` + hook + מסך הגדרות
3. `brand-header.ts` + עדכון כל בוני ה־PDF
4. שילוב לוגו במיילים ובעמודי שיתוף
5. OCR תעודות + כפתור בעמוד certificates
6. איחוד ingest hub
7. הוספת `summary` לכל ניתוח + הצגה ב־UI
8. שיפור עמוד הפקת תעודות (+מקצוע, חומרים)
9. Typecheck + הפעלה
