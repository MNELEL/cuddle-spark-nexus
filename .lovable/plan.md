
# תוכנית: ClassAlign Studio — שלב "תיקי תלמידים + דוחות + UI חדש"

## 1) מעטפת עיצוב חדשה (UI/UX Refresh)
החלפת `src/styles.css` לפלטה החדשה (HSL, light/dark, sidebar), גופן **Heebo** RTL, `--radius: 0.75rem`, scrollbar מותאם, `card-hover`, אנימציות Framer Motion עדינות.
- **Layout חדש** (`src/components/app-shell.tsx`):
  - Header sticky 56px עם safe-area
  - Bottom Nav במובייל (4 פריטים: בית, כיתות, CRM, פרופיל)
  - Sidebar בדסקטופ (`md+`) עם רשימת כיתות/תלמידים
  - Pull-to-refresh, bottom sheets במקום dialogs במובייל
- Toast: Sonner `top-center` `richColors`
- Toggle Light/Dark + שמירה ב-localStorage

## 2) תיקי תלמידים (Student Files)
טאב חדש בפרופיל התלמיד + עמוד ייעודי `/_authenticated/students/$studentId`.
- **מסמכים**: העלאה ל-Supabase Storage (bucket פרטי `student-files`), קטגוריות: אבחון, מכתב להורים, צילום מסמך, היסטוריה, כללי
- **יומן שיחות עם הורים**: רשומות עם תאריך, ערוץ (טלפון/וואטסאפ/פגישה/מייל), תקציר, מסמך מצורף אופציונלי, פולו-אפ
- **היסטוריה משנים קודמות**: תגית `school_year`, סינון/חיפוש
- תצוגת timeline מאוחדת לכל התלמיד

## 3) ציונים — קליטה בהקלטה/הקלדה/חופשי + AI
- כפתור 🎤 **הקלטה** (Web Speech API → fallback ל-Whisper דרך Lovable AI אם קיים) + כפתור הקלדה
- שדה "טקסט חופשי" — נשלח ל-Gemini עם JSON schema:
  ```
  { items: [{ studentName, subject, value, max, date?, notes? }] }
  ```
- שכבת **התאמה (matching)** לשמות תלמידים בכיתה (fuzzy), מסך אישור לפני שמירה
- כתיבה לטבלת `grades` הקיימת

## 4) דוחות PDF + שליחה
עמוד `/_authenticated/reports`:
- בחירת תלמיד / מקצוע / טווח תאריכים
- **תדפיס ציונים**: לפי תלמיד, לפי מקצוע, עם סיכום (ממוצע, מגמה, ScoreBadge)
- **דוח תקופתי**: ציונים + נוכחות + התנהגות + משימות
- יצירת PDF RTL (`jspdf` + `html2canvas`) — תבנית מעוצבת עם לוגו וכותרת
- כפתורי שליחה מהירה: **WhatsApp** (`wa.me/?text=...` עם לינק חתום למסמך), **Email** (`mailto:`)

## 5) יומן אירועים משמעתיים
טבלה חדשה `discipline_events`: סוג (חיובי/שלילי), קטגוריה, חומרה 1-5, תיאור, תאריך, קשור להורים?
- תצוגה: יומן מתגלגל בפרופיל התלמיד עם סינון (סוג/חומרה/טווח), badges צבעוניים, אינטגרציה ל-Score

## 6) מסד נתונים — מיגרציות חדשות
- `student_documents` (id, student_id, class_id, category, title, file_path, mime, size, school_year, uploaded_at)
- `parent_communications` (id, student_id, class_id, date, channel, summary, follow_up_date, document_id?)
- `discipline_events` (id, student_id, class_id, type, category, severity, description, date, parents_notified)
- `exams` + `exam_questions` + `exam_submissions` (למבחנים אינטראקטיביים — סעיף 7.16)
- `report_templates` (תבניות דוח שמורות)
- Storage bucket פרטי `student-files` + RLS לפי בעלות על הכיתה
- כל הטבלאות עם GRANTs ו-RLS scoped דרך `classes.owner_id`

## 7) 20 פונקציות נוספות לבית ספר
1. **מחולל מכתבים להורים** (AI) — תבניות + מילוי אוטומטי
2. **לוח שנה אקדמי** — מבחנים, אירועים, חופשות
3. **תוכניות לימוד שבועיות** עם export PDF
4. **בנק שאלות** לפי נושא ורמת קושי
5. **מבחנים אינטראקטיביים** — בנייה, שליחה לתלמידים, תיקון אוטומטי
6. **מעקב מטלות בית** (assignments) עם סטטוס הגשה
7. **טפסי הסכמה דיגיטליים** (טיולים, צילום) עם חתימת הורים
8. **תקשורת המונים** — שליחת הודעה לכל הכיתה/קבוצה ב-WhatsApp/Email
9. **דשבורד הורים** — קישור משותף מאובטח לצפייה בציוני הילד
10. **מעקב נוכחות עם תרשים** ו-streaks
11. **השוואת ביצועים** בין מבחנים/תקופות
12. **המלצות AI אישיות** לתלמיד (חיזוקים נדרשים)
13. **קבוצות לימוד דינמיות** ע"פ רמות
14. **תיעוד IEP** (תוכנית חינוכית אישית) לתלמידי שילוב
15. **בנק חיזוקים חיוביים** (משפטים מוכנים להערות)
16. **תזכורות חכמות להורים** (יום לפני מבחן)
17. **גיבוי שנה שלם** ל-ZIP להורדה
18. **ייבוא ממערכות אחרות** (CSV/Excel מפורט)
19. **מצב מורה מחליף** — תקציר מהיר של כל הכיתה
20. **אנליטיקס כיתה** — heatmap ביצועים, זיהוי קשיים מערכתיים

## 8) טכני
- ספריות חדשות: `jspdf`, `html2canvas`, `framer-motion` (אם חסר), `react-hot-toast`/sonner קיים
- כל הלוגיקה הרגישה ב-`createServerFn` עם `requireSupabaseAuth`
- העלאות קבצים: דרך browser supabase client לבאקט הפרטי
- AI: Lovable AI Gateway (`google/gemini-2.5-pro` להבנת חופשי, `google/gemini-2.5-flash` לקליל)
- שמירה על שפת העיצוב החדשה בכל קומפוננטה — שימוש בטוקנים בלבד

---

## אסטרטגיית מימוש (גלים)
- **גל A** (מיידי): מעטפת UI חדשה + AppShell + תיקי תלמידים בסיסי (מסמכים + יומן שיחות) + מיגרציות
- **גל B**: דוחות PDF + שליחה + יומן משמעת
- **גל C**: קליטת ציונים בהקלטה/AI חופשי
- **גל D**: 20 הפיצ'רים — בקבוצות של 4-5 לפי עדיפות שתבחר

---

## ❓ שאלות לפני התחלה
1. **גל ראשון** — להתחיל מ-A (UI+תיקים) או להוסיף גם B (דוחות) מיד?
2. **20 הפיצ'רים** — לסמן 5 שהכי קריטיים שייכנסו לגל הקרוב, או להשאיר לסוף?
3. **שליחת WhatsApp** — דרך `wa.me` (פתיחת ווטסאפ עם טקסט מוכן, חינם, ידני) או דרך API חיצוני (UAZAPI/Twilio, דורש מפתח בתשלום)?
4. **הקלטת קול** — Web Speech API דפדפן (חינם, איכות בינונית, תמיכה חלקית בעברית ב-Safari) או Whisper דרך Lovable AI (איכות גבוהה)?
