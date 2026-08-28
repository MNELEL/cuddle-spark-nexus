/**
 * מפת המערכת — מקור אמת אחד לפריטים המוצגים ב-/map ולייצוא ה-PDF.
 * `sub` הוא התיאור הקצר בעברית שמופיע גם בבועת המידע וגם במסמך.
 */
export type MapItem = {
  /** נתיב הראוט; `$classId` מוחלף בכיתה הנבחרת. */
  to: string;
  label: string;
  /** תיאור קצר — מה עושים ומה המטרה. */
  sub: string;
  /** מוצג רק למנהלי מוסד / מנהלים. */
  adminOnly?: boolean;
};

export type MapSection = { title: string; items: MapItem[] };

/** קטגוריית-על: אוסף של קטגוריות משנה (לפי הכותרות ב-MAP_SECTIONS). */
export type MapSuperSection = { title: string; sectionTitles: string[] };

/** קבוצות דו-רמתיות למסך /map — קטגוריית-על → קטגוריות משנה → מסכים. */
export const MAP_SUPER_SECTIONS: MapSuperSection[] = [
  { title: "ניהול הכיתה", sectionTitles: ["ניהול הכיתה יום־יום"] },
  { title: "הערכה ומבחנים", sectionTitles: ["הערכה, ציונים ומבחנים"] },
  { title: "מוטיבציה וקשר הורים", sectionTitles: ["מוטיבציה ופרסים", "קשר עם ההורים"] },
  { title: "חומרי הוראה וכלים", sectionTitles: ["חומרי הוראה וכלי שיעור"] },
  { title: "תלמידים וייבוא", sectionTitles: ["תלמידים, ייבוא ומעבר שנה"] },
  { title: "הגדרות וניהול", sectionTitles: ["הגדרות ואבטחה"] },
];

/**
 * בונה את המבנה הדו-רמתי מתוך רשימת קטגוריות (בדרך כלל אחרי סינון/חיפוש).
 * קטגוריה שאינה משויכת לקטגוריית-על מקבלת קטגוריית-על משלה, כדי שלא ייעלמו מסכים.
 */
export function buildSuperSections(
  sections: MapSection[],
): { title: string; sections: MapSection[]; count: number }[] {
  const byTitle = new Map(sections.map((s) => [s.title, s]));
  const used = new Set<string>();
  const out: { title: string; sections: MapSection[]; count: number }[] = [];

  for (const sup of MAP_SUPER_SECTIONS) {
    const subs: MapSection[] = [];
    for (const t of sup.sectionTitles) {
      const s = byTitle.get(t);
      if (s && s.items.length > 0) { subs.push(s); used.add(t); }
    }
    if (subs.length > 0) {
      out.push({ title: sup.title, sections: subs, count: subs.reduce((a, s) => a + s.items.length, 0) });
    }
  }
  for (const s of sections) {
    if (used.has(s.title) || s.items.length === 0) continue;
    out.push({ title: s.title, sections: [s], count: s.items.length });
  }
  return out;
}


export const MAP_SECTIONS: MapSection[] = [
  {
    title: "ניהול הכיתה יום־יום",
    items: [
      { to: "/classes", label: "הכיתות שלי", sub: "רשימת תלמידים, נוכחות והתנהגות — נקודת הפתיחה לכל יום לימודים" },
      { to: "/weekly-schedule/$classId", label: "מערכת שעות ותורנויות", sub: "לוח שבועי מלא כולל לוח עברי, חגים וחלוקת תורנויות אוטומטית" },
      { to: "/classes/$classId/display", label: "סידור הושבה ותצוגת כיתה", sub: "קביעת מקומות ישיבה וצפייה בכיתה בתלת־ממד לפני השיעור" },
      { to: "/daily/$classId", label: "סיכום יומי", sub: "מה קרה היום — סיכום מוכן להדפסה או לשליחה להורים" },
      { to: "/bulletins/$classId", label: "עלון שבועי לכיתה", sub: "עלון עם סיכום השבוע, חידה ופעילויות לתלמידים" },
      { to: "/weekly-sheet", label: "דף קשר שבועי להורים", sub: "הספק החומר לפי מקצועות, מבחנים והודעות — כולל דף חתימת הורים להדפסה" },
      { to: "/calendar/$classId", label: "לוח אירועים", sub: "מבחנים, ימי הולדת ואירועי כיתה במקום אחד" },
    ],
  },
  {
    title: "הערכה, ציונים ומבחנים",
    items: [
      { to: "/exam-generator/$classId", label: "מחולל מבחנים", sub: "יצירת מבחן מותאם מהחומר שנלמד, בלחיצה אחת" },
      { to: "/exam-scanner/$classId", label: "סורק מבחנים", sub: "העלאת מבחן סרוק וניקוד אוטומטי בעזרת בינה מלאכותית" },
      { to: "/analytics/$classId", label: "אנליטיקת כיתה", sub: "מגמות ציונים והתפלגות, כולל שקלול לפי סוגי הערכה" },
      { to: "/pedagogical/$classId", label: "דוח פדגוגי", sub: "תמונת מצב לימודית לכל תלמיד — לשיחות ולמסירה" },
      { to: "/reports/$classId", label: "דוחות מעקב", sub: "דוחות התקדמות מוכנים להדפסה ולתיק התלמיד" },
      { to: "/certificates/$classId", label: "תעודות PDF", sub: "הפקת תעודות בעברית מלאה עם הלוגו והכותרת של המוסד" },
      { to: "/insights", label: "תובנות", sub: "מגמות רוחביות בציונים, נוכחות והתנהגות לאורך זמן" },
    ],
  },
  {
    title: "מוטיבציה ופרסים",
    items: [
      { to: "/gamification/$classId", label: "מבצעים, נקודות וטבלת מובילים", sub: "מערכת נקודות ופרסים שמעודדת התמדה בלימוד ובהתנהגות" },
      { to: "/raffle/$classId", label: "הגרלות בכיתה", sub: "גלגל מזל להגרלת תלמיד או פרס — הוגן ומהנה" },
      { to: "/poll/$classId", label: "סקר כיתה חי", sub: "שאלה לכיתה עם תוצאות בזמן אמת על המקרן" },
    ],
  },
  {
    title: "קשר עם ההורים",
    items: [
      { to: "/parents/$classId", label: "מיילים ועדכונים להורים", sub: "כתיבה ושליחה של עדכונים להורים מתוך תבניות מוכנות" },
      { to: "/share/$classId", label: "קישורי צפייה להורים", sub: "יצירת קישור צפייה בלבד לעמוד הכיתה, ללא צורך בהרשמה" },
      { to: "/student-view/$classId", label: "מצב תלמיד", sub: "המסך כפי שהתלמיד וההורה רואים — לבדיקה לפני שיתוף" },
    ],
  },
  {
    title: "חומרי הוראה וכלי שיעור",
    items: [
      { to: "/resources", label: "ספריית חומרי הוראה", sub: "מערכי שיעור, דפי עבודה ועזרים — שמורים ומסודרים לפי נושא" },
      { to: "/resources/generate", label: "מחולל סיכומים ומשימות", sub: "הפקת סיכום או מערך משימות מתוך חומר שכבר בספרייה" },
      { to: "/questions", label: "מאגר שאלות", sub: "בנק שאלות לפי מקצוע ונושא — לשיעור, לחזרה ולמבחן" },
      { to: "/toolkit", label: "ארגז כלים לשיעור", sub: "טיימר, בוחר אקראי, מדד רעש וכרטיסיות — לשימוש מיידי בכיתה" },
      { to: "/bell-schedule", label: "לוח צלצולים ופעמונים", sub: "תזמון צלצולי שיעור והפסקות לאורך יום הלימודים" },
      { to: "/sound-board", label: "ניהול צלילים ואפקטים", sub: "ספריית צלילים לאירועים במערכת, כולל העלאת צליל משלך" },
    ],
  },
  {
    title: "תלמידים, ייבוא ומעבר שנה",
    items: [
      { to: "/ingest", label: "העלאה חכמה של רשימת תלמידים", sub: "זיהוי אוטומטי של שם פרטי ומשפחה, בלי למחוק מידע קיים" },
      { to: "/classes", label: "אשף מעבר שנה וארכיון כיתות", sub: "מתוך כרטיס הכיתה — פתיחת כיתת המשך והעברת התלמידים" },
      { to: "/classes/$classId", label: "תיק תלמיד ומידע רגיש", sub: "מידע רפואי ולימודי — גלוי למלמד ולמנהל בלבד" },
    ],
  },
  {
    title: "הגדרות ואבטחה",
    items: [
      { to: "/settings", label: "מרכז ההגדרות", sub: "קוד PIN, העדפות תזכורות ומצב המנוי — הכול במקום אחד" },
      { to: "/settings/brand", label: "מיתוג המוסד", sub: "לוגו, שם וכותרת שמוטמעים בכל מסמך שמופק מהמערכת" },
      { to: "/settings/theme", label: "ערכת נושא", sub: "בחירת מראה למערכת — נשמרת ומופיעה בכל המכשירים" },
      { to: "/contact-sheet", label: "דף קשר של המוסד", sub: "הנהלה, צוות, ספקים, בריאות וחירום — תבנית מוכנה והפקה ל-PDF" },
      { to: "/onboarding", label: "המדריך החכם", sub: "שישה שלבים מהקמת כיתה ועד הדוח הראשון להורים" },
      { to: "/overview", label: "דשבורד מוסדי מרוכז", sub: "כיתות, מלמדים, משימות פתוחות והתקדמות בתוכנית הלימודים", adminOnly: true },
      { to: "/institution", label: "לוח המוסד", sub: "ניהול כיתות, מלמדים וצוות המוסד", adminOnly: true },
      { to: "/user-management", label: "ניהול משתמשים והרשאות", sub: "בקשות גישה, הרשאות, מוסדות ותקופות ניסיון", adminOnly: true },
    ],
  },
];
