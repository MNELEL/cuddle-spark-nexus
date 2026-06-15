
## מטרה
לשפר את `src/lib/pdf/student-daily-pdf.ts` כך שהפלט יישמר זהה ועקבי בכל מכשיר שממנו מופעלת ההפקה (A4 קבוע, ללא תלות ברוחב המסך של הדפדפן), עם יישור RTL נקי, כותרות ממוספרות וטיפול נכון בעטיפת טקסט עברי.

## שינויים ב-`student-daily-pdf.ts`

### 1. RTL מדויק עבור כל הטקסטים
- כל קריאות `doc.text(...)` יקבלו במפורש `{ align: "right" }` (כיום נשענות על `setR2L` בלבד — לעיתים גורם לסטיות עיגון בכותרות).
- הוספת קבועי פריסה: `marginLeft = 14`, `marginRight = 14`, `contentWidth = pageW - marginLeft - marginRight`, ועיגון אחיד מימין ל-`pageW - marginRight`.
- ב-`autoTable`: הוספת `theme: "grid"`, `cellPadding: 2.5`, ו-`halign: "right"` כברירת מחדל לכל ה-`body` (גם בטבלאות שכיום ב-`center` נשאיר מספרים ב-`center` אך טקסטים מימין).

### 2. פונט מלא — Regular + Bold
- הוספת `Heebo-Bold.ttf` ל-`public/fonts/` ולפונקציית הטעינה (cache לשניהם במקביל).
- רישום שני סגנונות: `addFont("Heebo-Regular.ttf","Heebo","normal")` ו-`addFont("Heebo-Bold.ttf","Heebo","bold")`.
- כותרות סקציה ישתמשו ב-`setFont("Heebo","bold")`; גוף ב-`normal`.

### 3. כותרות ממוספרות
- מערך סקציות: `["נוכחות (30 ימים אחרונים)", "ציונים אחרונים", "התנהגות ונקודות", "הערות הרב"]`.
- פונקציית עזר `sectionHeader(num, title)` שתצייר:
  - רקע עדין `setFillColor(241,245,249)` מלבן ברוחב `contentWidth`,
  - פס אמבר `2mm` בצד ימין (RTL — בולט בקצה הימני),
  - טקסט `"§{num}. {title}"` ב-`bold 12pt`, צבע Midnight Slate, מיושר ל-`pageW - marginRight - 4`.
- כל סקציה מקבלת מספר רץ; אם סקציית הערות ריקה — לא נספרת.

### 4. שבירת שורות טבעית בעברית
- בלוק ההערות יעבור ל-`autoTable` עם תא יחיד (`overflow: "linebreak"`, `cellWidth: contentWidth`, `halign: "right"`) במקום `splitTextToSize` — autoTable שובר נכון לפי רוחב התא ושומר RTL, ומונע "בליעת" רווחים בעברית.
- גם תא "תיאור" בטבלת המשמעת יקבל `cellWidth: "wrap"` עם `minCellWidth` ו-`overflow: "linebreak"` כדי שתיאורים ארוכים לא יחתכו.
- בכל מקום שמשתמשים ב-`doc.text` למחרוזות אפשריות-ארוכות (subheader bits) — נריץ דרך `splitTextToSize(text, contentWidth)` ונצייר כמערך שורות.

### 5. ניהול שבירת עמוד
- פונקציית עזר `ensureSpace(needed)` שמוסיפה עמוד כשנשאר פחות מ-`needed` ל-`pageHeight - 20`. תיקרא לפני כל `sectionHeader`.

### 6. Footer ו-Header עקביים
- ה-Footer יצויר בלולאה הסופית עם `setR2L(true)` כדי שמספר העמודים יישאר תקין (`עמ׳ X מתוך Y`).
- הוספת מספר עמוד גם בפינה השמאלית-תחתונה ושם בית הספר/כיתה בימנית-תחתונה (font 7pt).

## קבצים שיתעדכנו
- `src/lib/pdf/student-daily-pdf.ts` — שכתוב הפונקציה לפי הנ"ל.
- `public/fonts/Heebo-Bold.ttf` — תוספת קובץ פונט (יורד מ-Google Fonts בזמן build).

## ללא שינוי
- חתימת `buildStudentDailyPdf` ו-`downloadPdfBlob` נשארות זהות → `parent-email-composer.tsx` לא משתנה.
- אין שינויי DB, אין מיגרציות, אין שינוי תלויות npm.

## QA לאחר ההטמעה
1. הפקת PDF לתלמיד עם הערות ארוכות + 20 ציונים + 10 אירועי משמעת.
2. בדיקה ב-3 רוחבי מסך (320, 768, 1440) שהפלט זהה בייט-לבייט (אותו A4).
3. בדיקה ש-Bold נטען (כותרות מודגשות) ושאין "ריבועים שחורים".
