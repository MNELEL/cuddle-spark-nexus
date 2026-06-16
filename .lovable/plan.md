## מטרה
לוודא ש-RTL מדויק, כותרות ממוספרות (§1, §2...) ושבירת שורות טבעית בעברית מיושמים אחיד **בכל** הדוחות והייצוא ל-PDF — לא רק ב-PDF סיכום אישי.

## מיפוי המצב הקיים

| מקור PDF | מנגנון | RTL/§/שבירה היום |
|---|---|---|
| `src/lib/pdf/student-daily-pdf.ts` (סיכום תלמיד 30 ימים) | jsPDF + autoTable + Heebo | ✅ מלא |
| `_authenticated.reports.$classId` (דוח כיתה לטווח) | `window.print()` על HTML | ⚠️ HTML RTL בלבד, ללא §, ללא שליטה מדויקת |
| `_authenticated.daily.$classId` (סיכום יומי כיתתי) | `window.print()` | ⚠️ אותו דבר |
| `_authenticated.bulletins.$classId` (עלון שבועי) | `window.print()` | ⚠️ אותו דבר |
| `import-export.tsx` exportPDF (גריד הושבה) | html2canvas → תמונה ב-jsPDF | ✅ לא רלוונטי (תמונה) |

## תכנון השינויים

### 1. חילוץ ליבת PDF משותפת — `src/lib/pdf/pdf-builder.ts`
מוציא מ-`student-daily-pdf.ts` ל-helper משותף שכל מחולל PDF ישתמש בו:
- `createHebrewDoc()` — טוען Heebo Regular+Bold, `setR2L(true)`, מחזיר `{ doc, layout }` (marginL/R, rightX, contentW, pageW/H, SLATE/AMBER/SOFT).
- `drawBrandHeader(doc, layout, { title, subtitle, meta })` — פס מותג + כותרת ראשית מיושרת לימין, מטא-נתונים, splitTextToSize למעטפת רב-שורתית.
- `sectionHeaderFactory(doc, layout)` — סוגר מונה `sectionNum` ומחזיר `section(title)` שמדפיס `§N. כותרת` עם רקע SOFT, פס AMBER, יישור ימין מדויק.
- `tablePresets(layout)` — `baseTable` עם `font:"Heebo"`, `halign:"right"`, `overflow:"linebreak"`, `cellPadding:2.5`, `theme:"grid"`.
- `ensureSpaceFactory(doc, layout)` ו-`afterTable(doc)`.
- `drawFooter(doc, layout, { meta })` — קו מפריד, מטא + `ClassAlign Studio · עמ׳ X מתוך Y`, `setR2L(true)` בכל עמוד.

עדכון `student-daily-pdf.ts` להישען על ה-helper (ללא שינוי תוצאה).

### 2. PDF מקורי לדוח טווח כיתה — `src/lib/pdf/class-report-pdf.ts`
מחליף את `window.print()` ב-`reports.$classId` (משאיר כפתור הדפסה כגיבוי):
- כותרת `דוח כיתה — {name}` + מטא: תקופה, תאריך הפקה, מורה, ביה״ס.
- לכל תלמיד `section(`${index}. ${name}`)` עם:
  - §X.1 נוכחות (טבלת present/late/absent/excused).
  - §X.2 ציונים (אם יש) — autoTable, ממוצע ב-foot.
  - §X.3 התנהגות/משמעת (אם יש).
- `pageBreak` אוטומטי, footer אחיד.
- כפתור חדש בעמוד "הורד PDF" לצד "הדפס".

### 3. PDF מקורי לסיכום יומי כיתתי — `src/lib/pdf/daily-class-pdf.ts`
מחליף את `window.print()` ב-`daily.$classId`:
- §1 סיכום נוכחות הכיתה (נכחו/נעדרו/איחור/אחוז).
- §2 פירוט תלמידים (טבלה: שם · נוכחות · ציון יום · אירועים).
- §3 הערות הרב (`classNotes` או `studentNotes[id]`), עם `splitTextToSize` לשבירת שורות עברית טבעית.
- כפתור "הורד PDF" לצד "הדפס".

### 4. PDF מקורי לעלון שבועי — `src/lib/pdf/bulletin-pdf.ts`
מחליף את `window.print()` ב-`bulletins.$classId`:
- כותרת העלון + טווח תאריכים.
- §1 סיכום השבוע (טקסט חופשי, `splitTextToSize`).
- §2 נקודות לימוד (רשימה ממוספרת כתת-סעיפים §2.1, §2.2…).
- §3 הודעות / קישורים (אם קיימים).
- כפתור "הורד PDF" לצד "הדפס".

### 5. אחידות RTL בנתיב ה-HTML print fallback
ב-`reports`, `daily`, `bulletins` — מוסיף ב-block ה-`@media print`:
- `body { direction: rtl; }` במפורש.
- כותרות ה-`<section>` ב-HTML מקבלות גם הן `§N.` (מספור עקבי בין HTML ל-PDF) דרך CSS counter (`counter-reset` + `counter-increment` + `::before { content: "§" counter(sec) ". "; }`).
- `word-break: normal; overflow-wrap: anywhere;` על תאי טבלאות עברית כדי שבדפדפן ייעשו שבירות טבעיות גם בהדפסה.

### 6. ולידציה
- `bun run build` עובר.
- בדיקה ויזואלית: יוצר PDF מכל אחד מהשלושה במצב פיתוח, מאמת:
  - כותרות עיקריות ביישור ימין מדויק (`align: "right"` + `rightX`).
  - מספור רץ §1, §2, §3 בכל מסמך.
  - מחרוזות עבריות ארוכות נשברות בתוך תאים בלי חיתוך.
  - footer ב-RTL בכל עמוד.

## פרטים טכניים
- כל הקבצים החדשים תחת `src/lib/pdf/` ומייצאים `build*Pdf(args): Promise<{ blob, filename }>` + שימוש ב-`downloadPdfBlob` הקיים.
- אין שינוי בסכמת נתונים / server functions — רק תצוגה.
- שמות קבצים: `דוח_כיתה_{name}_{from}_{to}.pdf`, `סיכום_יומי_{name}_{date}.pdf`, `עלון_{name}_{startDate}.pdf` עם `safeName()` משותף.
- שמירת תאימות אחורה: `window.print()` נשאר כאופציה במקביל לכפתור החדש.

מאשר/ת להתחיל?