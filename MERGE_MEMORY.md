# MERGE_MEMORY.md
> מסמך זיכרון קבוע לפרויקט מיזוג האפליקציות. עדכן אותו בכל שיחה חדשה כדי לא לאבד החלטות.
> יעד סופי: **Lovable**. הפרויקט החי: **"הכיתה שלי"** (שם קודם: Harmony Hub; repo: `cuddle-spark-nexus`), פרויקט Lovable ID `2734475a-1431-4ef2-8175-67b8af357276`.

**עדכון אחרון:** 11 באוגוסט 2026 — בוצע ניקוי ה-notifications היתומות: הוחזר קובץ tombstone/no-op למיגרציה `20260808225907` (גרסה שהייתה רשומה ב-DB בלי קובץ בריפו), אומת שאין שאריות DB (`%notif%` = רק `class_notifications`) ואין שורות יתומות ב-`class_notifications`, וסעיפי 12.0/12.3 עודכנו — הפריט סומן כ**סגור** ולא כחוב פתוח. קודם לכן: יושרו סעיפים 10.1, 10.3 ו-11.3 מול סעיף 12: קבוצה C נסגרה במלואה (התראת ארכוב כיתה דרך `class_notifications`, תשתית טסטי vitest/RLS, וחיבור ה-trial ל-UI), ו-11.3 סומן כתיעוד היסטורי של 8/8 בלבד. קודם לכן: עודכן סעיף 13 (עמוד ההגדרות המאוחד) מול קוד חי: תועד שתוכן ההגדרות הוזז בפועל מ-/toolkit ל-/settings ולא נשאר כפול, ונוספו לשוניות ההגדרות ו-/settings/theme. קודם לכן: עודכן סעיף 12.4.1 עם ספירת טסטים מדויקת נכון להיום (כולל rls-student-profiles המורחב ו-rollover-copy המתוקן), ותאריך סעיף 12.4.4 אומת ל-11/8.

**היסטוריית עדכונים קודמים (לשקיפות):**
- 23/7: הושלמה משימת Task Automation + איחוד AI Gateway.
- 26/7: פיצ'ר הרשמת מורים עם קוד גישה + תיקון אבטחת bulletinFeedback ב-Class-Flow.
- 30/7: סיור מקיף Lovable+Base44 — RBAC, תיקון אבחנת registerDriveWatch, פער אבטחת PIN ב-Class-Flow.
- 2/8: השוואה מול Teacher-students-management-interface (ClassAlign) — אימות שרוב פערי ClassAlign כבר מיושמים, אישור שני פערים אמיתיים (שקלול ציונים, circuit breaker), עדכון מוצלח של docs/lms-gap-analysis.md הפנימי.
- 4/8: בדיקה עצמאית נוספת (בלי לראות את עדכוני 30/7 ו-2/8 מראש) הגיעה באופן בלתי-תלוי לאותה מסקנה בדיוק — חיזוק משולש לגבי שני הפערים הנותרים.
- 5/8: בדיקה ממוקדת מול קוד חי לרשימת פערים/בקשות שהתקבלה בשיחה נפרדת (ראה סעיף 10).
- 9/8: עדכון סיכום בדיקות: כיסוי טבלאות, ספירת 91 טסטים, וקישורים לטסטי אינטגרציה (סעיף 12.4).

---

## ⚠️ הערה קריטית לגבי עדכניות מידע

ה-repo cuddle-spark-nexus ב-GitHub פיגר משמעותית אחרי הפרויקט החי ב-Lovable, וגם המסמך הזה עצמו התפצל לשתי גרסאות לא-מסונכרנות בעבר (תוקן ב-4/8). מסקנה מעשית קבועה: לפני כל החלטה על "מה חסר" — לקרוא קוד חי מ-Lovable (read_file/list_files/get_project) ולא להסתמך רק על מה שכתוב כאן. מספר בדיקות עצמאיות (23-30/7, 2/8, 4/8, 5/8) כל אחת בנפרד גילתה פערי-תיעוד בין המסמך לקוד בפועל.

---

## 0. רשימת כל המאגרים ותפקידם

| # | שם ריפו | סטאק | תפקיד במיזוג |
|---|---|---|---|
| 1 | cuddle-spark-nexus ("הכיתה שלי") | TanStack Start + Supabase + Cloudflare Workers | הפרויקט המרכזי בפועל — יעד המיזוג עצמו, פרויקט Lovable חי ופעיל, מתעדכן ברציפות |
| 2 | Teacher-students-management-interface ("ClassAlign") | Vite/React + Firebase + PWA | מקור פיצ'רים — גם הדפלוי החי הנפרד (smartclass-ai-manager ב-Cloud Run) |
| 3 | Class-manager-from-Gemini- | Vite/React + Express + Firebase + Capacitor/Electron | מקור פיצ'רים — Embeddings/RAG (גרסת Gemini), Whiteboard |
| 4 | classflow (Base44, app ID 69efc0a68bae1b1d07582eda) | Base44 SDK | מקור פיצ'רים — גרסה מוקדמת יותר של אותו רעיון, התפתחה בכיוון "ניהול-על מוסדי" משלים |
| 5 | certificates-tool | Vite/React + Supabase + Claude AI + Vercel | מקור פיצ'ר — הפיצ'ר הבסיסי כבר יובא בהצלחה; הכלי הנפרד עדיין קיים ופעיל על Vercel (Supabase ocxwkwfbqoeguvfmrqfj) |
| 6 | Cllapilot-for-haideer | Kotlin Android נייטיבי | reference בלבד — Kiosk mode הוא נייטיבי בלבד, אין מקבילה בווב |

**הבהרות מהעבר שעדיין תקפות:**
- ai.studio/apps/e3f0aac2-... = לינק ה-AI-Studio-origin של Teacher-students-management-interface בלבד. ai.studio/apps/84931763-... = אותו דבר עבור Cllapilot-for-haideer. אין בהם תוכן נוסף לשלוף.
- smartclass-ai-manager (Cloud Run, "ClassAlign") = הדפלוי החי של Teacher-students-management-interface — לא ריפו נפרד.
- הפרויקט שינה שם מ-"Harmony Hub" ל-"הכיתה שלי" (hakita-sheli) — ה-project_id נשאר זהה.

---

## 1. פערים אמיתיים שנותרו פתוחים — מאושרים ע"י 3 בדיקות עצמאיות (23/7, 2/8, 4/8)

### 1.1 שקלול ציונים (grade_weights)
- סטטוס: מיושם (אוגוסט 2026).
- מה נבנה: טבלת grade_weights (class_id, subject, weight 0.1–10, RLS בדפוס grades_owner_all); server functions listGradeWeights / upsertGradeWeight / deleteGradeWeight ב-src/lib/tracking.functions.ts; לוגיקה טהורה משותפת ב-src/lib/grade-weighting.ts.
- הנוסחה: שקלול בין-מקצועי — קודם ממוצע פנימי לכל מקצוע (sum(value)/sum(max)*100), ואז sum(subjAvg_i * w_i) / sum(w_i). מקצוע ללא שורת משקל = 1, כך שכשאין משקלים התוצאה מתלכדת עם ממוצע שווה-משקל.
- היכן מוצג: analytics (כרטיסי "ממוצע משוקלל" ו-"משקל מקצועות"), certificates (badge לכל תלמיד — רק כשהוגדרו משקלים), ai-pedagogical + pedagogical-pdf (ממוצע משוקלל בנוסף לניתוח האיכותני הקיים).
- בכוונה לא שונו: reports.functions.ts, performance-score.ts, seating-wizard.functions.ts, public-class.functions.ts, p.$token.tsx — ממוצע פשוט, כדי לא לשנות דוחות היסטוריים ונתונים שהורים כבר ראו.

### 1.2 Circuit breaker ל-AI Gateway — ✅ מיושם (אוגוסט 2026)
- מבנה: state in-memory ברמת המודול ב-src/lib/ai-gateway.server.ts, משותף ל-callLovableAI ול-callLovableAIEmbeddings — שתיהן פוגעות באותה מכסת Lovable AI Gateway, ולכן כשל שאחת רואה חוסם מיידית גם את השנייה.
- חלונות: 429 ⇒ 60 שניות (מתאושש לבד). 402 ומפתח חסר ⇒ חלון probe של 5 דקות: ניסיון בודד בסוף החלון, כדי שהוספת קרדיטים/מפתח תיתפס בלי restart.
- בתוך החלון: אין fetch כלל. callLovableAI זורק את אותה הודעה בעברית (חוזה throwing), callLovableAIEmbeddings מחזיר null (חוזה non-throwing) — שני החוזים נשמרו במדויק, ואף אחד מ-16 הקוראים לא שונה.
- איפוס: תגובה 200 סוגרת את ה-breaker. שגיאות אחרות (5xx / 400 / שגיאת רשת) אינן פותחות אותו — הן נקודתיות ולא מעידות על מכסה.
- לוגים: [AI Breaker] open <reason> בפתיחה, [AI Breaker] closed באיפוס.

**כל הפערים שתועדו בסעיף 1 הושלמו.**

---

## 2. מה כבר קיים בפועל ומאומת — לא לגעת, לא לייבא מחדש

### 2.1 פיצ'רי ליבה — קיימים ומאומתים לעומק
| פיצ'ר | קובץ מרכזי | הערה |
|---|---|---|
| בולטין שבועי | src/routes/_authenticated.bulletins.$classId.tsx | קיים ופעיל |
| נעילת PIN | src/lib/security.functions.ts | salt רנדומלי per-user, SHA-256, timingSafeEqual, server-side. עדיף על Class-Flow |
| הגרלה | src/routes/_authenticated.raffle.$classId.tsx | קיים ופעיל |
| תעודות PDF | src/lib/certificates.functions.ts | יובא בהצלחה, פונטים Heebo מוטבעים |
| סידור הושבה תלת-ממדי | src/routes/_authenticated.classes.$classId.display.tsx | קיים |
| קשר הורים | parents.functions.ts | עדיף על classflow, פער יחיד: אין דירוג/פידבק כוכבים |
| ציונים (OCR+קול+טקסט) | ai-grades.functions.ts | עולה על שני המאגרים האחרים |
| נוכחות | tracking-tab.tsx | שווה-ערך מלא ל-ClassAlign |
| Embeddings/RAG | embeddings.server.ts | המימוש הנכון ליעד |
| RBAC | user-roles.functions.ts | admin/principal/teacher/secretary, RLS |
| מתכנן שבועי | weekly-schedule.functions.ts | עולה על ClassAlign (Supabase ולא רק localStorage) |
| פידבק פדגוגי AI | ai-pedagogical.functions.ts | דוח כיתתי מלא |

### 2.2 תשתית — קיימת ומאומתת
| תשתית | קובץ | פרטים |
|---|---|---|
| בלוגים מובנים | src/lib/logger.server.ts | logEvent/logInfo/logWarn/logError, כותב ל-app_logs, fail-safe. מ-8/8 גם משמש כ-audit log לרולאובר (source: year_rollover) — ראה סעיף 11.2 |
| חיבור OCR→תעודות | src/lib/ai-certificate.functions.ts | analyzeCertificatePhoto + suggestCertificateNotes |
| איחוד AI Gateway | src/lib/ai-gateway.server.ts | callLovableAI/callLovableAIEmbeddings, בשימוש בכל קבצי ה-AI |
| Resend email | src/lib/reminder-alerts.server.ts | שולח מייל HTML RTL אמיתי דרך Resend SDK. הערת TODO(email-provider) בראש הקובץ מיושנת — יש להסיר |
| CSS theme classalign | src/styles.css | בלוק [data-theme="classalign"] מלא קיים |
| Task Automation (cron) | src/server.ts + wrangler.jsonc | ריצה יומית, מחובר ל-Resend |

### 2.3 פיצ'רים חדשים שהתגלו אגב בדיקה (לא הושוו עדיין מול מאגרים אחרים)
class_events, polls+poll_votes, curriculum_units+pacing_recalc_log, lesson_transcripts, student_relations, ingest_jobs, anti-spam.server.ts

---

## 3. docs/lms-gap-analysis.md — תיעוד עצמי של האפליקציה

עודכן בהצלחה ב-2/8/2026 (RBAC ✅, שקלול ציונים ✅ מיושם (אוגוסט 2026), circuit breaker ✅ מיושם (אוגוסט 2026) — תואם לסעיף 1 כאן). פערים נוספים לא בעדיפות נוכחית: אינטגרציות LMS חיצוניות, push notifications, צ'אט צוות, דוחות מוסדיים, iOS+offline, שיתוף משאבים בין מוסדות.

⚠️ טרם עודכן עם ממצאי סעיף 10/11 (5-8/8) — audit log, PDF handoff date, ו-Retry/rollback ב-Settings לא נכללים בגרסה הנוכחית של הקובץ. יש לתעדף עדכון בביקור הבא.

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

1. שיוך מוסדי אוטומטי — ביצירת כיתה נשלף institution_id מ-user_roles של המלמד ונשמר על הכיתה.
2. academic_year — טקסט חופשי בפורמט עברי (תשפ"ז). ברירת המחדל מחושבת מהתאריך ב-src/lib/year-rollover.ts (hebrewYearNumber + formatHebrewYear), והמלמד יכול לערוך בחופשיות.
3. אשף מעבר שנה — src/components/new-class-wizard.tsx. suggestParentClass מציע כיתת אב לפי רצף אותיות עבריות (א→ב→ג…), עם אפשרות לבחור כיתה אחרת או ליצור כיתה עצמאית.
4. העתקת תלמידים — בחירה פרטנית של התלמידים שעולים; מועתקים פרטי תלמיד/הורים/התאמות בלבד (בלי מושב, ציונים, נוכחות או היסטוריה). student_relations מועתקים וממופים למזהי התלמידים החדשים.
5. ארכוב הכיתה הישנה — דרך setClassStatus הקיים, כחלק מהאשף (ניתן לבטל).
6. שלוש שכבות הגנה על ארכיון
   - DB triggers: trg_classes_archived_readonly על classes (חוסם כל עדכון פרט לשינוי status/updated_at) + trg_*_not_archived על students, grades, attendance, behavior_points, discipline_events, class_events, weekly_lessons, student_relations, groups. הפונקציות private.class_is_archived וה-guards הן SECURITY DEFINER בלי הרשאת EXECUTE ציבורית.
   - Server guard: assertClassEditable ב-src/lib/classes.functions.ts מחזיר שגיאה בעברית ("הכיתה בארכיון — החזר אותה לפעילות כדי לערוך") לפני updateClass/deleteClass.
   - UI read-only: באנר ארכיון עם כפתור "החזר לפעילות" בדף הכיתה, הסתרת סרגל הפעולות והמחיקה, ותג "בארכיון · לצפייה בלבד".
7. שרשרת שנים — getClassChain + רכיב YearChain מציגים קישורי "שנה קודמת"/"שנה הבאה" בדף הכיתה, ותג שנת לימוד בכרטיסי הכיתות.
8. Audit log לרולאובר וארכוב (נוסף 8/8) — ראה סעיף 11.2.

לא נגענו ב-curriculum_history_snapshots ו-pacing_recalc_log — הם נשארים ניתנים לכתיבה גם לכיתה בארכיון (חישובי קצב והיסטוריה).

---

## 7ב. מידע רגיש לתלמיד + דוחות מסירה בין מורים (מומש, אוגוסט 2026)

1. טבלה — public.student_profiles, extension 1:1 ל-students (student_id PK), מכילה class_id, sensitive_flags (אבחון/אלרגיה/לקות למידה/סייע/מצב משפחתי/תקרית חריגה/אחר), sensitive_notes, teaching_style_notes, handoff_notes, updated_by, updated_at. נבחרה טבלת extension ולא עמודות על students כדי לשלוט בהרשאות בנפרד ולא לנפח את הטבלה שנקראת בעשרות מקומות.
2. מודל הרשאות (חשוב) — מורה בעל הכיתה + מנהל מוסד בלבד. אין ולא תהיה גישה להורים או לציבור.
   - student_profiles_owner_all — ALL ל-owner הכיתה.
   - student_profiles_institution_admin_select — SELECT בלבד דרך private.is_institution_admin(auth.uid(), c.institution_id). מנהל צופה, לא כותב.
   - GRANTs ל-authenticated ו-service_role בלבד — בלי anon. אין חשיפה בעמודי הכיתה הציבוריים (/c/$slug) ולא בטוקני שיתוף להורים.
   - trg_student_profiles_not_archived — כיתה בארכיון לקריאה בלבד, כמו שאר טבלאות הכיתה.
3. שרת — src/lib/student-profiles.functions.ts: getStudentProfile, upsertStudentProfile (upsert יחיד, בלי היסטוריית גרסאות), listClassProfiles.
4. ממשק — לשונית רביעית "פרופיל תלמיד" ב-student-file-sheet.tsx עם שני אזורים: מידע רגיש (צ'יפים + טקסט חופשי, כולל כיתוב מי רואה) וסגנון/יחס נדרש + הדגשים למורה היורש. תג "עודכן: תאריך" (מוצג גם בפרופיל בודד וגם, מ-8/8, בדוח המסירה PDF — ראה סעיף 11.2). פיצ'ר שוטף — ניתן לעדכן כל השנה.
5. חיבור למעבר שנה — createClass מעתיק את student_profiles באותה זרימה של העתקת התלמידים ו-student_relations, עם אותו mapping-לפי-שם, וכשל בהעתקה זורק שגיאה (לא נכשל בשקט). listRolloverStudents מחזיר hasSensitive/hasGuidance ל-badges בתצוגה המקדימה באשף.
6. מסמך מסירה PDF — src/lib/pdf/handoff-report-pdf.ts, מסומן "מסמך פנימי חסוי". כפתור באשף מעבר השנה (על הכיתה הקודמת) וכפתור בלשונית התלמידים בדף הכיתה. מ-8/8 מציג גם "עודכן לאחרונה: <תאריך>" לכל תלמיד — ראה סעיף 11.2.
7. ⚠️ הערה לתשומת לב עתידית — default privileges ברמת הסכימה — בפרויקט קיימת הגדרת ALTER DEFAULT PRIVILEGES (בבעלות postgres ו-supabase_admin) שמעניקה אוטומטית arwdDxtm ל-anon, authenticated ו-service_role על כל טבלה חדשה ב-public — גם אם המיגרציה כתבה GRANT ... TO authenticated בלבד. בפועל RLS חוסם את anon (אין לו policy), אז זו לא פרצה, אבל זו סטייה מעקרון ה-least privilege. לכן ב-student_profiles הורץ במיגרציה נפרדת REVOKE ALL ON public.student_profiles FROM anon; (אומת: ה-ACL כולל כיום רק postgres/authenticated/service_role). לכל טבלה חדשה עם מידע רגיש — להוסיף REVOKE ALL ... FROM anon; במיגרציה עצמה. תיקון גלובלי של ה-default privileges לא בוצע במכוון (משפיע על כל הטבלאות הקיימות, כולל כאלה שכן צריכות קריאת anon כמו הצגת כיתה ציבורית).

---

## 8. איך להשתמש במסמך הזה מכאן ואילך

1. תמיד לקרוא קוד חי מ-Lovable לפני שמניחים הנחות.
2. קובץ זה הוא כעת המקור היחיד — docs/MERGE_MEMORY.md נמחק ב-4/8.
3. docs/lms-gap-analysis.md הוא מסמך נפרד — לוודא סנכרון לגבי הפערים הפתוחים (כרגע מפגר אחרי סעיפים 10-11 — ראה הערה בסעיף 3).
4. שינויים בקוד נעשים דרך send_message. שינויי תיעוד/Markdown בלבד (בלי build) עדיפים דרך: הכנת קובץ מקומי → המשתמש מעלה ידנית ל-GitHub main → הסנכרון הדו-כיווני מושך אוטומטית — חוסך קרדיטים.
5. שני הפערים המקוריים שתועדו הושלמו: (א) grade_weights ✅ (ב) circuit breaker ל-AI gateway ✅ (אוגוסט 2026).

## 9. Harmony Hub (תוכנית עבודה ישנה) — נבדק מול קוד חי, 5/8/2026

מסמך תכנון ישן "Harmony Hub" (השם הקודם ל"הכיתה שלי") הכיל טבלת פערים A1–A9 ו-23 סעיפי פיתוח. נבדק שורה-שורה מול קוד חי (Lovable ref 5808b731...) ומול docs/lms-gap-analysis.md.

תמצית: רוב הפערים הישנים כבר נסגרו — מעבר שנה/ארכיון, Exams, Events, Insights, RBAC, שקלול ציונים, circuit breaker, פרופיל תלמיד. academic_year מומש אחרת ממה שהוכרע (עברי בלבד, לא עברי+לועזי). Classroom 3D מומש ב-CSS transforms, לא Three.js — יש מצלמה/presets/presentation mode, אין resize/rotate שולחנות ותבניות שמורות. Rewards Campaigns/Leaderboard לא אומת.

פערים שנותרו פתוחים (מאושר מול gap-analysis 2/8): בדיקות RLS אוטומטיות (A1), Google Drive תיקייה שלמה, דוחות מוסדיים, שיתוף משאבים בין מוסדות, push/SMS, צ'אט צוות, Google Classroom, iOS+offline, 3D שולחנות מתקדם, Campaigns/Leaderboard.

מסקנה: תוכנית Harmony Hub לא תעודכן יותר — MERGE_MEMORY.md הוא המקור היחיד להיום והלאה. פירוט מלא לפי סעיף: MERGE_MEMORY_addendum.md (בהיסטוריית השיחה, 5/8/2026).

---

## 10. סבב בדיקה + בקשות פיתוח חדשות — 5/8/2026 (בדיקה מול קוד חי)

בדיקה נוספת בוצעה מול קוד חי (security-settings.tsx, reminder-preferences-card.tsx, student-profiles.functions.ts, handoff-report-pdf.ts, docs/lms-gap-analysis.md) כדי לאמת רשימת פערים שהתקבלה בשיחה נפרדת. כל הממצאים הבאים אושרו כנכונים ומצטרפים לרשימת הפערים הפתוחים.

### 10.1 פערים שאושרו (לא היו מתועדים לפני כן ב-MERGE_MEMORY)

| # | פער | סטטוס מאומת ב-5/8 | סטטוס עדכני (8/8) |
|---|---|---|---|
| 1 | תאריך עדכון אחרון בדוח מסירה (handoff PDF) | ❌ חסר בפועל, תיקון קטן | ✅ בוצע — ראה סעיף 11.2 |
| 2 | התראה למורה על ארכוב כיתה | ❌ לא קיים | ✅ בוצע (9/8) — `class_notifications` + באנר במסך הכיתות, ראה 12.1/12.2 |
| 3 | Audit log ייעודי לרולאובר (מעבר שנה) | ❌ לא קיים | ✅ בוצע — ראה סעיף 11.2 |
| 4 | בדיקות RLS/רולאובר אוטומטיות (test suite) | ❌ לא קיים | ✅ בוצע (9/8 ואילך) — vitest + חבילת טסטי RLS/רולאובר, ראה 12.2 ו-12.4.1 |
| 5 | חיבור trial ל-UI | ❌ "יתום" | ✅ בוצע — כרטיס מצב מנוי/ניסיון ב-/settings, אישורי ניסיון למנהל ו-registration gate, ראה 12.2 |
| 6 | כפתור Retry בכשל שמירה — SecuritySettings | ❌ לא קיים | ✅ בוצע — ראה סעיף 11.1 |
| 7 | כפתור Retry + עדכון אופטימי — ReminderPreferencesCard | ❌ לא קיים | ✅ בוצע — ראה סעיף 11.1 |

### 10.2 עדיין פתוח — דורש החלטת מיכאל (לא קוד)
- סעיף "המשפט שנקטע" (מי צפה/עדכן מידע תלמיד — יומן צפיות מלא מול "מי עדכן אחרון" הקיים) — עדיין לא ידוע הניסוח המדויק שהתבקש.
- פורמט academic_year — כבר הוכרע ומומש בפועל כעברי בלבד (ראה סעיף 7). אם רוצים גם לועזי — זו החלטת מוצר חדשה, לא באג.

### 10.3 בקשות פיתוח חדשות — עדכון סטטוס 8/8

קבוצה A — פיצ'רים חדשים (טרם התחיל):
1. סנכרון לוח שיעורים שבועי ↔ Google Calendar
2. דוח תעודות חודשי מרוכז לפי כיתה (ציונים + הערות מורים) + מסך אישור לפני שליחה
3. שדרוג מסך ניהול מורים — הוספה/עריכה/הסרה, סגנון הוראה, שיוך כיתות מסודר
4. דשבורד מרוכז — התקדמות מורים, כיתות פעילות, משימות פתוחות

קבוצה B — תיקוני UX — ✅ הושלמה במלואה (8/8, ראה סעיף 11.1):
5. Retry ב-SecuritySettings + ReminderPreferencesCard ✅
6. Toast מותאם הקשר (הודעה כללית משודרגת, לפי החלטת מיכאל) ✅
7. עדכון אופטימי + rollback ב-ReminderPreferencesCard ✅

קבוצה C — השלמות אבטחה/ממשל — חלקית (8/8, ראה סעיף 11.2-11.3):
8. תאריך עדכון בדוח מסירה + מסך העברה — ✅ בוצע ב-PDF (מסך "פרופיל תלמיד" הבודד כבר הציג את זה מקודם)
9. מנגנון התראה בין-משתמשי לארכוב כיתה — ✅ בוצע (9/8) דרך `class_notifications` + באנר; אין פעמון גלובלי
10. Audit log לרולאובר — ✅ בוצע (דרך app_logs הקיים, בלי טבלה חדשה)
11. Test suite ל-RLS ולהעתקת תלמידים — ✅ בוצע (vitest + טסטי RLS לכל הטבלאות הרגישות + rollover-copy)
12. חיבור ה-trial הקיים למסך הרשמה + gate לתוכן חינמי — ✅ בוצע (registration gate, כרטיס מנוי, אישורי ניסיון למנהל)

כלומר: קבוצה C נסגרה במלואה. הפירוט ההיסטורי בסעיף 11.3 נשמר כתיעוד של המצב ב-8/8 בלבד.

---

## 11. ביצוע בפועל — קבוצה B + חלק מקבוצה C, 8/8/2026

### 11.1 קבוצה B — Retry ו-rollback ב-Settings (commit 55a9dc3)

src/components/security-settings.tsx:
- נוספו saveFailed/disableFailed state נפרדים מ-err הכללי, כדי שכפתור "נסה שוב" יופיע רק על כשל שמירה אמיתי (לא validation).
- כפתור "נסה שוב" (אייקון RotateCcw) ליד הודעת השגיאה בשני הדיאלוגים (הגדרת/שינוי PIN, כיבוי נעילה) — קורא שוב ל-handleSave/handleDisable בלי לסגור דיאלוג או לאבד קלט.
- Toast ממוקד: "עדכון ה-PIN נכשל — נסה שוב" / "שמירת ה-PIN נכשלה — נסה שוב" / "כיבוי הנעילה נכשל — נסה שוב".

src/components/reminder-preferences-card.tsx:
- snapshotRef שומר את הערכים לפני שינוי; onError מבצע rollback אמיתי אליהם.
- attemptedRef שומר את הערכים שהמשתמש ניסה לשמור; כפתור "נסה שוב" שולח אותם מחדש (לא את מה שחזר אחרי rollback).
- הודעת שגיאה כללית משודרגת (לפי בחירת מיכאל — לא לפרק לפי סוג שדה): "שמירת ההעדפות נכשלה — הערכים הוחזרו למצב הקודם. נסה שוב."

Type-checking עבר (tsgo --noEmit). עלות: 2.3 קרדיטים.

### 11.2 קבוצה C חלק א' — Audit log + תאריך PDF (commit 8a21569)

החלטת ארכיטקטורה חשובה: נבדק ואומת שאין טבלת audit_log ייעודית בפרויקט כלל — מה שתועד בעבר כ"audit log לניהול מוסדות/תפקידים" מתבסס בפועל על app_logs (הטבלה הגנרית הקיימת: level/message/context jsonb/source/user_id/created_at, נכתבת דרך logInfo/logWarn/logError/logEvent ב-logger.server.ts). לכן audit log לרולאובר לא דרש טבלה חדשה — רק קריאות logInfo נוספות עם source: "year_rollover".

src/lib/classes.functions.ts:
- import { logInfo } from "@/lib/logger.server" נוסף.
- createClass — אחרי יצירה מוצלחת: logInfo("מעבר שנה: נוצרה כיתה חדשה" | "כיתה חדשה נוצרה", { source: "year_rollover", userId, context: { newClassId, newClassName, parentClassId, copiedStudents, archivedParent } }).
- setClassStatus — כשה-status הופך ל-"archived" בלבד (לא בשחזור ל-active): logInfo("כיתה הועברה לארכיון", { source: "year_rollover", userId, context: { classId } }).
- הסוכן ב-Lovable תחילה שם את קריאת הארכוב בפונקציה הלא נכונה (updateClass), זיהה את הטעות בעצמו תוך כדי ביצוע, ותיקן ל-setClassStatus — מתועד לשקיפות.

src/lib/pdf/handoff-report-pdf.ts:
- HandoffProfile כולל כעת updated_at?: string | null.
- buildHandoffPdfBlob מדפיס "עודכן לאחרונה: <תאריך בעברית>" מיד אחרי שם התלמיד, כשהשדה קיים.
- גילוי משמעותי: listClassProfiles כבר החזיר updated_at לפני התיקון הזה (לא היה צריך migration) — החוסר היה רק בחיווט ל-type וב-PDF עצמו. מסך "פרופיל תלמיד" הבודד (student-file-sheet.tsx) כבר הציג "עודכן: תאריך" גם לפני התיקון — הפער היה ספציפית בדוח המסירה המרוכז (PDF) ובאשף הרולאובר, לא במסך הבודד.

Type-checking עבר. עלות: 1.6 קרדיטים.

### 11.3 קבוצה C — מצב היסטורי ב-8/8 (נסגר לאחר מכן — ראה סעיף 12)

> ⚠️ הסעיף הזה מתאר את המצב בתאריך 8/8/2026 בלבד. שני הפריטים שנרשמו כאן כ"נותר לביצוע" **בוצעו** ב-9/8 ואילך: התראת ארכוב כיתה מומשה כ-`class_notifications` (12.1/12.2), ותשתית הטסטים הוקמה ב-vitest עם חבילת טסטי RLS ורולאובר (12.2, 12.4.1). נשמר לתיעוד השתלשלות ההחלטות.

מנגנון התראה בין-משתמשי לארכוב כיתה — נבדק: אין שום טבלת notifications בפרויקט (הטבלה היחידה שנמצאה בחיפוש, sent_reminder_alerts, היא deduplication פשוט לתזכורות קיימות — לא מנגנון כללי). ביצוע דורש:
- טבלה חדשה + RLS (מי רואה מה)
- החלטת עיצוב UI: פעמון בממשק? באנר במסך הכיתות? משהו אחר?
- migration אמיתי — לא ניתן לבצע ללא אישור וללא תכנון UX מוקדם.

Test suite ל-RLS ולהעתקת תלמידים — נבדק: אין תשתית טסטים בפרויקט כלל (לא נמצא אף קובץ *.test.ts/*.spec.ts, ולא נמצאה תלות ל-vitest/jest ב-package). ביצוע דורש הקמת תשתית מאפס — היקף עבודה משמעותי, לא "תיקון קטן".

עדכון: שני הפריטים תוכננו ומומשו לאחר מכן — ההחלטה שהתקבלה הייתה טבלת התראות ממוקדת לארכוב (`class_notifications`) עם באנר במסך הכיתות ולא פעמון גלובלי, ו-vitest כתשתית הטסטים.

חשוב: זהו עדכון תוכן Markdown בלבד. אין לגעת בשום קובץ קוד אחר.

---

## 12. דוח diff — מ-commit 8a21569 (8/8/2026) עד HEAD (9/8/2026)

### 12.0 עקביות DB↔ריפו — מיגרציית notifications הזנוחה (נסגר סופית 11/8/2026)

הטבלה `public.notifications` (מיגרציה `20260808225907`) נוצרה ב-8/8 אך **בוטלה כבר למחרת** — המיגרציה של `class_notifications` (`20260809092949`) פתחה ב-`drop table if exists public.notifications`. אומת מול ה-DB בפועל: קיימת רק `class_notifications`; `notifications` אינה קיימת, ואין אף הפניה אליה בקוד.
לכן, לשם עקביות בין ה-DB לריפו:
- קובץ המיגרציה `20260808225907_...sql` נמחק בזמנו — אך הגרסה עצמה **נשארה רשומה** ב-`supabase_migrations.schema_migrations`, כלומר נוצרה גרסה יתומה בהיסטוריה (רשומה ב-DB בלי קובץ בריפו).
- **ניקוי 11/8/2026:** הוחזר קובץ `20260808225907_21d89609-....sql` כ-**tombstone/no-op** — הוא אינו יוצר שום טבלה, אלא רק מאמת ב-`do $$ ... $$` ש-`public.notifications` אינה קיימת ונכשל אם היא חזרה. כך היסטוריית ה-DB והריפו זהות בלי להחיות את הטבלה. לא נמחקה שום שורת היסטוריה מ-`schema_migrations`.
- שורת ה-`drop table if exists public.notifications;` הוסרה מראש מיגרציית `class_notifications` (אין יותר טבלה למחוק).

**ניקוי נתונים יתומים (אומת 11/8/2026 מול ה-DB):** ב-`public.class_notifications` 5 שורות, מהן 0 עם `class_id` שאינו קיים ב-`classes`, 0 עם `recipient_id` שאינו קיים ב-`auth.users`, ו-0 התראות שנקראו מעל 90 יום. חיפוש אובייקטים שרידיים בשמות `%notif%` בסכמות `public`/`private` מחזיר רק את `class_notifications` (טבלה, pkey, אינדקס `class_notifications_recipient_unread_idx`, וטיפוסי השורה) — אין טבלה, פונקציה, טיפוס enum או policy יתומים משאריות המיגרציה שבוטלה. אין צורך במיגרציית מחיקה.
מסקנה מתועדת: מנגנון ההתראות בפרויקט הוא **`class_notifications` בלבד** (התראת ארכוב כיתה לבעלים). אין טבלת notifications גנרית — אם יידרש מנגנון רחב, זו תוספת חדשה ולא "החזרה" של הטבלה שנמחקה.

### 12.1 DB — מיגרציות שנוספו בתקופה

| מיגרציה | תוכן |
|---|---|
| `20260809092949` | `public.class_notifications` + policies `class_notifications_recipient_select/update` + REVOKE anon + GRANT select/update ל-authenticated |
| `20260809093401` | `GRANT EXECUTE` על `private.is_institution_admin(uuid,uuid)` ל-authenticated/service_role, `REVOKE` מ-anon/public |
| `20260809111211` | `students.first_name` + `students.last_name`, backfill חד-פעמי מ-`name` (עם השהיית טריגר הארכוב), ועדכון `sync_student_name()` |
| `20260809143704` | `public.access_requests` (user_id, email, requested_role, institution_name, message, status, reviewed_by/at) + RLS: הגשה/צפייה עצמית, צפייה ל-admin+principal, עדכון/מחיקה ל-admin בלבד + REVOKE anon |
| `20260809144854` | `students.middle_name` + `sync_student_name()` מרכיב שם מלא מ-first/middle/last |

### 12.2 פיצ'רים שהושלמו

- **התראת ארכוב כיתה** — `src/lib/notifications.functions.ts` (`listUnreadClassNotifications`, `markNotificationRead`), כתיבת התראה ב-`setClassStatus` כשמנהל מארכב כיתה של מורה אחר, באנר במסך הכיתות. **סוגר את פריט C-9 שהיה פתוח בסעיף 11.3.**
- **תשתית טסטים + סגירת פער A1** — vitest, `src/test/helpers.ts` (משתמשי טסט, anonClient, מוסדות, grantRole), 14 קבצי טסט: RLS ל-classes/students/reminders/behavior_points/grade_weights/institutions/class_notifications/student_profiles/access_requests, ולוגיקה טהורה ל-hebrew-date/student-field-validation/grade-weighting/roster-merge/ai-gateway-breaker/rollover-copy. חילוץ `src/lib/roster-merge.ts` מתוך `commitRoster`. CI מריץ `bun run test`. **סוגר את פריט C-11 שהיה פתוח בסעיף 11.3.**
- **פרטי תלמיד מלאים** — first/middle/last name בכל השרשרת: מיפוי עמודות בייבוא (כולל זיהוי אוטומטי מכותרות עבריות), טבלת סקירה, מיזוג שדה-שדה שלא מוחק ערכים קיימים, כרטיס פרטי קשר, יום הולדת עברי בכרטיסי כיתה וביומן, guard על `classId`.
- **שדרוג ספריית חומרי הוראה** — מועדפים, רמת קושי, נגישות מקלדת (`src/hooks/use-tablist-keys.ts`), שני מחוללים פדגוגיים.
- **מנוי ואישורי גישה (חדש, לא היה בידיעה)** — `src/lib/trial-admin.server.ts` + `listUserTrials`/`extendUserTrial`, כרטיס `src/components/trial-approvals-card.tsx` (אישור +30 יום / שנה בלחיצה), `src/components/subscription-status-card.tsx` עם פנייה למנהל, וקישור "ניהול משתמשים" בהגדרות **חסום למנהל בלבד**.
- **בקשות הרשאה (חדש)** — `src/lib/access-requests.functions.ts`, `access-request-form.tsx`, `access-requests-card.tsx`; `canManageUsers` מאפשר גם ל-principal לצפות בתור (קריאה בלבד), פעולות הרסניות נשארות admin-only ונאכפות בשרת.
- **פישוט מסך /ingest (חדש)** — הוסרו שלושה כרטיסי העלאה כפולים; נשארה העלאה חכמה אחת, והעלאה לפי סוג מדויק מוסתרת מאחורי toggle. כל שורה בהיסטוריה נפתחת (כולל jobs שאושרו) עם מסך מתאים במקום מסך ריק.
- **קשיחות שרשרת אספקה (חדש)** — `@cloudflare/vite-plugin` 1.51.1, `undici` מוצמד ל-8.10.0 דרך overrides+resolutions, dependabot + workflow לסנכרון lockfile, SLSA/SBOM ב-ci/release. אומת עם `bun install --frozen-lockfile` + build נקי.
- **SEO** — תיקון דילוג על רמות כותרות (`CardTitle as=`), מטא-דאטה עברית מקוצרת, RSS/JSON-LD, טופס לידים לשותפים עם hCaptcha.

### 12.3 פתוח / התחיל ולא נגמר

- `notifications` הגנרי — **סגור, לא חוב**: בוטל במכוון, ההיסטוריה יושרה ב-11/8 עם tombstone ואומת שאין שאריות DB או שורות יתומות (12.0). מה שקיים הוא התראת ארכוב בלבד; פעמון גלובלי/סוגי התראות נוספים לא מומשו — וזו תוספת עתידית אופציונלית, לא חוב פתוח מהמיגרציה.
- 10.2 — יומן צפיות מלא במידע רגיש: עדיין רק "מי עדכן אחרון", בלי audit של קריאות.
- פערי סעיף 9 ללא שינוי: סנכרון Google Calendar, דוח תעודות חודשי מרוכז + מסך אישור, דשבורד מרוכז להתקדמות מורים, Google Drive תיקייה שלמה, שיתוף משאבים בין מוסדות, push/SMS, צ'אט צוות, Google Classroom, iOS+offline, 3D שולחנות מתקדם, Campaigns/Leaderboard.

### 12.4 אימות אחרי הסרת מיגרציית `notifications` (9/8/2026)

**טבלאות:** `public.class_notifications` קיימת; `public.notifications` **לא קיימת** ואין אליה אף הפניה בקוד (`rg` על `from("notifications")` — 0 תוצאות). 56 base tables ב-`public`.

**הרשאות שנבדקו על `class_notifications`:** `authenticated` = SELECT/INSERT/UPDATE ✔, `service_role` = מלא ✔, `anon` = ללא הרשאה בכלל ✔. Policies: `class_notifications_recipient_select`, `class_notifications_recipient_update` בלבד (אין INSERT/DELETE ללקוח — נכתב רק ב-service role מתוך `setClassStatus`).

**טסטים:** 16 קבצי טסט / 91 טסטים עוברים (ספירה מעודכנת אוגוסט 2026), כולל `src/test/rls-class-notifications.test.ts` (5) ו-`src/test/notifications-flow.test.ts` (6, חדש) — טסט זרימה מקצה-לקצה שמשחזר בדיוק את השאילתות של `listUnreadClassNotifications` / `markNotificationRead`: סינון לפי `recipient_id`, סינון `read_at is null`, סימון כנקרא שמוציא מהרשימה, אי-אפשרות לסמן התראה של מישהו אחר, ווידוא שטבלת `notifications` אכן לא קיימת.

#### 12.4.1 כיסוי טבלאות ותיקי טסטים (קצת מעודכן)

| קבוצת טבלאות | טבלאות נבדקות | קבצי טסט | מספר `it()` |
|---|---|---|---|
| RLS כיתות + תלמידים | `classes`, `students`, `student_relations`, `groups`, `seating_configs` | `rls-classes.test.ts`, `rls-students.test.ts`, `rollover-copy.test.ts` | 3 + 4 + 4 = 11 |
| RLS נתוני כיתה | `behavior_points`, `grade_weights`, `reminders`, `curriculum_units` | `rls-behavior-points.test.ts`, `rls-grade-weights.test.ts`, `rls-reminders.test.ts` | 3 + 3 + 4 = 10 |
| RLS מוסדות + תפקידים | `institutions`, `user_roles`, `access_requests`, `trial_extension_requests` | `rls-institutions.test.ts`, `rls-access-requests.test.ts`, `rls-trial-requests.test.ts` | 9 + 9 + 7 = 25 |
| RLS מידע רגיש והתראות | `student_profiles`, `class_notifications` | `rls-student-profiles.test.ts`, `rls-class-notifications.test.ts`, `notifications-flow.test.ts` | 5 + 5 + 13 = 23 |
| לוגיקה עסקית | שקלול ציונים, תאריכים עבריים, אימות שדות תלמיד, מיזוג roster | `grade-weighting.test.ts`, `hebrew-date.test.ts`, `student-field-validation.test.ts`, `roster-merge.test.ts` | 8 + 10 + 10 + 7 = 35 |
| תשתית | Circuit breaker AI Gateway, כיסוי קישורי ניווט | `ai-gateway-breaker.test.ts`, `route-link-coverage.test.ts` | 7 + 3 = 10 |

**סה"כ:** 18 קבצים, 114 מקרי בדיקה (`it()`) — ספירה בפועל ב-11/8/2026.

#### 12.4.2 קישורים לטסטים מרכזיים לבדיקות עתידיות

- **זרימת התראות ארכוב (class_notifications):** `src/test/notifications-flow.test.ts` — מסמך מקצה-לקצה לבדיקה עתידית של כל שינוי ב-`src/lib/notifications.functions.ts`.
- **RLS כללי:** `src/test/rls-classes.test.ts`, `src/test/rls-students.test.ts`, `src/test/rls-institutions.test.ts` — הדגלנים של בדיקות הרשאות.
- **מידע רגיש:** `src/test/rls-student-profiles.test.ts` — בדוק בעדכונים עתידיים של `src/lib/student-profiles.functions.ts` או `public.student_profiles`.
- **תשתית AI:** `src/test/ai-gateway-breaker.test.ts` — בדיקה חיונית לשינויי תעריף/מכסה ב-`src/lib/ai-gateway.server.ts`.
- **חישובים / תאריכים:** `src/test/grade-weighting.test.ts`, `src/test/hebrew-date.test.ts` — רגרסיות בממוצעים משוקללים או בלוח השנה העברי.

**פערי schema prod↔repo:** נמצאו 6 טבלאות שנוצרו בעבר ידנית ב-SQL בלי מיגרציה בריפו — `curriculum_units`, `class_pacing_settings`, `academic_calendar_overrides`, `curriculum_history_snapshots`, `pacing_recalc_log`, `seating_wizard_prefs`. נוספה מיגרציית **baseline אידמפוטנטית** שמתעדת אותן (CREATE TABLE IF NOT EXISTS + GRANTs + RLS + policies בתוך `DO $$ IF NOT EXISTS`) וגם **מבטלת גישת anon** לשש הטבלאות (הן היו עם `GRANT SELECT` ל-anon, חסום בפועל ע"י RLS). אחרי המיגרציה אין פערי טבלאות בין prod לריפו.

#### 12.4.3 שומר CI לסינון recipient בהתראות (9/8/2026)

נוסף job נפרד `notifications-guard` ב-`.github/workflows/ci.yml`, שרץ בכל push ובכל pull request במקביל ל-job `build`:

- מריץ `bun run test:notifications` בלבד — `src/test/notifications-flow.test.ts` + `src/test/rls-class-notifications.test.ts` (11 טסטים, כולל recipient לא תואם ובידוד `institution_admin`).
- **נכשל ולא מדלג:** אם אחד מ-`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` חסר — ה-job נכשל עם שגיאה מפורשת. הסיבה: הסוויטות משתמשות ב-`describe.skipIf(!hasTestEnv)`, ולכן בלי הסודות הריצה הייתה יורקת ירוק גם אם הסינון נשבר.
- אחרי הריצה נבדק דוח ה-JSON: אם `passed === 0` או שיש טסט שדולג — ה-job נכשל. הדוח נשמר כ-artifact (`notifications-report-<sha>`, 30 יום).
- ה-job `build` ממשיך להריץ את כל הסוויטה; `notifications-guard` הוא סיגנל נוסף וממוקד לגבול הפרטיות של ההתראות.

#### 12.4.4 ביטול גישת anon לכל טבלאות public (11/8/2026)

- **מיגרציה:** `REVOKE ALL ... FROM anon` על 43 טבלאות ב-public (`classes`, `user_roles`, `institutions`, `student_documents`, `parent_communications`, `discipline_events` ועוד). RLS הגן עליהן בפועל, אז זו הגנת-עומק ולא סגירת פרצה. השורש הוא `ALTER DEFAULT PRIVILEGES` בבעלות `supabase_admin` שלא ניתן לשינוי מ-`postgres` — לכן הפתרון הוא REVOKE נקודתי, וכל טבלה חדשה עשויה להיווצר שוב עם anon עד שהאודיט יתפוס אותה.
- **חריגים מכוונים:** `checklist_leads`, `partner_leads` — טפסי לידים ציבוריים ש-server functions שולחות דרך ה-publishable client (תפקיד anon). הן קיבלו `GRANT INSERT` בלבד (בלי SELECT) והן ב-`ANON_ALLOWLIST` של `scripts/check-table-grants.mjs`.
- **תיקון באודיט עצמו:** הסקריפט קרא `information_schema.role_table_grants`, שמציג רק grants שהתפקיד המחובר רשאי לראות — ולכן החזיר "נקי" גם כשהיו 43 grants. הוא קורא כעת את ה-ACL ישירות מ-`pg_class` דרך `aclexplode`. אין להחזיר את השאילתה הקודמת.
- **דגל לא-חוקי:** `src/test/rollover-copy.test.ts` השתמש ב-`"health"` שאינו ב-`SENSITIVE_FLAGS`; הוחלף ל-`"allergy"` (התלמיד בטסט נושא דגל רפואי).

---

## 13. עמוד הגדרות מאוחד — מומש (עודכן 11/8/2026)

**למה זה נבנה:** מיתוג, אבטחה (PIN) ותזכורות כבר היו קיימים ומחוברים בפועל — אבל הם ישבו בתוך `/toolkit` (בלשוניות "אבטחה" / "תזכורות" / "מסמכים ותבניות") ובקיצור `Ctrl+K` בלבד, בלי נקודת כניסה ברורה מה-header. מצב הניסיון/מנוי לא הוצג בשום מקום קבוע. כלומר זהו **תיקון ניראות וארגון, לא בנייה מאפס**.

### 13.1 מיקום וניווט

- **Route:** `src/routes/_authenticated.settings.index.tsx` → `/settings` (מרכז ההגדרות).
- **Header ראשי:** קישור "הגדרות" בניווט העליון (`src/routes/_authenticated.tsx`, שורה ~127), ליד ארגז כלים / ספרייה / תובנות — נגיש מכל מסך.
- **תת-routes נפרדים ללא שינוי:** `/settings/brand` (`_authenticated.settings.brand.tsx`) ו-`/settings/theme` (`_authenticated.settings.theme.tsx`).
- **ניווט פנימי:** `src/components/settings-tabs.tsx` מציג לשוניות: כללי, אבטחה, תזכורות, מסמכים, מותג (→ `/settings/brand`), ערכת נושא (→ `/settings/theme`).

### 13.2 תוכן העמוד (מה שקיים בקוד)

1. **כללי** — `SubscriptionStatusCard` + `ThemePickerCard`.
2. **מצב ניסיון / מנוי** — `src/components/subscription-status-card.tsx` קורא ל-`getMyTrialStatus` (`src/lib/trial.functions.ts`) ומציג ימים שנותרו, תאריך סיום, ובקשות הרחבה ממתינות.
3. **אבטחה** — `SecuritySettings` (נעילת PIN, שינוי קוד, כיבוי נעילה).
4. **תזכורות** — `ReminderPreferencesCard` (העדפות תזכורות/מיילים, עדכון אופטימי עם rollback).
5. **מיתוג** — כרטיס עם קישור ל-`/settings/brand` הקיים; העמוד עצמו לא הוזז ולא שוכפל.
6. **כרטיסי ניווט נוספים** — קישורים לכלים/ספרייה ולניהול (`isAdmin`), ו-`HomeQuickNav`.

### 13.3 מצב הכפילות מול /toolkit — נבדק בקוד (11/8/2026)

- **הרכיבים הוזזו, לא שוכפלו:** לשונית "הגדרות" ב-`src/routes/_authenticated.toolkit.tsx` מרנדרת כיום **רק כרטיסי קישור** (`ToolLinkGrid` מתוך `src/lib/tool-registry.ts`, section `settings`) — "מרכז ההגדרות" (`/settings`), "ערכות נושא", "לוח המוסד", "ניהול משתמשים", "השוואת ערכות נושא". `SecuritySettings` ו-`ReminderPreferencesCard` **אינם** מיובאים שם יותר; הם קיימים במופע אחד בלבד, ב-`/settings`.
- **מה שנשאר ב-/toolkit:** ארגז כלים פדגוגי/תפעולי — כלים, צלצולים וסאונד, מוטיבציה ופרסים, הערכה ומבחנים, מסמכים ותבניות.
- **Command palette:** `Ctrl+K` עדיין מצביע ל-`/settings/brand` ותקין — לא השתנה.
- **הפרדת אחריות:** `/settings` = הגדרות משתמש/מוסד (אבטחה, תזכורות, מנוי, מיתוג, ערכת נושא); `/toolkit` = כלים + קישורי ניווט להגדרות.
