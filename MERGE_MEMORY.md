# MERGE_MEMORY.md
> מסמך זיכרון קבוע לפרויקט מיזוג האפליקציות. עדכן אותו בכל שיחה חדשה כדי לא לאבד החלטות.
> יעד סופי: **Lovable**. הפרויקט החי: **"Harmony Hub"** (repo: `cuddle-spark-nexus`), פרויקט Lovable ID `2734475a-1431-4ef2-8175-67b8af357276`.

**עדכון אחרון:** 23 ביולי 2026 — **עודכן אחרי בדיקה ישירה מול Lovable API (לא רק GitHub)**

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

## 2. הפער האמיתי היחיד שאומת כחסר: Task Automation בצד שרת

נבדק בקפידה, כולל קריאה מלאה של `crm-tab.tsx`:
- **יש** מערכת תזכורות מלאה בממשק (`RemindersPanel` בתוך `crm-tab.tsx`) — `listReminders`/`upsertReminder`/`toggleReminderDone`/`deleteReminder`, עם תאריך יעד, סימון "בוצע", והדגשת "overdue" (חישוב `new Date(due_date) < today` **בצד לקוח בלבד**, ברגע הרינדור).
- **אין** קובץ מקביל ל-`checkOverdueTasks`/`dailyTaskReminder`/`lessonReminder` (שקיימים ב-`classflow`) — כלומר שום דבר לא רץ ברקע כדי *ליצור* התראה/מייל כשמשימה מאחרת; המורה חייב לפתוח את המסך כדי לראות שמשהו overdue.
- **אין** `triggers.crons` בקובץ `wrangler.jsonc` — כלומר אין שום Cloudflare Cron Trigger מוגדר בכלל.

**מסקנה מדויקת יותר מאשר קודם:** זה לא "אין תזכורות" — יש תזכורות ידניות מלאות ומנוהלות היטב. **הפער הספציפי הוא רק באוטומציה: אין שום מנגנון שיוזם משהו בלי שהמורה יפתח את האפליקציה** (למשל: שליחת מייל/פוש כשמשימה עברה את תאריך היעד, או תזכורת יומית אוטומטית). זהו הפריט האחרון שבאמת נשאר לסגור.

### מה נדרש בפועל כדי לסגור את זה ב-Lovable/Cloudflare:
1. הוספת `triggers.crons` ל-`wrangler.jsonc` (לדוגמה: ריצה יומית ב-06:00).
2. handler בתוך `src/server.ts` (או קובץ ייעודי) שמטפל ב-`scheduled` event של Cloudflare Worker.
3. לוגיקה מותאמת מ-`classflow/base44/functions/checkOverdueTasks/entry.ts` (בדיקת עומס יתר) ו-`dailyTaskReminder/entry.ts` — יש להמיר מ-Deno (Base44) ל-Cloudflare Workers syntax, אך הלוגיקה העסקית (דדופ, ישות `OverdueAlert`, חישוב ימי איחור) ניתנת להעברה ישירה.
4. טבלת Supabase מקבילה ל-`Task`/`SentReminder`/`OverdueAlert` (יש לבדוק אם `students.functions.ts`/`tracking.functions.ts` הקיימים כבר מכילים ישות `tasks` — טרם אומת).

**סטטוס: לא הועבר. זו משימת המיזוג הבאה עם העדיפות הגבוהה ביותר.**

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

### 3.3 ציונים (הושווה לעומק מול הקוד החי — 23/7) ✅ סופי
נקראו `grade-ai-import.tsx` + `ai-grades.functions.ts` במלואם. **הממצא: cuddle-spark-nexus כבר עולה על גם classflow וגם certificates-tool בתחום הזה — אינטגרציה מלאה של שלוש שיטות קלט לתוך דיאלוג אחד:**
- **OCR מתמונה** (`ocrGradesImage`) — שולח לגמיני עם רשימת שמות התלמידים בפועל, מבצע "fuzzy matching" לשמות מקוצרים/משובשים/ראשי-תיבות בעברית, מחזיר טקסט מנורמל.
- **קול** (Web Speech API, `he-IL`) — מקליט ומוסיף לאותו תיבת טקסט חופשי.
- **טקסט חופשי** — כל הקלט (מתמונה/קול/הקלדה) עובר דרך `parseGradesFromText`, שמשייך כל שם לתלמיד אמיתי ב-DB עם ציון-ביטחון (`confidence`) ואפשרות תיקון ידני לכל שורה לפני שמירה.
- טיפול נכון בשגיאות מכסה/קרדיטים של Lovable AI Gateway (429/402) בעברית ברורה למשתמש.
- **סטטוס: לא נדרשת פעולה נוספת — הפיצ'ר שלם ומעולה כפי שהוא.**

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

## 4. טבלת מעקב מעודכנת

| תחום | מצב ב-Harmony Hub (cuddle-spark-nexus) | פעולה נדרשת |
|---|---|---|
| בולטין שבועי | ✅ קיים | לוודא שלמות מול classflow |
| נעילת PIN | ✅ קיים, מימוש איכותי מאומת | אין צורך בפעולה |
| הגרלה | ✅ קיים | לוודא שלמות מול classflow (confetti, leaderboard) |
| תעודות PDF | ✅ קיים, מאומת לעומק | אין צורך בפעולה |
| תלת-ממד בסידור הושבה | ✅ קיים (חדש, לא ידענו) | לבדוק מנוע/ביצועים |
| **תזכורות/משימות אוטומטיות (cron)** | **❌ עדיין חסר** | **המשימה הבאה בעדיפות עליונה** |
| קשר הורים (טוקן ציבורי) | ✅ קיים ומעולה, **עדיף על classflow** | להוסיף רק מנגנון פידבק/דירוג (הפער האחרון) |
| ציונים מתמונה (AI) | ✅ קיים ומעולה — OCR+קול+טקסט מאוחדים | אין צורך בפעולה |
| ספרייה/חומרי הוראה | 🟡 קיים חלקית, כולל AI-quiz-from-bulletin ייחודי | להשוות עומק מול Teacher-students-mgmt |
| נוכחות | ✅ קיים, שווה-ערך מלא ל-Teacher-students-mgmt | אין צורך בפעולה |
| PWA/Offline | ❌ חסר (ארכיטקטורה שונה) | דורש מימוש נפרד להתאמת Cloudflare |
| Embeddings/RAG | ✅ קיים ומתאים ליעד | אין צורך בפעולה |
| Whiteboard | ❌ חסר | לייבא מ-Class-manager-from-Gemini- אם רלוונטי |
| Sound-board | 🟡 קיים, פחות מפותח | לשקול שדרוג מול Teacher-students-mgmt |
| Kiosk mode | ❌ לא קיים בשום מאגר web | לבנות מאפס אם נדרש |
| Google Workspace | ❓ לא אומת | לבדוק מול Lovable ישירות |

---

## 5. איך להשתמש במסמך הזה מכאן ואילך

1. **תמיד לבדוק קודם מול Lovable API (`get_project`/`list_files`/`read_file`/`list_edits`) על project_id `2734475a-1431-4ef2-8175-67b8af357276`** לפני שמניחים הנחות מה קיים ב-Harmony Hub — ה-GitHub clone שלו עלול להיות מיושן.
2. ה-5 מאגרים האחרים (Teacher-students-mgmt וכו') עדיין ניתן להשוות מול ה-clone הסטטי, אלא אם יתברר שגם הם מחוברים לפלטפורמת build חיה.
3. עדכן טבלה בסעיף 4 מיד כשתחום עובר מ-🟡/❌ ל-✅ בפועל.
4. הקובץ הזה חי גם בתוך `/mnt/user-data/outputs` (קובץ נפרד) — יש להוריד ולשמור גרסה מקומית מפעם לפעם.
