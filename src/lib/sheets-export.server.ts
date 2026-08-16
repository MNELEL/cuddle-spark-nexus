/**
 * ייצוא רשימת התלמידים והציונים לגיליון Google Sheets.
 * הגיליון נוצר פעם אחת לכיתה (המזהה נשמר על הכיתה) ובכל ייצוא נוסף הוא מתעדכן,
 * כדי שלא ייצרו עשרות גיליונות זהים.
 */
import { buildGradesSheetValues, type SheetStudent } from "./sheets-rows";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SHEET_TAB = "Grades";

function columnLetter(index: number): string {
  let n = index;
  let out = "";
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

async function gateway(path: string, init: { method: string; body?: unknown }) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("חיבור Google Sheets אינו מוגדר במערכת");

  const res = await fetch(`${GATEWAY}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[Google Sheets ${res.status}]`, text);
    if (res.status === 401 || res.status === 403) throw new Error("אין הרשאה ל-Google Sheets. יש לחבר מחדש את החיבור.");
    if (res.status === 404) throw new Error("SHEET_NOT_FOUND");
    if (res.status === 429) throw new Error("יותר מדי בקשות ל-Google Sheets. נסה שוב בעוד רגע.");
    throw new Error("הייצוא ל-Google Sheets נכשל. נסה שוב.");
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export async function exportGradesToGoogleSheet(
  supabase: Supa,
  input: { classId: string; from: string; to: string },
) {
  const { data: cls, error: cErr } = await supabase
    .from("classes")
    .select("id,name,grades_sheet_id")
    .eq("id", input.classId)
    .maybeSingle();
  if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
  if (!cls) throw new Error("הכיתה לא נמצאה");

  const [students, grades, weights] = await Promise.all([
    supabase.from("students").select("id,name").eq("class_id", input.classId).order("name"),
    supabase
      .from("grades")
      .select("student_id,subject,value,max_value")
      .eq("class_id", input.classId)
      .gte("date", input.from)
      .lte("date", input.to),
    supabase.from("grade_weights").select("id,subject,weight").eq("class_id", input.classId),
  ]);
  if (students.error) { console.error("[DB Error]", students.error); throw new Error("טעינת התלמידים נכשלה"); }
  if (grades.error) { console.error("[DB Error]", grades.error); throw new Error("טעינת הציונים נכשלה"); }

  const rowsOfStudents: SheetStudent[] = (students.data ?? []).map(
    (s: { id: string; name: string }) => ({
      id: s.id,
      name: s.name,
      grades: (grades.data ?? []).filter((g: { student_id: string }) => g.student_id === s.id),
    }),
  );
  if (rowsOfStudents.length === 0) throw new Error("אין תלמידים בכיתה לייצוא");

  const values = buildGradesSheetValues({
    className: cls.name,
    from: input.from,
    to: input.to,
    students: rowsOfStudents,
    weights: weights.data ?? [],
  });
  const lastCol = columnLetter((values[0]?.length ?? 1) - 1);

  let spreadsheetId: string = cls.grades_sheet_id ?? "";
  let created = false;

  if (spreadsheetId) {
    // עדכון גיליון קיים: מנקים ואז כותבים מחדש. אם הגיליון נמחק — יוצרים חדש.
    try {
      await gateway(`/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!A1:ZZ2000:clear`, { method: "POST", body: {} });
    } catch (e) {
      if (e instanceof Error && e.message === "SHEET_NOT_FOUND") spreadsheetId = "";
      else throw e;
    }
  }

  if (!spreadsheetId) {
    const createdSheet = await gateway("/spreadsheets", {
      method: "POST",
      body: {
        properties: { title: `ציונים — ${cls.name}` },
        sheets: [{ properties: { title: SHEET_TAB, rightToLeft: true } }],
      },
    });
    spreadsheetId = String(createdSheet["spreadsheetId"] ?? "");
    if (!spreadsheetId) throw new Error("יצירת הגיליון נכשלה");
    created = true;
    const { error: upErr } = await supabase
      .from("classes")
      .update({ grades_sheet_id: spreadsheetId })
      .eq("id", input.classId);
    if (upErr) console.error("[DB Error]", upErr);
  }

  await gateway(
    `/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!A1:${lastCol}${values.length}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: { range: `${SHEET_TAB}!A1:${lastCol}${values.length}`, majorDimension: "ROWS", values } },
  );

  return {
    ok: true as const,
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    created,
    rows: values.length,
    students: rowsOfStudents.length,
  };
}
