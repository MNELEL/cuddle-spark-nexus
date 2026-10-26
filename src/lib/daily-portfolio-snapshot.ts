import { hebrewDate } from "./hebrew-date";
import type { StudentDailyEntry } from "./student-daily.functions";
export function dailySnapshotDescription(entry: StudentDailyEntry, date: string, now: string): string {
  const labels: Record<string, string> = { present: "נוכח", absent: "חסר", late: "איחר", excused: "חיסור מוצדק" };
  const time = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(now));
  return [
    `יום: ${hebrewDate(date)} · שעת משיכה: ${time}`,
    entry.attendance ? `נוכחות: ${labels[entry.attendance.status] ?? "לא נרשמה"}${entry.attendance.notes ? ` · ${entry.attendance.notes}` : ""}` : "נוכחות: לא נרשמה",
    ...entry.grades.map((g) => `ציון: ${g.value}/${g.max_value} ${g.subject}`.trim()),
    ...entry.insights.map((i) => `סיכום: ${i.title}${i.description ? ` — ${i.description}` : ""}`),
  ].join("\n");
}