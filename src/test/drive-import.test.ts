import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { partitionDriveFiles, driveFileName, driveFileMime } from "@/lib/drive.server";

describe("partitionDriveFiles", () => {
  it("splits folders from files and sorts both alphabetically", () => {
    const { folders, files } = partitionDriveFiles([
      { id: "a", name: "ז.pdf", mimeType: "application/pdf", size: "1024" },
      { id: "b", name: "תיקייה", mimeType: "application/vnd.google-apps.folder" },
      { id: "c", name: "א.pdf", mimeType: "application/pdf", size: "2048" },
    ]);
    expect(folders.map((f) => f.id)).toEqual(["b"]);
    expect(files.map((f) => f.id)).toEqual(["c", "a"]);
  });

  it("returns empty lists for an empty folder", () => {
    const { folders, files } = partitionDriveFiles([]);
    expect(folders).toEqual([]);
    expect(files).toEqual([]);
  });
});

describe("Google-native export mapping", () => {
  it("exports Docs/Slides to PDF with an adjusted file name", () => {
    const doc = { id: "g", name: "שיעור גמרא", mimeType: "application/vnd.google-apps.document" };
    expect(driveFileMime(doc)).toBe("application/pdf");
    expect(driveFileName(doc)).toBe("שיעור גמרא.pdf");
  });

  it("exports Sheets to xlsx", () => {
    const sheet = { id: "s", name: "מעקב נוכחות", mimeType: "application/vnd.google-apps.spreadsheet" };
    expect(driveFileMime(sheet)).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(driveFileName(sheet)).toBe("מעקב נוכחות.xlsx");
  });

  it("passes regular files through unchanged", () => {
    const pdf = { id: "p", name: "דף עבודה.pdf", mimeType: "application/pdf" };
    expect(driveFileMime(pdf)).toBe("application/pdf");
    expect(driveFileName(pdf)).toBe("דף עבודה.pdf");
  });
});

describe("recurring rules wiring", () => {
  it("schedule-rules route renders the panel and has head metadata", () => {
    const src = readFileSync("src/routes/_authenticated.schedule-rules.tsx", "utf8");
    expect(src).toContain("RecurringRulesPanel");
    expect(src).toContain('createFileRoute("/_authenticated/schedule-rules")');
    expect(src).toContain("title: \"כללים קבועים במערכת · הכיתה שלי\"");
  });

  it("weekly schedule shows the active-rules summary and links the management screen", () => {
    const src = readFileSync("src/routes/_authenticated.weekly-schedule.$classId.tsx", "utf8");
    expect(src).toContain("RecurringRulesSummary");
    const summary = readFileSync("src/components/schedule/recurring-rules-summary.tsx", "utf8");
    expect(summary).toContain('to="/schedule-rules"');
  });

  it("schedule-rules is registered in the tool registry", () => {
    const src = readFileSync("src/lib/tool-registry.ts", "utf8");
    expect(src).toContain('"/schedule-rules"');
  });
});

describe("drive import wiring", () => {
  it("library page exposes the Drive import and the panel triggers style learning", () => {
    const page = readFileSync("src/routes/_authenticated.resources.index.tsx", "utf8");
    expect(page).toContain("GoogleDrivePanel");
    expect(page).toContain("ייבוא תיקייה מ-Google Drive");
    const panel = readFileSync("src/components/drive/google-drive-panel.tsx", "utf8");
    expect(panel).toContain("recomputeStyleProfile");
  });

  it("reports page has a PDF preview wired to the same builder as download", () => {
    const src = readFileSync("src/routes/_authenticated.reports.$classId.tsx", "utf8");
    expect(src).toContain("PdfPreviewModal");
    expect(src).toContain("onPreview");
    expect(src).toContain("build={buildPdf}");
  });
});
