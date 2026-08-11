# הרחבת העלון השבועי — תוכן מובנה ו-PDF משודרג

התוכנית מרחיבה את הפיצ׳ר הקיים בלבד. זרימת draft/publish/lock והיסטוריית הגרסאות לא נוגעים בהם. `bulletin-sync.functions.ts` כן יורחב — בתוספת server fns חדשות בלבד, בלי לשנות את `suggestResourcesForBulletin`, `linkResourceToBulletin`, `listBulletinResources` ו-`generateQuizFromBulletin` הקיימות.

## 1. סכימה (מיגרציה אחת, בלי טבלה חדשה)

הוספת עמודות ל-`public.weekly_bulletins` הקיימת:

- `torah_dvar_title text not null default ''`
- `torah_dvar_body text not null default ''`
- `study_schedule jsonb not null default '{}'::jsonb`
- `honored_students jsonb not null default '[]'::jsonb`
- `special_notices jsonb not null default '[]'::jsonb`

`study_points` נשאר כמו שהוא — הוא מקור ה-fallback וגם מה שמזין את embedding/הצעות הספרייה, ולכן אין לו שינוי. אין GRANT/RLS חדשים (טבלה קיימת, מדיניות קיימת).

## 2. טיפוסים ושרת (`src/lib/bulletins.functions.ts`)

- `BulletinDraft` יקבל:
  - `torah_dvar_title: string`, `torah_dvar_body: string`
  - `study_schedule: StudySchedule` — אובייקט עם מפתחות אופציונליים `gemara {daf, topic}`, `mishna {masechet, perek}`, `torah {parasha, pasuk_range}`, `navi {sefer, perek}`, `halacha {siman, seif}`; כל שדה טקסט עם ברירת מחדל `""`.
  - `honored_students: { name: string; type: "vort" | "mazal_tov" | "other"; note: string }[]`
  - `special_notices: { title: string; body: string }[]` — "הודעות מיוחדות" חד-פעמיות (אירוע חד פעמי, שינוי לוח זמנים וכו׳)
- `saveBulletin`: ולידציית zod לשדות החדשים (אורכים סבירים, `type` enum) ושמירתם ב-row. שאר הפונקציה — כולל בדיקת ה-lock — ללא שינוי.
- `generateBulletin`: הפרומפט יורחב כך שה-JSON כולל גם `torah_dvar_title`/`torah_dvar_body`/`study_schedule`/`honored_students` (honored נשאר ריק כברירת מחדל — AI לא ימציא שמות תלמידים), עם normalization מלא בקוד כמו שנעשה היום לשדות האחרים, כדי שעלונים ישנים ותשובות חסרות לא ישברו.
- `unpublishBulletin`: ה-select של ה-snapshot יכלול את השדות החדשים (אחרת גרסאות ישמרו חלקיות). זה שינוי נקודתי בתוך המנגנון הקיים, לא שינוי בהתנהגותו.

תאימות לאחור: כל השדות החדשים עם ברירות מחדל, ולכן `p.$token.tsx`, `c.$slug.tsx`, `parents.functions.ts`, `public-class.functions.ts` ו-`text-export.ts` ממשיכים לעבוד ללא שינוי.

## 3. טופס העריכה (`_authenticated.bulletins.$classId.tsx`)

- `emptyDraft`/`fromStored` יאתחלו את השדות החדשים.
- שני שדות חדשים לדבר תורה (Input לכותרת, Textarea לגוף).
- בלוק "הספק לימודי" — חמש שורות מקצוע עם שני Inputs כל אחת, בתוויות עבריות (גמרא: דף / נושא; משנה: מסכת / פרק; חומש: פרשה / פסוקים; נביא: ספר / פרק; הלכה: סימן / סעיף).
- בלוק "יישר כח ומזל טוב" — רשימה דינמית (הוספה/מחיקה) עם שם, בורר סוג (ווארט / מזל טוב / אחר) והערה.
- בלוק "הודעות מיוחדות" — רשימה דינמית של פריטים חופשיים, כל פריט עם כותרת קצרה (Input) וטקסט (Textarea), הוספה/מחיקה. גמיש לגמרי, לא קשור לשום קטגוריה קבועה.
- בבלוק שאלות החזרה הקיים נוסף כפתור "ייבא משאלות קיימות בספרייה" (סעיף 6).
- בכל שורת מקצוע בבלוק ההספק נוסף כפתור "צור דף שאלות למקצוע" (סעיף 7).
- כל השדות החדשים `disabled` כשה-status הוא `published`, בהתאם לדפוס הקיים.
- `cacheKey` של תצוגת ה-PDF ישאר `editing.id ?? 'new'`.

## 4. PDF (`src/lib/pdf/bulletin-pdf.ts`)

מבנה עמודים מכוון, במקום זרימה אחת:

```text
עמוד 1 — שער:      לוגו + שם מוסד + כותרת העלון + טווח תאריכים + סיכום השבוע
עמוד 2 — דבר תורה: מסגרת דקורטיבית + כותרת + גוף
עמוד 3 — הספק:     טבלת "שורה למקצוע" + יישר כח/מזל טוב + הודעות מיוחדות + פעילויות
עמוד 4 — חזרה:     שאלות חזרה להורים + חידה שבועית ותשובה
```

- הלוגו: `drawBrandHeader` כבר מצייר את הלוגו המוסדי כשקיים ב-brand; בשער נשתמש בו ונוסיף כותרת שער גדולה (`subtitle` עם טווח התאריכים) — בלי לשנות את ה-builder המשותף.
- רקע דקורטיבי לעמוד דבר התורה: מסגרת מלבנית כפולה בגוני ה-brand (slate + amber) עם מילוי רך מאוד — מצוירת מקומית ב-`bulletin-pdf.ts`, לא ב-builder, כדי לא להשפיע על שאר המסמכים.
- טבלת הספק: עמודות `מקצוע | פירוט`, שורה לכל מקצוע שיש בו תוכן. אם `study_schedule` ריק לגמרי — נפילה לטבלת `study_points` הקיימת (התנהגות היום).
- יישר כח: טבלה `שם | סוג | הערה` (סוג מתורגם לעברית), מוצגת רק כשיש רשומות.
- הודעות מיוחדות: סקציה "הודעות מיוחדות" (טבלת `כותרת | תוכן`) שמוצגת רק כשיש פריטים — כשהיא ריקה אין שינוי במבנה או במספור העמודים.
- מעברי עמוד עם `hd.newPage()` בין הסקציות, ורק כשיש תוכן — עמוד לא ייווצר ריק. `drawFooter` הקיים ממשיך לספור עמודים.

## 5. ייצוא טקסט

`bulletinToMarkdown` ב-`src/lib/text-export.ts` יקבל ארבע סקציות אופציונליות חדשות (דבר תורה, הספק, יישר כח, הודעות מיוחדות) באותו דפוס "לא מודפס כשריק", והבדיקות הקיימות ב-`src/test/text-export.test.ts` יתרחבו בהתאם — כולל שמירה על דטרמיניזם.

## 6. ייבוא שאלות חזרה מספריית החומרים

לצד ההקלדה הידנית הקיימת של `recap_questions`, כפתור "ייבא משאלות קיימות בספרייה" שפותח דיאלוג חדש (`src/components/bulletin-import-questions-dialog.tsx`):

- שני מקורות בדיאלוג: (א) הצעות רלוונטיות דרך `suggestResourcesForBulletin` הקיים (זמין רק כשהעלון נשמר ויש לו `id`), (ב) רשימת/חיפוש חומרים מסוג שאלות ומבחנים (`question_bank`, `exam`, `worksheet`) דרך פונקציית רשימת החומרים הקיימת.
- בחירת משאב פורשת את השאלות שבתוכו (`content.questions` בפורמט `{q, a}`) עם checkbox לכל שאלה, וכפתור "הוסף לעלון" שמצרף את הנבחרות ל-`recap_questions` (מיפוי `q→question`, `a→answer`), בלי כפילויות עם שאלות שכבר בטופס.
- שרת: server fn חדש `listQuestionsFromResource` ב-`bulletin-sync.functions.ts` שמחזיר את שאלות המשאב מנורמלות (בעלות נאכפת ב-RLS).
- אין מיגרציה — השאלות נשמרות בתוך `recap_questions` הקיים דרך `saveBulletin`.

## 7. הפקת חומר לספרייה מתוך שדות ההספק

server fn חדש `generateQuizFromSchedule` ב-`bulletin-sync.functions.ts`, באותו דפוס בדיוק כמו `generateQuizFromBulletin` (שנשאר ללא שינוי):

- קורא מהעלון את `study_schedule`, `torah_dvar_title`/`torah_dvar_body`, `title` ו-`digest_summary`.
- פרמטר `subject` אופציונלי (`gemara`/`mishna`/`torah`/`navi`/`halacha`): כשהוא מסופק הפרומפט מתמקד באותו מקצוע ובפרטיו (דף/נושא, מסכת/פרק, פרשה/פסוקים, ספר/פרק, סימן/סעיף), וממנו נגזרים `title` ו-`subject` של החומר החדש. בלי `subject` — כל ההספק כמקור.
- שאר הזרימה כמו הקיים: `buildStyleContextString`, `callLovableAI` ב-JSON, embedding דרך `embeddings.server`, הכנסה ל-`teaching_resources` עם `resource_type: 'question_bank'` ותיוג `auto-from-bulletin`, וקישור ב-`bulletin_resources`.
- בממשק: כפתור "צור דף שאלות למקצוע" ליד כל שורת מקצוע, פעיל רק כשהעלון נשמר ויש תוכן בשורה, עם toast וקישור לחומר שנוצר.

## קבצים

- מיגרציה: הוספת 5 עמודות ל-`weekly_bulletins`
- עדכון: `src/lib/bulletins.functions.ts`, `src/lib/bulletin-sync.functions.ts` (שתי server fns חדשות), `src/routes/_authenticated.bulletins.$classId.tsx`, `src/lib/pdf/bulletin-pdf.ts`, `src/lib/text-export.ts`, `src/test/text-export.test.ts`
- חדש: `src/components/bulletin-import-questions-dialog.tsx`
