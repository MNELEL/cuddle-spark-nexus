import { describe, expect, it } from "vitest";
import {
  ACCEPT_IMAGE, ACCEPT_LIBRARY_ALL, ACCEPT_RESOURCE, ACCEPT_ROSTER, ACCEPT_SMART,
  ACCEPT_SPREADSHEET, LIBRARY_KIND_ACCEPT, describeAccept, describeAcceptDetailed, validateUploadFile,
} from "@/lib/upload-accept";

describe("describeAcceptDetailed", () => {
  it("מחזיר מערך סוגים ומסונכרן עם describeAccept", () => {
    const kinds = describeAcceptDetailed(ACCEPT_RESOURCE);
    expect(kinds).toContain("PDF");
    expect(kinds).toContain("Word");
    expect(kinds).toContain("תמונה");
    expect(kinds.join(", ")).toBe(describeAccept(ACCEPT_RESOURCE));
  });

  it("מחזיר מערך ריק כשאין התאמה", () => {
    expect(describeAcceptDetailed("")).toEqual([]);
  });
});

const file = (name: string, type: string, size = 1024) =>
  ({ name, type, size }) as unknown as File;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("ולידציית קבצים מאוחדת", () => {
  it("כל רשימת accept מכילה גם MIME וגם סיומת ל-Word", () => {
    for (const a of [ACCEPT_RESOURCE, ACCEPT_SMART, ACCEPT_LIBRARY_ALL, LIBRARY_KIND_ACCEPT.word]) {
      expect(a).toContain(DOCX);
      expect(a).toContain("application/msword");
      expect(a).toContain(".docx");
    }
  });

  it("מקבל docx גם כשהדפדפן מדווח MIME וגם כשהוא ריק", () => {
    expect(validateUploadFile(file("שיעור.docx", DOCX), ACCEPT_RESOURCE).ok).toBe(true);
    expect(validateUploadFile(file("שיעור.docx", ""), ACCEPT_RESOURCE).ok).toBe(true);
  });

  it("דוחה סוג לא נתמך עם הודעה בעברית שמפרטת מה מותר", () => {
    const res = validateUploadFile(file("clip.mp4", "video/mp4"), ACCEPT_ROSTER);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain("אינו נתמך");
      expect(res.message).toMatch(/[\u0590-\u05FF]/);
      expect(res.message).toContain("PDF");
    }
  });

  it("דוחה קובץ גדול מדי וקובץ ריק בעברית", () => {
    const big = validateUploadFile(file("a.png", "image/png", 30 * 1024 * 1024), ACCEPT_IMAGE);
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.message).toContain("המקסימום");
    const empty = validateUploadFile(file("a.png", "image/png", 0), ACCEPT_IMAGE);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.message).toContain("ריק");
  });

  it("גיליונות: xlsx ו-csv נתמכים, pdf לא", () => {
    expect(validateUploadFile(file("a.csv", "text/csv"), ACCEPT_SPREADSHEET).ok).toBe(true);
    expect(validateUploadFile(file("a.xlsx", ""), ACCEPT_SPREADSHEET).ok).toBe(true);
    expect(validateUploadFile(file("a.pdf", "application/pdf"), ACCEPT_SPREADSHEET).ok).toBe(false);
  });

  it("describeAccept מחזיר תיאור בעברית", () => {
    expect(describeAccept(ACCEPT_RESOURCE)).toContain("תמונה");
    expect(describeAccept(ACCEPT_LIBRARY_ALL)).toContain("אודיו");
  });
});
