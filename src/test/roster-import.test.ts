import { describe, expect, it } from "vitest";
import {
  buildRosterStudents,
  guessMapping,
  mappingHasName,
  type RosterMapping,
} from "@/lib/roster-import";

describe("guessMapping", () => {
  it("מזהה כותרות בעברית", () => {
    const map = guessMapping(["שם פרטי", "שם משפחה", "גובה", "העדפת שורה", "פינה", "הערות"]);
    expect(map).toMatchObject({
      "שם פרטי": "first_name",
      "שם משפחה": "last_name",
      "גובה": "height",
      "העדפת שורה": "row_pref",
      "פינה": "corner_pref",
      "הערות": "notes",
    });
  });

  it("מזהה כותרות באנגלית ומתעלם מעמודות לא מוכרות", () => {
    const map = guessMapping(["Full Name", "Height", "Random"]);
    expect(map["Full Name"]).toBe("full_name");
    expect(map["Height"]).toBe("height");
    expect(map["Random"]).toBe("ignore");
  });
});

describe("mappingHasName", () => {
  it("דורש עמודת שם", () => {
    expect(mappingHasName({ a: "height" })).toBe(false);
    expect(mappingHasName({ a: "full_name" })).toBe(true);
    expect(mappingHasName({ a: "last_name" })).toBe(true);
  });
});

describe("buildRosterStudents", () => {
  const mapping: RosterMapping = {
    "שם פרטי": "first_name",
    "שם האב": "middle_name",
    "שם משפחה": "last_name",
    "גובה": "height",
    "העדפת שורה": "row_pref",
    "פינה": "corner_pref",
    "הערות": "notes",
  };

  it("מחבר שם מלא ומנרמל שדות עבריים", () => {
    const res = buildRosterStudents(
      [
        {
          "שם פרטי": " יוסף ",
          "שם האב": "בן",
          "שם משפחה": "כהן",
          "גובה": "גבוה",
          "העדפת שורה": "קדמית",
          "פינה": "כן",
          "הערות": "יושב עם חבר",
        },
      ],
      mapping,
    );
    expect(res.students).toEqual([
      {
        name: "יוסף בן כהן",
        height: "high",
        row_pref: "front",
        corner_pref: true,
        notes: "יושב עם חבר",
      },
    ]);
    expect(res.skipped).toBe(0);
  });

  it("מדלג על שורות בלי שם", () => {
    const res = buildRosterStudents([{ "גובה": "נמוך" }, { "שם פרטי": "לוי" }], mapping);
    expect(res.students).toHaveLength(1);
    expect(res.skipped).toBe(1);
  });

  it("מסנן כפילויות בקובץ ומול שמות קיימים", () => {
    const res = buildRosterStudents(
      [
        { "שם פרטי": "משה", "שם משפחה": "לוי" },
        { "שם פרטי": "משה", "שם משפחה": "לוי" },
        { "שם פרטי": "אהרן", "שם משפחה": "כהן" },
      ],
      mapping,
      ["אהרן כהן"],
    );
    expect(res.students.map((s) => s.name)).toEqual(["משה לוי"]);
    expect(res.duplicatesInFile).toEqual(["משה לוי"]);
    expect(res.existingMatches).toEqual(["אהרן כהן"]);
  });

  it("ברירות מחדל כשהערכים חסרים או לא מוכרים", () => {
    const res = buildRosterStudents([{ "שם פרטי": "דוד", "גובה": "???" }], mapping);
    expect(res.students[0]).toMatchObject({ height: "mid", row_pref: "any", corner_pref: false, notes: "" });
  });
});
