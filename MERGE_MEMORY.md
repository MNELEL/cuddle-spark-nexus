# MERGE_MEMORY.md
> מסמך זיכרון קבוע לפרויקט מיזוג האפליקציות. עדכן אותו בכל שיחה חדשה כדי לא לאבד החלטות.
> יעד סופי: **Lovable**. הפרויקט החי: **"Harmony Hub"** (repo: `cuddle-spark-nexus`), פרויקט Lovable ID `2734475a-1431-4ef2-8175-67b8af357276`.

**עדכון אחרון:** 30 ביולי 2026 — **סיור מקיף חדש: Lovable + Base44, כולל תיקון אבחנה קריטי (registerDriveWatch) ופער אבטחה חדש (PIN hashing ב-Class-Flow). ראה סעיף 10.**
**עדכון קודם:** 26 ביולי 2026 — פיצ'ר הרשמת מורים עם קוד גישה + תיקון אבטחת bulletinFeedback ב-Class-Flow (סעיף 9).
**עדכון קודם:** 23 ביולי 2026 — הושלמה משימת ה-Task Automation (סעיף 2) ואיחוד AI Gateway (סעיף 4).

---

## ⚠️ הערה קריטית לגבי עדכניות מידע

**ה-repo `cuddle-spark-nexus` ב-GitHub פיגר משמעותית אחרי הפרויקט החי ב-Lovable.** התגלה שבמקביל לשיחות התכנון כאן, בוצע פיתוח ישיר בתוך Lovable שהוסיף פיצ'רים שלמים (ראה סעיף 1). **מסקנה מעשית: מכאן ואילך, לפני כל החלטת מיזוג, יש לבדוק את המצב האמיתי ב-Lovable (`Lovable:list_files` / `Lovable:read_file` על project_id הנ"ל), ולא להסתמך רק על ה-git clone.** ה-GitHub clone עדיין שימושי להשוואה מול 5 המאגרים **האחרים** (Teacher-students-mgmt, classflow, Class-manager-from-Gemini-, certificates-tool, Cllapilot) — הבעיה היא ספציפית להשוואה מול המצב העדכני של הפרויקט המרכזי עצמו.

---

## 0. רשימת כל המאגרים ותפקידם

| # | שם ריפו | סטאק | תפקיד במיזוג |
|---|---|---|---|
| 1 | **`cuddle-spark-nexus` ("Harmony Hub")** | TanStack Start + Supabase + Cloudflare Workers | **הפרויקט המרכזי בפועל** — זהו יעד המיזוג עצמו, פרויקט Lovable חי ופעיל, מתעדכן ברציפות |
| 2 | `Teacher-students-management-interface` | Vite/React + Firebase + PWA | מקור פיצ'רים — גם הדפלוי החי הנפרד (ClassAlign/smartclass-ai-manager ב-Cloud Run) |
| 3 | `Class-manager-from-Gemini-` | Vite/React + Express + Firebase + Capacitor/Electron | מקור פיצ'רים — Embeddings/RAG (גרסת Gemini), Whiteboard |
| 4 | `classflow` | Base44 SDK | מקור פיצ'רים — גרסה מוקדמת יותר של אותו רעיון כמו cuddle-spark-nexus |
| 5 | `certificates-tool` (`-certificates-tool`) | Vite/React + Supabase + Claude AI | מקור פיצ'ר — **הפיצ'ר כבר יובא בהצלחה** ל-cuddle-spark-nexus (ראה 1.4) |
| 6 | `Cllapilot-for-haideer` | Kotlin Android נייטיבי | reference בלבד — Kiosk mode הוא נייטיבי בלבד, אין מקבילה בווב |

**הבהרות מהעבר שעדיין תקפות:**
- `ai.studio/apps/e3f0aac2-...` = לינק ה-AI-Studio-origin של `Teacher-students-management-interface` בלבד. `ai.studio/apps/84931763-...` = אותו דבר עבור `Cllapilot-for-haideer`. אין בהם תוכן נוסף לשלוף.
- **smartclass-ai-manager (Cloud Run, "ClassAlign")** = הדפלוי החי של `Teacher-students-management-interface` — לא ריפו נפרד.

---

## 1. מה כבר קיים בפועל ב-Harmony Hub (cuddle-spark-nexus) — אומת ישירות מול Lovable

הפיצ'רים הבאים **כבר פותחו ישירות בתוך Lovable** על ידך, ואינם צריכים "יבוא" — רק אימות שהם שלמים ותקינים מול שאר המאגרים:

### 1.1 בולטין שבועי ✅
- קובץ: `src/routes/_authenticated.bulletins.$classId.tsx`
- פונקציות תמיכה: `bulletin-sync.functions.ts`, `bulletins.functions.ts`, `pdf/bulletin-pdf.ts`
- **סטטוס: קיים ופעיל.**

### 1.2 נעילת PIN / אבטחה ✅ — נבדק לעומק, מימוש איכותי
- קובץ: `src/lib/security.functions.ts` — נקרא במלואו.
- **מימוש חזק מבחינה אבטחתית**: PIN בן 4 ספרות, hash מלוח SHA-256 (`salt` רנדומלי 16 בית לכל משתמש), אימות עם `timingSafeEqual` (מונע timing attacks), הכל דרך `createServerFn` עם `requireSupabaseAuth` middleware — כלומר **לא client-side בלבד**, בדיוק כמו שרצינו.
- טבלה: `app_security` (Supabase) עם `pin_enabled`, `pin_hash`, `pin_salt`.
- UI: `src/components/pin-lock-screen.tsx`, `src/components/security-settings.tsx`.
- **סטטוס: קיים, פעיל, ואיכותי. אין צורך בשינוי.**

### 1.3 הגרלה (Raffle) ✅
- קובץ: `src/routes/_authenticated.raffle.$classId.tsx`
- **סטטוס: קיים ופעיל.**

### 1.4 תעודות PDF ✅ — נבדק לעומק, יובא בהצלחה מ-certificates-tool
- קובץ: `src/lib/certificates.functions.ts` — נקרא במלואו.
- `getCertificateData`: server function עם Zod validation (classId כ-UUID, טווח תאריכים), שולף במקביל (`Promise.all`) ציונים+התנהגות+נוכחות מ-Supabase, error handling תקין.
- קובץ ייצור ה-PDF: `src/lib/pdf/certificate-pdf.ts`.
- Route: `src/routes/_authenticated.certificates.$classId.tsx`.
- פונטים מוטבעים: `public/fonts/Heebo-Regular.ttf`, `public/fonts/Heebo-Bold.ttf` (בדיוק כמו ב-`certificates-tool` המקורי).
- **סטטוס: קיים, פעיל, בנוי היטב. הפיצ'ר שהיה ב-certificates-tool בלבד — יובא בהצלחה.**

### 1.5 תצוגת סידור הושבה תלת-ממדית (3D) ✅ — לא ידענו על זה קודם!
- קובץ: `src/routes/_authenticated.classes.$classId.display.tsx`
- לפי `.lovable/plan.md` — יש שם Canvas תלת-ממדי (כנראה `@react-three/fiber`, כמו ב-Teacher-students-mgmt), עם עבודה בתהליך על אופטימיזציית ביצועים (`dpr`, `frameloop="demand"`, זיהוי מכשיר חלש).
- **סטטוס: קיים. משמעות: הפער "3D רק ב-Teacher-students-mgmt" שתועד בעבר — כבר לא נכון. שני הצדדים יש להם 3D.**

### 1.6 Group Maker Tool — פיצ'ר חדש שלא זוהה בהשוואה המקורית
- קובץ: `src/routes/tools.group-maker.tsx`
- לא נבדק לעומק עדיין — נוסף 13-14 ביולי לפי `list_edits`.

### 1.7 עמודים ציבוריים נוספים שכבר קיימים
- `src/routes/c.$slug.tsx` — עמוד כיתה ציבורי (public class page)
- `src/routes/p.$token.tsx` — כנראה זהו ה-`ParentFeedbackPage` בטוקן שזיהינו בעבר (תואם לתיאור "לינק ציבורי בטוקן, בלי login")
- `src/routes/help.*`, `src/routes/blog.*`, `src/routes/partners.*` — מרכז עזרה, בלוג, שיתופי פעולה — כולם קיימים ומלאים

---

## 2. Task Automation בצד שרת — ✅ הושלם ב-23/7

נבדק בקפידה, כולל קריאה מלאה של `crm-tab.tsx`:
- **יש** מערכת תזכורות מלאה בממשק (`RemindersPanel` בתוך `crm-tab.tsx`) — `listReminders`/`upsertReminder`/`toggleReminderDone`/`deleteReminder`, עם תאריך יעד, סימון "בוצע", והדגשת "overdue" (חישוב `new Date(due_date) < today` **בצד לקוח בלבד**, ברגע הרינדור).
- **אין** קובץ מקביל ל-`checkOverdueTasks`/`dailyTaskReminder`/`lessonReminder` (שקיימים ב-`classflow`) — כלומר שום דבר לא רץ ברקע כדי *ליצור* התראה/מייל כשמשימה מאחרת; המורה חייב לפתוח את המסך כדי לראות שמשהו overdue.
- **אין** `triggers.crons` בקובץ `wrangler.jsonc` — כלומר אין שום Cloudflare Cron Trigger מוגדר בכלל.

**מסקנה מדויקת יותר מאשר קודם:** זה לא "אין תזכורות" — יש תזכורות ידניות מלאות ומנוהלות היטב. **הפער הספציפי הוא רק באוטומציה: אין שום מנגנון שיוזם משהו בלי שהמורה יפתח את האפליקציה** (למשל: שליחת מייל/פוש כשמשימה עברה את תאריך היעד, או תזכורת יומית אוטומטית). זהו הפריט האחרון שבאמת נשאר לסגור.

### מה בוצע בפועל (23 ביולי 2026)
- `wrangler.jsonc`: נוסף `triggers.crons` — ריצה יומית ב-03:00 UTC (≈06:00 בישראל).
- `src/server.ts`: נוסף `scheduled` handler (Cloudflare Workers), קורא ל-`checkOverdueReminders()`, ללא שינוי ב-`fetch` handler הקיים.
- `src/lib/reminder-alerts.server.ts` (קובץ חדש): מוצא reminders עם `completed=false` ו-`due_date <= today`, מסנן דרך טבלת דדופ, מקבץ לפי מורה (`classes.owner_id`), שולף אימייל דרך `supabaseAdmin.auth.admin.getUserById`, ושולח דיגסט אחד למורה (לא מייל נפרד לכל תזכורת). כשל אצל מורה אחד לא עוצר את הריצה עבור השאר.
- מיגרציית Supabase חדשה: טבלת `sent_reminder_alerts` (unique על `reminder_id`) — מונעת שליחה כפולה של אותה תזכורת. הורצה בפועל על ה-DB, ו-`types.ts` התעדכן אוטומטית.
- **מגבלה ידועה שנשארה בכוונה**: אין עדיין ספק מייל מחובר לפרויקט (לא Resend/SendGrid). לכן `sendReminderDigestEmail` כרגע רק כותב ל-console.log מה היה נשלח, ועדיין רושם ל-`sent_reminder_alerts` כדי שכל שרשרת הלוגיקה (dedup כולל) תהיה ניתנת לבדיקה מקצה לקצה. יש TODO ברור בקוד בשם `TODO(email-provider)`. כשיחובר ספק מייל, צריך להחליף רק את גוף הפונקציה הזו.
- אומת ישירות מול קבצי הפרויקט ב-Lovable (לא רק תיאורטית) שכל הקבצים נמצאים במקום הנכון ושה-typecheck עובר נקי.

---

## 3. השוואות שבוצעו קודם מול שאר 5 המאגרים (עדיין רלוונטיות — לא השתנו)

> הערה: ההשוואות הבאות בוצעו מול קלונים של GitHub של Teacher-students-mgmt/classflow/Class-manager/certificates-tool/Cllapilot. אלו **לא** התעדכנו באותה תדירות כמו cuddle-spark-nexus (שכן זה הפרויקט שעודכן ישירות), ולכן סביר שהם עדיין משקפים נכונה את המצב שם. אם יתגלה שגם אחד מהם מחובר ל-Lovable/פלטפורמה חיה אחרת — יש לבדוק שוב באותו אופן.

### 3.1 קשר הורים (הושווה לעומק מול הקוד החי — 23/7)
נקרא `p.$token.tsx` + `parents.functions.ts` במלואם. **הממצא: cuddle-spark-nexus עולה על classflow כאן, לא רק "משלים אותו".**
- ניהול טוקנים מלא בצד המורה: `listParentTokens`/`createParentToken`/`revokeParentToken`/`deleteParentToken` — כולל תיוג (label) לכל טוקן ואפשרות שיוך לתלמיד ספציפי או לכיתה כולה.
- תצוגת הורה מאוחדת: ציונים + נוכחות + נקודות התנהגות + עלונים שבועיים (כולל "חידת השבוע") — הכל במסך אחד, לעומת classflow שפיצל בין `ParentPortalPage` ל-`ParentFeedbackPage`.
- **מנגנון פרטיות מובנה בקוד עצמו**: טוקן ברמת-כיתה (ללא `student_id`) *מכוון בכוונה* להחזיר מערכים ריקים לציונים/נוכחות/התנהגות ומחזיר רק עלונים — יש הערת קוד מפורשת שמסבירה שזה נועד למנוע חשיפת נתוני-שורה של כל תלמידי הכיתה דרך טוקן רחב.
- **מה עדיין חסר לעומת classflow**: מנגנון פידבק/דירוג (כוכבים + טקסט חופשי) מה-`ParentFeedbackPage.jsx` המקורי — **לא נמצא כלל** ב-cuddle-spark-nexus. זהו הפער האמיתי היחיד שנשאר בתחום הזה.
- **סטטוס: הושווה סופית.** לפעולה: להוסיף מנגנון פידבק/דירוג בלבד (component קטן), שאר הפיצ'ר כבר שלם ואף עדיף.

### 3.2 סידור הושבה
- טרם נבדק מול הקוד החי (`seating-logic.ts`/`seating-grid.tsx`) בסבב הזה — עדיין ברשימת המעקב.
- **עדכון 30/7**: הסיור החדש חשף ש-Class-Flow יש כלי אופטימיזציית הושבה עמוקים משמעותית (`StrategicLeadersOptimizer.jsx`, `GroupSeatingOptimizer.jsx`, `ConflictHelper.jsx`) שאין להם מקבילה כלל ב-Harmony Hub — ראה סעיף 10.6.

### 3.3 ציונים (הושווה לעומק מול הקוד החי — 23/7) ✅ סופי
נקראו `grade-ai-import.tsx` + `ai-grades.functions.ts` במלואם. **הממצא: cuddle-spark-nexus כבר עולה על גם classflow וגם certificates-tool בתחום הזה — אינטגרציה מלאה של שלוש שיטות קלט לתוך דיאלוג אחד:**
- **OCR מתמונה** (`ocrGradesImage`) — שולח לגמיני עם רשימת שמות התלמידים בפועל, מבצע "fuzzy matching" לשמות מקוצרים/משובשים/ראשי-תיבות בעברית, מחזיר טקסט מנורמל.
- **קול** (Web Speech API, `he-IL`) — מקליט ומוסיף לאותו תיבת טקסט חופשי.
- **טקסט חופשי** — כל הקלט (מתמונה/קול/הקלדה) עובר דרך `parseGradesFromText`, שמשייך כל שם לתלמיד אמיתי ב-DB עם ציון-ביטחון (`confidence`) ואפשרות תיקון ידני לכל שורה לפני שמירה.
- טיפול נכון בשגיאות מכסה/קרדיטים של Lovable AI Gateway (429/402) בעברית ברורה למשתמש.
- **סטטוס: לא נדרשת פעולה נוספת — הפיצ'ר שלם ומעולה כפי שהוא.**
- **עדכון 30/7**: נוספו גם `ai-exam-generator.functions.ts` (יצירת מבחנים AI) ו-`ai-exam.functions.ts` (סריקת/ניקוד מבחן מצולם) — שניהם קוראים נכון ל-`callLovableAI()` המשותף. ראה סעיף 10.1.

### 3.4 ספרייה/חומרי הוראה
- Teacher-students-mgmt עדיין נראה החזק ביותר (10 קומפוננטות ייעודיות).
- cuddle-spark-nexus יש `teaching-resources.functions.ts` + routes `_authenticated.resources.*`, וגם `bulletin-sync.functions.ts` כולל `generateQuizFromBulletin` (יצירת מבחן חזרה אוטומטי מעלון שבועי, עם חיפוש סמנטי דרך embeddings/`match_resources` RPC) — **פיצ'ר AI שלא היה בשום מאגר אחר שנבדק**.
- **סטטוס: עדיין דורש השוואה ישירה בעומק (לא רק ברמת קבצים) מול Teacher-students-mgmt לפני הכרעה.**
- **עדכון 30/7**: Class-Flow מכיל קומפוננטות עומק נוספות תחת `library/` — `MultiSourceGenerator.jsx`, `ArtifactGenerator.jsx`, `ArtifactRenderer.jsx` — שאין להן מקבילה ב-Harmony Hub. ראה סעיף 10.6.

### 3.5 נוכחות (הושווה לעומק מול הקוד החי — 23/7) ✅ סופי
נקרא `tracking-tab.tsx` במלואו. **הממצא: cuddle-spark-nexus שווה-ערך מלא ל-Teacher-students-mgmt, לא נחות ממנו.**
- **4 סטטוסים בדיוק כמו הצד השני**: present/absent/late/**excused** ("מאושר") — כולל אייקונים וצבעים לכל סטטוס.
- ספירה חיה לכל סטטוס + "לא סומן" (unmarked), כפתורי bulk ("סמן הכל נוכח"/"סמן הכל נעדר").
- טאב הציונים והנוכחות מאוחדים ב-component אחד (`TrackingTab`) עם ה-AI-import (סעיף 3.3) משולב ישירות בתוכו.
- **סטטוס: לא נדרשת פעולה נוספת — שקול לחלוטין ל-Teacher-students-mgmt.**

### 3.6 PWA/Offline
- **עדיין רק ב-Teacher-students-mgmt** (Service Worker אמיתי + IndexedDB). cuddle-spark-nexus הוא TanStack Start + Cloudflare — ארכיטקטורת offline שונה לגמרי תידרש (Service Worker נפרד, לא Firebase-based).
- **עדכון 30/7**: `docs/lms-gap-analysis.md` הפנימי של Harmony Hub מאשר זאת — PWA מסומן ⚠️ ("אין מניפסט ברור ו-service worker"), iOS ואופליין מסומנים ❌.

### 3.7 Embeddings/RAG
- cuddle-spark-nexus כבר יש `embeddings.server.ts` עם **Lovable AI Gateway** (`text-embedding-3-small`, pgvector-ready) — **זה כבר המימוש הנכון ליעד**, אין צורך לייבא מ-Class-manager-from-Gemini-.

### 3.8 Whiteboard
- עדיין קיים רק ב-`Class-manager-from-Gemini-`. לא נמצא ב-cuddle-spark-nexus הנוכחי.

### 3.9 Sound-board
- `_authenticated.sound-board.tsx` קיים ב-cuddle-spark-nexus (89 שורות לפי הבדיקה הקודמת). Teacher-students-mgmt עדיין נראה מפותח יותר (361 שורות).

### 3.10 Kiosk Mode
- עדיין לא קיים בשום מאגר web, כולל cuddle-spark-nexus. נייטיבי בלבד (Android). ידרוש בניה חדשה (Fullscreen API) אם רוצים את זה בדפדפן.

### 3.11 Google Workspace Integration
- טרם אומת מול המצב העדכני של cuddle-spark-nexus — לא נראה קובץ `googleWorkspace`-דומה ברשימת הקבצים שנבדקה. דורש בדיקה נוספת.
- **עדכון 30/7**: `docs/lms-gap-analysis.md` הפנימי מאשר "Google OAuth + Google Search Console" קיימים ("✅"), אך אינטגרציה עם Google Classroom עצמו מסומנת "❌ אין".

---

## 4. משימות שנפתחו בשיחה — ✅ כולן הושלמו (23/7)

1. **בלוגים מובנים (structured logging)**
   - הוספת מערכת `app_logs` בצד שרת והחלפה הדרגתית של `console.log`/`console.error`.
   - **עדכון (23/7): הושלם.** ראה סעיף 2 ומיגרציית `app_logs`.
   - **עדכון 30/7**: אומת מחדש — `src/lib/logger.server.ts` קיים ובנפרד מ-`error-capture.ts` (שתי מנגנונים משלימים, לא כפילות: logger = מבנה לוגים, error-capture = תפיסת קריסות out-of-band).

2. **חיבור OCR → תעודות**
   - לשלב את יכולת ה-OCR שמזהה שמות/מקצועות/ציונים/הליכות/הערות מתמונת תעודה לזרימת ההנפקה, כך שהמורה יערוך וידפיס.
   - **עדכון (23/7, המשך): התברר בבדיקה שהפיצ'ר הזה כבר קיים ומיושם במלואו!** `src/routes/_authenticated.certificates.$classId.tsx` כולל כבר כפתור 'העלה צילום תעודה' לכל תלמיד, שקורא ל-`analyzeCertificatePhoto` (מ-`src/lib/ai-certificate.functions.ts`, קובץ נפרד מ-`ai-grades.functions.ts` שנבדק לראשונה). הפונקציה מזהה שם/מקצועות/ציונים/הליכות/הערות מתמונה, וה-handler `applyOcrToRow` ממזג את התוצאה ישירות לתוך ה-state הניתן לעריכה (`rows`) — בדיוק לפני שהמורה עורך ומדפיס. **אין צורך בפעולה נוספת — המשימה כבר בוצעה בעבר, רק לא תועדה.**

3. **איחוד AI Gateway**
   - לאחד קבצים עם אותו בלוק `fetch` כפול לקריאה מרכזית אחת ל-AI Gateway.
   - **עדכון סופי (23/7): הושלם.** נוצר `src/lib/ai-gateway.server.ts` עם פונקציה משותפת `callLovableAI()` (תומכת ב-messages מולטימודליים, `jsonResponse` אופציונלי, ו-model ניתן לדריסה). כל 5 מופעי הקריאה הכפולה הוחלפו לקרוא לפונקציה המשותפת, תוך שימור מדויק של כל הלוגיקה העסקית (system/user prompts, פרסור JSON, טיפול בתוצאות) בקובץ הקורא עצמו — רק שכבת ה-fetch/headers/error-handling אוחדה. אומת ישירות מול 3 מהקבצים (`ai-gateway.server.ts`, `ai-certificate.functions.ts`, `ai-assistant.functions.ts`) שההתנהגות נשמרה במדויק. Typecheck עובר נקי.
   - **עדכון 30/7**: אומת מחדש שהאיחוד לא נשחק — קבצי AI חדשים שנוספו מאז (`ai-exam-generator.functions.ts`, `ai-exam.functions.ts`) גם הם קוראים נכון ל-`callLovableAI()` ולא יצרו כפילות fetch חדשה.

**סטטוס סופי (23/7): שלוש המשימות הושלמו במלואן.** 1) בלוגים מובנים — הושלם. 2) OCR→תעודות — התברר שכבר היה קיים ומיושם. 3) איחוד AI Gateway — הושלם, 5 קבצים מאוחדים למודול משותף אחד.

## 5. טבלת מעקב מעודכנת

| תחום | מצב ב-Harmony Hub (cuddle-spark-nexus) | פעולה נדרשת |
|---|---|---|
| בולטין שבועי | ✅ קיים | לוודא שלמות מול classflow |
| נעילת PIN | ✅ קיים, מימוש איכותי מאומת | אין צורך בפעולה |
| הגרלה | ✅ קיים | לוודא שלמות מול classflow (confetti, leaderboard) |
| תעודות PDF | ✅ קיים, מאומת לעומק | אין צורך בפעולה |
| תלת-ממד בסידור הושבה | ✅ קיים (חדש, לא ידענו) | לבדוק מנוע/ביצועים |
| **תזכורות/משימות אוטומטיות (cron)** | ✅ **הושלם 23/7** — לוגיקה מלאה, שליחה בפועל ממתינה לחיבור ספק מייל | לחבר ספק מייל (מומלץ Resend) ולהחליף את גוף `sendReminderDigestEmail` |
| קשר הורים (טוקן ציבורי) | ✅ קיים ומעולה, **עדיף על classflow** | להוסיף רק מנגנון פידבק/דירוג (הפער האחרון) |
| ציונים מתמונה (AI) | ✅ קיים ומעולה — OCR+קול+טקסט מאוחדים | אין צורך בפעולה |
| ספרייה/חומרי הוראה | 🟡 קיים חלקית, כולל AI-quiz-from-bulletin ייחודי | להשוות עומק מול Teacher-students-mgmt |
| נוכחות | ✅ קיים, שווה-ערך מלא ל-Teacher-students-mgmt | אין צורך בפעולה |
| PWA/Offline | ❌ חסר (ארכיטקטורה שונה) | דורש מימוש נפרד להתאמת Cloudflare |
| Embeddings/RAG | ✅ קיים ומתאים ליעד | אין צורך בפעולה |
| Whiteboard | ❌ חסר | לייבא מ-Class-manager-from-Gemini- אם רלוונטי |
| Sound-board | 🟡 קיים, פחות מפותח | לשקול שדרוג מול Teacher-students-mgmt |
| Kiosk mode | ❌ לא קיים בשום מאגר web | לבנות מאפס אם נדרש |
| Google Workspace | 🟡 חלקי — OAuth+Search Console קיימים, Classroom חסר | לחבר Google Classroom API אם רלוונטי |
| **RBAC (ניהול תפקידים)** | ✅ **חדש 30/7** — נבנה במלואו | אין צורך בפעולה |
| **מיתוג מוסדי + "הכיתה שלי"** | ✅ **חדש 30/7** | לוודא עם מיכאל שזהו כיוון מכוון |
| **מחולל/סורק מבחנים AI** | ✅ **חדש 30/7** | אין צורך בפעולה |
| **סידור הושבה מתקדם (אופטימיזציה)** | ❌ **חסר** — Class-Flow עולה משמעותית | לשקול העברה מ-Class-Flow |
| **תכנון שבועי גרפי (Weekly Planner Board)** | ❌ **חסר** | קיים רק ב-Class-Flow |

---

## 6. איך להשתמש במסמך הזה מכאן ואילך

1. **תמיד לבדוק קודם מול Lovable API (`get_project`/`list_files`/`read_file`/`list_edits`) על project_id `2734475a-1431-4ef2-8175-67b8af357276`** לפני שמניחים הנחות מה קיים ב-Harmony Hub — ה-GitHub clone שלו עלול להיות מיושן.
2. ה-5 מאגרים האחרים (Teacher-students-mgmt וכו') עדיין ניתן להשוות מול ה-clone הסטטי, אלא אם יתברר שגם הם מחוברים לפלטפורמת build חיה.
3. עדכן טבלה בסעיף 5 מיד כשתחום עובר מ-🟡/❌ ל-✅ בפועל.
4. הקובץ הזה חי גם בתוך `/mnt/user-data/outputs` (קובץ נפרד) — יש להוריד ולשמור גרסה מקומית מפעם לפעם.
5. **הערה 30/7 (מעודכן)**: העדכון הזה הועלה בהצלחה דרך העלאה ידנית ל-branch ה-`main` ב-GitHub, וסונכרן אוטומטית חזרה ל-Lovable (אומת דרך `Lovable:read_file`). מסקנה מעשית: אם בעתיד ל-workspace ייגמרו קרדיטים שוב, ניתן לעדכן את הקובץ הזה גם דרך העלאה ידנית ל-`main` ב-GitHub כפתרון חלופי אמין.

---

## 7. Class-Flow (Base44) — פיצ'רים חדשים — הושלמה בדיקה מלאה (23-26/7)

נבדקו לעומק (קריאת קוד מלאה, לא רק שמות קבצים) כל 6 הפיצ'רים שזוהו בהתחלה מול המצב הנוכחי ב-Harmony Hub. **התוצאה: 4 מתוך 6 כבר קיימים ב-Harmony Hub, חלקם אף עולים על המקור.**

### ✅ קיימים ב-Harmony Hub (אומת בקריאת קוד מלאה):

1. **Analytics** (`_authenticated.analytics.$classId.tsx`) — פורט נאמן כמעט מלא: גרפי קו/עמודות/רדאר, סדר עדיפות מקצועות נשמר ב-localStorage, בדיוק כמו המקור.
2. **Bell Schedule** (`_authenticated.bell-schedule.tsx`) — פורט נאמן מלא: אותם 4 סוגי צליל (קלאסי/צלצול/דיגיטלי/מנגינה), סינתזת Web Audio זהה (ללא קבצי מדיה), לולאת הפעלה בזמן אמת, תצוגת 'הצלצול הבא'.
3. **Exam Scanner** (`_authenticated.exam-scanner.$classId.tsx`) — **עולה על המקור**: כולל גם עריכת ניקוד לכל שאלה במחוון, זיהוי אוטומטי של שם התלמיד מהתמונה עם התאמה מטושטשת (fuzzy) לרשימת הכיתה, ומשוב איכותני (נקודות חוזק/לשיפור) בנוסף לניקוד.
4. **Teacher Insights** — **קיים בגרסה שונה ומכוונת אחרת, לא זהה אך משלימה**: Class-Flow בנה דשבורד למנהל-מערכת שסוקר את כל המורים (`TeacherInsightsPage.jsx`, גישה admin-only). Harmony Hub בנה (`_authenticated.insights.tsx`) דשבורד תובנות אישי לכל מורה על עצמו — סגנון כתיבה, מקצועות מועדפים, קצב יצירת תוכן, מילות מפתח בטקסט. זוהי החלטת מוצר שונה (self-service אישי לעומת admin oversight), לא פער שצריך לסגור.

### ❌ עדיין לא קיימים ב-Harmony Hub (אומת — אין שום route/component מקביל בכל רשימת הקבצים):

5. **Weekly Schedule** (`WeeklySchedulePage.jsx` ב-Class-Flow, 503 שורות) — לוח שיעורים שבועי ניתן לעריכה (גרירה/הוספה לפי יום ושעה), עם קישור לפריטי ספרייה, ותצוגת Mobile יומית + Desktop שבועית מלאה. **אין מקביל כלל ב-Harmony Hub.**
6. **Student View** (`StudentViewPage.jsx` ב-Class-Flow, 56 שורות) — מסך תצוגה פשוט לתלמידים עצמם (למשל להצגה על מסך בכיתה): רק שמות פרטיים בכרטיסיות, בכוונה **ללא כל מידע רגיש** (הערת קוד מפורשת: 'Only show name - no sensitive data'). **אין מקביל כלל ב-Harmony Hub.**

**סטטוס: הבדיקה הושלמה. שני פערים אמיתיים בלבד נותרו (Weekly Schedule, Student View), שניהם קטנים יחסית ומתועדים כאן בפירוט לביצוע עתידי במידת הצורך.**

> **עדכון 30/7**: הסיור המקיף החדש חשף פערים נוספים ועמוקים יותר מעבר לשניים אלו — ראה סעיף 10.6 (כלי אופטימיזציית הושבה, מחוללי תוכן ממקורות מרובים, כלי ניהול-על מוסדי, לוח תכנון שבועי גרפי).

---

## 8. מיזוג נתונים (Class-Flow ↔ Harmony Hub) — מסמך תכנון נפרד

נוצר מסמך ייעודי `DATA_MERGE_MAPPING.md` (לא בריפו הזה — קובץ נפרד, ניתן להעברה בנפרד לפי הצורך) הכולל: מיפוי שדות מלא בין סכימת `Student`/`Grade`/`Attendance`/`BehaviorEvent`/`ParentContact` של Class-Flow לבין הטבלאות המקבילות ב-Harmony Hub, זיהוי הבדלים ארכיטקטוניים משמעותיים (למשל: BehaviorEvent הוא יומן-אירועים מפורט לעומת behavior_points שהוא מונה מצטבר בלבד — לא ניתן למיזוג ישיר בלי אובדן מידע), והמלצות זהירות לטיפול בשדות רגישים על קטינים (`special_needs`, `traits`, `custom_conditions`). **הוחלט במפורש: זהו שלב תכנון/מיפוי בלבד. לא בוצע ולא יבוצע שום שינוי אוטומטי בנתוני תלמידים אמיתיים ללא אישור מפורש, שלב אחר שלב.**

---

## 9. עדכונים חדשים ב-Class-Flow (Base44) — 26/7, נבדק ישירות דרך git log

בדיקה ישירה של ה-commit history הראתה **15 קומיטים מהיום (26/7/2026)**, כולם על ידי `base44-builder[bot]` — כלומר פיתוח פעיל ישירות ב-Base44 (בדיוק כמו שקרה עם Harmony Hub ב-Lovable). שני תחומים משמעותיים:

### 9.1 זרימת הרשמת מורים חדשה עם קוד גישה — פיצ'ר שלם וחדש
- **`Register.jsx`** (290 שורות, כמעט קובץ חדש) — הרשמה עצמאית: מייל/סיסמה + אימות OTP, עם שדה אופציונלי ל"קוד גישה" בזמן ההרשמה.
- **`linkTeacher/entry.ts`** (function חדשה) — כשמורה מזין קוד גישה תקף, הפונקציה (בהרצת service-role, עוקפת RLS בכוונה כי `user_id` עדיין לא מוגדר בשלב הזה) מקשרת את המשתמש שנרשם לרשומת `Teacher` קיימת (שנוצרה מראש על ידי admin דרך `TeacherFormModal.jsx`), ומעדכנת אוטומטית את `teacher_user_id` בכל הכיתות המשויכות לאותו מורה.
- **שינויי RLS מקבילים ב-`Teacher.jsonc`**: `user_id` הפך מ-required ל-optional (מאפשר ליצור רשומת מורה לפני שיש חשבון מקושר), ומדיניות ה-`update` הורחבה בחזרה מ-admin-only ל-admin **או** המורה עצמו.
- **סטטוס: זוהה בלבד. פיצ'ר שלם ומשמעותי (self-service onboarding למורים) שלא היה קיים בהשוואה המקורית. לא נבדק אם/כמה רלוונטי להעביר ל-Harmony Hub — Harmony Hub כבר משתמש ב-Supabase Auth שיש בו זרימת הרשמה שונה מובנית.**
- **עדכון 30/7**: אומת מחדש מול הקוד החי — `linkTeacher/entry.ts` בנוי נכון (בדיקת `access_code` + `is_active`, עדכון `teacher_user_id` בכל הכיתות המשויכות). ראה גם 10.5 — הניתוב ב-`App.jsx` תקין ואין דפים יתומים.

### 9.2 תיקון אבטחה אמיתי ב-bulletinFeedback (טוקן משוב הורים)
- **הבעיה שתוקנה היום**: אם `BASE44_APP_ID` לא היה מוגדר, הקוד הישן חזר בשקט ל-secret קבוע וציבורי בקוד המקור (`"bulletin-fallback-secret"`) ליצירת טוקן HMAC — כלומר כל מי שקורא את הקוד יכול לזייף טוקן משוב תקף.
- **התיקון**: משתנה סביבה ייעודי חדש `BULLETIN_TOKEN_SECRET`, וכשלא מוגדר — הפונקציה **נכשלת בקול** (`throw Error`) במקום לחזור לברירת מחדל לא-מאובטחת.
- זה מאשש ומחזק: מנגנון טוקן משוב ההורים ב-Class-Flow (`bulletinFeedback`, ה"פער" שזוהה ב-3.1 לגבי Harmony Hub) הוא אכן פעיל ומטופל ברצינות אבטחתית (משתמש בהשוואת HMAC בזמן קבוע — timing-safe — בדיוק כמו ה-PIN-hash ב-Harmony Hub).
- **סטטוס: תיקון אבטחה תועד. לא דורש פעולה ב-Harmony Hub (אין לו את הפיצ'ר הזה כלל עדיין).**
- **⚠️ עדכון 30/7 — סתירה שיש לשים לב אליה**: בסיור החדש נמצא ש-`pinSecurity/entry.ts` (פונקציה אחרת לגמרי, לא bulletinFeedback) **עדיין** משתמש ב-`BASE44_APP_ID` כ-secret קבוע לכל המשתמשים, ללא ה-fail-safe שנוסף כאן ל-bulletinFeedback. כלומר התיקון האבטחתי מ-26/7 טופל רק במקום אחד (bulletinFeedback) ולא הוחל על pinSecurity. ראה פירוט מלא בסעיף 10.3.

---

## 10. סיור מקיף 30/7 — מצב חי מעודכן + תיקון אבחנה קריטי + פערי אבטחה

בוצע סיור שיטתי ישירות מול Lovable API (`list_edits`, `list_files`, `read_file`) ומול Base44 (`list_directory`, `read_file`, `list_connectors`, `query_entities`). **הפרויקט ב-Lovable התקדם מאוד מאז 23/7** — יותר מ-15 commits חדשים עד 30/7 כולל שינוי מיתוג אסטרטגי.

### 10.1 Harmony Hub — עדכונים שלא היו מתועדים

**RBAC מלא נבנה** (`docs/rbac-roles.md`, `src/lib/user-roles.functions.ts`) — היה "❌ חסר" לפי `docs/lms-gap-analysis.md` הישן, עכשיו קיים בפועל.

**מסמך פערים עצמי חדש**: `docs/lms-gap-analysis.md` — המערכת עצמה מתעדת 8 קטגוריות LMS עם סטטוס ✅/⚠️/❌. תמצית הפערים שהמערכת מודה בהם:
- Google Classroom/Moodle integration — ❌ אין
- Push notifications / SMS — ❌ אין
- צ'אט/פורום צוות מורים — ❌ אין
- דוחות ברמת מוסד/מחוז — ❌ אין
- iOS app + offline מלא — ❌ אין
- שיתוף משאבים בין מורים/מוסדות — ⚠️ חלקי (משאבים כרגע שייכים למורה בודד בלבד)

**שינוי מיתוג אסטרטגי**: `src/components/torah-logo.tsx`, שם מוצר חדש "הכיתה שלי" (`hakita-sheli-implementation-guide.html/pdf`), ערכת נושא ייעודית. **יש לוודא עם מיכאל שזהו כיוון מכוון ולא drift לא-מתוכנן.**

**פיצ'רי AI חדשים** שלא היו במסמך: `ai-exam-generator.functions.ts` (יצירת מבחנים — שאלות פתוחות+אמריקאיות, ניקוד אוטומטי מנורמל), `ai-exam.functions.ts` (סריקת/ניקוד מבחן מצולם), `ai-pedagogical.functions.ts`, `ai-poll.functions.ts`, `ai-weekly-summary.functions.ts`. **נבדק ואומת**: כל אלו קוראים נכון ל-`callLovableAI()` המשותף — האיחוד מ-23/7 נשמר ולא נשחק.

**Anti-spam server** (`anti-spam.server.ts` + `anti-spam-config.functions.ts`) — הגנה חדשה שלא הייתה מתועדת.

**קבצים חדשים נוספים לאימות עתידי** (לא נבדקו לעומק הפעם — ברשימת מעקב): `checklist-leads.functions.ts`, `data-export.functions.ts`, `class-events.functions.ts`, `polls.functions.ts`, `topics.functions.ts`, `weekly-schedule.functions.ts`, `certificate-notes.functions.ts`, `seating-wizard.functions.ts` + `seating-wizard-prefs.functions.ts`, `reminder-preferences.functions.ts` + `reminder-preferences-card.tsx` (הרחבה על מנגנון ה-cron מ-23/7 — כנראה מאפשר למורה לקבוע העדפות תזכורת).

**Migrations**: 95+ קבצי מיגרציה ב-`supabase/migrations/`, כולל 3 מ-30/7 עצמו — קצב הפיתוח גבוה ומתמשך.

### 10.2 Class-Flow (Base44) — תיקון אבחנה קריטי לגבי registerDriveWatch

**המסמך הישן (סעיף שהוחלף) קבע שהבעיה היא `createClientFromRequest(req)` לא מקבל טוקן אימות כראוי דרך cookie. זו הייתה אבחנה שגויה.** נבדק ישירות מול הקוד ומול מצב ה-connector בפועל:

- Google Drive connector מחובר עם **scope `drive.readonly` בלבד** (אומת דרך `list_connectors`).
- `registerDriveWatch/entry.ts` קורא ל-`POST https://www.googleapis.com/drive/v3/changes/watch` — זו פעולת **כתיבה** (יצירת ערוץ webhook) שדורשת הרשאה מעבר ל-readonly.
- Google מחזירה כנראה 403 (insufficient scope) על הקריאה הזו; קוד ה-`catch` הגנרי בפונקציה תופס את זה ומחזיר 500 ללא הבחנה מסיבת השגיאה האמיתית.
- **המסקנה הנכונה**: התיקון הנדרש הוא **הרחבת ה-scope של ה-Google Drive connector** (מ-readonly לכתיבה/ניהול), לא תיקון triaging של טוקן/cookie. ה-קוד של הפונקציה עצמו תקין ובנוי נכון (אימות admin, גזירת webhook address מה-URL בלבד למניעת exfiltration, ניהול נכון של `SyncState`).
- `syncDriveStudentDocs` (הפונקציה שמקבלת את ה-webhook עצמו) פועלת נכון עם readonly כי היא רק *קוראת* שינויים — היא לא הבעיה.

**פעולה נדרשת**: להרחיב את הרשאות ה-Google Drive connector ב-Base44 dashboard לכלול scope שמאפשר `changes.watch` (למשל `drive` המלא, לא `drive.readonly`), ואז להריץ מחדש את `registerDriveWatch`.

### 10.3 פער אבטחה חדש שזוהה: PIN hashing ב-Class-Flow חלש יותר מ-Harmony Hub

- **Harmony Hub** (`security.functions.ts`): salt רנדומלי 16 בית **לכל משתמש בנפרד** + SHA-256 + `timingSafeEqual`. חזק.
- **Class-Flow** (`pinSecurity/entry.ts`): ה-HMAC secret הוא `Deno.env.get("BASE44_APP_ID")` — **אותו secret קבוע לכל המשתמשים במערכת כולה**, וזהו ערך (App ID) שבמידה מסוימת ניתן לחשיפה/ניחוש בהשוואה לסוד ייעודי. משמעות בפועל: אם ה-App ID ידלוף או ייחשף, ניתן לבצע brute-force offline על כל ה-PINs של כל המורים במערכת בבת אחת (לא רק על משתמש בודד).
- **חשוב לציין לחיוב**: הקוד עצמו איכותי בהיבטים אחרים — משתמש ב-`asServiceRole` נכון לעקיפת RLS controlled, ומבצע `timingSafeEqual`-style השוואה (`safeEqual`) נכונה נגד timing attacks. הבעיה ממוקדת רק בבחירת ה-secret, לא בשאר הלוגיקה.
- **הערה חשובה**: תיקון אבטחה דומה כבר בוצע ב-26/7 עבור `bulletinFeedback` (החלפת fallback-secret קבוע ב-secret ייעודי שנכשל בקול אם חסר) — אבל התיקון **לא הוחל** על `pinSecurity`. יש כאן חוסר עקביות בין שני מנגנוני אבטחה באותו קודבייס.
- **פעולה מומלצת (לא בוצעה)**: להחליף ל-secret ייעודי אקראי (Deno secret נפרד, לא App ID), ורצוי גם salt פר-משתמש כמו ב-Harmony Hub. כדאי ליישם באותו דפוס שכבר הוכח ב-`bulletinFeedback`.

### 10.4 פיצ'ר שנבנה אך לא בשימוש בפועל: PendingUpdate

- Entity `PendingUpdate` ב-Class-Flow — מנגנון "אשר לפני ביצוע" לפקודות AI (קול/טקסט/העלאת קובץ) שיוצרות שינויים באמת (הוספת תלמיד, סימון נוכחות, הוספת ציון וכו').
- הסכימה בנויה היטב (RLS תקין, `intent` enum מסודר, שדות ביקורת `reviewed_at`/`review_notes`).
- **נבדק בפועל מול הדאטה החי (`query_entities`): 0 רשומות קיימות.** המשמעות: הפיצ'ר קיים בקוד אבל **מעולם לא הופעל בפרודקשן**, או הוזנח אחרי הבנייה. כדאי לברר עם מיכאל אם זהו פיצ'ר בפיתוח-בתהליך שצריך להשלים חיבור UI אליו, או קוד מת שאפשר להסיר.

### 10.5 סיור ניתוב (App.jsx ב-Class-Flow) — תקין, ללא דפים יתומים

נבדק `src/App.jsx` במלואו (278 שורות). כל הדפים (~50+) ממופים כראוי ל-routes תקינים תחת `ProtectedRoute`, כולל lazy-loading נכון, טיפול בכפתור back של Android/iOS WebView דרך postMessage, ו-PIN lock ברמת אפליקציה שלמה. **לא נמצאו דפים מיובאים-אך-לא-מנותבים או ניתובים שבורים.**

### 10.6 יכולות עומק ב-Class-Flow שעדיין אין להן מקבילה כלל ב-Harmony Hub

מעבר לשניים שכבר תועדו בסעיף 7 (Weekly Schedule, Student View), הסיור הנוכחי חשף רשימה רחבה יותר של קומפוננטות עומק, כולן קיימות רק ב-Class-Flow:
- `StrategicLeadersOptimizer.jsx`, `GroupSeatingOptimizer.jsx`, `ConflictHelper.jsx` — כלי אופטימיזציית הושבה מתקדמים משמעותית מעבר למה שיש ב-`seating-logic.ts` של Harmony Hub.
- `MultiSourceGenerator.jsx`, `ArtifactGenerator.jsx`, `ArtifactRenderer.jsx` (בתוך `library/`) — יצירת תוכן לימודי ממקורות מרובים.
- `TeacherStyleDashboard`/`TeachingStyleOverview.jsx`/`PreMeetingBriefing.jsx` (תחת `admin/`) — כלים לניהול-על ברמת מוסד, לא רק פרטני.
- `WeeklyPlannerBoard.jsx` (28KB, הגדול מבין קבצי הקומפוננטות) — לוח תכנון שבועי גרפי.

**המלצה**: לפני שממשיכים בהעברת פיצ'רים בודדים, שווה להחליט אם Class-Flow הוא כעת "מקור עומק" נפרד ומכוון (לניהול-על מוסדי) ולא רק "גרסה מוקדמת" של Harmony Hub — הקוד מראה שהוא המשיך להתפתח בכיוון משלים (admin/מוסד) ולא רק כפילות.

---
