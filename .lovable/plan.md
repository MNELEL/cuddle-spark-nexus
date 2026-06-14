## טיוטות מייל אישיות להורים

הוספת מחולל מיילים להורים עם תוכן מותאם אישית לכל תלמיד, ישירות מעמוד הסיכום היומי ומתיק התלמיד.

### מה נבנה

**1. ספריית תבניות (`src/lib/parent-email-templates.ts`)**
6 תבניות מוכנות בעברית:
- עדכון חיובי שבועי (הצטיינות בלימוד/התנהגות)
- דאגה מנוכחות (חיסורים/איחורים אחרונים)
- דאגה התנהגותית (נקודות שליליות)
- שיחה על ציון נמוך
- ברכה ליום הולדת / הישג מיוחד
- הזמנה לפגישת הורים

כל תבנית מקבלת `{ studentName, className, teacherName, stats }` ומחזירה `{ subject, body }` בעברית עם פנייה מכובדת ("שלום וברכה להוריו של...").

**2. Server function — `draftParentEmail` (`src/lib/parent-emails.functions.ts`)**
- מקבל `studentId, classId, templateKey, customNote?`
- שולף נתוני 30 יום אחרונים: נוכחות, ציונים, התנהגות, ציון ביצועים
- מזרים אותם לתבנית, מחזיר `{ subject, body }`
- אופציה ל-AI polish דרך Lovable AI (משתמש ב-`buildStyleContext` הקיים לסגנון המלמד) — toggle בצד לקוח

**3. רכיב `ParentEmailComposer` (`src/components/parent-email-composer.tsx`)**
Dialog שנפתח עם:
- בחירת תבנית (Select)
- שדה הערה אישית (Textarea, אופציונלי)
- toggle "שפר עם AI"
- כפתור "צור טיוטה" → קורא ל-`draftParentEmail`
- תצוגה מקדימה ניתנת לעריכה של נושא + גוף
- כפתורי פעולה: העתק, פתח ב-Gmail (`mailto:`), פתח ב-WhatsApp (`wa.me`)

**4. נקודות שילוב**
- `_authenticated.daily.$classId.tsx` — בטור פרטי תלמיד מוסיף כפתור "צור מייל" שפותח את ה-Composer
- `student-file-sheet.tsx` — כפתור "צור מייל להורים" בכותרת התיק

### טכני

- אין מיגרציה — הכל מחושב מהנתונים הקיימים
- AI polish משתמש ב-`LOVABLE_API_KEY` הקיים + `google/gemini-2.5-flash`
- mailto/wa.me בלבד — אין שליחה אוטומטית (דורש OAuth/הסכמת הורה)
- RTL מלא, כל הטקסטים בעברית עם פנייה בלשון "הרב/המלמד"
