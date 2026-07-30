import { createHebrewDoc, drawBrandHeader, drawFooter, downloadPdfBlob, setPdfBrand, getPdfBrand, safeName } from "./pdf-builder";

export type ChecklistBrand = {
  schoolName?: string;
  headerLine?: string;
  logoDataUrl?: string;
};

type Section = { title: string; items: string[] };

const SECTIONS: Section[] = [
  {
    title: "1. תגבור התנהגות חיובית",
    items: [
      "הגדרתי 3–5 ציפיות ברורות בניסוח חיובי ותליתי אותן בכיתה.",
      "החלטתי על יחס חיזוקים 4:1 (חיובי לתיקון) ומדדתי יום אחד לדוגמה.",
      "מערכת נקודות/כוכבים פועלת עם פרסים שהתלמיד בוחר.",
      "טקס פתיחה יומי של 60 שניות שבח קבוצתי הוטמע.",
    ],
  },
  {
    title: "2. עיצוב סביבת הלמידה",
    items: [
      "מפת ישיבה עודכנה על סמך נתוני התנהגות וציונים.",
      "אזור שקט מוגדר לקריאה ולהתאוששות (לא כענישה).",
      "לוח סדר יום גלוי ומעודכן מדי בוקר.",
      "רענון מפת הישיבה מתוזמן כל 4–6 שבועות ביומן.",
    ],
  },
  {
    title: "3. שגרות ופרוצדורות",
    items: [
      "5 שגרות ליבה הוגדרו: כניסה, יציאה, מעבר, שאלה, סוף יום.",
      "כל שגרה נלמדה בהדגמה + תרגול + משוב.",
      "סימני שקט חזותיים הוטמעו במקום העלאת קול.",
      "הודעה מוקדמת על מעברים ('עוד שתי דקות עוברים לגמרא').",
    ],
  },
  {
    title: "4. הוראה מבוססת נתונים",
    items: [
      "בדיקה שבועית של תלמידים שירדו יותר מ-10 נקודות ממוצע.",
      "מעקב אחר איחורים ונקודות שליליות לפי יום בשבוע.",
      "דו״ח מודפס לפני כל שיחת הורים.",
      "הפקת תעודות תקופתית נקבעה ביומן.",
    ],
  },
  {
    title: "5. חיבור בית–חיידר",
    items: [
      "דו״ח שבועי קצר להורים יוצא באופן קבוע.",
      "שיחת טלפון קודמת למסרונים במצבים רגישים.",
      "לפחות פנייה חיובית אחת בחודש לכל תלמיד.",
      "הציפיות והשגרות שותפו עם ההורים בכתב.",
    ],
  },
  {
    title: "מעקב שבועי",
    items: [
      "יום א׳ – בדיקת נתוני נוכחות והתנהגות מהשבוע הקודם.",
      "יום ג׳ – שיחה אישית קצרה עם 2 תלמידים.",
      "יום ה׳ – משוב חיובי בכתב להורה אחד לפחות.",
      "יום ו׳ – סיכום ההישגים של הכיתה.",
    ],
  },
];

export async function generateClassroomManagementChecklistPdf(brand?: ChecklistBrand): Promise<void> {
  const prev = getPdfBrand();
  if (brand) {
    setPdfBrand({
      schoolName: brand.schoolName || "הכיתה שלי",
      headerLine: brand.headerLine || "צ'קליסט מקצועי למלמד • ניהול כיתה בתלמוד תורה",
      logoDataUrl: brand.logoDataUrl,
    });
  } else {
    setPdfBrand({
      schoolName: "הכיתה שלי",
      headerLine: "צ'קליסט מקצועי למלמד • ניהול כיתה בתלמוד תורה",
    });
  }
  try {
    const hd = await createHebrewDoc();
    drawBrandHeader(hd, {
      title: "צ'קליסט ניהול כיתה בתלמוד תורה",
      subtitle: "5 אסטרטגיות מקצועיות + מעקב שבועי — לשימוש יומיומי במלמד",
      meta: "הפקה: הכיתה שלי · מבוסס על המדריך המלא בבלוג",
    });

    const { doc, layout } = hd;

    for (const sec of SECTIONS) {
      hd.section(sec.title);
      for (const item of sec.items) {
        hd.ensureSpace(9);
        const boxSize = 4;
        const y = hd.currentY();
        // Checkbox on the right (RTL).
        doc.setDrawColor(120);
        doc.setLineWidth(0.4);
        doc.rect(layout.rightX - boxSize, y - 0.5, boxSize, boxSize);
        // Item text, indented from the checkbox.
        doc.setFont("Heebo", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30);
        const lines = doc.splitTextToSize(item, layout.contentW - boxSize - 3) as string[];
        doc.text(lines, layout.rightX - boxSize - 3, y + 3, { align: "right" });
        hd.advance(Math.max(boxSize + 2, lines.length * 4.6));
      }
      hd.advance(2);
    }

    hd.section("הערות מלמד");
    for (let i = 0; i < 4; i++) {
      hd.ensureSpace(8);
      const y = hd.currentY();
      doc.setDrawColor(210);
      doc.setLineWidth(0.3);
      doc.line(layout.marginL, y + 4, layout.rightX, y + 4);
      hd.advance(7);
    }

    drawFooter(hd, "צ'קליסט זה מהווה השלמה למדריך: בלוג ClassAlign — אסטרטגיות ניהול כיתה");
    const blob = doc.output("blob");
    const school = brand?.schoolName ? `-${safeName(brand.schoolName)}` : "";
    downloadPdfBlob(blob, `checklist-classroom-management${school}.pdf`);
  } finally {
    setPdfBrand(prev);
  }
}