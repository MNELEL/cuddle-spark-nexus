## המשך פיתוח — שני מודולים מרכזיים

### עדיפות 1: שדרוג מדור סידור מקומות הישיבה

המערכת כבר כוללת רשת ישיבה, נעילת מושבים, יחסים (חבר/הרחקה/ריחוק), העדפות אישיות (גובה, שורה, פינה), חיפוש חכם (smartAssign), ושמירת תצורות. נוסיף שכבת חוויה ועוצמה:

1. **תצוגת הפרות בזמן אמת** — סימון חזותי על הרשת (קווים אדומים בין תלמידים שמפרים `avoid`/`distance`, קווים ירוקים בין `friend` שיושבים יחד). פאנל צידי עם רשימת ההפרות הפעילות לפי חומרה (hard/soft) עם ניווט לחיצה למושב.
2. **השוואת תצורות** — בחירת 2 snapshots ממאגר `seating_configs` והצגת diff: מי הוזז, ציון לפני/אחרי, מספר הפרות.
3. **מצב הצגה לכיתה (Display Mode)** — מסך מלא RTL עם שמות גדולים, מותאם להקרנה ביום הראשון של הזמן. כפתור הדפסה PDF של מפת הישיבה.
4. **קבוצות → צביעה ברשת** — שילוב טבלת `groups` הקיימת: כל קבוצה בצבע משלה ברקע המושב, לזיהוי מיידי של חבורות.
5. **שיפור smartAssign** — הוספת משקלים מתואמים (כרגע hard=100, soft=5): אפשרות למשתמש להגדיר בדיאלוג עדיפויות (לדוגמה: "תן עדיפות לחברויות" / "תן עדיפות לגובה"), והרצת 500 ניסיונות במקום 200 עם תצוגת התקדמות.
6. **היסטוריית שינויים** — לוג קצר של 10 סידורים אחרונים עם undo מהיר.

### עדיפות 2: ספריית חומרי הוראה ועזרים לכיתה

מודול חדש לחלוטין — מאגר משאבים דיגיטליים שהמלמד צובר ומשתף בין כיתות.

#### סכמת נתונים (מיגרציה חדשה)

- `teaching_resources` — id, owner_id, title, description, subject (מ-`kodesh-subjects`), grade_level (כיתה א-ח), resource_type (`worksheet`/`game`/`song`/`story`/`visual_aid`/`lesson_plan`/`question_bank`/`riddle`), content (jsonb לתוכן עשיר), file_path (storage), tags (text[]), is_public (לעתיד — שיתוף בין משתמשים), created_at
- `resource_collections` — אוספים אישיים (לדוגמה: "חומרים לפרשת בראשית")
- `resource_collection_items` — קישור many-to-many
- `class_resource_usage` — תיעוד שימוש: מתי משאב הוגש לאיזו כיתה (לדוח שימושיות)
- Storage bucket חדש: `teaching-resources` (פרטי, RLS לפי owner)
- כל הטבלאות עם RLS owner-based + GRANTs מתאימים

#### Server functions (`src/lib/teaching-resources.functions.ts`)

`listResources` (פילטרים: subject/type/grade/tag), `createResource`, `updateResource`, `deleteResource`, `uploadResourceFile`, `listCollections`, `createCollection`, `addToCollection`, `removeFromCollection`, `logResourceUsage`, `getResourceStats` (כמה פעמים שימשני).

#### יצירת תוכן בעזרת AI (`generateResourceWithAI`)

באמצעות Lovable AI (Gemini 2.5 Flash) — המלמד מתאר בעברית מה הוא צריך ("דף עבודה לכיתה ב' על פרשת לך לך עם 5 שאלות") והמודל מחזיר תוכן מובנה (JSON: כותרת, הוראות, שאלות/תשובות) שנשמר כ-`resource_type='worksheet'`. סוגים נתמכים: דפי עבודה, חידות, שאלות חזרה, רעיונות לסיפור/משל, פעילויות גיבוש.

#### ממשק (`src/routes/_authenticated.resources.tsx` + `_authenticated.resources.$resourceId.tsx`)

- **דף ראשי** — גריד כרטיסיות עם פילטרים בצד (סוג, מקצוע, כיתה, תגיות), חיפוש מהיר, ומיון לפי שימוש/תאריך.
- **פעולות מהירות** — כפתור "צור בעזרת AI ✨" שפותח דיאלוג עם prompt + בחירת סוג.
- **תצוגת משאב** — תוכן עשיר עם אפשרות הדפסה, הורדת קובץ, או "הגש לכיתה" (בוחר כיתה → רושם usage → לעתיד: שולח לעלון).
- **אוספים** — טאב נפרד לארגון בקבצים נושאיים.
- **שילוב בעמוד הכיתה** — כפתור חדש "חומרי הוראה" שמפלטר לפי כיתה רלוונטית.

### סדר ביצוע

1. מיגרציה: טבלאות teaching_resources + collections + bucket
2. server functions של teaching-resources (כולל AI generation)
3. עמודי resources
4. שיפורי seating: הפרות חזותיות + צביעת קבוצות + Display Mode
5. השוואת תצורות + שיפורי smartAssign
6. עדכון `routeTree.gen.ts` וחיבור כפתורים מעמוד הכיתה

### הערות טכניות

- כל הקריאות ל-Gemini עוברות `src/lib/ai-grades.functions.ts` כפטרן קיים (שגיאות לוג בצד-שרת + הודעה גנרית למשתמש)
- האחסון: bucket פרטי, signed URLs להורדה
- ה-Display Mode של seating יהיה route חדש: `_authenticated.classes.$classId.display.tsx`
