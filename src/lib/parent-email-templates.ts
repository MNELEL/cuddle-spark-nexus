/**
 * Pre-built parent email templates in Hebrew. Each template receives a
 * StudentStats payload and returns `{ subject, body }` ready to send.
 */

export type StudentStats = {
  studentName: string;
  className: string;
  teacherName: string;
  /** ISO date YYYY-MM-DD for window start */
  from: string;
  /** ISO date YYYY-MM-DD for window end */
  to: string;
  attendance: { present: number; absent: number; late: number; excused: number };
  grades: Array<{ subject: string; value: number; max_value: number }>;
  behavior: { positive: number; negative: number };
  scoreOutOf100?: number | null;
  /** Free-text personal note from the teacher. */
  customNote?: string;
};

export type TemplateKey =
  | "weekly_positive"
  | "attendance_concern"
  | "behavior_concern"
  | "grade_concern"
  | "achievement"
  | "meeting_invite";

export const PARENT_TEMPLATE_LABELS: Record<TemplateKey, string> = {
  weekly_positive: "עדכון חיובי שבועי",
  attendance_concern: "דאגה מנוכחות",
  behavior_concern: "דאגה התנהגותית",
  grade_concern: "שיחה על ציון נמוך",
  achievement: "ברכה על הישג מיוחד",
  meeting_invite: "הזמנה לפגישת הורים",
};

function gradesLines(s: StudentStats) {
  if (!s.grades.length) return "אין ציונים בתקופה הזו.";
  return s.grades
    .slice(0, 8)
    .map((g) => `• ${g.subject || "—"}: ${g.value}/${g.max_value}`)
    .join("\n");
}

function attendanceLine(s: StudentStats) {
  const a = s.attendance;
  const total = a.present + a.absent + a.late + a.excused;
  if (!total) return "אין רישומי נוכחות בתקופה זו.";
  const pct = Math.round(((a.present + a.excused) / total) * 100);
  return `נכח ${a.present} · איחר ${a.late} · נעדר ${a.absent} · מאושר ${a.excused} (${pct}% נוכחות פעילה)`;
}

function sign(s: StudentStats) {
  const note = s.customNote?.trim()
    ? `\n\nהערה אישית:\n${s.customNote.trim()}\n`
    : "";
  return `${note}\nבברכת התורה,\nהרב ${s.teacherName || "המלמד"}\nכיתה ${s.className}`;
}

function greeting(s: StudentStats) {
  return `שלום וברכה להוריו של ${s.studentName} שיחי',`;
}

export function renderTemplate(
  key: TemplateKey,
  s: StudentStats,
): { subject: string; body: string } {
  switch (key) {
    case "weekly_positive": {
      const subject = `עדכון שבועי על ${s.studentName} — נחת ושמחה`;
      const body =
`${greeting(s)}

ברצוני לעדכן אתכם שהשבוע ${s.studentName} למד יפה והשתתף בשיעורים בצורה נאה.

נתוני התקופה (${s.from} — ${s.to}):
${attendanceLine(s)}
נקודות התנהגות: +${s.behavior.positive} / −${s.behavior.negative}

ציונים אחרונים:
${gradesLines(s)}

המשך מתן הערכה ועידוד בבית יסייעו לו מאוד.${sign(s)}`;
      return { subject, body };
    }
    case "attendance_concern": {
      const subject = `${s.studentName} — בקשה לשיתוף פעולה בנושא נוכחות`;
      const body =
`${greeting(s)}

שמתי לב שבתקופה האחרונה (${s.from} — ${s.to}) ל-${s.studentName} ${s.attendance.absent} חיסורים ו-${s.attendance.late} איחורים.
הסדר היומי וההגעה בזמן חשובים מאוד להתקדמותו בלימודים ולתחושת השייכות לכיתה.

אשמח לשמוע ממכם אם יש משהו שאוכל לסייע בו, ולתאם יחד דרך לחזק את הנושא.${sign(s)}`;
      return { subject, body };
    }
    case "behavior_concern": {
      const subject = `${s.studentName} — עדכון התנהגותי`;
      const body =
`${greeting(s)}

ברצוני לעדכן אתכם בקצרה על מספר אירועים התנהגותיים מהתקופה האחרונה (${s.from} — ${s.to}):
סך נקודות חיוביות: +${s.behavior.positive}
סך נקודות שליליות: −${s.behavior.negative}

אני מאמין ב-${s.studentName} ובכוחותיו, וחשוב לי לעבוד יחד אתכם כדי לעזור לו להתמקד בלימוד ובהתנהגות ראויה.
אשמח לתאם שיחה קצרה בנושא.${sign(s)}`;
      return { subject, body };
    }
    case "grade_concern": {
      const subject = `${s.studentName} — שיחה על ההישגים בלימודים`;
      const body =
`${greeting(s)}

אני פונה אליכם בנוגע להישגים האחרונים של ${s.studentName} בלימודים:

${gradesLines(s)}

ניכר ש-${s.studentName} זקוק לחיזוק נוסף במקצועות אלו. אשמח לחשוב יחד אתכם על דרכי תגבור — האם בבית, חברותא, או שיעור פרטני.${sign(s)}`;
      return { subject, body };
    }
    case "achievement": {
      const subject = `יישר כח גדול ל-${s.studentName}!`;
      const body =
`${greeting(s)}

אני שמח לבשר לכם על הישג מיוחד של ${s.studentName} בתקופה האחרונה.
ניכר על פניו השקעה אמיתית, רצון להתעלות, וענווה בלימוד.

${s.grades.length ? `ציונים מצוינים אחרונים:\n${gradesLines(s)}\n` : ""}תזכו לרוות ממנו רוב נחת ושמחה, ולראותו גדל בתורה וביראת שמים.${sign(s)}`;
      return { subject, body };
    }
    case "meeting_invite": {
      const subject = `הזמנה לפגישה בנושא ${s.studentName}`;
      const body =
`${greeting(s)}

אשמח לתאם אתכם פגישה קצרה כדי לעדכן אתכם על התקדמותו של ${s.studentName} בתקופה האחרונה, ולחשוב יחד כיצד נוכל להמשיך ולקדם אותו.

אנא השיבו לי באילו ימים ושעות נוח לכם, ואתאם בהתאם.${sign(s)}`;
      return { subject, body };
    }
  }
}