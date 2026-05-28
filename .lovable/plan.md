
# תוכנית מאסטר: ClassManager Pro → "ClassAlign Studio"

איחוד הטוב משני המסמכים (ClassAlign + ClassPro) עם מה שכבר בנינו, ויצירת חוויה ברמה של Awwwards בעברית RTL.

## מה לוקחים מכל מקור

**מ-ClassAlign (Three.js):**
- 3D אמיתי ב-React Three Fiber (במקום CSS 3D), עם OrbitControls, ContactShadows, תאורה
- אפקטים: Floor Halo פועם, Pulsing Glow על כיסא נבחר, אווטרים כדוריים מרחפים עם שם
- מצב Pairing — חיבור בין שני שולחנות עם צינור סגול זוהר
- AI Sort מתקדם עם 4 רמות עדיפות (חברים יחד, ניגודים בנפרד, מתקשים קדימה, גיוון)
- כפתורי toggle לכיסא enabled/disabled בריחוף

**מ-ClassPro (UI/UX):**
- אסתטיקה Premium: Slate #0f172a + הדגשות ענבר/Amber, Light/Dark, RTL מלא
- טיפוגרפיה: Space Grotesk + Inter + JetBrains Mono לתגים
- ציון ביצועים דינמי 0-100 עם Tooltip מרחף צבעוני (ירוק/צהוב/אדום) מעל כל שולחן
- מצב מצגת (Presentation HUD) עם Toggle לשמות/אנונימי, פריסות מצלמה: Normal / Bird's Eye / Student Level / Side Observer
- מחולל דוחות PDF (html2canvas + jsPDF) — כיתתי / אישי, A4, נוכחות+התנהגות+הערות
- שיגור Gmail אוטומטי להורים

## מה כבר יש לנו (לשמור ולחבר)
כיתות, תלמידים, גריד 2D עם drag, נעילת כיסאות, הסתרת מושבים, יחסים (friend/avoid/distance), Smart Sort בסיסי, קבוצות, Import/Export, נוכחות+ציונים, CRM (תזכורות + נקודות התנהגות + Leaderboard), נגישות, Auth.

## שלבי הביצוע

### שלב A — שדרוג מערכת העיצוב (Design System Refresh)
- `src/styles.css`: עדכון tokens — Midnight Slate `#0f172a`, Amber `#f59e0b`, gradient mesh, glow shadows
- חיבור 3 פונטים: Space Grotesk (display), Inter (body), JetBrains Mono (tags/scores)
- אנימציות framer-motion חלקות במעברי טאבים, drawers, dialogs
- Layout עליון מחודש: navbar שקוף עם blur, breadcrumb, theme toggle

### שלב B — מנוע ציון ביצועים (Performance Score Engine)
- פונקציה `computeStudentScore(student)` שמחשבת 0-100 לפי: ממוצע ציונים (40%), נוכחות (30%), נקודות התנהגות (30%)
- הצגה: bage עם רקע צבעוני (emerald 85+, amber 70-84, rose <70) + JetBrains Mono
- שילוב בכרטיס תלמיד, ב-Leaderboard, ובכיסא בגריד

### שלב C — תצוגת 3D אמיתית (Three.js)
- התקנה: `three`, `@react-three/fiber`, `@react-three/drei`
- קומפוננטה `Classroom3D.tsx`: רצפת slate, לוח כיתה, שולחן מורה, שולחנות תלמידים מתוך הגריד
- אווטר כדורי מרחף + Float + Text של שם מעל כל שולחן תפוס
- Halo טבעת פועמת + emissive glow על שולחן נבחר
- OrbitControls + ContactShadows + תאורה דרמטית
- Toggle בין תצוגת 2D (הקיימת) לתצוגת 3D באותו טאב

### שלב D — מצב Pairing (חיבור שולחנות)
- הוספת עמודה `paired_with` ב-students (migration)
- מצב Pairing ב-UI: לחיצה ראשונה צבע ענבר → לחיצה שניה יוצרת חיבור (גם בגריד 2D כקו, גם ב-3D כצינור סגול)
- פאנל RTL עם רשימת כל הזוגות + מחיקה
- ה-Smart Sort החדש יכבד paired_with — מנסה לשבץ זוגות סמוכים

### שלב E — AI Sort עם Gemini
- serverFn חדש `aiSortSeats` שמשתמש ב-Lovable AI Gateway (google/gemini-2.5-pro) עם structured JSON
- שולח: תלמידים + ציונים + נוכחות + יחסים + paired_with + גריד
- מקבל: שיבוץ אופטימלי + הסבר טקסטואלי לכל החלטה
- דיאלוג "AI Sort": תצוגה מקדימה של ההצעה עם הסברים → אישור / ביטול
- אינדיקטור עלות/תוקן בזמן אמת

### שלב F — מצב מצגת (Presentation Mode)
- כפתור Fullscreen שמסתיר navbar וטאבים
- HUD תחתון מרחף: toggle שמות/אנונימי, toggle תוויות מושב, 4 פריסות מצלמה (רק ב-3D)
- אנימציית מצלמה חלקה בין presets (lerp ב-useFrame)

### שלב G — מחולל דוחות PDF
- התקנה: `jspdf`, `html2canvas`
- קומפוננטה `ReportBuilder.tsx`: בחירת מצב (כיתתי/אישי), טווח תאריכים, סעיפים (נוכחות/ציונים/התנהגות/הערות)
- תבנית A4 RTL עם כותרת, גרפים (recharts קיים), טבלאות
- כפתורי: הורד PDF, הדפס, שלח במייל (`mailto:` עם גוף מוכן להורים)

### שלב H — ליטוש סופי + Onboarding
- מסך נחיתה משודרג ל-/index עם hero, תכונות, CTA
- Empty states יפים בכל המקומות
- Toasts, skeletons, loading states עם framer-motion
- בדיקות נגישות חוזרות

## פרטים טכניים

**Migrations נדרשות:**
- `students.paired_with uuid nullable` + index
- אופציונלי: `students.birth_date date`, `students.academic_history jsonb` להתאמה למודל ClassAlign

**Dependencies חדשות:**
`three @react-three/fiber @react-three/drei jspdf html2canvas`

**קבצים חדשים עיקריים:**
- `src/lib/performance-score.ts`
- `src/lib/ai-sort.functions.ts` (Lovable AI)
- `src/components/classroom-3d.tsx`
- `src/components/pairing-mode.tsx`
- `src/components/presentation-hud.tsx`
- `src/components/report-builder.tsx`

**עריכות עיקריות:**
- `src/styles.css` — design tokens
- `src/components/seating-grid.tsx` — אינטגרציה ל-3D + Pairing + Score badge
- `src/routes/_authenticated.classes.$classId.tsx` — toggle 3D/2D + Presentation
- `src/routes/index.tsx` — landing page חדש

## סדר ביצוע מוצע
מבצע A → B → C → D → E → F → G → H ברצף, בכל שלב עוצר אם משהו לא עובד. השלבים A-D הם הליבה החזותית — הם משדרגים את התחושה הכי הרבה.

---

**שאלה אחת לפני שמתחילים:** האם להתחיל מ-A+B+C ביחד (Design System + Score + 3D — השדרוג ה"וואו" הראשון), או שאתה מעדיף שאעבור שלב-שלב עם אישור ביניהם?
