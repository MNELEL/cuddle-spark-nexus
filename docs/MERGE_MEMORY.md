# MERGE_MEMORY.md
> מסמך זיכרון קבוע לפרויקט מיזוג האפליקציות. עדכן אותו בכל שיחה חדשה כדי לא לאבד החלטות.
> יעד סופי: **Lovable**. הפרויקט החי: **"Harmony Hub"** (repo: `cuddle-spark-nexus`), פרויקט Lovable ID `2734475a-1431-4ef2-8175-67b8af357276`.

**עדכון אחרון:** 23 ביולי 2026 — **עודכן אחרי בדיקה ישירה מול Lovable API (לא רק GitHub)**
**עדכון נוסף:** 23 ביולי 2026, בסמוך לכך — הושלמה משימת ה-Task Automation (ראה סעיף 2).
**עדכון נוסף:** 2 באוגוסט 2026 — נבדק `Teacher-students-management-interface` ישירות מול ה-git clone (לא רק שמות קבצים). נמצאו מספר פיצ'רים חדשים/לא-מתועדים, כולל commit מאותו יום ממש. ראה סעיף 6 החדש.
**עדכון נוסף:** 2 באוגוסט 2026, בסמוך לכך — עודכן `docs/lms-gap-analysis.md` הפנימי של Harmony Hub: תוקן סעיף RBAC (היה ❌, אומת כ-✅ מיושם), נוסף סעיף 9 חדש (Circuit Breaker ל-AI Gateway), נוספה שורת שקלול ציונים. **בוצע דרך ה-workaround המתועד**: הקובץ הוכן מקומית והועבר למשתמש להעלאה ידנית ל-GitHub `main` (Lovable `send_message` נתקל בדרישת אישור נפרדת/לא זמינה באותו רגע) — סנכרון דו-כיווני של Lovable אמור למשוך את זה אוטומטית לאחר ה-commit. **טרם אומת** שההעלאה בפועל בוצעה — יש לוודא בשיחה הבאה ש-`docs/lms-gap-analysis.md` בלובאבל אכן משקף את הגרסה המעודכנת (`read_file` על הנתיב), ולא רק להניח שהסנכרון קרה.

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
- **מה עדיין חסר לעומת classflow**: מנגנון פידבק/דירוג (כוכבים + טקסט חופשי) מה-`ParentFeedbackPage.jsx` המקורי — **לא נמצא כלל** ב-cuddle-spark-nexus. זהו הפער האמיתי היחיד שנשאר בתחום הזה (הוחלט להשאיר כרגע, לא בעדיפות).
- **סטטוס: הושווה סופית.**

### 3.2 סידור הושבה
- טרם נבדק מול הקוד החי (`seating-logic.ts`/`seating-grid.tsx`) בסבב הזה — עדיין ברשימת המעקב.

### 3.3 ציונים (הושווה לעומק מול הקוד החי — 23/7) ✅ סופי
נקראו `grade-ai-import.tsx` + `ai-grades.functions.ts` במלואם. **הממצא: cuddle-spark-nexus כבר עולה על גם classflow וגם certificates-tool בתחום הזה — אינטגרציה מלאה של שלוש שיטות קלט לתוך דיאלוג אחד:**
- **OCR מתמונה** (`ocrGradesImage`) — שולח לגמיני עם רשימת שמות התלמידים בפועל, מבצע "fuzzy matching" לשמות מקוצרים/משובשים/ראשי-תיבות בעברית, מחזיר טקסט מנורמל.
- **קול** (Web Speech API, `he-IL`) — מקליט ומוסיף לאותו תיבת טקסט חופשי.
- **טקסט חופשי** — כל הקלט (מתמונה/קול/הקלדה) עובר דרך `parseGradesFromText`, שמשייך כל שם לתלמיד אמיתי ב-DB עם ציון-ביטחון (`confidence`) ואפשרות תיקון ידני לכל שורה לפני שמירה.
- טיפול נכון בשגיאות מכסה/קרדיטים של Lovable AI Gateway (429/402) בעברית ברורה למשתמש.
- **הערה לגבי בקשה עתידית**: עדיין אין חיבור ישיר בין ה-OCR הזה למסך התעודות (`certificates.$classId.tsx`) — עלייה חדשה תיצור/תעדכן ציונים בטבלה, אבל אין עדיין כפתור "העלה דף ציונים" בתוך זרימת התעודות עצמה. זו בקשה שעלתה בשיחה ולא בוצעה עדיין.
- **סטטוס: הפיצ'ר הבסיסי שלם ומעולה. חיבור לזרימת התעודות טרם בוצע.**

### 3.4 ספרייה/חומרי הוראה
- Teacher-students-mgmt עדיין נראה החזק ביותר (10 קומפוננטות ייעודיות).
- cuddle-spark-nexus יש `teaching-resources.functions.ts` + routes `_authenticated.resources.*`, וגם `bulletin-sync.functions.ts` כולל `generateQuizFromBulletin` (יצירת מבחן חזרה אוטומטי מעלון שבועי, עם חיפוש סמנטי דרך embeddings/`match_resources` RPC) — **פיצ'ר AI שלא היה בשום מאגר אחר שנבדק**.
- **סטטוס: עדיין דורש השוואה ישירה בעומק (לא רק ברמת קבצים) מול Teacher-students-mgmt לפני הכרעה.**

### 3.5 נוכחות (הושווה לעומק מול הקוד החי — 23/7) ✅ סופי
נקרא `tracking-tab.tsx` במלואו. **הממצא: cuddle-spark-nexus שווה-ערך מלא ל-Teacher-students-mgmt, לא נחות ממנו.**
- **4 סטטוסים בדיוק כמו הצד השני**: present/absent/late/**excused** ("מאושר") — כולל אייקונים וצבעים לכל סטטוס.
- ספירה חיה לכל סטטוס + "לא סומן" (unmarked), כפתורי bulk ("סמן הכל נוכח"/"סמן הכל נעדר").
- טאב הציונים והנוכחות מאוחדים ב-component אחד (`TrackingTab`) עם ה-AI-import (סעיף 3.3) משולב ישירות בתוכו.
- **סטטוס: לא נדרשת פעולה נוספת — שקול לחלוטין ל-Teacher-students-mgmt.**

### 3.6 PWA/Offline
- **עדיין רק ב-Teacher-students-mgmt** (Service Worker אמיתי + IndexedDB). cuddle-spark-nexus הוא TanStack Start + Cloudflare — ארכיטקטורת offline שונה לגמרי תידרש (Service Worker נפרד, לא Firebase-based).

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

---

## 4. משימות שנפתחו בשיחה ועדיין פתוחות (23/7, אחרי השלמת ה-cron)

לפי בקשה מפורשת: להתמקד רק ב-automation (הושלם, סעיף 2). לא לגעת בפידבק/דירוג הורים. שלוש בקשות חדשות שעלו ועדיין לא בוצעו:

1. **בלוגים מובנים (structured logging)**: קיים היום רק `src/lib/error-capture.ts` — מנגנון צר לתפיסת קריסות בודדות (500 errors), לא מערכת logging אמיתית. יש להטמיע: טבלת `app_logs` ב-Supabase (level/timestamp/context/user_id/message) + helper מרכזי (`logEvent()` או דומה) שיוחלף בהדרגה במקום כל ה-`console.error`/`console.log` הבודדים המפוזרים בקוד היום.

2. **חיבור OCR→תעודות**: לחבר בין `ocrGradesImage`/`parseGradesFromText` (הקיימים ב-`ai-grades.functions.ts`) לבין מסך `certificates.$classId.tsx` — להוסיף אפשרות "העלה דף ציונים/תעודה" ישירות במסך התעודות, שמזהה שמות+ציונים אוטומטית ומעדכן את הנתונים, **לפני** שהמורה עורך (מקצועות/הערות/הליכות — זה כבר קיים) ומדפיס.

3. **איחוד קוד — פונקציות AI Gateway כפולות**: אותו בלוק בדיוק (`fetch` ל-`https://ai.gateway.lovable.dev/v1/chat/completions` + טיפול שגיאות 429/402) חוזר על עצמו היום ב**-4 מקומות שונים**: `ai-grades.functions.ts` (פעמיים — ב-`ocrGradesImage` וב-`parseGradesFromText`), `bulletin-sync.functions.ts` (`generateQuizFromBulletin`), ו-`ai-assistant.functions.ts`. יש ליצור קובץ משותף חדש `src/lib/ai-gateway.server.ts` עם פונקציה אחת `callLovableAI()`, ולהחליף את כל 4 מופעי הקוד הכפול לקרוא לה במקום לשכפל את הלוגיקה.

**סטטוס: שלוש המשימות הנ"ל טרם בוצעו — ברשימת העבודה הבאה.**

---

## 6. ממצאים חדשים מ-Teacher-students-management-interface — נבדק ישירות מול git clone (2/8/2026)

> **שיטת בדיקה:** בוצע `git clone` מלא של המאגר וקריאת `git log` + `git show` על הקומיטים האחרונים, ולא רק סקירת שמות קבצים. זה חשוף פיצ'רים שלא היו מתועדים כלל, כולל אחד מאותו יום.

### 6.1 מתכנן שיעורים שבועי (Weekly Lesson Planner) — 🆕 חשוב, לא קיים ב-Harmony Hub
- קובץ: `src/components/planner/WeeklyLessonPlanner.tsx` (1173 שורות, נוסף ב-commit `fb460c4`, **2/8/2026 08:37** — אותו יום כמו הבדיקה).
- לוח שבועי אמיתי עם ימים (א'-ו') × 6 שיעורים, drag & drop מלא (`handleDragStart`/`handleDragOver`/`handleDrop`).
- 3 מקורות תוכן נגררים: תוכנית לימודים מובנית (curriculum topics לפי מקצוע: משנה/גמרא/הלכה/תנ"ך/חשבון/עברית/מדעים), ספריית חומרים (`library` collection ב-Firestore, `onSnapshot` בזמן אמת), ומטלות שיעורי בית (`homework` collection, גם realtime).
- שמירה אוטומטית ל-`localStorage` לפי שבוע (`smartclass_weekly_planner_slots_v2_w{offset}`), אפשרות ליצור מטלת ש"ב חדשה ישירות מתוך תא בלוח, מצב הדפסה (`window.print()`).
- **המלצה: זה הפער האמיתי הכי גדול היום מול Harmony Hub.** יש שם `_authenticated.lessons` וכו', אבל לא נראה מתכנן-שבועי ויזואלי בסגנון גרירה. שווה השוואה ישירה מול הקוד החי בלובאבל לפני החלטה על יבוא.

### 6.2 Circuit Breaker ל-Gemini API — רעיון ארכיטקטוני שכדאי לשקול, לא רק קוד להעתקה
- `server.ts`, commit `ef849b2` (23/7/2026).
- state tracking גלובלי (`geminiServiceState`: `active`/`exhausted`/`invalid_key`/`permission_denied`) שמזהה מכסה שאזלה / מפתח דלוף / הרשאה חסומה מתוך הודעת השגיאה, "זוכר" את זה, ומנתב אוטומטית לפונקציית fallback מקומית (סימולציה פדגוגית) בלי לנסות שוב את ה-API עד לאתחול השרת.
- **רלוונטי ל-Harmony Hub**: יש כבר `callLovableAI()` מאוחד (ראה סעיף 4.3 המקורי, כבר בוצע) — אפשר להוסיף לו בדיוק את אותו רעיון של state tracking כדי לא להמשיך לנסות קריאות API כשכבר ידוע שהמכסה אזלה, במקום רק error handling נקודתי לכל קריאה.

### 6.3 פידבק פדגוגי AI לתלמיד בודד — יש רעיון טוב, אבל יש גם באג בקוד המקור
- `src/components/StudentProfileDetail.tsx`, אותו commit `fb460c4`.
- כפתור "מלא באמצעות AI פדגוגי ✨" ששולח את נתוני התלמיד (נוכחות, ביצועים, תגמולים, הערות התנהגות) ומחזיר טיוטת הערה מותאמת אישית שהמורה יכול לערוך.
- ⚠️ **באג קיים בקוד המקור**: הפונקציה `handlePopulateAiReport` קוראת קודם ל-endpoint שגוי `/api/api/report` (עם הערת קוד "Wait, let's verify if the endpoint is /api/ai/report") ורק בפתרון fallback (status 404) קוראת לנתיב הנכון `/api/ai/report`, שאכן קיים בשרת (`server.ts` שורה 1708). **אם מייבאים את הרעיון ל-Lovable — יש לתקן ולקרוא ישירות לנתיב הנכון, לא להעתיק את ה-fallback המסורבל.**

### 6.4 googleWorkspace.ts — מאשר את מה שסעיף 3.11 (הישן) סימן כ"טרם אומת"
- קובץ: `src/lib/googleWorkspace.ts`, 379 שורות. **קיים בפועל** (בניגוד למצב שתועד קודם שבו לא היה ברור אם יש כזה).
- כולל: `googleSignIn`/`googleLogout` (OAuth), `exportStudentsToGoogleSheets`, `createReportInGoogleDocs`, `createStudentAwardSlides` (יצירת שקופיות פרס לתלמיד), `syncParentToGoogleContacts`.
- **סטטוס: עדיין לא הושווה מול Harmony Hub — האם יש שם משהו מקביל. ברשימת המעקב.**

### 6.5 שרת AI מורחב מאוד — 20 endpoints שונים
- `server.ts` כולל כיום `/api/ai/parse-file`, `/api/ai/sort`, `/api/ai/layout-suggestion`, `/api/ai/parse-text-students`, `/api/ai/parse-grades-feedback`, `/api/ai/suggest-notes`, `/api/ai/report`, `/api/ai/analyze-lesson`, `/api/ai/organize-materials`, `/api/ai/tag-material`, `/api/ai/link-resource-bulletin`, `/api/ai/transcribe-lesson`, `/api/ai/summarize-transcript`, `/api/ai/improve-transcript`, `/api/ai/generate-lesson-assets`, `/api/ai/recompute-style-profile`, `/api/ai/generate-lesson-plan`, `/api/ai/generate-quiz`, `/api/ai/mood-reflection`, `/api/ai/weekly-digest`.
- זה עשיר משמעותית ממה שתועד קודם. חלק חופפים לפיצ'רים שכבר יובאו (OCR ציונים, generateQuizFromBulletin), אבל **תמלול שיעור + שיפור תמלול + "mood reflection"** לא זוהו קודם כקיימים ב-Harmony Hub. דורש בדיקה שיטתית endpoint-by-endpoint מול מה שכבר קיים בלובאבל, לא רק סריקת שמות.

### 6.6 ניתוח קול (Voice Analysis) בכלי ניתוח השיעור
- `src/pages/LessonAnalyzerPage.tsx`, commit `31fd742`. מדדי איכות אודיו (רעש רקע, בהירות, מספר דוברים) עם ציון איכות, לצד ניתוח תוכן השיעור עצמו.

### 6.7 שקלול ציונים גמיש (Grade Weighting)
- `src/pages/GradesPage.tsx`, commit `fb460c4`. פאנל UI לקביעת משקל לכל מבחן/קטגוריה (`categoryWeights`), נשמר ב-Firestore (`grade_weights` doc בתוך settings). לא זוהה מקביל ב-Harmony Hub עד כה — שווה בדיקה.

### 6.8 עדכון קריטי — אומת מול Lovable החי ב-2/8/2026, אחרי כתיבת סעיף 6 המקורי

> **הפרויקט שינה שם**: כרגע נקרא **"הכיתה שלי"** (`hakita-sheli`) ב-`package.json`/כותרות דפים, לא "Harmony Hub". ה-project_id ב-Lovable נשאר זהה (`2734475a-1431-4ef2-8175-67b8af357276`). יש לעדכן התייחסות בשיחות הבאות.

בדיקה ישירה (`list_files` + `read_file` בפועל, לא רק שמות) העלתה שרוב ההמלצות המקוריות בסעיף 6 **כבר מיושמות ב-Harmony Hub, לעיתים ברמה גבוהה יותר מ-ClassAlign**:

| פריט מסעיף 6 | סטטוס אמיתי ב-Harmony Hub |
|---|---|
| 6.1 מתכנן שבועי | ✅ **קיים ומתקדם יותר**. `src/routes/_authenticated.weekly-schedule.$classId.tsx` + `src/lib/weekly-schedule.functions.ts`. בנוי עם `@dnd-kit/core` (drag & drop אמיתי בין תאים), שמירה ב-Supabase (טבלת `weekly_lessons`, מיגרציה מ-26/7/2026) ולא רק localStorage, קישור לפריטי ספריית משאבים (`library_item_id`), דיאלוג הוספה/עריכה מלא. **אין צורך ביבוא — ההפך, זה עולה על מקבילו ב-ClassAlign.** |
| 6.3 פידבק פדגוגי AI | ✅ **קיים וברמה גבוהה יותר**, אך בהיקף שונה. `src/lib/ai-pedagogical.functions.ts` (`buildPedagogicalReport`) מפיק ניתוח **כיתתי** מלא (מקצועות חזקים/חלשים, קטגוריות התנהגות ומשמעת, נוכחות, מגמה שבועית) — בעוד ה-ClassAlign היה פידבק ל**תלמיד בודד** בלבד, ועם באג ב-endpoint (ראה 6.3 המקורי). אין מה לייבא מ-ClassAlign כאן; אם יש ערך ב"פידבק לתלמיד בודד" כפיצ'ר נפרד (המשלים את הדוח הכיתתי), אפשר לשקול בעתיד כתוספת ולא כתחליף. |
| user_roles / RBAC | ✅ **קיים ומיושם באופן מלא**, בסתירה למה שכתוב ב-`docs/lms-gap-analysis.md` הפנימי של הפרויקט (שמסמן ❌ חסר — **המסמך עצמו לא מעודכן**). יש `src/lib/user-roles.functions.ts` עם `assignRole`/`removeRole`/`bootstrapFirstAdmin`/`getMyRoles`, טבלת `user_roles` עם תפקידים `admin`/`principal`/`teacher`/`secretary`, ומסך `_authenticated.user-management.tsx`. |
| 6.7 שקלול ציונים גמיש | ❓ **לא נמצא אישור קיום**. נבדק `src/lib/ai-grades.functions.ts` — עוסק ב-OCR וחילוץ ציונים מטקסט/תמונה, ללא מנגנון שקלול קטגוריות. ייתכן שקיים במקום אחר (component צד-לקוח) — טרם נבדק `GradesTab`-מקביל בלובאבל. **עדיין מועמד סביר ליבוא, בכפוף לבדיקה נוספת.** |
| 6.2 Circuit breaker ל-Gemini | ❓ טרם נבדק ישירות מול `ai-gateway.server.ts` הקיים. **נשאר כמועמד לבדיקה/יבוא.** |
| 6.4 googleWorkspace.ts | ❓ טרם הושווה מול המקביל בלובאבל (אם יש). נשאר ברשימת המעקב כפי שסומן במקור. |
| 6.5 שרת AI עם 20 endpoints | חלקית רלוונטי — ב-Harmony Hub יש כבר קבצי `ai-*.functions.ts` ייעודיים רבים (`ai-pedagogical`, `ai-grades`, `ai-exam`, `ai-exam-generator`, `ai-certificate`, `ai-poll`, `ai-weekly-summary`, `ai-assistant`) שמכסים חלק ניכר מהרשימה. תמלול שיעור ("mood reflection" וכו') טרם אומת ספציפית. |

### 6.9 בדיקה סופית של שני הפריטים הפתוחים (2/8/2026, המשך אותה בדיקה)

**Circuit breaker ל-`ai-gateway.server.ts` — ✅ פער אמיתי, מאושר**
נקרא `src/lib/ai-gateway.server.ts` במלואו. יש טיפול שגיאות נקודתי בלבד: קוד 429 (חריגת מכסה) וקוד 402 (נגמרו קרדיטים) מזוהים ומוחזרת הודעת שגיאה בעברית, אבל **אין state tracking בין קריאות** — אם המכסה אזלה, הקריאה הבאה תנסה שוב את ה-API מההתחלה ותקבל שוב 429/402, במקום לדעת מראש ולחסוך את הקריאה. זה בדיוק הפער שזוהה ב-ClassAlign (`ef849b2`). **מומלץ להוסיף מנגנון state (in-memory, ברמת המודול) שמסמן `exhausted`/`invalid_key` ומחזיר שגיאה מיידית בלי לקרוא ל-fetch, עד timeout מוגדר (למשל 60 שניות) או עד restart.**

**שקלול ציונים גמיש — ✅ פער אמיתי, מאושר**
נקרא `src/routes/_authenticated.analytics.$classId.tsx`. קיים שם מנגנון "**סדר עדיפות למקצועות**" (`priority`, נשמר ב-`localStorage` לפי `ca_subject_priority_{classId}`) — אבל זה משפיע רק על **סדר התצוגה** בגרפים (קו/עמודות/רדאר), לא על חישוב ממוצע משוקלל. אין מנגנון שמאפשר להגדיר "מבחן שווה 40%, שיעורי בית 20%" וכו' שמשפיע בפועל על ציון סופי/ממוצע. **הפער מה-ClassAlign אמיתי ורלוונטי ליבוא**, אך שם המנגנון (`categoryWeights` ב-Firestore) היה מבוסס-קטגוריות טקסטואליות חופשיות; כדאי לתכנן טבלת `grade_weights` דומה ב-Supabase (class_id, category, weight) ולחשב ממוצע משוקלל בשרת (כנראה תוספת ל-`tracking.functions.ts` שכבר מספק `listGrades`, או קובץ ייעודי חדש).

### 6.10 עדכון `docs/lms-gap-analysis.md` — בוצע 2/8/2026, בהמתנה לאישור העלאה

מסמך התיעוד הפנימי של Harmony Hub עצמו (`docs/lms-gap-analysis.md`) הכיל מידע לא מעודכן — סימן RBAC כ-❌ חסר, למרות שהוא כבר מיושם במלואו (ראה 6.8). בנוסף לא כלל את שני הפערים האמיתיים שאומתו בסעיף 6.9 (שקלול ציונים, circuit breaker).

**מה בוצע בפועל:**
- הוכן קובץ מקומי מעודכן עם: תיקון שורת RBAC ל-✅, שורת "שקלול ציונים" חדשה בטבלת סעיף 6 (הדוחות), סעיף 9 חדש שלם ("אמינות תשתית AI") עם טבלת סטטוס ל-Circuit Breaker, ועדכון תוכנית היישום (שלב 1 סומן כהושלם, שלב 4 כולל שקלול ציונים בעדיפות ראשונה, שלב 6 חדש לאמינות AI).
- **ניסיון לשלוח דרך `Lovable:send_message` נתקל ב"No approval received"** ולא הושלם — כנראה כי זו פעולת כתיבה בפרויקט אמיתי שדורשת אישור נפרד ולא ניתן לעקוף אוטומטית.
- **נבחר ה-workaround המתועד**: הקובץ הועבר למשתמש כ-artifact להורדה, להעלאה ידנית ל-`docs/lms-gap-analysis.md` ב-GitHub `main` של `cuddle-spark-nexus`. המשתמש אישר שיבצע את ההעלאה בעצמו.
- **⚠️ טרם אומת בפועל** שההעלאה בוצעה ושה-sync הדו-כיווני של Lovable משך את השינוי. **פעולה נדרשת בתחילת השיחה הבאה**: להריץ `Lovable:read_file` על `docs/lms-gap-analysis.md` ולהשוות מול התוכן שהוכן, כדי לוודא שהעדכון אכן נכנס לפני שממשיכים להסתמך עליו.


שני הפריטים היחידים שנותרו כפערים אמיתיים ומאושרים ליבוא/פיתוח ב-Harmony Hub:
1. **שקלול ציונים משוקלל** — הפער הגדול יותר מבין השניים; דורש טבלת Supabase חדשה + server function + UI (כנראה הרחבה ל-`analytics.$classId.tsx` או ל-route ציונים ייעודי) + עדכון חישוב ממוצעים בכל מקום שמציג ציון סופי.
2. **Circuit breaker ל-AI Gateway** — שיפור טכני פנימי, קטן יחסית להטמעה, לא דורש UI.

כל שאר הפריטים המקוריים בסעיף 6 (מתכנן שבועי, פידבק פדגוגי, RBAC) מאושרים כ**"אין פעולה נדרשת"** — קיימים ומיושמים ב-Harmony Hub ברמה שווה או גבוהה יותר מ-ClassAlign.

---

## 5. איך להשתמש במסמך הזה מכאן ואילך

1. **תמיד לבדוק קודם מול Lovable API (`get_project`/`list_files`/`read_file`/`list_edits`) על project_id `2734475a-1431-4ef2-8175-67b8af357276`** לפני שמניחים הנחות מה קיים ב-Harmony Hub — ה-GitHub clone שלו עלול להיות מיושן.
2. ה-5 מאגרים האחרים (Teacher-students-mgmt וכו') עדיין ניתן להשוות מול ה-clone הסטטי, אלא אם יתברר שגם הם מחוברים לפלטפורמת build חיה.
3. שינויים בקוד עצמו נעשים דרך `Lovable:send_message` (agent כותב את הקוד) — אין כלי כתיבה ישיר. יש לוודא תמיד בסוף עם `Lovable:read_file` שהשינוי אכן נכנס במקום הנכון.
4. **`Lovable:send_message` עלול להיתקע על "No approval received"** גם ללא בעיית קרדיטים ברורה — כנראה דורש אישור נפרד לכתיבה בפרויקט אמיתי. כשזה קורה, ברירת המחדל: לחזור ל-workaround המתועד (הכנת קובץ מקומי + המשתמש מעלה ידנית ל-GitHub `main`), ולוודא בשיחה הבאה עם `read_file` שהשינוי אכן נקלט דרך הסנכרון הדו-כיווני.
4. הקובץ הזה חי גם בתוך הריפו (`MERGE_MEMORY.md` בשורש) וגם כקובץ נפרד ב-`/mnt/user-data/outputs` — יש לוודא ששניהם מסונכרנים.
