## מה נבנה

### 1. תצוגה מקדימה של PDF בפאנל סקירת השיעור
- הוספת כפתור "תצוגה מקדימה" ליד "ייצוא PDF" ב-`src/routes/_authenticated.ingest.tsx`.
- רכיב חדש `src/components/ingest/pdf-preview-dialog.tsx` — Dialog של shadcn שמריץ את `exportLessonSummaryPdf` במצב `preview` (מחזיר Blob במקום להוריד), יוצר `blob:` URL ומציג ב-`<iframe>` בגובה מלא. כפתור "הורד" בתוך הדיאלוג מפעיל את ההורדה.
- שחרור ה-`blob:` URL ב-cleanup כדי למנוע דליפת זיכרון.

### 2. עימוד PDF בטוח לטקסטים ארוכים
- עדכון `src/lib/pdf/pdf-builder.ts`:
  - `paragraph()` — כרגע קורא `ensureSpace(all lines)`; יתחלק ללולאה שמעבירה קבוצות שורות לעמוד חדש כשנגמר המקום, במקום לחתוך.
  - `section()` / `subSection()` — לוודא שגם הכותרת + לפחות 2-3 שורות מהתוכן שאחריה נכנסות באותו עמוד (widow control), אחרת דחיפה לעמוד חדש.
- `baseTable` כבר משתמש ב-autoTable שמטפל בשבירת עמודים לטבלאות; נוסיף `rowPageBreak: 'avoid'` לתאים קצרים ו-`showHead: 'everyPage'` כדי שהכותרות יחזרו.
- ב-`src/lib/pdf/lesson-summary-pdf.ts`: אין שינוי לוגי, רק להסתמך על ה-builder המשופר.

### 3. שם קובץ מותאם לפי שם השיעור + תאריך
- ב-`exportLessonSummaryPdf` (וב-preview dialog) — שם הקובץ יהיה:
  `{safeName(lesson.title)}__{YYYY-MM-DD}.pdf` (תאריך היום, פורמט ISO קצר, ללא תלות ב-locale).
- אם `lesson.title` ריק — fallback ל-`סיכום-שיעור__{date}.pdf`.

### 4. שיפור ביצועים בתצוגה התלת-ממדית
עדכון `src/routes/_authenticated.classes.$classId.display.tsx`:
- **הפחתת עומס rendering**:
  - `dpr={[1, 1.5]}` ב-`<Canvas>` (במקום ברירת מחדל שיכולה להגיע ל-3 במסכי retina).
  - `frameloop="demand"` כאשר אין אנימציה פעילה — צייר מחדש רק בשינוי מצב/מצלמה.
  - `performance={{ min: 0.5 }}` כדי ש-R3F ישחרר איכות אוטומטית תחת עומס.
- **זיהוי מכשיר חלש**: hook קטן חדש `src/hooks/use-device-perf.ts` שמזהה `navigator.hardwareConcurrency <= 4` או `navigator.deviceMemory <= 4` או `matchMedia('(prefers-reduced-motion)')` ומחזיר `'low' | 'high'`.
  - במצב `low`: מבטל צללים, מוריד מספר segments של גיאומטריות, משבית anti-aliasing, מוריד את ה-HUD floating tooltips לרינדור חד-פעמי.
- **Lazy load של ה-Canvas**: `React.lazy` + `Suspense` על רכיב ה-3D, עם fallback של השלד הדו-ממדי. משפר TTI במיוחד בטעינה ראשונה במובייל.
- **מדידה**: להוסיף `stats.js` רק ב-`import.meta.env.DEV` כדי לא להשפיע על production.

### 5. תיקון ממצא אבטחה `SUPA_extension_in_public`
- Migration חדש: העברת ה-extension מ-`public` ל-schema ייעודי (`extensions`), עדכון `search_path` בפונקציות שמשתמשות בה.
- קריאה ל-`security--manage_security_finding` לסימון כפתור.
- הערה: ייתכן שכבר בוצע בעבר (`pgvector` הועבר) — נריץ קודם `security--get_scan_results` לוודא איזה extension בדיוק נותר ב-public לפני הכתיבה.

## קבצים

**חדשים**
- `src/components/ingest/pdf-preview-dialog.tsx`
- `src/hooks/use-device-perf.ts`
- Migration ל-extension

**עדכון**
- `src/routes/_authenticated.ingest.tsx` (כפתור preview + שם קובץ)
- `src/lib/pdf/pdf-builder.ts` (עימוד בטוח)
- `src/lib/pdf/lesson-summary-pdf.ts` (שם קובץ עם תאריך)
- `src/routes/_authenticated.classes.$classId.display.tsx` (ביצועי 3D)

## מחוץ להיקף
- שינוי מנוע ה-PDF (jsPDF נשאר).
- הוספת תצוגה מקדימה לשאר סוגי ה-PDF (question bank, bulletin) — נעשה רק אם תבקש בהמשך.
