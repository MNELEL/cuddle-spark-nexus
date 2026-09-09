import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readCalendarRows, readDailyLogRows } from "@/lib/calendar-file-import";

/** בונה קובץ Excel אמיתי (מערך בייטים) ומחזיר את שורות הגיליון הראשון. */
function roundTrip(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "כיתה");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const back = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = back.Sheets[back.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

describe("קריאת תאריכי לוח מקובץ Excel", () => {
  it("קורא שם, תאריך-החלוף ותאריך לידה מקובץ אמיתי", () => {
    const rows = roundTrip([
      { "שם התלמיד": "יוסף כהן", "תאריך תחילת לימוד": "א׳ תשרי תשפ״ו", "תאריך לידה": "2015-03-12" },
      { "שם התלמיד": "שמעון לוי", "תאריך תחילת לימוד": "02/09/2025", "תאריך לידה": "" },
      { "שם התלמיד": "", "תאריך תחילת לימוד": "2025-09-02", "תאריך לידה": "" },
    ]);

    const out = readCalendarRows(rows);
    expect(out).toHaveLength(2);
    expect(out[0]!.name).toBe("יוסף כהן");
    expect(out[0]!.start_date).toBe("2025-09-23");
    expect(out[0]!.birth_date).toBe("2015-03-12");
    expect(out[1]!).toEqual({ name: "שמעון לוי", start_date: "2025-09-02", birth_date: null });
  });

  it("מדלג על שורות בלי תאריך בכלל", () => {
    const rows = roundTrip([{ "שם מלא": "לוי ישראל", "הערות": "אין תאריכים" }]);
    expect(readCalendarRows(rows)).toEqual([]);
  });
});

describe("קריאת תיעוד יומי מקובץ Excel", () => {
  it("קורא נוכחות, ציון והערה, ומשלים תאריך חסר מהיום הפעיל", () => {
    const rows = roundTrip([
      { "שם התלמיד": "יוסף כהן", "תאריך תיעוד": "2025-09-23", "נוכחות": "נוכח", "ציון": 88, "מקצוע": "גמרא", "תיעוד": "השתתף מאוד" },
      { "שם התלמיד": "שמעון לוי", "תאריך תיעוד": "", "נוכחות": "איחור", "ציון": "", "מקצוע": "", "תיעוד": "" },
      { "שם התלמיד": "אין נתונים", "תאריך תיעוד": "2025-09-23", "נוכחות": "", "ציון": "", "מקצוע": "", "תיעוד": "" },
    ]);

    const out = readDailyLogRows(rows, "2025-10-01");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      name: "יוסף כהן",
      date: "2025-09-23",
      status: "present",
      grade: 88,
      subject: "גמרא",
      note: "השתתף מאוד",
    });
    expect(out[1]!.date).toBe("2025-10-01");
    expect(out[1]!.status).toBe("late");
    expect(out[1]!.grade).toBeNull();
  });

  it("מחזיר רשימה ריקה בלי עמודת שם", () => {
    expect(readDailyLogRows(roundTrip([{ "נוכחות": "נוכח" }]), "2025-10-01")).toEqual([]);
  });
});

