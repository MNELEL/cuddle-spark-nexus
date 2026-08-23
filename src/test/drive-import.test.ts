import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { partitionDriveFiles, type DriveFile } from "@/lib/drive.server";

const file = (over: Partial<DriveFile>): DriveFile => ({
  id: "f1",
  name: "doc.pdf",
  mimeType: "application/pdf",
  size: 1024,
  modifiedTime: "2026-08-01T10:00:00Z",
  isFolder: false,
  ...over,
});

describe("partitionDriveFiles", () => {
  it("sorts folders first, then files, then skipped (unsupported)", () => {
    const { folders, files, skipped } = partitionDriveFiles([
      file({ id: "a", name: "a.xyz", mimeType: "application/octet-stream" }),
      file({ id: "b", name: "folder", mimeType: "application/vnd.google-apps.folder", isFolder: true }),
      file({ id: "c", name: "c.pdf" }),
    ]);
    expect(folders.map((f) => f.id)).toEqual(["b"]);
    expect(files.map((f) => f.id)).toEqual(["c"]);
    expect(skipped.map((f) => f.id)).toEqual(["a"]);
  });

  it("keeps native Google docs as importable (exported server-side)", () => {
    const { files } = partitionDriveFiles([
      file({ id: "g", mimeType: "application/vnd.google-apps.document" }),
    ]);
    expect(files.map((f) => f.id)).toEqual(["g"]);
  });

  it("skips empty folders and unsupported mime types", () => {
    const { skipped } = partitionDriveFiles([
      file({ id: "x", mimeType: "application/vnd.google-apps.shortcut" }),
      file({ id: "y", mimeType: "image/png" }), // תמונות לא נתמכות בייבוא
    ]);
    expect(skipped).toHaveLength(2);
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
