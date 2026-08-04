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
- **המצב היום**: קיים רק "סדר עדיפות למקצועות" שמשפיע על סדר התצוגה בגרפים בלבד (`localStorage`). הממוצע הוא ממוצע פשוט לא-משוקלל.
- **מה נדרש**: טבלת `grade_weights` חדשה ב-Supabase + server function לחישוב ממוצע משוקלל + UI להגדרת משקלים + עדכון כל מקום שמציג ציון סופי.
- **עדיפות**: הפער הגדול/החשוב מבין השניים בכל שלוש הבדיקות.

### 1.2 Circuit breaker ל-AI Gateway
- **המצב היום**: `src/lib/ai-gateway.server.ts` מטפל בשגיאות 429/402 נקודתית בלבד, בלי state בין קריאות.
- **מה נדרש**: state tracking ברמת המודול שמסמן `exhausted`/`invalid_key` ומחזיר שגיאה מיידית עד timeout/restart.
- **עדיפות**: שיפור טכני-פנימי, לא דורש UI.

**אלו שני הפערים היחידים שנותרו לעבודה בפועל.**

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

עודכן בהצלחה ב-2/8/2026 (RBAC ✅, שקלול ציונים ❌, circuit breaker ❌ — תואם לסעיף 1 כאן). פערים נוספים לא בעדיפות נוכחית: אינטגרציות LMS חיצוניות, push notifications, צ'אט צוות, דוחות מוסדיים, iOS+offline, שיתוף משאבים בין מוסדות.

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

## 7. איך להשתמש במסמך הזה מכאן ואילך

1. תמיד לקרוא קוד חי מ-Lovable לפני שמניחים הנחות.
2. קובץ זה הוא כעת המקור היחיד — docs/MERGE_MEMORY.md נמחק ב-4/8.
3. docs/lms-gap-analysis.md הוא מסמך נפרד — לוודא סנכרון לגבי הפערים הפתוחים.
4. שינויים בקוד נעשים דרך send_message. אם נתקע על "No approval received" — להכין קובץ מקומי, המשתמש מעלה ידנית ל-GitHub main, הסנכרון הדו-כיווני מושך אוטומטית.
5. הפערים האמיתיים היחידים שנותרו: (א) grade_weights, (ב) circuit breaker ל-AI gateway.
