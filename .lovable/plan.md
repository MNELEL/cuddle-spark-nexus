# תוכנית: סנכרון, תמלול אמיתי ולמידת סגנון אישי

שלוש יכולות גדולות שמחברות את האפליקציה לרשת אחת חכמה.

## 1. סנכרון מלא בין הספרייה לעלון השבועי / תכנון

**רעיון:** העלון השבועי (`weekly_bulletins`) כבר מתעד מה למדו השבוע. נחבר אותו ישירות לספריית החומרים:

- **קישור משאב→עלון** — טבלה חדשה `bulletin_resources` (bulletin_id, resource_id) + הצגה בעלון של כל החומרים ששימשו השבוע.
- **הצעות אוטומטיות בספרייה** — כשהמלמד נכנס לספרייה, חלון "מתאים לשבוע הזה" שמציע חומרים קיימים על-פי `study_points` של העלון האחרון (התאמה ע"י embeddings — pgvector + Lovable embeddings על `study_points` ועל `resource.content`).
- **יצירה אוטומטית של מבחני חזרה** — כפתור "צור מבחן על השבוע" בעלון: שולח את `study_points` + תוכן המשאבים הקשורים ל-Gemini, מקבל `question_bank` חדש, ושומר אותו עם תג `auto-from-bulletin` + קישור חזרה לעלון.
- **טריגר בכיוון ההפוך** — כש-`logResourceUsage` נרשם, החומר מסומן אוטומטית כ"בשימוש השבוע" ועולה בטיוטת העלון הבאה.

**טכני:**
- מיגרציה: `bulletin_resources` + עמודות `embedding vector(1536)` ב-`teaching_resources` וב-`weekly_bulletins.study_points_embedding`
- `pgvector` extension + פונקציית `match_resources_for_bulletin(bulletin_id, k)`
- server fns חדשות: `suggestResourcesForCurrentWeek`, `generateQuizFromBulletin`, `linkResourceToBulletin`
- embeddings נוצרים ב-`upsertResource` ו-`saveBulletin` (אוטומטית ברקע)

## 2. תמלול אמיתי + סיכום וחומרים על תוכן השיעור עצמו

היום הסיכום הוא "לפי כותרת". נחליף לזרימה אמיתית:

- **הקלטה / העלאת אודיו** — בעמוד הכיתה, רכיב חדש "תיעוד שיעור": מקליט מהדפדפן (MediaRecorder) או מאפשר להעלות קובץ אודיו/וידאו. נשמר ב-bucket חדש `lesson-recordings` (פרטי, RLS לפי כיתה/בעלים).
- **תמלול** — server fn `transcribeLesson` שמשתמשת ב-Gemini multimodal (`google/gemini-2.5-pro` תומך אודיו ישירות) לקבלת תמלול עברי + חותמות זמן. תוצאה נשמרת בטבלה חדשה `lesson_transcripts` (id, class_id, audio_path, transcript, summary, key_points, created_at).
- **סיכום מהתוכן** — `summarizeFromTranscript` מקבל את התמלול ומפיק: סיכום, נקודות מפתח, ציטוטים מרכזיים — הכל מהתוכן ולא מהכותרת.
- **דפי עבודה / שאלות שמבוססות על התמלול בפועל** — `generateWorksheetFromTranscript`: prompt עם התמלול המלא + הנחיה מפורשת "צור שאלות שמוודאות הבנה של הדברים שנאמרו בפועל בשיעור, ציטוטים ישירים מהתמלול". התוצאה נשמרת כ-`teaching_resource` עם `source_transcript_id` ועם תג `from-lesson`.
- **קישור לעלון** — התמלול והחומרים שנוצרו ממנו עולים אוטומטית כמועמדים לעלון השבועי.

**טכני:**
- bucket: `lesson-recordings` + storage policies
- מיגרציה: `lesson_transcripts` (+ עמודה `source_transcript_id` ב-`teaching_resources`)
- 3 server fns חדשות + עמוד `_authenticated.classes.$classId.lessons.tsx` (רשימת שיעורים מוקלטים + פעולות)
- העלאת אודיו ל-storage → קריאה ב-server fn → שליחה ל-Gemini עם `inline_data` (base64)
- מגבלת אודיו: 25MB בהעלאה ישירה; קבצים גדולים יותר ידרשו chunked upload (שלב ב')

## 3. אלגוריתם שלומד את סגנון המלמד האישי

מטרה: המערכת זוכרת את הסגנון של כל מלמד (לפי `user_id`) ומציעה חומרים שמתאימים לו.

- **טבלה חדשה `teacher_style_profile`** — שורה אחת לכל user_id, עם:
  - `preferred_subjects` (jsonb עם משקלים) — חישוב מהמשאבים שנוצרו
  - `preferred_resource_types` (jsonb)
  - `avg_questions_per_worksheet`, `avg_question_length`
  - `tone_keywords` (text[]) — מילים שחוזרות בכותרות/תיאורים שלו
  - `writing_style_sample` (text) — דוגמאות קצרות לשיבוץ ב-prompts
  - `weekly_pace` (jsonb) — כמה חומרים בשבוע, באילו מקצועות
  - `last_updated_at`
- **עדכון אוטומטי** — אחרי כל `upsertResource` / `logResourceUsage`, server fn `recomputeStyleProfile` רצה ברקע (מצטברת — לא בכל פעם). אחת ל-N פעולות מריצה גם סיכום-סגנון ע"י Gemini ("תאר את הסגנון של מלמד שכתב את אלה...").
- **שימוש בפועל:**
  - בכל קריאה ל-`generateResourceWithAI` / `generateWorksheetFromTranscript`, ה-prompt מקבל מקטע נוסף: "סגנון המלמד: ..." + 2-3 דוגמאות קצרות מחומרים קודמים שלו.
  - דף הבית של הספרייה מציג קלפי "מומלץ עבורך" — שילוב של (א) embeddings קרובים למה שהוא ערך לאחרונה (ב) סוגי משאבים שהוא מעדיף (ג) המקצוע התורן בעלון.
  - הצעות עריכה: כשפותחים משאב, AI יכול להציע "אצלך בדרך-כלל יש גם תשובות לכל שאלה — להוסיף?" / "אתה נוהג להוסיף ניקוד — לנקד?"
- **ניטור קצב** — דשבורד קטן "הקצב שלך השבוע": x חומרים מתוך הממוצע שלך y; התראה עדינה אם נופלים מתחת לקצב הרגיל.

**טכני:**
- מיגרציה: `teacher_style_profile`
- server fns: `recomputeStyleProfile`, `getStyleProfile`, `getPersonalRecommendations`
- helper `buildStyleContext(userId)` שמחזיר טקסט קצר להזרקה לכל prompt
- כל קריאות ה-AI הקיימות (`generateResourceWithAI`, `generateBulletin`, `summarizeFromTranscript`, וכו') יחוברו אליו

## סדר ביצוע

1. **תשתית embeddings** — pgvector + helper `embedText` משותף
2. **תמלול שיעור** — bucket + טבלה + 3 server fns + UI בעמוד הכיתה
3. **סנכרון ספרייה⇄עלון** — `bulletin_resources` + הצעות + יצירת מבחן מעלון
4. **פרופיל סגנון** — טבלה + recompute + הזרקה ל-prompts + קלפי "מומלץ עבורך"
5. **קצב שבועי** — וידג'ט קטן בדף הראשי של הספרייה

## הערות

- **פרטיות:** הקלטות אודיו פרטיות לחלוטין (bucket פרטי, signed URLs, מחיקה לפי בקשת המלמד). אין שיתוף בין מלמדים.
- **עלויות AI:** תמלול אודיו ארוך יכול להיות יקר — נציג למלמד הערכת זמן/עלות לפני הרצה, וקובץ נשמר במלואו כדי שלא נחזור על תמלול.
- **embeddings:** ירוצו אסינכרונית; אם הם נכשלים, החומר נשמר כרגיל וההצעות פשוט לא יופיעו עבורו.

האם להמשיך לבנייה בסדר הזה, או שתעדיף להתחיל מ-#2 (תמלול) שזה השינוי הכי מורגש?
