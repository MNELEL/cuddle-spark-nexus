import { describe, expect, it } from "vitest";
import {
  buildMatchIndex,
  digitsOnly,
  mergePatch,
  normalizeName,
  rememberMatch,
  resolveMatch,
  studentFieldsFromRow,
} from "@/lib/roster-merge";

describe("roster-merge (field-level import merge)", () => {
  it("normalises names and strips non-digits", () => {
    expect(normalizeName("  שמואל   לוי ")).toBe("שמואל לוי");
    expect(normalizeName(null)).toBe("");
    expect(digitsOnly("12-345/678")).toBe("12345678");
    expect(digitsOnly(undefined)).toBe("");
  });

  it("indexes existing rows by national id and by name, first wins", () => {
    const index = buildMatchIndex([
      { id: "a", name: "שמואל לוי", national_id: "123456789" },
      { id: "b", name: "שמואל לוי", national_id: "987654321" },
      { id: "c", name: "  יוסי  כהן ", national_id: "12" },
      { id: "d", name: null, national_id: null },
    ]);
    expect(index.byId.get("123456789")).toBe("a");
    expect(index.byName.get("שמואל לוי")).toBe("a");
    expect(index.byName.get("יוסי כהן")).toBe("c");
    // too-short id is not indexed
    expect(index.byId.has("12")).toBe(false);
    expect(index.byName.has("")).toBe(false);
  });

  it("matches by national id first, then falls back to the full name", () => {
    const index = buildMatchIndex([
      { id: "a", name: "שמואל לוי", national_id: "123456789" },
      { id: "c", name: "יוסי כהן", national_id: null },
    ]);
    // id wins even when the name differs (e.g. name fixed in the file)
    expect(resolveMatch(index, { name: "שמואל הלוי", national_id: "12-3456789" })).toBe("a");
    // no id -> name fallback
    expect(resolveMatch(index, { name: "  יוסי   כהן " })).toBe("c");
    // unknown row
    expect(resolveMatch(index, { name: "אברהם פרידמן", national_id: "555555555" })).toBeUndefined();
  });

  it("splits the full name into first / last name", () => {
    expect(studentFieldsFromRow({ name: "שמואל  לוי" })).toMatchObject({
      name: "שמואל לוי",
      first_name: "שמואל",
      last_name: "לוי",
    });
    expect(studentFieldsFromRow({ name: "יוסי" })).toMatchObject({
      first_name: "יוסי",
      last_name: null,
    });
    expect(studentFieldsFromRow({ name: "משה בן דוד" })).toMatchObject({
      first_name: "משה",
      last_name: "בן דוד",
    });
  });

  it("maps empty incoming values to null", () => {
    const fields = studentFieldsFromRow({
      name: "שמואל לוי",
      national_id: "",
      address: null,
      father_phone: "050-1234567",
    });
    expect(fields.national_id).toBeNull();
    expect(fields.address).toBeNull();
    expect(fields.father_phone).toBe("050-1234567");
  });

  it("mergePatch keeps only non-empty fields so stored values survive", () => {
    const fields = studentFieldsFromRow({
      name: "שמואל לוי",
      national_id: "123456789",
      address: "",
      mother_phone: undefined,
    });
    const patch = mergePatch(fields);
    expect(patch).toEqual({
      name: "שמואל לוי",
      first_name: "שמואל",
      last_name: "לוי",
      national_id: "123456789",
    });
    expect("address" in patch).toBe(false);
    expect("mother_phone" in patch).toBe(false);
    expect("birth_date" in patch).toBe(false);
  });

  it("a freshly inserted row is matched by later rows in the same file", () => {
    const index = buildMatchIndex([]);
    const row = { name: "אברהם פרידמן", national_id: "555555555" };
    expect(resolveMatch(index, row)).toBeUndefined();
    rememberMatch(index, row, "new-id");
    expect(resolveMatch(index, row)).toBe("new-id");
    expect(resolveMatch(index, { name: "אברהם פרידמן" })).toBe("new-id");
  });
});
