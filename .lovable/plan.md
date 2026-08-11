# הרחבת העלון השבועי — תוכן מובנה ו-PDF משודרג

התוכנית מרחיבה את הפיצ׳ר הקיים בלבד. זרימת draft/publish/lock, סנכרון לספרייה (`bulletin-sync.functions.ts`) והיסטוריית הגרסאות לא נוגעים בהם.

## 1. סכימה (מיגרציה אחת, בלי טבלה חדשה)

הוספת שלוש עמודות ל-`public.weekly_bulletins` הקיימת:

- `torah_dvar_title text not null default ''`
- `torah_dvar_body text not null default ''`
- `study_schedule jsonb not null default '{}'::jsonb`
- `honored_students jsonb not null default '[]'::jsonb`

`study_points` נשאר כמו שהוא — הוא מקור ה-fallback וגם מה שמזין את embedding/הצעות הספרייה, ולכן אין לו שינוי. אין GRANT/RLS חדשים (טבלה קיימת, מדיניות קיימת).

## 2. טיפוסים ושרת (`src/lib/bulletins.functions.ts`)

- `BulletinDraft` יקבל:
  - `torah_dvar_title: string`, `torah_dvar_body: string`
  - `study_schedule: StudySchedule` — אובייקט עם מפתחות אופציונליים `gemara {daf, topic}`, `mishna {masechet, perek}`, `torah {parasha, pasuk_range}`, `navi {sefer, perek}`, `halacha {siman, seif}`; כל שדה טקסט עם ברירת מחדל `""`.
  - `honored_students: { name: string; type: "vort" | "mazal_tov" | "other"; note: string }[]`
- `saveBulletin`: ולידציית zod לשדות החדשים (אורכים סבירים, `type` enum) ושמירתם ב-row. שאר הפונקציה — כולל בדיקת ה-lock — ללא שינוי.
- `generateBulletin`: הפרומפט יורחב כך שה-JSON כולל גם `torah_dvar_title`/`torah_dvar_body`/`study_schedule`/`honored_students` (honored נשאר ריק כברירת מחדל — AI לא ימציא שמות תלמידים), עם normalization מלא בקוד כמו שנעשה היום לשדות האחרים, כדי שעלונים ישנים ותשובות חסרות לא ישברו.
- `unpublishBulletin`: ה-select של ה-snapshot יכלול את השדות החדשים (אחרת גרסאות ישמרו חלקיות). זה שינוי נקודתי בתוך המנגנון הקיים, לא שינוי בהתנהגותו.

תאימות לאחור: כל השדות החדשים עם ברירות מחדל, ולכן `p.$token.tsx`, `c.$slug.tsx`, `parents.functions.ts`, `public-class.functions.ts` ו-`text-export.ts` ממשיכים לעבוד ללא שינוי.

## 3. טופס העריכה (`_authenticated.bulletins.$classId.tsx`)

- `emptyDraft`/`fromStored` יאתחלו את השדות החדשים.
- שני שדות חדשים לדבר תורה (Input לכותרת, Textarea לגוף).
- בלוק "הספק לימודי" — חמש שורות מקצוע עם שני Inputs כל אחת, בתוויות עבריות (גמרא: דף / נושא; משנה: מסכת / פרק; חומש: פרשה / פסוקים; נביא: ספר / פרק; הלכה: סימן / סעיף).
- בלוק "יישר כח ומזל טוב" — רשימה דינמית (הוספה/מחיקה) עם שם, בורר סוג (ווארט / מזל טוב / אחר) והערה.
- כל השדות החדשים `disabled` כשה-status הוא `published`, בהתאם לדפוס הקיים.
- `cacheKey` של תצוגת ה-PDF ישאר `editing.id ?? 'new'`.

## 4. PDF (`src/lib/pdf/bulletin-pdf.ts`)

מבנה עמודים מכוון, במקום זרימה אחת:

```text
עמוד 1 — שער:      לוגו + שם מוסד + כותרת העלון + טווח תאריכים + סיכום השבוע
עמוד 2 — דבר תורה: מסגרת דקורטיבית + כותרת + גוף
עמוד 3 — הספק:     טבלת "שורה למקצוע" + יישר כח/מזל טוב + פעילויות
עמוד 4 — חזרה:     שאלות חזרה להורים + חידה שבועית ותשובה
```

- הלוגו: `drawBrandHeader` כבר מצייר את הלוגו המוסדי כשקיים ב-brand; בשער נשתמש בו ונוסיף כותרת שער גדולה (`subtitle` עם טווח התאריכים) — בלי לשנות את ה-builder המשותף.
- רקע דקורטיבי לעמוד דבר התורה: מסגרת מלבנית כפולה בגוני ה-brand (slate + amber) עם מילוי רך מאוד — מצוירת מקומית ב-`bulletin-pdf.ts`, לא ב-builder, כדי לא להשפיע על שאר המסמכים.
- טבלת הספק: עמודות `מקצוע | פירוט`, שורה לכל מקצוע שיש בו תוכן. אם `study_schedule` ריק לגמרי — נפילה לטבלת `study_points` הקיימת (התנהגות היום).
- יישר כח: טבלה `שם | סוג | הערה` (סוג מתורגם לעברית), מוצגת רק כשיש רשומות.
- מעברי עמוד עם `hd.newPage()` בין הסקציות, ורק כשיש תוכן — עמוד לא ייווצר ריק. `drawFooter` הקיים ממשיך לספור עמודים.

## 5. ייצוא טקסט

`bulletinToMarkdown` ב-`src/lib/text-export.ts` יקבל שלוש סקציות אופציונליות חדשות (דבר תורה, הספק, יישר כח) באותו דפוס "לא מודפס כשריק", והבדיקות הקיימות ב-`src/test/text-export.test.ts` יתרחבו בהתאם — כולל שמירה על דטרמיניזם.

## קבצים

- מיגרציה: הוספת 4 עמודות ל-`weekly_bulletins`
- עדכון: `src/lib/bulletins.functions.ts`, `src/routes/_authenticated.bulletins.$classId.tsx`, `src/lib/pdf/bulletin-pdf.ts`, `src/lib/text-export.ts`, `src/test/text-export.test.ts`
