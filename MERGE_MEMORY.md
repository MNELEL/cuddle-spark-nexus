# MERGE_MEMORY.md
> מסמך זיכרון קבוע לפרויקט מיזוג האפליקציות. עדכן אותו בכל שיחה חדשה כדי לא לאבד החלטות.
> יעד סופי: **Lovable**. הפרויקט החי: **"הכיתה שלי"** (שם קודם: Harmony Hub; repo: `cuddle-spark-nexus`), פרויקט Lovable ID `2734475a-1431-4ef2-8175-67b8af357276`.
*עReplace the top "עדכון אחרון" line with:
*עדכון אחרון:* 23 באוגוסט 2026 — ראה סעיף 18: 8 קומיטים לא-מתועדים אותרו ונבדקו (ייבוא Google Drive מלא, מסך כללים קבועים /schedule-rules, היסטוריית שינויים בניהול מורים, שיפורי עמוד דוחות). הפרויקט ואותרו **17 קומיטים לא-מתועדים** בין הקומיט האחרון שתועד בסעיף 14 (13:41) ל-HEAD בפועל (20:10, אותו יום). כל קומיט נבדק ישירות מול `get_diff`. נמצאו שלושה מסכים חדשים שלא היו מתועדים כלל — מפת מערכת (`/map`), דף קשר מוסדי (`/contact-sheet` + `/contact` ציבורי), ודף קשר שבועי להורים (`/weekly-sheet`) — וכן הרחבה משמעותית לספריית חומרי ההוראה (העלאה מרובה עם OCR, עורך סיווג/תגיות, עורך OCR, חומרים דומים, הורדה מרוכזת ל-ZIP). נמצא גם קובץ תכנון חדש `docs/ROADMAP.md` (11/8) שמחליף את `plan.md` שנמחק — אומת ש"PDF widow-control" מ-`plan.md` הישן כבר מיושם בפועל ב-`pdf-builder.ts`. **מסקנת מפתח: תיעוד "עדכון אחרון" בראש הקובץ אינו ערובה שאין קומיטים נוספים אחריו באותו יום — יש להריץ `list_edits` בתחילת כל שיחה.** לפני כן, באותה שיחה: אומת מול קוד ש"תוכנית תצוגה מקדימה + היסטוריית עלונים ונעילה" (11/8) בוצעה במלואה — preview דיאלוג, publish/unpublish, היסטוריית גרסאות, וייצוא טקסט לעלון ולתעודות — ולא נדרשה בנייה נוספת.

**היסטוריה קודמת (12/8, מוקדם יותר):** ראה סעיף 14: אומת מול קוד חי ש"תוכנית פישוט ספריית חומרי הוראה" (original_text, שמירת קובץ מקור, resource_chunks, UI מפושט) הייתה **כבר מיושמת במלואה**, נמנעה בנייה כפולה מיותרת. נוסף בפועל רק הפער האמיתי: הצעת נושא (topic) ואוסף (collection) אוטומטית ב-/ingest לחומרי לימוד, עם ולידציה בצד השרת נגד המצאת מזהים. קודם לכן, 11 באוגוסט 2026 — בוצע ניקוי ה-notifications היתומות: הוחזר קובץ tombstone/no-op למיגרציה `20260808225907` (גרסה שהייתה רשומה ב-DB בלי קובץ בריפו), אומת שאין שאריות DB (`%notif%` = רק `class_notifications`) ואין שורות יתומות ב-`class_notifications`, וסעיפי 12.0/12.3 עודכנו — הפריט סומן כ**סגור** ולא כחוב פתוח. קודם לכן: יושרו סעיפים 10.1, 10.3 ו-11.3 מול סעיף 12: קבוצה C נסגרה במלואה (התראת ארכוב כיתה דרך `class_notifications`, תשתית טסטי vitest/RLS, וחיבור ה-trial ל-UI), ו-11.3 סומן כתיעוד היסטורי של 8/8 בלבד. קודם לכן: עודכן סעיף 13 (עמוד ההגדרות המאוחד) מול קוד חי: תועד שתוכן ההגדרות הוזז בפועל מ-/toolkit ל-/settings ולא נשאר כפול, ונוספו לשוניות ההגדרות ו-/settings/theme. קודם לכן: עודכן סעיף 12.4.1 עם ספירת טסטים מדויקת נכון להיום (כולל rls-student-profiles המורחב ו-rollover-copy המתוקן), ותאריך סעיף 12.4.4 אומת ל-11/8.

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

--

## 14. אימות ספריית חומרי הוראה + הצעת נושא/אוסף אוטומטית ב-ingest — 12/8/2026

### 14.1 רקע — תוכנית ישנה שהתבררה כבר מיושמת

התקבלה תוכנית בשם "ספריית חומרי הוראה — פישוט הממשק + שמירת המקור כפי שהוא" לביצוע. לפני שליחה ל-Lovable נבדק קוד חי (src/lib/ingest.functions.ts, src/routes/_authenticated.resources.index.tsx, src/lib/teaching-resources.functions.ts) ונמצא שכל התוכנית **כבר מיושמת**:
- original_text נשמר במלואו ב-ResourceExtracted, בלי שכתוב, עם הנחיה מפורשת בפרומפט.
- commitResource מעביר את הקובץ המקורי מ-ingest-staging ל-teaching-resources bucket במקום למחוק אותו, ושומר file_path + mime_type.
- resource_chunks table + indexResourceChunks קיימים ומחוברים גם ל-commitResource וגם ל-commitLessonAudio.
- תמלול שיעור נשמר כחומר מלא בספרייה (resource_type: "summary"), לא רק כמאגר שאלות.
- ResourceViewerDialog כולל מצב "המקור המלא" מתקפל + כפתור הורדת קובץ מקורי.
- מסך /resources מפושט: תפריט "הוסף חומר" יחיד, סינון מקופל עם מונה פעיל, כרטיס נקי (כוכב + עריכה/וריאציה בלבד).

מסקנה: נמנעה בנייה כפולה מיותרת של פיצ'ר שלם. תואם לעיקרון הקבוע במסמך זה (סעיף "הערה קריטית") — קוד חי תמיד קודם להנחות.

### 14.2 הפער האמיתי שאותר ותוקן — הצעת נושא/אוסף אוטומטית

הפער היחיד שנמצא בפועל מול התוכנית: analyzeResource לא הציע topic_id או collection, ו-ResourcePreview לא כללה שדות לבחירתם. תוקן (commit 3091464, 3.2 קרדיטים):

- src/lib/ingest.functions.ts — analyzeResource מקבל כעת candidates (topics + collections של ה-owner), מעביר אותם לפרומפט עם הנחיה מפורשת "בחר רק מזהים מהרשימה, אל תמציא". התוצאה מסוננת שוב בקוד מול Set של המזהים האמיתיים (topicIds.has / collIds.has) — כפל הגנה נגד הזיה. ResourceExtracted הורחב עם suggested_topic_id, suggested_collection_ids, topic_confidence.
- commitResource מקבל collection_ids (עד 10), ומכניס ל-resource_collection_items ב-insert אחד.
- src/routes/_authenticated.ingest.tsx — ResourcePreview כוללת כעת Select לנושא (עם listTopics) ו-checkboxes לאוספים (עם listCollections), מסומנים מראש לפי הצעת ה-AI, עם תג "הצעת AI · X%" ליד הנושא.
- מחוץ להיקף בכוונה: commitAuto ו-commitLessonAudio לא שונו. אין migration — topic_id ו-resource_collection_items כבר היו קיימים.

## 14. Breadcrumb ל-/settings + תרגום מסכי 404/שגיאה — מומש (12/8/2026)

### רקע — אימות מול קוד חי לפני בנייה

מתוך חמש משימות `/settings` שהיו ב-queue ממתין (ראה סעיפים קודמים), בוצע אימות מול קוד חי לפני כל תכנון. התוצאה: שתיים מהחמש התבררו כמומשות כבר במלואן ולא נכללו בעבודה:

- **Active-tab state** — כבר מומש במלואו: `?tab=` search param, `validateSearch`, `SettingsTabs active`. אין צורך בפעולה.
- **Audit logging לשינויי הגדרות** — כבר מומש במלואו: `logInfo` עם `source: "settings_update"` קיים ב-`setPin`/`disablePin` (`security.functions.ts`) וב-`saveReminderPreferences` (מנגנון reminder-preferences). 0 שורות ב-`app_logs` לא מעידות על באג — פשוט אף אחד לא שינה הגדרות אלה לאחרונה. אין צורך בפעולה.

שתי המשימות הבאות אומתו כפערים אמיתיים ובוצעו:

### 14.1 Breadcrumb ייעודי ל-/settings (במקום "ארגז כלים › הגדרות")

**הבעיה שאומתה:** `/settings`, `/settings/brand`, `/settings/theme` היו רשומים ב-`tool-registry.ts`, ולכן `ToolBreadcrumbs` הציג "ארגז כלים › הגדרות › X" — מטעה, כי `/settings` נגיש ישירות מכפתור "הגדרות" ב-header (לא דרך `/toolkit`), ולא השתקף בו איזו לשונית פנימית (כללי/אבטחה/תזכורות/מסמכים) פעילה.

**מה בוצע (commit `3fbb479d`):**
- `src/components/tool-breadcrumbs.tsx` — מחזיר `null` כש-`pathname.startsWith("/settings")`, כדי לא להציג יותר את ה-breadcrumb הישן דרך ארגז כלים.
- `src/components/settings-tabs.tsx` — נוסף `SETTINGS_TAB_LABELS`, מיפוי `tab id → שם תצוגה` שנגזר מ-`TABS` הקיים (מונע שכפול מחרוזות).
- `src/routes/_authenticated.settings.index.tsx` — breadcrumb חדש בראש הדף: "הגדרות › \<לשונית פעילה\>" (`SETTINGS_TAB_LABELS[tab]`), לא קישור לעצמו.
- `src/routes/_authenticated.settings.brand.tsx` ו-`_authenticated.settings.theme.tsx` — גילוי אגבי: כבר היה קיים רכיב `SettingsBreadcrumb` ישן בקבצים אלה (`current="מותג"` / `current="ערכת נושא"`), לא תועד קודם ב-MERGE_MEMORY. הוחלף ברכיב `SettingsSubBreadcrumb` חדש עם "הגדרות" כקישור פעיל ל-`/settings` ואז `BreadcrumbPage` עם השם מ-`SETTINGS_TAB_LABELS`.
- `src/test/nav-settings.test.ts` — הטסט הקיים `"breadcrumbs exist only on the brand and theme sub-routes"` שהתייחס ל-`SettingsBreadcrumb` הישן הוחלף ב-`"settings area shows dedicated breadcrumbs, not the toolkit breadcrumb"`, בודק גם את ה-early-return ב-`tool-breadcrumbs.tsx` וגם את השימוש ב-`SETTINGS_TAB_LABELS` בשלושת הראוטים.

### 14.2 תרגום מסך 404 ומסך שגיאה גלובלי לעברית

**הבעיה שאומתה:** `NotFoundComponent` ו-`ErrorComponent` ב-`src/routes/__root.tsx` היו כתובים באנגלית לגמרי ("Page not found" / "Go home" / "Try again" וכו'), בניגוד לכל שאר האתר (עברית, RTL).

**מה בוצע (commit `3fbb479d`), שני הרכיבים ב-`src/routes/__root.tsx`:**
- `NotFoundComponent`: "404" נשאר, כותרת → "הדף שחיפשת לא נמצא", תיאור → "ייתכן שהקישור שגוי או שהדף הוסר", כפתור → "חזרה לדף הבית" מפנה ל-`/classes` (נקודת הכניסה האמיתית, לא `/`).
- `ErrorComponent`: כותרת → "הדף לא נטען", תיאור → "משהו השתבש. אפשר לנסות שוב או לחזור לדף הבית", כפתור ראשון → "נסה שוב", כפתור שני → "חזרה לדף הבית" מפנה גם הוא ל-`/classes`.

**היקף:** ללא migration, ללא HITL, ללא קבצים חדשים. Type-checking עבר.

### 14.3 מצב מעודכן של 5 משימות `/settings` המקוריות

| # | משימה | סטטוס |
|---|---|---|
| 1 | e2e tests | ⏳ עדיין פתוח — scope גדול משמעותית, לא בוצע בסבב הזה. דורש התקנת Playwright, `playwright.config.ts`, `e2e/settings.spec.ts`, helper login, CI job נפרד (בדומה ל-`notifications-guard`), והחלטות פתוחות: סביבת ריצה (dev server מקומי מול CI מוצע, לא production), משתמש טסט ייעודי או משותף עם vitest, היקף התחלתי (הוצע: /settings בלבד). |
| 2 | Breadcrumbs | ✅ בוצע (12/8) — סעיף 14.1 |
| 3 | דף 404 בעברית | ✅ בוצע (12/8) — סעיף 14.2 |
| 4 | Audit logging להגדרות | ✅ כבר היה מומש קודם לכן — לא פער אמיתי |
| 5 | Active-tab state | ✅ כבר היה מומש קודם לכן — לא פער אמיתי |

**מסקנה לפעם הבאה:** תמיד לאמת מול קוד חי לפני תכנון — שוב התברר ששני פריטים מתוך חמישה ב-queue כבר היו מומשים במלואם, ופריט שלישי (breadcrumb ב-brand/theme) התברר כקיים בצורה חלקית/ישנה ולא כפי שתועד.

---

## 15. סבב אימות מקיף — מ-HEAD המתועד (13:41, 12/8) עד HEAD בפועל (20:10, 12/8)

בעקבות חשד מפורש שיש בנייה לא מתועדת, הורץ `list_edits` על הפרויקט. אותרו **17 קומיטים** אחרי הקומיט האחרון שתועד בסעיף 14 (`3fbb479d`, breadcrumbs) ועד ל-HEAD בפועל. כל אחד נבדק ישירות מול `get_diff`. שני קבצי תכנון חדשים נמצאו במקביל ותועדו גם הם (15.5–15.6).

### 15.1 מפת מערכת בעברית — `/map` (חדש, לא היה מתועד)

מסך ניווט חדש שמרכז את כל מסכי המערכת במקום אחד, בעברית מלאה, עם קישורים מותאמים לכיתה שנבחרה:

- `src/routes/_authenticated.map.tsx` + `src/lib/system-map.ts` (מקור אמת אחד ל-7 קטגוריות, ~30 פריטים).
- חיפוש חופשי לפי שם/תיאור, סינון לפי קטגוריה, טולטיפ "מה עושים במסך הזה" לכל פריט.
- ייצוא ל-PDF: `src/lib/pdf/system-map-pdf.ts` — אותה רשימה מסוננת, מודפסת לפי קטגוריות.
- נוסף לניווט המהיר (`home-quick-nav.tsx`) ול-`tool-registry.ts` (section settings).
- פריטים שדורשים admin/principal מוסתרים אוטומטית ממורה רגיל.
- ללא טבלת DB — נתונים סטטיים בקוד בלבד.

### 15.2 דף קשר מוסדי — `/contact-sheet` (חדש, לא היה מתועד)

מדריך אנשי קשר של המוסד (הנהלה, ספקים, בריאות וחירום, הורים וקהילה), נפרד מ"דף קשר להורים" (שהיה כבר קיים ומתועד):

- טבלה חדשה `public.contact_entries` (owner_id, class_id אופציונלי, category, name, role, phone, email, notes, sort_order). RLS: `contact_entries_owner_all` — owner בלבד. **הערה לתשומת לב:** המיגרציה (`20260811145422`) לא כוללת `REVOKE ALL ... FROM anon` המפורש שתועד כלקח קבוע בסעיף 7ב.7 — כדאי להוסיף REVOKE נקודתי בביקור הבא, גם אם RLS כבר חוסם בפועל (אומת: `anon` אינו ב-ACL של הטבלה, ראה הרצת `aclexplode` ב-12/8 בתחילת השיחה — אין חשיפה בפועל, רק סטייה מהנוהל התיעודי).
- `src/lib/contact-entries.functions.ts` (list/save/saveMany/delete), `src/lib/contact-defaults.ts` (14 שורות תבנית מוכנות לחיידר/ת"ת: הנהלה, ספקים, בריאות וחירום, הורים וקהילה).
- כפתור "הזנה מראש לפי תבנית" ממלא את כל השורות בלחיצה אחת (נשאר רק להשלים טלפונים).
- ייצוא PDF: `src/lib/pdf/contact-sheet-pdf.ts`, מסודר לפי קטגוריות.
- דף שיווקי ציבורי חדש `/contact` (`src/routes/contact.tsx`) — ערוצי תמיכה, פנייה למוסדות, קישור לדף הקשר הפנימי. נוסף ל-sitemap.xml.

### 15.3 דף קשר שבועי להורים — `/weekly-sheet` (חדש, לא היה מתועד)

תבנית קלאסית של "דף קשר" שבועי לתלמודי תורה — נפרדת לגמרי מ-15.2 ומהעלון השבועי (`/bulletins`) הקיים:

- `src/lib/weekly-sheet.ts` — טיוטה נשמרת ב-`localStorage` בלבד (מפתח לפי כיתה), **אין טבלת DB** ואין נתון רגיש מעורב.
- שלושה עמודי PDF (`src/lib/pdf/weekly-sheet-pdf.ts`): שער עם לוגו המוסד ושם המלמד, עמוד הספק חומר לפי מקצועות (גמרא/משנה/תורה/נביא/הלכה) + מבחנים/הודעות/יישר כח, ודף חתימת הורים עם שדות הערכה ניתנים לעריכה.
- פרשת השבוע מזוהה אוטומטית (`parasha.ts` הקיים) עם אפשרות עריכה ידנית.
- כפתור "איפוס לשבוע חדש" משמר שם כיתה/מלמד ומאפס רק את תוכן השבוע.

### 15.4 שדרוג משמעותי לספריית חומרי הוראה (הרחבה למה שתועד ב-12.2)

סעיף 12.2 תיעד "מועדפים, רמת קושי, נגישות מקלדת, שני מחוללים פדגוגיים" — מאז נוספו יכולות נוספות, לא מתועדות:

- **העלאה מרובה עם OCR אוטומטי** — `src/components/library-bulk-upload.tsx`: עד 20 קבצים במקביל, כל קובץ עולה ל-Storage, נרשם ב-`teaching_resources`, ועובר `analyzeExistingResource` (OCR + סיווג) אוטומטית. חבילת `jszip` נוספה לפרויקט.
- **עורך סיווג ותגיות ידני** — `src/components/resource-classification-editor.tsx`: תיקון סוג/מקצוע/כיתה/רמת קושי/תיאור/תגיות שה-AI קבע, כולל רישום גרסה (`recordResourceVersion`) לפני כל שמירה.
- **עורך טקסט OCR** — `src/components/resource-ocr-editor.tsx`: תצוגת רמת ודאות (`ocr_confidence`, שדה חדש שנוסף ל-`understandResource`), תיקון ידני של הטקסט, אינדוקס מחדש ל-`resource_chunks` אחרי שמירה, וכפתור "הפעל סריקה מחדש".
- **חומרים דומים** — `src/components/similar-resources.tsx` + `getSimilarResources`: מבוסס embedding קיים או מחושב חדש, קורא ל-`match_resources` RPC הקיים.
- **הורדה מרוכזת ל-ZIP** — בחירה מרובה בכרטיסי המשאבים (`Checkbox` על כל כרטיס), `getResourceDownloadLinks` (קישורים חתומים ל-Storage, timeout 10 דקות) + `src/lib/zip-download.ts` (אריזה בצד הדפדפן דרך jszip, עד 60 פריטים).
- כל הפונקציות החדשות ב-`src/lib/library-extras.functions.ts`, מוגנות `requireSupabaseAuth`, ללא חשיפת service-role ללקוח.

### 15.5 תיקוני יציבות קטנים (לא דורשים מעקב נוסף)

- **תצוגת תלת-ממד** (`classroom-3d.tsx`) — תוקן כיוון RTL: עמודה 0 הייתה השמאלית ביותר, עכשיו הימנית ביותר (תואם לרשת ה-2D). נוסף תג "חזית הכיתה" קבוע לכיוון. תואם ל-`billboard` transform מאוחד לשילוט שמחזיק זווית קריאה מכל סיבוב. `smartAssign` מכבד כעת גם `room_objects` כתאים חסומים (לא רק `hidden_seats`).
- **ingest אוטומטי** — נאכף עברית בלעדית בשדה `reasoning` שמוחזר מה-AI (הנחיה מפורשת בפרומפט + סינון תצוגה כגיבוי), ו-`max_value` בציונים אוטומטיים מוגן מפני ערך 0/שלילי (נופל ל-100 כברירת מחדל).
- **MIME של קובצי Word באנדרואיד** — תוקן (לא נבדק diff מפורט; קומיט `90fac78f`, סיכון נמוך, קשור להורדות בלבד).

### 15.6 עדכון ניהול תכנון — `docs/ROADMAP.md` (קובץ חדש, 11/8)

התגלה קובץ תכנון חדש שמחליף את התפקיד שמילא `plan.md`:

- **`plan.md` נמחק בפועל מהריפו** (אומת: `read_file` על `plan.md` מחזיר 404). התוכן שתועד בעבר תחת "נותר לביצוע" בסעיף הישן של MERGE_MEMORY — **PDF widow-control ו-3D performance** — אומת ישירות מול קוד חי: **PDF widow-control כבר מיושם** (`pdf-builder.ts`: `paragraph()` מחלק לעמודים באמצע פסקה בלי לחתוך, `section()` שומר מקום לכותרת + שורות תוכן לפני מעבר עמוד). ביצועי 3D לא אומתו בסבב הזה — לבדוק בביקור הבא אם `dpr`/`frameloop`/`use-device-perf` יושמו.
- `docs/ROADMAP.md` מכריז על עצמו כ"נקודת האמת היחידה לתכנון", מצביע ל-`MERGE_MEMORY.md` (מומש) ו-`docs/lms-gap-analysis.md` (ניתוח) כמקורות הפעילים, ומגדיר ש-`.lovable/plan/` הוא ארכיון היסטוריה בלבד ולא מקור למשימות.
- **`docs/lms-gap-analysis.md` מיושן משמעותית** — עדיין מתויג "עודכן לאחרונה 2/8", מסמן MCP כ-"⚠️ scaffolding בלבד, לא הושלם חיבור agent" ודשבורד מוסד כלא קיים. שניהם שגויים: ה-MCP server (`src/lib/mcp/index.ts`, `harmony-hub`) פעיל לגמרי עם OAuth מול Supabase ו-6 כלים עובדים (`list_classes`, `list_students`, `behavior_summary`, `add_behavior_point`, `create_reminder`, `list_reminders`), ודשבורד המוסד קיים ומתועד כבר בסעיף 2.1/13 כאן. יש לתעדף עדכון של קובץ זה בביקור הבא.

### 15.7 פריט קבוע לתשומת לב — שם ה-MCP server

`src/lib/mcp/index.ts` עדיין מוגדר `name: "harmony-hub"` / `title: "Harmony Hub"` — תואם לפריט הקיים "Phase B rebrand" (שינוי שם מ-Harmony Hub) שכבר מתועד כדחוי. אין פעולה חדשה נדרשת, רק אישור שהפריט הזה הוא הסיבה הקונקרטית.

### מסקנה לפעם הבאה

אישור נוסף לעיקרון הקבוע: אפילו כשקומיט אחרון מתועד נראה "טרי" (אותו יום), יכולים להיות עשרות קומיטים נוספים מעבר לו באותו יום. יש להריץ `list_edits` בתחילת כל שיחה משמעותית ולא להסתמך על "עדכון אחרון" בראש הקובץ כאינדיקציה למצב האמיתי.
---

## 16. Retry נקודתי לקובץ בודד — ספריית חומרי הוראה, 14/8/2026 (commit `45fed75e`)

### רקע — בדיקה מול קוד חי לפני תכנון

הפריט הפתוח "per-file detailed error display during upload, allowed file types/size/page limits sourced from a central constant, progress bar, and per-file retry without stopping the full upload" נבדק מול `src/components/library-bulk-upload.tsx` ו-`src/lib/upload-accept.ts` לפני תכנון. נמצא שרוב הפריט **כבר מיושם**:
- מקור אמת מרכזי לגבולות — `MAX_LIBRARY_UPLOAD_MB`/`MAX_LIBRARY_UPLOAD_FILES` ב-`upload-accept.ts`, מוצג בממשק.
- שגיאה לפי קובץ — `note` על כל שורה עם `AlertTriangle`.
- Progress bar — קיים, `role="progressbar"` עם ספירה חיה.
- Retry — היה קיים כבר, אך **רק גורף**: קבצים שנכשלו נשארו ב-`pending`, וכפתור "המשך העלאה" שלח את כולם יחד מחדש.

הפער האמיתי היחיד: retry לקובץ בודד, עצמאי, בלי לדרוש הרצה מחדש של כל מה שנכשל.

### מה בוצע

`src/components/library-bulk-upload.tsx` בלבד — ללא migration, ללא קבצים חדשים:

- **`uploadOne(file, i)`** — הלוגיקה של קובץ בודד (Storage upload → `createUploadedResource` → `analyzeExistingResource` → `recordUpload`) חולצה מתוך הלולאה שהייתה ב-`uploadFiles`, בלי לשנות התנהגות. מחזירה `boolean` הצלחה/כשלון.
- **`uploadFiles`** ממשיכה לרוץ ברצף על כל הקבצים דרך `uploadOne` — זהה להתנהגות הקודמת.
- **`retryOne(i)`** — פונקציה חדשה, עצמאית: מריצה מחדש `uploadOne` רק לפריט אחד. מצב `retrying` (מערך אינדקסים ב-state) מאפשר כמה ריצות retry מקביליות בו-זמנית, כל אחת עצמאית — לא נעילה הדדית.
- **כפתור "נסה שוב"** (`RotateCcw`, בהשראת התבנית הקיימת ב-`security-settings.tsx`) מופיע רק בשורות עם `status === "error"`. בזמן ריצה — הופך לספינר ומושבת **רק עבור עצמו**; שאר הכפתורים ברשימה נשארים פעילים.
- `pending`, כפתור "המשך העלאה" הגורף, וה-toast המסכם בסוף `uploadFiles` — **ללא שינוי**, כמתוכנן. ה-retry הנקודתי עובד ישירות מול `items` ולא נוגע ב-`pending`.

Type-checking עבר (`tsgo --noEmit`). עלות: 1.9 קרדיטים.

### מצב מעודכן של הפריט "per-file upload UX" ב"על האופק"

✅ **בוצע במלואו** — כל ארבעת חלקי הפריט (שגיאות מפורטות, גבולות ממקור מרכזי, progress bar, retry בודד) קיימים כעת. לא נותר חוב פתוח בנושא זה.
---

## 17. סבב עבודה — 14/8/2026: retry נקודתי, עדכון gap-analysis, Phase B rebrand, ודחייה מכוונת של Playwright e2e ובדיקת 3D

### רקע — פתיחת השיחה

השיחה נפתחה עם `list_edits` (2 עמודים, 59 קומיטים) והשוואה מול `MERGE_MEMORY.md` — נמצא **תיעוד תקין ומעודכן**: הקוד החי תאם בדיוק את הרשום עד commit `479f4580` (13/8, 18:46). זו הפעם הראשונה שאין פער נסתר בפתיחת שיחה. נבדק גם Base44 (classflow, appId `69efc0a68bae1b1d07582eda`) דרך `list_entity_schemas` — 40 entities, זהה למתועד בסעיף 4, ללא שינוי מאז 4/8.

### 17.1 Retry נקודתי לקובץ בודד — ספריית חומרי הוראה (commit `45fed75e`)

הפריט הפתוח "per-file upload UX" (שגיאות מפורטות, גבולות ממקור מרכזי, progress bar, retry לקובץ בודד) נבדק מול `src/components/library-bulk-upload.tsx` ו-`src/lib/upload-accept.ts` לפני תכנון. נמצא שלושה מתוך ארבעה חלקים **כבר קיימים** (`MAX_LIBRARY_UPLOAD_MB`/`MAX_LIBRARY_UPLOAD_FILES` ב-`upload-accept.ts`, שגיאה לפי קובץ, progress bar). הפער האמיתי היחיד: retry היה קיים רק כגורף (כל ה-`pending` יחד), לא נקודתי.

**מה בוצע** — `src/components/library-bulk-upload.tsx` בלבד:
- `uploadOne(file, i)` חולצה מתוך `uploadFiles` — אותה לוגיקה (Storage → `createUploadedResource` → `analyzeExistingResource` → `recordUpload`), ללא שינוי התנהגות.
- `retryOne(i)` חדשה — מריצה מחדש קובץ בודד, עצמאית ומקבילית (מצב `retrying: number[]`), בלי לגעת ב-`pending`.
- כפתור "נסה שוב" (`RotateCcw`) מופיע רק בשורות `error`, הופך לספינר ומושבת רק עבור עצמו בזמן ריצה.
- `pending`, כפתור "המשך העלאה" הגורף, וה-toast המסכם — ללא שינוי.

Type-check עבר. עלות: 1.9 קרדיטים. **הפריט "per-file upload UX" סגור במלואו.**

### 17.2 עדכון docs/lms-gap-analysis.md (commit `107f0592`)

עדכון תיעוד בלבד — נבדק מול MERGE_MEMORY סעיפים 15-16 לפני עריכה:
- שורת "עודכן לאחרונה" → 14/8/2026.
- סעיף 3: שורת "מנגנון שיתוף משאבים" עודכנה לשקף את שדרוג הספרייה (bulk upload+OCR, עורך סיווג, עורך OCR, חומרים דומים, ZIP, retry נקודתי) — נשאר ⚠️ כי עדיין אין שיתוף בין-מוסדי, רק תוספת הבהרה. נוספה שורה חדשה "העלאה וניתוח אוטומטי מתקדם" (✅).
- סעיף 5: נוספו שלוש שורות חדשות שלא היו מתועדות כלל — מפת מערכת (`/map`), דף קשר מוסדי (`/contact-sheet`+`/contact`), דף קשר שבועי להורים (`/weekly-sheet`).
- שום שורה אחרת לא נגעה — הפערים האמיתיים (Google Classroom, push/SMS, צ'אט צוות, iOS/offline, report builder) נשארו בדיוק כפי שהיו.

עלות: 1.1 קרדיטים.

### 17.3 בדיקת ביצועי 3D במכשירים חלשים — נמצא שאין פער (ללא שינוי קוד)

`plan.md` המקורי (סעיף 4, "שיפור ביצועים בתצוגה התלת-ממדית") תכנן `dpr`, `frameloop="demand"`, hook נפרד `use-device-perf.ts`, ו-`React.lazy`+`Suspense` על Canvas — **בהנחה שגויה שהתצוגה בנויה ב-Three.js/R3F**. נבדק מול `src/routes/_authenticated.classes.$classId.display.tsx` בפועל: התצוגה בנויה **כולה ב-CSS 3D transforms**, לא Three.js (מאשר את מה שכבר תועד בסעיף 9). לארכיטקטורה הזו כבר קיים טיפול שקול:
- `detectLowPower()` — inline, שקול ל-hook המתוכנן: בודק `prefers-reduced-motion`, `hardwareConcurrency<=4`, `deviceMemory<=4`, `saveData`, רשת 2G.
- במצב low-power: מבטל טרנזישן, מקטין `perspective` (1800px לעומת 1250px), משבית tooltip ציון צף, מבטל backdrop-blur ב-HUD.
- `rAF`-throttled slider drags, `contentVisibility:auto` + `containIntrinsicSize` על כל תא — render-skipping דפדפני, בלי Canvas בכלל.

**מסקנה: אין פער אמיתי לביצוע.** הפריט "3D performance optimization for low-end devices" נסגר כ**לא-רלוונטי** (המשימה המקורית תוכננה נגד ארכיטקטורה שלא נבנתה בפועל) ולא כ"בוצע" או "פתוח".

### 17.4 Phase B rebrand — MCP name + תווית theme (commit `b99c8385`)

בדיקה מקדימה גילתה ש-Phase B מורכב משלוש שכבות נפרדות, לא שתיים כפי שתועד קודם:
1. **MCP server name/title/instructions** (`src/lib/mcp/index.ts`) — מזהה טכני בלבד, בטוח לשינוי.
2. **CSS theme `id: "classalign"`** (`src/hooks/use-theme.tsx`) — **לא מזהה טכני-בלבד**: נשמר בפועל בטבלת `theme_preference` (DB) וב-`localStorage` (`classpro-theme` key) עבור כל משתמש שבחר את ה-theme הזה. שינוי ה-`id` היה שובר את הבחירה השמורה של כל מורה שבחר אותו. גם התגלה ש-`hakita-sheli` theme כבר קיים כ-theme נפרד ועדכני יותר לצד `classalign` — שניהם פעילים במקביל במכוון, לא כפילות בטעות.
3. **`localStorage` key `"classpro-theme"`** — שריד משם קודם עוד יותר ("ClassPro") שלא היה מתועד כלל.

**החלטה שאושרה על ידי מיכאל:** לבצע רק (1) ו-(2)-כתווית-בלבד:
- MCP: `name: "harmony-hub"` → `"hakita-sheli"`, `title: "Harmony Hub"` → `"הכיתה שלי"`, `instructions` עודכן ("HaKita Sheli ('My Classroom')" במקום "Harmony Hub (ClassAlign Studio)"). `issuer`/`projectRef`/OAuth — ללא שינוי.
- Theme: `label` של הרשומה `id: "classalign"` שונה מ-"מודרני מובייל" ל-**"טורקיז"**, ה-`description` נוקה מהמילים "מודרני מובייל". **ה-`id` עצמו נשאר `"classalign"` ללא שינוי** — אין סיכון לבחירות שמורות קיימות.

**במכוון לא נגעו (לא חוב פתוח — החלטת ארכיטקטורה):**
- `id: "classalign"` עצמו נשאר. שינויו דורש migration של `theme_preference` + טיפול בערכי `localStorage` ישנים אצל לקוחות — לא בוצע כי אין צורך אמיתי (ה-theme פעיל ותקין, רק השם ההיסטורי שלו נוקה).
- `THEME_STORAGE_KEY = "classpro-theme"` — שריד לשם "ClassPro" ההיסטורי. לא נוגעים בו מאותה סיבה (ישבור העדפות מקומיות שמורות בלי תועלת אמיתית).
- Phase C rebrand (כתובות מייל `reminders@notifications.classalign.app` וכו') — עדיין **חסום** על אימות דומיין ב-Resend, לא ניתן לביצוע מהצד הזה.

Type-check עבר, MCP manifest נבנה מחדש בהצלחה. עלות: 1 קרדיט.

### 17.5 Playwright e2e ל-/settings — נדחה במכוון (לא בוצע, לא חוב)

תוכנן לעומק לפני שהוחלט לדחות: משתמש טסט בתבנית `createTestUser`/`deleteTestUser` הקיימת (`src/test/helpers.ts` — משתמש זמני נוצר/נמחק בכל הרצה, לא משתמש קבוע), הרצה נגד `dist/` דרך `wrangler dev` (אותו מנגנון בדיוק כמו `scripts/lighthouse.mjs`, לא `bun run dev`), היקף בינוני (טעינה+לשוניות+flow שינוי PIN עם retry). אומת: אין Playwright בפרויקט כלל (`package.json` נבדק — רק vitest), ו-CI secrets (`SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`) **כבר קיימים בפועל** ב-repo — הפריט הישן "GitHub Actions secrets setup" שתועד ב"על האופק" **אינו רלוונטי עוד**, ה-secrets כבר מחוברים ומשמשים את `notifications-guard`/`student-profiles-guard`/`build`.

**החלטה מפורשת:** לא לבנות כרגע. הנימוק שהוצג ואושר: זו רשת ביטחון למניעת רגרסיות עתידיות, לא תיקון לבעיה קיימת; אין תלות של שום קוד אחר בה; עלות התחזוקה (repo ללא צוות QA ייעודי) לא הצדיקה את ההשקעה מול פריטים אחרים. **לחזור לזה רק אם ייצפו רגרסיות חוזרות ב-/settings בפועל** — לא מתוזמן מראש.

### 17.6 מצב מעודכן של "על האופק" אחרי סבב זה

| פריט | סטטוס לפני | סטטוס אחרי 14/8 |
|---|---|---|
| Per-file upload UX (ספרייה) | פתוח | ✅ **סגור במלואו** (17.1) |
| docs/lms-gap-analysis.md מיושן | פתוח | ✅ **מעודכן** (17.2) |
| 3D performance על מכשירים חלשים | לא אומת | ✅ **אין פער — סגור כלא-רלוונטי** (17.3) |
| Phase B rebrand (MCP + theme) | פתוח | ✅ **בוצע בהיקף שאושר** — MCP name מלא, theme label בלבד; `id`/`localStorage key` הושארו במכוון (17.4) |
| Phase C rebrand (כתובות מייל) | חסום ב-Resend | **עדיין חסום** — ללא שינוי, לא ניתן לפעולה מכאן |
| Playwright e2e ל-/settings | פתוח | **נדחה במכוון** — לא מתוזמן, לא חוב (17.5) |
| GitHub Actions secrets setup | פתוח (ישן) | ✅ **כבר קיים בפועל** — התגלה אגב בדיקת Playwright (17.5), הפריט בעצמו היה מיושן |

**נותר פתוח בפועל, לביקור הבא:** רק Phase C (חסום חיצונית, לא תלוי בעבודת קוד).

---

## 18. סבב אימות — 23/8/2026: ייבוא Google Drive, כללים קבועים, ושדרוג ניהול מורים (8 קומיטים לא-מתועדים)

### רקע — פתיחת השיחה

`list_edits` הריץ מול HEAD בפועל וגילה **8 קומיטים** אחרי הקומיט האחרון שתועד בסעיף 17 (`b99c8385`, 14/8) ועד ל-HEAD (`425aefa`, 23/8, 04:32). כל קומיט נבדק ישירות מול `get_diff` לפני עדכון המסמך.

### 18.1 ייבוא Google Drive מלא — סוגר פריט "על האופק" ישן (commits `65e6055`, `24f27bf`, `425aefa`)

הפריט "Google Drive תיקייה שלמה" היה רשום כפער פתוח מאז סעיף 9 (5/8). מומש עכשיו במלואו:
- חיבור Google Drive (OAuth) + דפדוף תיקיות בממשק.
- ייבוא מרובה קבצים עם retry נקודתי לקובץ בודד (אותה תבנית UX שנקבעה ב-17.1 לספריית חומרי הוראה).
- זיהוי כפילויות לפי hash לפני ייבוא, כדי לא ליצור עותקים כפולים בספרייה.
- ייצוא אוטומטי ל-PDF/xlsx עבור קבצי Google-native (Docs/Sheets) לפני שמירה בספרייה — כדי שהקובץ השמור יהיה פורמט קריא/ניתן להורדה ולא קישור Google בלבד.

**סטטוס מעודכן:** ✅ סגור. "Google Drive תיקייה שלמה" מוסר מרשימת "עדיין לא נבנה".

### 18.2 מסך "כללים קבועים במערכת" — `/schedule-rules` (commit `425aefa`)

הפריט "Fixed recurring schedule rules (Fridays end at 12:00, Rosh Chodesh ends at 13:00)" תועד עד כה כ"מתוכנן, לא בנוי" (ברשימת "Active open items" בזיכרון). מומש בפועל:
- מסך ייעודי `/schedule-rules` לניהול כללי סיום מוקדם (ימי שישי, ראש חודש) לפי כיתה.
- Summary מוצג בראש המתכנן השבועי הקיים, כדי שהמורה יראה מייד אילו ימים מקוצרים החודש.
- לא נבדק diff מלא מול `weekly-schedule.functions.ts` הקיים — לאשר בביקור הבא שאין התנגשות עם לוגיקת השעות השלמה (הפריט "precise time scheduling with minutes" עדיין רשום כפתוח בזיכרון, דורש migration נפרד).

**סטטוס מעודכן:** ✅ סגור בהיקף הבסיסי (ימי שישי + ראש חודש, לפי כיתה). **נשאר פתוח:** אינטגרציה עם שעות מדויקות (14:15 וכו') — תלוי במיגרציית `weekly_lessons`/`schedule_template_slots`/`schedule_tasks` שעדיין לא בוצעה.

### 18.3 שדרוג מסך ניהול מורים — היסטוריית שינויים (commits `d6b175f`, `7ea1720`, `d5ad529`)

הפריט "שדרוג מסך ניהול מורים — הוספה/עריכה/הסרה, סגנון הוראה, שיוך כיתות מסודר" (קבוצה A, סעיף 10.3) תועד כ"טרם התחיל". חלק ממנו בוצע:
- כרטיס "היסטוריית שינויים" (`teacher-change-history.tsx`) בדף ניהול מורים — לוג מלא לפני/אחרי על עריכת הערות, סגנון הוראה, ושינויי שיוך כיתה: מי ביצע, מתי.
- מבוסס על `app_logs` הקיים (אותה תשתית logInfo/logEvent שתועדה בסעיף 11.2 לרולאובר) — **לא נוצרה טבלה חדשה**, עקבי עם העיקרון הקבוע לא לנפח סכימה כשיש מנגנון גנרי מתאים.

**סטטוס מעודכן:** ⚠️ חלקי. היסטוריית שינויים ✅ בוצעה. **נשאר פתוח:** "הוספה/עריכה/הסרה" מסודרת של מורים ו"שיוך כיתות מסודר" (ממשק ה-CRUD המלא) לא אומתו בסבב הזה — ייתכן שכבר קיימים בחלקם דרך `/user-management`, לביקור הבא.

### 18.4 שיפורי עמוד הדוחות (commits `2e5fc14`, `0c06421`, `89942a3`)

לא היו מתועדים כפער פתוח, אך שופרו אגב הסבב:
- הדפסה ממוקדת — CSS מיוחד (`report-print-area`) שמדפיס רק את אזור הדוח, לא כל העמוד.
- סינון דוחות לפי קבוצת תלמידים (לא רק כיתה שלמה).
- Badge "נותח ב-AI" בכרטיסי הספרייה — סימון חזותי איזה חומר עבר ניתוח אוטומטי.
- ולידציה מלאה נוספה למחולל ה-AI (מניעת שליחה עם שדות חסרים).

### 18.5 מצב מעודכן של רשימת "עדיין לא נבנה" / "על האופק" אחרי סבב זה

| פריט | סטטוס לפני | סטטוס אחרי 23/8 |
|---|---|---|
| Google Drive תיקייה שלמה | פתוח (מאז סעיף 9) | ✅ **סגור במלואו** (18.1) |
| כללים קבועים (שישי/ר״ח) | מתוכנן, לא בנוי | ✅ **סגור בהיקף בסיסי** — שעות מדויקות עדיין תלויות ב-migration (18.2) |
| שדרוג ניהול מורים | טרם התחיל | ⚠️ **חלקי** — היסטוריית שינויים בוצעה, CRUD מלא לאמת (18.3) |
| Google Calendar sync | פתוח | **ללא שינוי** — עדיין לא בוצע |
| דוח תעודות חודשי מרוכז | פתוח | **ללא שינוי** — עדיין לא בוצע |
| דשבורד מרוכז להתקדמות מורים | פתוח | **ללא שינוי** — עדיין לא בוצע |

**נותר פתוח לביקור הבא:** Google Calendar sync, דוח תעודות חודשי, דשבורד מרוכז, אימות היקף מלא של ניהול מורים (18.3), אימות schedule-rules מול שעות מדויקות (18.2). כמו כן — Base44 (Class-Flow) לא נבדק בסבב זה; לפי סעיף 17 תיעוד אחרון הוא 4/8/2026, יש לבדוק אם התקדם.

### מסקנה לפעם הבאה

שוב אושר העיקרון הקבוע: 8 קומיטים לא-מתועדים תפסו על הפרש של כ-9 ימים בין ביקורים. יש להריץ `list_edits` בתחילת כל שיחה, גם כשה"עדכון אחרון" בראש הקובץ נראה תואם לתאריך הנוכחי.

---

## 19. דירוג כוכבים מהורים על העלון השבועי — סגירת פער Base44 #2 (23/8/2026, commit `e57646bc`)

### רקע

השוואה ישירה מול Base44 (`list_entity_schemas`, `WeeklyBulletin.parent_feedbacks`) אישרה שהפער היחיד שתועד בסעיף 2.1 ("קשר הורים... פער יחיד: אין דירוג/פידבק כוכבים") עדיין פתוח בפועל. אומת מול קוד חי (`src/lib/parents.functions.ts`, `src/routes/p.$token.tsx`) לפני תכנון — `getParentView` לא כלל שום שדה feedback.

### מה בוצע

- **Migration ידנית (הורצה על ידי מיכאל, לא דרך send_message):** `ALTER TABLE weekly_bulletins ADD COLUMN parent_feedbacks jsonb NOT NULL DEFAULT '[]'::jsonb;` — עמודה בודדת, בדפוס זהה לעמודות jsonb קיימות אחרות בטבלה (`study_points`, `recap_questions`, `activities`). ללא טבלה נפרדת, ללא RLS חדש (הטבלה כבר מוגנת דרך `owner_id`).
- **`src/lib/parents.functions.ts`:**
  - `submitBulletinFeedback(token, bulletinId, rating, comment?)` — server function ציבורית חדשה: מאמתת טוקן תקף ולא-revoked, מאמתת שה-`bulletinId` שייך ל-`class_id` של הטוקן, מוסיפה (append) רשומה `{ rating, comment, submitted_at, student_id }` למערך.
  - `getParentView` מורחב: כל bulletin כולל כעת `parent_feedbacks_summary: { avg, count }` בלבד — **לא** את התוכן הגולמי (הגנת פרטיות בין הורים).
- **`src/routes/p.$token.tsx`:** רכיב `BulletinFeedback` חדש מתחת לכל כרטיס עלון — 5 כוכבים לחיצים (`role="radiogroup"`, `aria-checked`, `aria-label`), textarea עד 300 תווים, מצב "תודה" אחרי שליחה (state מקומי, בלי רענון עמוד). עיצוב תואם לקיים (`bg-amber/10`, `font-display`, `rounded-2xl`).

### אומת מול `get_diff` (לא רק תקציר טקסטואלי של הסוכן)

הבנייה תאמה במדויק את התוכנית. **שני שינויים נוספים לא-מבוקשים** הוזרקו יחד עם הבנייה, לא קשורים למשוב הורים:
1. `previewAuthStorage.ts` + שינוי ב-`client.ts` — נראה כמו עדכון תשתית פלטפורמה סטנדרטי (broker שיתוף session בין preview surfaces), לא קוד שהתבקש.
2. `hebrew-months-rules.test.ts` (133 שורות, טסטים לניווט חודשים עברי + `recurring_rules`) — לא קשור לבקשה, כנראה נדבק מעבודה מקבילה אחרת בפרויקט (ראה סעיף 18.2, מסך `/schedule-rules`).

**לביקור הבא:** לוודא ש-`previewAuthStorage` לא משפיע על טוקן ההורה (storage נפרד, כנראה בטוח), ולוודא ש-`hebrew-months-rules.test.ts` עובר ב-CI.

### סטטוס מעודכן

| פריט | סטטוס לפני | סטטוס אחרי 23/8 |
|---|---|---|
| דירוג/פידבק כוכבים מהורים (Base44 gap #2) | פתוח (מתועד בסעיף 2.1 מאז תחילת המסמך) | ✅ **סגור** (19) |

**פערי Base44 שנותרו פתוחים לבדיקה (מתוך השוואת `list_entity_schemas` ב-23/8):**
- `OrchestratorInsight` — מנוע briefing יומי (ניטור נוכחות/ציונים/איחורים/מעורבות הורים + המלצת פעולה). **הפער המשמעותי ביותר שנותר**, מתוכנן לסבב הבא.
- `CertificateTemplate.analyzed_layout` — ניתוח תבנית תעודה אוטומטי מתמונה.
- `SeatingArrangement.satisfaction_score` — ציון שביעות רצון מחושב למערך הושבה.
- `TeacherMeeting` — יומן פגישות 1:1 מובנה בין הנהלה למורה (מעבר להיסטוריית שינויים שכבר קיימת, סעיף 18.3).
- `StudentPortfolioItem.academic_year` — תיוג תיק תלמיד לפי שנה (ארכיון רב-שנתי, מעבר לפרופיל התלמיד הנוכחי).

### מסקנה לפעם הבאה

השוואה ישירה מול `list_entity_schemas` של Base44 (ולא רק קריאת MERGE_MEMORY) חשפה במדויק אילו שדות/entities אין להם מקבילה — שיטה יעילה יותר מניחוש. להמשיך להשתמש בה בסבבי השוואה עתידיים מול Base44.

---

## 20. מנוע תובנות יומי (OrchestratorInsight) — סגירת פער Base44 #4 (30/8/2026, commit `9a6e0603`)

### רקע

הפער המשמעותי ביותר שנותר מהשוואת סעיף 19: `/insights` הקיים היה דשבורד סגנון-הוראה אישי בלבד (מקצועות, קצב יצירה) — בלי שום ניטור תלמידים או briefing יומי. תוכנן סיגנל ראשון בלבד: ירידת נוכחות, לפי בחירת מיכאל, להצגה בתוך `/insights` הקיים. תוכנית מלאה הוכנה מראש כולל אימות `action_link` מול `_authenticated.classes.$classId.tsx` (`?tab=tracking`).

### אזהרת סדר-תורים — לתעד למניעת בלבול עתידי

בבדיקה הראשונה (`get_diff` מול `66c4089c`), ה-commit שנבדק לא הכיל את הבקשה כלל — הוא הכיל הרחבה לא-קשורה של `AiAssistantDock` שתאמה לתוכנית ישנה שהמתינה בתור. זה גרם לחשד שגוי שהבקשה "סטתה מהיעד". בבדיקה חוזרת מאוחרת יותר (`list_edits`) התברר ששני קומיטים נוספים בשם "הוסף מנוע תובנות יומי" (`b939699c` בשעה 04:55, ואז `9a6e0603` הסופי בשעה 11:45) התבצעו **אחרי** נקודת הבדיקה הראשונה — כלומר הבקשה כן התקבלה ובוצעה, רק מאוחר יותר משציפינו (כנראה סביב חידוש הקרדיטים). **לקח מרכזי: כשתוכן ה-diff הראשון לא תואם לבקשה, לא להסיק כישלון סופי — להריץ `list_edits` שוב בסבב מאוחר יותר ולבדוק אם קומיטים נוספים נוספו, לפני שמדווחים על סטייה או מתעדים משהו כ"פתוח".**

### מה בוצע (אומת במלואו מול `get_diff`, `66c4089c` → `9a6e0603`)

- **Migration אמיתית** (`supabase/migrations/20260830114320_dd694868-9b2f-49f1-9081-15b8825d13a2.sql`): טבלת `orchestrator_insights` (`owner_id`, `class_id`, `student_id`, `insight_type`, `severity` עם CHECK, `title`, `description`, `suggested_action`, `action_link`, `is_dismissed`). `GRANT SELECT,UPDATE TO authenticated` + `GRANT ALL TO service_role`, ואז RLS: SELECT+UPDATE בלבד ל-`owner_id = auth.uid()`, אין INSERT/DELETE ללקוח. שני אינדקסים לביצועים. `REVOKE ALL FROM anon`.
- **`src/lib/attendance-decline.ts`** — לוגיקת הזיהוי כפונקציה טהורה, 7 בדיקות אוטומטיות.
- **`src/lib/orchestrator.functions.ts`** — `generateDailyBriefing`, `listDailyBriefing`, `dismissInsight`.
- **`src/components/daily-briefing-card.tsx`** + עדכון `_authenticated.insights.tsx`.

### סטטוס מעודכן

| פריט | סטטוס לפני | סטטוס אחרי 30/8 |
|---|---|---|
| מנוע תובנות יומי / OrchestratorInsight (Base44 gap #4) | פתוח, פער משמעותי ביותר | ✅ **סגור** (20) — סיגנל יחיד: ירידת נוכחות |

### מסקנה לפעם הבאה

כשמתקבל commit שלא תואם לבקשה, יש שתי אפשרויות: (א) פרומפט שגוי/תוכנית-בתור קדמה, (ב) הבקשה עדיין בתהליך ותושלם בקומיט מאוחר יותר. יש לבדוק `list_edits` שוב לפני קביעה סופית. **אין לתעד "סגור" או "פתוח" על סמך ניחוש — רק על סמך `get_diff` שאומת בפועל.**

---

## 21. שכבת אישור + הרחבת מנוע התובנות + כלים נלווים (1/9/2026, commits `c5e61132` → `41f4b93c`)

### רקע

המשך ישיר לסעיף 20. בוצעו שני חלקים: (א) הפרומפט המתוכנן — שכבת אישור לאירועים חריגים, נשלח ואומת. (ב) הרחבה משמעותית שמיכאל בנה ישירות בעורך הלובאבל — הורחב מנוע התובנות מסיגנל יחיד לשבעה, ונוספו כמה כלים נלווים. הכל אומת מול `get_diff` בפועל.

### חלק א׳ — שכבת אישור לאירועים חריגים (`c5e61132`)

- `add_incident` ב-`ai-assistant.functions.ts`: כותב ל-`pending_updates` (status="pending") במקום ישירות ל-`discipline_events`. שאר הכוונות לא השתנו.
- קובץ חדש `src/lib/pending-updates.functions.ts`: `listPendingUpdates`, `approvePendingUpdate`, `rejectPendingUpdate`.
- מסך חדש `src/routes/_authenticated.review.tsx`.
- קישור מכרטיס "תובנות יומיות" ב-`/insights`, מוצג רק כשיש פריטים ממתינים.

### חלק ב׳ — הרחבת מנוע התובנות (בוצע ישירות ע"י מיכאל, `b939699c`→`41f4b93c`)

**סיגנלים חדשים ברמת תלמיד:** היעדרות רצופה, ירידת ציונים, ירידה בהתנהגות, ריבוי אירועי משמעת.
**סיגנלים חדשים ברמת כיתה:** פער רישום נוכחות, פער רישום ציונים, פער פרסום עלון, ירידה בממוצע הכיתתי.

`orchestrator.functions.ts` מריץ את כל הסיגנלים במקביל (6 שאילתות SQL לכל כיתה). מפתח מניעת-כפילויות שונה לתמיכה בתובנות ברמת כיתה. 20 בדיקות אוטומטיות חדשות.

**מאגר היסטוריה לתלמיד** — `getStudentTimeline`, `StudentHistoryDialog` חדש.
**עוזר הרב — תשובות קריאה עשירות** — `AssistantSnapshotTable` חדש.
**פעמון "אירועים קרובים"** — `UpcomingEventsWidget`, גלובלי ב-`_authenticated.tsx`.
**ניקוי:** `HomeQuickNav` הוסר מ-4 מסכים — אומת: לא רגרסיה, היה כפילות תצוגה אמיתית.

### נקודות לתשומת לב

- `listUpcomingEvents`: `.limit(60)` לפני סינון ארכיון — סיכון תיאורטי בהיקף גדול.
- עומס שאילתות ב-`generateDailyBriefing` — סביר להפעלה ידנית, לבדוק לפני cron עתידי.
- `daily_summaries`/`teacher_notes` — עדיין ללא קוד מחובר.

### מסקנה לפעם הבאה

לעולם לא להניח שהיקף הבנייה תואם למה שתוכנן בשיחה האחרונה — להריץ `list_edits`+`get_diff` בתחילת כל סבב עבודה.

---

## 22. לוח עברי מרכזי + דוחות טווח + שני סיגנלי תובנה נוספים (1–6/9/2026, commits `f992f6a2` → `a4ff24dd`, 41 קבצים)

### רקע

תשעה קומיטים נוספים בנה מיכאל ישירות בעורך, ללא תכנון מוקדם בשיחה זו. אומת במלואו מול `get_diff` יחיד (`41f4b93c` → `a4ff24dd`).

### מה בוצע

**תשתית תאריך עברי מאוחדת** (`src/lib/hebrew-date.ts`): `hebrewDate`, `hebrewDateTime`, `hebrewWeekday`, `hebrewDateWithWeekday`, `toHebrewDateFull`. `pdf-builder.ts` עודכן להשתמש בהן במקום `toLocaleDateString("he-IL")`. רכיב `HebrewRangeFilter` חדש, משולב ב-`/reports/$classId`.

**שני סיגנלי תובנה נוספים** (סה"כ כעת תשעה):
- `grade_outlier` — כשל חד-פעמי אצל תלמיד עם רצף טוב. `action_link` → `/analytics/{classId}` (אומת קיים).
- `below_class_average` — פער עקבי מול ממוצע הכיתה.

**דוחות PDF חדשים:** `class-range-pdf.ts`, `daily-report-pdf.ts` — בנויים על תשתית `pdf-builder.ts` הקיימת.
**מסך חדש `/daily-report/$classId`** — מאומת קיים בפועל.
**ייצוא Excel/PDF משופר** לתמיכה בטווחי תאריך עבריים.

### נקודות לתשומת לב

- `orchestrator.functions.ts` ממשיך לגדול (9 סיגנלים כעת). עדיין רק הפעלה ידנית.
- לא נמצאה בעיית RLS או קישור שבור באימות זה.

### סטטוס מעודכן — מנוע התובנות (9 סיגנלים סה"כ)

| # | סוג | רמה | תועד |
|---|---|---|---|
| 1 | ירידת נוכחות | תלמיד | סעיף 20 |
| 2 | היעדרות רצופה | תלמיד | סעיף 21 |
| 3 | ירידת ציונים | תלמיד | סעיף 21 |
| 4 | ירידה בהתנהגות | תלמיד | סעיף 21 |
| 5 | ריבוי אירועי משמעת | תלמיד | סעיף 21 |
| 6 | פער רישום נוכחות | כיתה | סעיף 21 |
| 7 | פער רישום ציונים / עלון | כיתה | סעיף 21 |
| 8 | כשל חד-פעמי (grade_outlier) | תלמיד | סעיף 22 |
| 9 | פער מול ממוצע הכיתה (below_class_average) | תלמיד | סעיף 22 |

**פערי Base44 שנותרו פתוחים (ללא שינוי):**
- `CertificateTemplate.analyzed_layout`
- `SeatingArrangement.satisfaction_score`
- `TeacherMeeting`
- `StudentPortfolioItem.academic_year`

### מסקנה לפעם הבאה

תשעה קומיטים תפסו על פני 5 ימים ללא בדיקה — פער הזמן הגדול ביותר שתועד עד כה בין ביקורי בדיקה. `list_edits` בתחילת השיחה, גם כשנדמה שהמצב "טרי".

---

## 23. חיבור `daily_summaries` + תוספות מקבילות + תיקון `insight_date` (7–8/9/2026, commits `ce891d4a` → `f53180b0`)

### רקע

המשך ישיר לפערים שזוהו בסעיף 22 (טבלאות `daily_summaries`/`teacher_notes` ללא קוד מחובר). הפרומפט המתוכנן — חיבור `daily_summaries` לתיקון חוסר-שמירה קיים במסך `/daily/$classId` — נשלח ואומת. בנוסף, מיכאל בנה ישירות בעורך הרחבה משמעותית: מערכת אישור תיעוד יומי, תובנות יומיות ידניות (מכסה חלקית את `teacher_notes`), ותמיכה בתאריכי לידה/תחילת לימוד בייבוא. כל השורות הבאות אומתו במלואן מול `get_diff` בפועל.

### חלק א׳ — חיבור `daily_summaries` (תואם לתכנון, `ce891d4a`)

- קובץ חדש `src/lib/daily-summaries.functions.ts`: `getDailySummary` (GET, מחזיר `notes` או מחרוזת ריקה), `saveDailySummary` (upsert לפי `class_id+date`, מוחק רשומה אם ההערה מתרוקנת).
- `_authenticated.daily.$classId.tsx`: `useQuery` לטעינת `classNotes` מה-DB, שמירה אוטומטית debounce 1.5 שניות עם אינדיקציה `aria-live`. מדויק לתכנון שאושר מראש.

### חלק ב׳ — הרחבה שבוצעה ישירות ע"י מיכאל

**מערכת אישור תיעוד יומי — טבלה חדשה `daily_log_approvals`**: `owner_id, class_id, student_id, date, approver_name, notes`, `UNIQUE(student_id, date)`, RLS מלא. קובץ `daily-approvals.functions.ts` ורכיב `DailyApprovalCard` — "חתימת" מלמד על תיעוד יומי.

**תובנות יומיות ידניות — מסך `/daily-insights` חדש** (מכסה חלק ניכר מייעוד `teacher_notes`, דרך `orchestrator_insights` עם `insight_type="manual"`): `manual-insights.functions.ts`, טופס עם כיתה/תלמיד-או-כלל-כיתתי/תאריך/חשיבות, רשימה מסוננת לפי טווח עברי/תלמיד/יום.

**תיעוד יומי מהיר לתלמיד** — `StudentDailyCard` חדש בתוך `crm-tab.tsx`: שמירה משולבת של נוכחות+ציון+תובנה לתלמיד ביום אחד.

**ייבוא רשימת תלמידים — תאריכי לידה ותחילת לימוד**: `roster-import.ts` מורחב עם `parseRosterDate`, עמודה חדשה `students.start_date`. `HebrewDateForm` חדש למסך `/hebrew-calendar`.

**`getDailyReport`/`getDailyReportDetails` הורחבו**: סינון לפי `studentId` בודד, ספירת `approvals`, שדה `insight_date` לסינון תובנות.

**מיגרציות:** `students.start_date`, `orchestrator_insights.insight_date` (+ `UPDATE` backfill), `daily_log_approvals`.

### חלק ג׳ — תיקון באג `insight_date` (`f53180b0`)

**הבאג:** המיגרציה שהוסיפה `insight_date` כללה ברירת מחדל `current_date`, אך `generateDailyBriefing` (מנוע התובנות האוטומטי) **לא עודכן** לשלוח את השדה במפורש — בזמן שהתובנות הידניות כן שולחות. תוצאה: תובנות אוטומטיות היו נכנסות עם תאריך-ריצה במקום תאריך האירוע, מטעה את דוח התיעוד היומי שמסנן לפי `insight_date`.

**התיקון:** הוספת `insight_date: today` לכל תשעת מקומות ה-`pending.push` ב-`orchestrator.functions.ts`. אומת מול `get_diff` מלא.

**לקח:** אחרי מיגרציה שמוסיפה עמודה עם ערך מחושב לטבלה שנכתבת ממספר מקורות קוד, לבדוק את **כל** נקודות הכתיבה, לא רק זו שהניעה את השינוי.

### סטטוס מעודכן

| פריט | סטטוס |
|---|---|
| `daily_summaries` מחובר לקוד עובד | ✅ סגור (23, חלק א׳) |
| `teacher_notes` (הטבלה המקורית) | עדיין ללא קוד מחובר — אך `orchestrator_insights.insight_type="manual"` מכסה רוב הצורך |
| מערכת אישור תיעוד יומי | ✅ חדש, לא היה מתוכנן |
| באג `insight_date` בתובנות אוטומטיות | ✅ תוקן ואומת |

---

## 24. פיצול הקלטות שיעור + סנכרון הספק אוטומטי (8/9/2026, commit `eb784c41`)

### רקע

קומיט נוסף שנבדק כחלק מסבב אימות שגרתי (`list_edits` לפני תכנון פער Base44 חדש) — לא היה קשור לפער שתוכנן (CertificateTemplate), אך נבדק במלואו לפי הכלל הקבוע. **לא קשור לתעודות/Base44** — פיצ'ר עצמאי בתחום התמלול הקיים.

### מה בוצע

**פיצול אודיו אוטומטי** (`src/lib/audio-split.ts`, חדש): הקלטות שיעור עד 400MB (הוגדל מ-24MB) מפוענחות בדפדפן (`AudioContext.decodeAudioData`), ממוזגות לערוץ מונו ומדוללות ל-16kHz (קצב מתאים לדיבור, מקטין את הקובץ משמעותית), ומחולקות לחלקים של עד 18MB כ-WAV. קובץ קטן מהסף מוחזר כחלק בודד ללא עיבוד.

**זרימת העלאה מעודכנת** (`lessons-tab.tsx`): כל חלק מועלה ומתומלל בנפרד (`part_group_id`/`part_index`/`part_total` חדשים ב-`lesson_transcripts`), עם חיווי התקדמות שלב-אחר-שלב ("מעלה חלק X מתוך Y", "מתמלל חלק X מתוך Y").

**איחוד סיכום** (`summarizeLessonParts`, חדש ב-`lessons.functions.ts`): לאחר שכל החלקים תומללו, מריץ AI (`google/gemini-2.5-pro`) שמאחד את כל התמלולים לסיכום רציף אחד, נקודות מפתח, ורשימת נושאים שנלמדו בפועל (`topics`).

**סנכרון הספק אוטומטי** (`syncLessonToCurriculum`, חדש): משווה את תוכן השיעור מול `curriculum_units` של הכיתה (טבלה קיימת, לא נבדקה בסבבים קודמים) — מזהה יחידות שכוסו (התאמת מילים ≥60% מכותרת היחידה בתוך תמלול/סיכום), מסמן אותן `status="done"`, ויוצר תובנה `orchestrator_insights` מסוג `lesson_coverage` המפרטת אילו יחידות טרם נלמדו.

### ⚠️ ממצא לתשומת לב

מיגרציית הקומיט (`20260908205932`) כוללת, מעבר להוספת שלוש העמודות (`part_group_id/index/total`), בלוק `DO $$...END$$` שמזריק **נתוני דמו אמיתיים** (נוכחות, ציונים, תובנה, אישור יומי, סיכום כיתתי) ל-10 תלמידים בכיתה ומשתמש ספציפיים, עם `WHERE NOT EXISTS` guards נגד כפילות. **אומת עם מיכאל: מכוון** — נתוני בדיקה לכיתת הבדיקה שלו. מתועד כאן כי זה חורג מדפוס המיגרציות הרגיל בפרויקט (סכימה בלבד עד כה) — לתשומת לב אם דפוס דומה יופיע שוב בלי אישור מפורש.

### סטטוס

| פריט | סטטוס |
|---|---|
| פיצול הקלטות שיעור כבדות + תמלול מרובה-חלקים | ✅ חדש, לא קשור לפערי Base44 |
| סנכרון אוטומטי בין תמלול שיעור להספק (`curriculum_units`) | ✅ חדש |
| נתוני דמו במיגרציה | מאומת מכוון (לא סטייה) |

**פערי Base44 שנותרו פתוחים (ללא שינוי):**
- `CertificateTemplate.analyzed_layout` — בתכנון פעיל, ראה שיחה נוכחית
- `SeatingArrangement.satisfaction_score`
- `TeacherMeeting`
- `StudentPortfolioItem.academic_year`

### מסקנה לפעם הבאה

גם קומיטים שנראים לא-קשורים לנושא הנוכחי צריכים אימות מלא לפני שממשיכים — כאן זה חשף פיצ'ר עצמאי משמעותי (400MB, פיצול, סנכרון הספק) שלא היה מתועד כלל בלי הבדיקה. `list_edits` בתחילת כל סבב, גם באמצע עבודה על נושא ספציפי אחר.

---

## 25. תבנית עיצוב תעודה מתמונה — סגירת פער Base44 #1 (9/9/2026, commits `3b220871` → `0d4870c2`)

**Migration**: טבלת `certificate_templates` עם CHECK constraints על שדות עיצוביים. RLS `FOR ALL` ל-owner. `analyzeCertificateTemplate` ב-`ai-certificate.functions.ts` מנתח רק מבנה חזותי, ולידציה קשיחה עם fallback. `CertificateTemplateCard` חדש ב-`/certificates/$classId`.

**יישום על PDF** (בוצע ישירות ע"י מיכאל): `template-design.ts` חדש (`drawTemplateFrame`), `certificate-pdf.ts`+`daily-report-pdf.ts` מקבלים `design?` אופציונלי (ברירת מחדל זהה לקיים). `CertificateTemplateSelect` חדש.

**תוספות נלוות**: ייבוא תיעוד מ-Excel, מסך `/class-anchors`, סנכרון תאריך-החלוף לתובנות.

**⚠️**: `daily-log-import.functions.ts` שורה 39, `as any` עוקף type-safety במכוון.

### סטטוס: ✅ **סגור** — Base44 gap #1

---

## 26. תקציר AI לתיעוד יומי + טבלת תיעוד-לפי-תלמיד (9/9/2026, commit `dbf36591`)

`suggestStudentDailySummary`: מנסח כותרת+תיאור מנתונים קיימים, "בלי להמציא עובדות". `daily-report-pdf.ts` מקבל `entries?`.

---

## 27. ציון שביעות רצון להושבה — סגירת פער Base44 #3 (10/9/2026, commits `e9de1484` → `7f23d699`)

אומת מראש: `SeatingSnapshots`/`seating-configs.functions.ts` וגם `scoreAssignment`+`computeViolations` כבר קיימים — רק לא נחשפו ברמת תצורה שמורה. `ALTER TABLE seating_configs ADD COLUMN score, violation_count`. `generateSeatingCandidates` חדשה: מריצה `smartAssign` הקיים כמה פעמים. תג ציון + כפתור "צור 3 הצעות" ב-UI.

**הרחבה ע"י מיכאל**: PDF לתצורת הושבה, ייצוא Excel, לוח עברי אוטומטי ב-`/daily-insights`, עמודת אישור בדוח היומי.

### סטטוס: ✅ **סגור** — Base44 gap #3

---

## 28. שני כרטיסי PDF תיעוד-יומי בלוח העברי (10/9/2026, commit `0eb73470`)

`HebrewDailyPdfCard`/`StudentDailyPdfCard` חדשים ב-`/hebrew-calendar`. אישור: `getDailyApproval` מחזיר `approver_name` בפועל — ממצא מסעיף 27 תקין.

---

## 29. מזהה-על יציב לתלמיד + תיק רב-שנתי — סגירת פער Base44 (10/9/2026, commits `dc93dd93` → `09562b93`)

`StudentPortfolioItem.academic_year`. אומת מראש: מעבר שנה יוצר `student.id` חדש לגמרי, matching רק לפי שם ברגע המעבר, לא נשמר כקישור קבוע.

**שלב א׳** (תואם לתכנון): `students.person_key uuid`. Backfill דו-שלבי: `gen_random_uuid()` לכל מי שחסר, ואז `WITH RECURSIVE` על `parent_class_id` שמאחד שרשראות מעבר-שנה לאותו `person_key` (השורה הוותיקה ביותר נבחרת כמקור). `createClass` מעתיק `person_key` בהעתקת תלמיד.

**שלב ב׳** (בוצע ישירות ע"י מיכאל): טבלת `student_portfolio_items` (5 סוגי פריט, RLS תקין). `portfolio.functions.ts`: `getStudentPortfolio` (פריטים + timeline לפי `person_key`), `addPortfolioItem`, `deletePortfolioItem`. `StudentPortfolioPanel` — טאב "תיק רב-שנתי" ב-`StudentFileSheet`. `/classes` מקובץ לפי `academic_year` (`yearGroups`), `ClassRoster` עם תג "עבר שנה" (`carriedOver`).

### סטטוס: ✅ **סגור**

### סיכום — 5 מתוך 6 פערי Base44 נסגרו, נותר: `TeacherMeeting`

---

## 30. יומן פגישות 1:1 מלמד-מנהל — סגירת פער Base44 האחרון + תיקון RLS קריטי (10/9/2026, commits `de3322ae` → `08b295ad`)

### רקע

`TeacherMeeting` — הפער האחרון מששת הפערים המקוריים. אומת מראש שדשבורד מוסד מלא (`/institution`, תפקידי `admin`/`principal`/`teacher`) כבר קיים ופעיל, אך `teaching_notes` הוא שדה יחיד ללא היסטוריית פגישות. מיכאל אישר: לא בשימוש פעיל כרגע, אך זו תשתית מכוונת למוסדות עתידיים — נבנה באותה רמה כמו שאר תשתית ה-institution.

### מה בוצע (`de3322ae`, תואם לתכנון בהיקף התכנים)

Migration: טבלת `teacher_meetings` (`institution_id`, `teacher_id`, `admin_id`, `meeting_date`, `summary`, `action_items`, `follow_up_date`). `src/lib/teacher-meetings.functions.ts` (דפוס זהה ל-`institution-teachers.functions.ts`): `listTeacherMeetings`, `createTeacherMeeting` (מוודא שיוך מלמד-מוסד), `updateTeacherMeeting`/`deleteTeacherMeeting` (מוודאים בעלות מוסדית לפני כתיבה), רישום ל-`app_logs`. `TeacherMeetingsDialog` חדש, כפתור "פגישות" בטאב מלמדים.

### ⚠️ פרצת אבטחה שנוצרה ותוקנה תוך דקה (`08b295ad`)

**הבעיה**: הפרומפט הנחה RLS "בסיסי, אכיפה באפליקציה" מתוך אנלוגיה שגויה לדפוס הקיים ב-`institution-dashboard.functions.ts`. אך שם, ה-RLS כמעט אף פעם לא נבדק בפועל כי כל הקריאות עוברות דרך `supabaseAdmin` (עוקף RLS לגמרי) אחרי אימות בשכבת האפליקציה. במיגרציה הראשונה של `teacher_meetings`, ה-RLS policies נכתבו כ-`USING (true)`/`WITH CHECK (true)` לכל ארבע הפעולות (SELECT/INSERT/UPDATE/DELETE) — **זה חושף את הטבלה בפועל**: כל משתמש מחובר (לא רק admin/principal, לא רק אותו מוסד) יכול לקרוא/לכתוב/למחוק כל פגישה של כל מוסד, אם הוא היה קורא ל-Supabase client ישירות במקום דרך שכבת ה-server functions.

**התיקון** (זוהה ותוקן אוטומטית ע"י קלאסיפייר האבטחה של לובאבל, דקה אחרי): 4 policies חדשים המשתמשים ב-`private.is_institution_admin(auth.uid(), institution_id)` (פונקציה security-definer קיימת בפרויקט): SELECT מוגבל ל-`teacher_id`/`admin_id`/מנהל אותו מוסד, INSERT/UPDATE/DELETE מוגבלים למנהל המוסד הרלוונטי בלבד.

**לקח קריטי לתיעוד קבוע:** כתיבת RLS policy כ-`USING (true)` "כי הדפוס הקיים ככה" היא טעות מסוכנת — צריך לבדוק **איך ה-RLS נאכף בפועל בדפוס המקורי**, לא רק להעתיק את הצורה החיצונית שלו. אם קריאות בדפוס המקורי עוברות תמיד דרך `supabaseAdmin`, ה-RLS שם כמעט דקורטיבי; אבל אם טבלה חדשה עלולה להיקרא ישירות דרך ה-client הרגיל (או שקוד עתידי יעשה זאת), RLS רופף הוא חור אבטחה אמיתי. **בפרומפטים עתידיים ליצירת טבלה חדשה: לעולם לא לכתוב `USING (true)` כברירת מחדל — תמיד לדרוש RLS שאוכף בעלות/שיוך אמיתי, גם אם הקריאות המתוכננות עוברות דרך admin client.**

### סטטוס מעודכן

| פריט | סטטוס לפני | סטטוס אחרי 10/9 |
|---|---|---|
| `TeacherMeeting` (Base44 gap אחרון) | פתוח | ✅ **סגור** (30) |
| פרצת RLS ב-`teacher_meetings` | נוצרה ותוקנה באותו יום | ✅ תוקן, אומת מול `get_diff` |

### סיכום סופי — כל ששת פערי Base44 שזוהו בסעיף 19 נסגרו

| # | פער | נסגר בסעיף |
|---|---|---|
| 1 | `CertificateTemplate.analyzed_layout` | 25 |
| 2 | דירוג כוכבים מהורים | 19 |
| 3 | `SeatingArrangement.satisfaction_score` | 27 |
| 4 | `OrchestratorInsight` (תובנות יומיות) | 20–22 |
| 5 | `TeacherMeeting` | 30 |
| 6 | `StudentPortfolioItem.academic_year` | 29 |

**אין פערי Base44 פתוחים נוספים מההשוואה המקורית.**

### מסקנה לפעם הבאה

כשמפרומפט מבקשים ליצור טבלה חדשה בהשראת דפוס RLS קיים, יש לבדוק תמיד את **אופן האכיפה בפועל** (RLS ישיר מול admin-client עם בדיקה באפליקציה), לא רק להעתיק תבנית SQL. קלאסיפייר האבטחה של לובאבל תפס ותיקן פרצה אמיתית תוך דקה — שווה תמיד לבדוק `list_edits` מיד אחרי שליחת פרומפט הכולל יצירת טבלה חדשה, כדי לתפוס תיקוני אבטחה אוטומטיים כאלה ולהבין למה היו נחוצים.

