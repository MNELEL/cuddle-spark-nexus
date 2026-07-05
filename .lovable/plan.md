## מה בונים

מרכז "העלאה חכמה" (Smart Ingest) — אזור אחד שאליו מעלים כל קובץ (תמונה, PDF, DOCX, Excel, טקסט, אודיו) והמערכת:
1. מזהה אוטומטית מה סוג התוכן
2. מפיקה את הנתונים באמצעות AI (Lovable AI Gateway — Gemini לראייה/טקסט, gpt-4o-mini-transcribe לאודיו)
3. מציגה טבלת תצוגה מקדימה עריכה
4. לאחר אישור המורה — משבצת ליעד הנכון במסד הנתונים

## סוגי קלט וניתוב

| סוג קובץ | AI מזהה | יעד |
|---|---|---|
| רשימת תלמידים (תמונה/PDF/Excel) | שמות, ת.ז., ת.לידה, כתובת, שם+ת.ז.+טלפון אב, שם+ת.ז.+טלפון אם | `students` + `parent_communications` (איש קשר לכל הורה) |
| חומר לימוד (PDF/DOCX/תמונה/טקסט) | כותרת, מקצוע (מתוך `kodesh-subjects`), כיתה, נושא, סיכום, תגיות | `teaching_resources` + storage bucket + embedding |
| הקלטת שיעור (mp3/m4a/wav/webm) | תמלול מלא, סיכום, נקודות מרכזיות, מקצוע, כיתה | `lesson_transcripts` + storage bucket |
| בקשה "צור מבחן/דף עבודה" מחומר קיים | שאלות פתוחות + רב-ברירה עם מפתח תשובות | קובץ PDF ב-`/mnt/documents` להורדה, ואופציה לשמירה כ-teaching_resource |

## מיקום במסך

- **עמוד חדש** `/ingest` — נגיש מתפריט ראשי (סרגל עליון בדשבורד) עם כרטיסי drag-and-drop לכל סוג קלט + היסטוריית העלאות אחרונות
- **כפתור מהיר** בכל עמוד כיתה (`/classes/$classId`) — "העלאה חכמה לכיתה זו" שפותח את אותו UI עם `classId` מוגדר מראש (כך העלאת רשימת תלמידים משבצת ישירות לכיתה הנכונה)

## זרימת המשתמש

```text
1. גרירת קובץ → העלאה ל-Supabase Storage (bucket זמני "ingest-staging")
2. server fn `analyzeUpload` → קורא לגייטווי AI המתאים לסוג הקובץ
3. מחזיר JSON מובנה (schema לכל סוג) + הצעת יעד
4. UI מציג טבלה עריכה (או תמלול עריך לאודיו)
5. המורה מסמנת שורות/עורכת ולוחצת "אשר ושבץ"
6. server fn `commitIngest` כותב לטבלאות היעד, מוחק את הקובץ הזמני
7. Toast: "23 תלמידים נוספו לכיתה ה'1" + קישור לתוצאה
```

## פרטים טכניים

**מסד נתונים**
- migration חדש: טבלה `ingest_jobs` (id, owner_id, class_id nullable, kind, source_storage_path, status, extracted_json, target_summary, created_at, committed_at) + RLS per-owner + GRANTs
- bucket חדש `ingest-staging` (פרטי, TTL ידני — מחיקה אחרי commit)
- שדות חדשים ב-`students` אם חסרים: `national_id`, `birth_date`, `address`, `father_name`, `father_id`, `father_phone`, `mother_name`, `mother_id`, `mother_phone` (בדיקה מול הסכימה הקיימת קודם; יתווספו רק החסרים)

**Server functions חדשים** ב-`src/lib/ingest.functions.ts`:
- `createIngestJob({ storagePath, kind, classId? })` — יוצר רשומה
- `analyzeIngestJob({ jobId })` — קורא ל-AI לפי kind, מחזיר `extracted_json`
  - `roster`: Gemini vision → schema של תלמידים
  - `resource`: Gemini text/vision → כותרת/מקצוע/סיכום + embedding
  - `lesson_audio`: gpt-4o-mini-transcribe → תמלול → Gemini סיכום
  - `exam_generation`: Gemini → שאלות + תשובות
- `commitIngestJob({ jobId, editedJson })` — כותב לטבלת היעד

**רכיבי UI חדשים**
- `src/routes/_authenticated.ingest.tsx` — עמוד ראשי (dropzone + היסטוריה)
- `src/components/ingest/upload-dropzone.tsx` — אזור גרירה
- `src/components/ingest/roster-preview-table.tsx` — טבלה עריכה לתלמידים
- `src/components/ingest/resource-preview-card.tsx` — מטא-נתונים לחומר
- `src/components/ingest/lesson-transcript-preview.tsx` — תמלול + סיכום
- `src/components/ingest/exam-generator-dialog.tsx` — יצירת מבחן מחומר קיים
- כפתור `SmartIngestButton` שמוטמע ב-`_authenticated.classes.$classId.tsx`

**AI Gateway**
- שימוש ב-`google/gemini-2.5-flash-image` לקבצי תמונה (OCR עברי מצוין)
- `google/gemini-3-flash-preview` לטקסט/PDF/סיכום
- `openai/gpt-4o-mini-transcribe` לאודיו
- `google/gemini-embedding-2` להטמעה של חומרי לימוד (כמו הקיים)
- הפעלות עם zod schema על התגובה כדי להבטיח מבנה נכון

**בטיחות**
- כל server fn: `requireSupabaseAuth`
- כל rows ב-ingest_jobs וב-storage: owner_id של המורה
- Zod validation על ה-editedJson לפני commit
- מחיקה של הקובץ הזמני מ-Storage אחרי commit או ביטול

## מחוץ להיקף השלב הראשון

- ייבוא מרובה-כיתות בבת אחת (יטופל דרך העלאות נפרדות)
- עריכת מבחנים אחרי יצירה (יורד להורדה כ-PDF; עריכה עתידית)
- OCR של כתב יד ילדותי (Gemini עושה זאת סביר, ללא הבטחה)

## שלבי מימוש (סדר ביצוע)

1. Migration: `ingest_jobs` + עמודות חסרות ב-`students` + bucket `ingest-staging`
2. `src/lib/ingest.functions.ts` — 4 ה-server functions עם schemas
3. `src/routes/_authenticated.ingest.tsx` + רכיבי preview
4. `SmartIngestButton` בעמוד כיתה + קישור מהתפריט הראשי
5. QA: העלאת התמונה שסופקה, לוודא ש-32 התלמידים מזוהים נכון עם כל הפרטים