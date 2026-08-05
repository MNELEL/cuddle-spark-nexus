# MERGE_MEMORY.md
> מסמך זיכרון קבוע לפרויקט מיזוג האפליקציות. עדכן אותו בכל שיחה חדשה כדי לא לאבד החלטות.
> יעד סופי: **Lovable**. הפרויקט החי: **"הכיתה שלי"** (שם קודם: Harmony Hub; repo: `cuddle-spark-nexus`), פרויקט Lovable ID `2734475a-1431-4ef2-8175-67b8af357276`.

**עדכון אחרון:** 4 באוגוסט 2026 — **מיזוג של שני מסמכי MERGE_MEMORY.md שהתפצלו (שורש מ-30/7 + docs/ מ-2/8) לגרסה אחת, בתוספת בדיקה ישירה נוספת מול Lovable + `get_project`. `docs/MERGE_MEMORY.md` הכפול נמחק — זהו כעת המסמך היחיד.**

**היסטוריית עדכונים קודמים (לשקיפות):**
- 23/7: הושלמה משימת Task Automation + איחוד AI Gateway.
- 26/7: פיצ'ר הרשמת מורים עם קוד גישה + תיקון אבטחת bulletinFeedback ב-Class-Flow.
- 30/7: סיור מקיף Lovable+Base44 — RBAC, תיקון אבחנת registerDriveWatch, פער אבטחת PIN ב-Class-Flow.
- 2/8: השוואה מול Teacher-students-management-interface (ClassAlign) — אימות שרוב פערי ClassAlign כבר מיושמים, אישור שני פערים אמיתיים (שקלול ציונים, circuit breaker), עדכון מוצלח של `docs/lms-gap-analysis.md` הפנימי.
- 4/8: בדיקה עצמאית נוספת (בלי לראות את עדכוני 30/7 ו-2/8 מראש) הגיעה **באופן בלתי-תלוי לאותה מסקנה בדיוק** — חיזוק משולש לגבי שני הפערים הנותרים.

---

## ⚠️ הערה קריטית לגבי עדכניות מידע

**ה-repo `cuddle-spark-nexus` ב-GitHub פיגר משמעותית אחרי הפרויקט החי ב-Lovable, וגם המסמך הזה עצמו התפצל לשתי גרסאות לא-מסונכרנות בעבר (תוקן היום).** מסקנה מעשית קבועה: **לפני כל החלטה על "מה חסר" — לקרוא קוד חי מ-Lovable (`read_file`/`list_files`/`get_project`) ולא להסתמך רק על מה שכתוב כאן.** שלוש בדיקות עצמאיות (23-30/7, 2/8, 4/8) כל אחת בנפרד גילתה פערי-תיעוד בין המסמך לקוד בפועל.

---

## 0. רשימת כל המאגרים ותפקידם

| # | שם ריפו | סטאק | תפקיד במיזוג |
|---|---|---|---|
| 1 | **`cuddle-spark-nexus` ("הכיתה שלי")** | TanStack Start + Supabase + Cloudflare Workers | **הפרויקט המרכזי בפועל** — יעד המיזוג עצמו, פרויקט Lovable חי ופעיל, מתעדכן ברציפות |
| 2 | `Teacher-students-management-interface` ("ClassAlign") | Vite/React + Firebase + PWA | מקור פיצ'רים — גם הדפלוי החי הנפרד (smartclass-ai-manager ב-Cloud Run) |
| 3 | `Class-manager-from-Gemini-` | Vite/React + Express + Firebase + Capacitor/Electron | מקור פיצ'רים — Embeddings/RAG (גרסת Gemini), Whiteboard |
| 4 | `classflow` (Base44, app ID `69efc0a68bae1b1d07582eda`) | Base44 SDK | מקור פיצ'רים — גרסה מוקדמת יותר של אותו רעיון, התפתחה בכיוון "ניהול-על מוסדי" משלים |
| 5 | `certificates-tool` | Vite/React + Supabase + Claude AI + Vercel | מקור פיצ'ר — **הפיצ'ר הבסיסי כבר יובא בהצלחה**; הכלי הנפרד עדיין קיים ופעיל על Vercel (Supabase `ocxwkwfbqoeguvfmrqfj`) |
| 6 | `Cllapilot-for-haideer` | Kotlin Android נייטיבי | reference בלבד — Kiosk mode הוא נייטיבי בלבד, אין מקבילה בווב |

**הבהרות מהעבר שעדיין תקפות:**
- `ai.studio/apps/e3f0aac2-...` = לינק ה-AI-Studio-origin של `Teacher-students-management-interface` בלבד. `ai.studio/apps/84931763-...` = אותו דבר עבור `Cllapilot-for-haideer`. אין בהם תוכן נוסף לשלוף.
- **smartclass-ai-manager (Cloud Run, "ClassAlign")** = הדפלוי החי של `Teacher-students-management-interface` — לא ריפו נפרד.
- הפרויקט שינה שם מ-"Harmony Hub" ל**-"הכיתה שלי"** (`hakita-sheli`) — ה-`project_id` נשאר זהה.

---

## 1. פערים אמיתיים שנותרו פתוחים — מאושרים ע"י 3 בדיקות עצמאיות (23/7, 2/8, 4/8)

### 1.1 שקלול ציונים (grade_weights)
- **סטטוס: מיושם** (אוגוסט 2026).
- **מה נבנה**: טבלת `grade_weights` (`class_id`, `subject`, `weight` 0.1–10, RLS בדפוס `grades_owner_all`); server functions `listGradeWeights` / `upsertGradeWeight` / `deleteGradeWeight` ב-`src/lib/tracking.functions.ts`; לוגיקה טהורה משותפת ב-`src/lib/grade-weighting.ts`.
- **הנוסחה**: שקלול בין-מקצועי — קודם ממוצע פנימי לכל מקצוע (`sum(value)/sum(max)*100`), ואז `sum(subjAvg_i * w_i) / sum(w_i)`. מקצוע ללא שורת משקל = 1, כך שכשאין משקלים התוצאה מתלכדת עם ממוצע שווה-משקל.
- **היכן מוצג**: `analytics` (כרטיסי "ממוצע משוקלל" ו-"משקל מקצועות"), `certificates` (badge לכל תלמיד — רק כשהוגדרו משקלים), `ai-pedagogical` + `pedagogical-pdf` (ממוצע משוקלל בנוסף לניתוח האיכותני הקיים).
- **בכוונה לא שונו**: `reports.functions.ts`, `performance-score.ts`, `seating-wizard.functions.ts`, `public-class.functions.ts`, `p.$token.tsx` — ממוצע פשוט, כדי לא לשנות דוחות היסטוריים ונתונים שהורים כבר ראו.

### 1.2 Circuit breaker ל-AI Gateway — ✅ מיושם (אוגוסט 2026)
- **מבנה**: state in-memory ברמת המודול ב-`src/lib/ai-gateway.server.ts`, **משותף** ל-`callLovableAI` ול-`callLovableAIEmbeddings` — שתיהן פוגעות באותה מכסת Lovable AI Gateway, ולכן כשל שאחת רואה חוסם מיידית גם את השנייה.
- **חלונות**: 429 ⇒ 60 שניות (מתאושש לבד). 402 ומפתח חסר ⇒ חלון probe של 5 דקות: ניסיון בודד בסוף החלון, כדי שהוספת קרדיטים/מפתח תיתפס בלי restart.
- **בתוך החלון**: אין fetch כלל. `callLovableAI` זורק את אותה הודעה בעברית (חוזה throwing), `callLovableAIEmbeddings` מחזיר `null` (חוזה non-throwing) — שני החוזים נשמרו במדויק, ואף אחד מ-16 הקוראים לא שונה.
- **איפוס**: תגובה 200 סוגרת את ה-breaker. שגיאות אחרות (5xx / 400 / שגיאת רשת) **אינן** פותחות אותו — הן נקודתיות ולא מעידות על מכסה.
- **לוגים**: `[AI Breaker] open <reason>` בפתיחה, `[AI Breaker] closed` באיפוס.

**כל הפערים שתועדו בסעיף 1 הושלמו.**

---

## 2. מה כבר קיים בפועל ומאומת — לא לגעת, לא לייבא מחדש

### 2.1 פיצ'רי ליבה — קיימים ומאומתים לעומק
| פיצ'ר | קובץ מרכזי | הערה |
|---|---|---|
| בולטין שבועי | `src/routes/_authenticated.bulletins.$classId.tsx` | קיים ופעיל |
| נעילת PIN | `src/lib/security.functions.ts` | salt רנדומלי per-user, SHA-256, timingSafeEqual, server-side. עדיף על Class-Flow |
| הגרלה | `src/routes/_authenticated.raffle.$classId.tsx` | קיים ופעיל |
| תעודות PDF | `src/lib/certificates.functions.ts` | יובא בהצלחה, פונטים Heebo מוטבעים |
| סידור הושבה תלת-ממדי | `src/routes/_authenticated.classes.$classId.display.tsx` | קיים |
| קשר הורים | `parents.functions.ts` | עדיף על classflow, פער יחיד: אין דירוג/פידבק כוכבים |
| ציונים (OCR+קול+טקסט) | `ai-grades.functions.ts` | עולה על שני המאגרים האחרים |
| נוכחות | `tracking-tab.tsx` | שווה-ערך מלא ל-ClassAlign |
| Embeddings/RAG | `embeddings.server.ts` | המימוש הנכון ליעד |
| RBAC | `user-roles.functions.ts` | admin/principal/teacher/secretary, RLS |
| מתכנן שבועי | `weekly-schedule.functions.ts` | עולה על ClassAlign (Supabase ולא רק localStorage) |
| פידבק פדגוגי AI | `ai-pedagogical.functions.ts` | דוח כיתתי מלא |

### 2.2 תשתית — קיימת ומאומתת
| תשתית | קובץ | פרטים |
|---|---|---|
| בלוגים מובנים | `src/lib/logger.server.ts` | logEvent/logInfo/logWarn/logError, כותב ל-app_logs, fail-safe |
| חיבור OCR→תעודות | `src/lib/ai-certificate.functions.ts` | analyzeCertificatePhoto + suggestCertificateNotes |
| איחוד AI Gateway | `src/lib/ai-gateway.server.ts` | callLovableAI/callLovableAIEmbeddings, בשימוש בכל קבצי ה-AI |
| Resend email | `src/lib/reminder-alerts.server.ts` | שולח מייל HTML RTL אמיתי דרך Resend SDK. הערת TODO(email-provider) בראש הקובץ מיושנת — יש להסיר |
| CSS theme classalign | `src/styles.css` | בלוק [data-theme="classalign"] מלא קיים |
| Task Automation (cron) | `src/server.ts` + `wrangler.jsonc` | ריצה יומית, מחובר ל-Resend |

### 2.3 פיצ'רים חדשים שהתגלו אגב בדיקה (לא הושוו עדיין מול מאגרים אחרים)
class_events, polls+poll_votes, curriculum_units+pacing_recalc_log, lesson_transcripts, student_relations, ingest_jobs, anti-spam.server.ts

---

## 3. docs/lms-gap-analysis.md — תיעוד עצמי של האפליקציה

עודכן בהצלחה ב-2/8/2026 (RBAC ✅, שקלול ציונים ✅ מיושם (אוגוסט 2026), circuit breaker ✅ מיושם (אוגוסט 2026) — תואם לסעיף 1 כאן). פערים נוספים לא בעדיפות נוכחית: אינטגרציות LMS חיצוניות, push notifications, צ'אט צוות, דוחות מוסדיים, iOS+offline, שיתוף משאבים בין מוסדות.

---

## 4. Class-Flow (Base44) — לא נבדק מחדש ב-4/8

יכולות עומק ללא מקבילה: StrategicLeadersOptimizer/GroupSeatingOptimizer/ConflictHelper (אופטימיזציית הושבה), MultiSourceGenerator/ArtifactGenerator (יצירת תוכן), כלי ניהול-על מוסדי.

פערי אבטחה ב-Class-Flow עצמו (לא דורש פעולה בהכיתה שלי): PIN hashing עם secret משותף (BASE44_APP_ID) במקום salt per-user; registerDriveWatch דורש הרחבת scope ל-Google Drive connector; PendingUpdate entity קיים בקוד אך 0 רשומות בפרודקשן.

---

## 5. certificates-tool (Vercel) — לא נבדק מחדש ב-4/8

Supabase נפרד (8 טבלאות, RLS), Edge Function analyze-document, Hebrew PDF via bidi-js+jsPDF. שומר רק שם וכיתה, לא פרטי הורה.

---

## 6. Teacher-students-management-interface (ClassAlign) — השוואות שטרם הושלמו

ספרייה/חומרי הוראה עדיין דורשת השוואת עומק. PWA/Offline רק ב-ClassAlign. Whiteboard רק ב-Class-manager-from-Gemini-. Kiosk Mode לא קיים בשום מאגר web.

---

## 7. מעבר שנה וארכיון כיתות — מומש (אוגוסט 2026)

פיצ'ר מלא ב"הכיתה שלי", לא פער פתוח.

1. **שיוך מוסדי אוטומטי** — ביצירת כיתה נשלף `institution_id` מ-`user_roles` של המלמד ונשמר על הכיתה.
2. **`academic_year`** — טקסט חופשי בפורמט עברי (תשפ"ז). ברירת המחדל מחושבת מהתאריך ב-`src/lib/year-rollover.ts` (`hebrewYearNumber` + `formatHebrewYear`), והמלמד יכול לערוך בחופשיות.
3. **אשף מעבר שנה** — `src/components/new-class-wizard.tsx`. `suggestParentClass` מציע כיתת אב לפי רצף אותיות עבריות (א→ב→ג…), עם אפשרות לבחור כיתה אחרת או ליצור כיתה עצמאית.
4. **העתקת תלמידים** — בחירה פרטנית של התלמידים שעולים; מועתקים פרטי תלמיד/הורים/התאמות בלבד (בלי מושב, ציונים, נוכחות או היסטוריה). `student_relations` מועתקים וממופים למזהי התלמידים החדשים.
5. **ארכוב הכיתה הישנה** — דרך `setClassStatus` הקיים, כחלק מהאשף (ניתן לבטל).
6. **שלוש שכבות הגנה על ארכיון**
   - **DB triggers**: `trg_classes_archived_readonly` על `classes` (חוסם כל עדכון פרט לשינוי `status`/`updated_at`) + `trg_*_not_archived` על `students`, `grades`, `attendance`, `behavior_points`, `discipline_events`, `class_events`, `weekly_lessons`, `student_relations`, `groups`. הפונקציות `private.class_is_archived` וה-guards הן SECURITY DEFINER בלי הרשאת EXECUTE ציבורית.
   - **Server guard**: `assertClassEditable` ב-`src/lib/classes.functions.ts` מחזיר שגיאה בעברית ("הכיתה בארכיון — החזר אותה לפעילות כדי לערוך") לפני `updateClass`/`deleteClass`.
   - **UI read-only**: באנר ארכיון עם כפתור "החזר לפעילות" בדף הכיתה, הסתרת סרגל הפעולות והמחיקה, ותג "בארכיון · לצפייה בלבד".
7. **שרשרת שנים** — `getClassChain` + רכיב `YearChain` מציגים קישורי "שנה קודמת"/"שנה הבאה" בדף הכיתה, ותג שנת לימוד בכרטיסי הכיתות.

לא נגענו ב-`curriculum_history_snapshots` ו-`pacing_recalc_log` — הם נשארים ניתנים לכתיבה גם לכיתה בארכיון (חישובי קצב והיסטוריה).

---

## 7ב. מידע רגיש לתלמיד + דוחות מסירה בין מורים (מומש, אוגוסט 2026)

1. **טבלה** — `public.student_profiles`, extension 1:1 ל-`students` (`student_id` PK), מכילה `class_id`, `sensitive_flags` (אבחון/אלרגיה/לקות למידה/סייע/מצב משפחתי/תקרית חריגה/אחר), `sensitive_notes`, `teaching_style_notes`, `handoff_notes`, `updated_by`, `updated_at`. נבחרה טבלת extension ולא עמודות על `students` כדי לשלוט בהרשאות בנפרד ולא לנפח את הטבלה שנקראת בעשרות מקומות.
2. **מודל הרשאות (חשוב)** — **מורה בעל הכיתה + מנהל מוסד בלבד. אין ולא תהיה גישה להורים או לציבור.**
   - `student_profiles_owner_all` — ALL ל-owner הכיתה.
   - `student_profiles_institution_admin_select` — SELECT בלבד דרך `private.is_institution_admin(auth.uid(), c.institution_id)`. מנהל צופה, לא כותב.
   - GRANTs ל-`authenticated` ו-`service_role` בלבד — **בלי `anon`**. אין חשיפה בעמודי הכיתה הציבוריים (`/c/$slug`) ולא בטוקני שיתוף להורים.
   - `trg_student_profiles_not_archived` — כיתה בארכיון לקריאה בלבד, כמו שאר טבלאות הכיתה.
3. **שרת** — `src/lib/student-profiles.functions.ts`: `getStudentProfile`, `upsertStudentProfile` (upsert יחיד, בלי היסטוריית גרסאות), `listClassProfiles`.
4. **ממשק** — לשונית רביעית "פרופיל תלמיד" ב-`student-file-sheet.tsx` עם שני אזורים: מידע רגיש (צ'יפים + טקסט חופשי, כולל כיתוב מי רואה) וסגנון/יחס נדרש + הדגשים למורה היורש. תג "עודכן: תאריך". פיצ'ר שוטף — ניתן לעדכן כל השנה.
5. **חיבור למעבר שנה** — `createClass` מעתיק את `student_profiles` **באותה זרימה** של העתקת התלמידים ו-`student_relations`, עם אותו mapping-לפי-שם, וכשל בהעתקה זורק שגיאה (לא נכשל בשקט). `listRolloverStudents` מחזיר `hasSensitive`/`hasGuidance` ל-badges בתצוגה המקדימה באשף.
6. **מסמך מסירה PDF** — `src/lib/pdf/handoff-report-pdf.ts`, מסומן "מסמך פנימי חסוי". כפתור באשף מעבר השנה (על הכיתה הקודמת) וכפתור בלשונית התלמידים בדף הכיתה.

---

## 8. איך להשתמש במסמך הזה מכאן ואילך

1. תמיד לקרוא קוד חי מ-Lovable לפני שמניחים הנחות.
2. קובץ זה הוא כעת המקור היחיד — docs/MERGE_MEMORY.md נמחק ב-4/8.
3. docs/lms-gap-analysis.md הוא מסמך נפרד — לוודא סנכרון לגבי הפערים הפתוחים.
4. שינויים בקוד נעשים דרך send_message. אם נתקע על "No approval received" — להכין קובץ מקומי, המשתמש מעלה ידנית ל-GitHub main, הסנכרון הדו-כיווני מושך אוטומטית.
5. שני הפערים שתועדו הושלמו: (א) grade_weights ✅ (ב) circuit breaker ל-AI gateway ✅ (אוגוסט 2026).
