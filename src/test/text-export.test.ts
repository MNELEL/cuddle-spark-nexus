import { describe, expect, it } from "vitest";
import {
  bulletinToMarkdown,
  certificateToText,
  type CertificateTextMeta,
  type CertificateTextRow,
} from "@/lib/text-export";

type BulletinArg = Parameters<typeof bulletinToMarkdown>[0];

function makeBulletin(over: Partial<BulletinArg> = {}): BulletinArg {
  return {
    title: "עלון שבועי — פרשת נח",
    digest_summary: "השבוע למדנו על התיבה.",
    study_points: ["גמרא: דף ג", "משנה: פרק ב"],
    recap_questions: [
      { question: "מה שם הפרשה?", answer: "נח" },
      { question: "מי בנה את התיבה?", answer: "" },
    ],
    weekly_riddle: "מה נכנס לתיבה זוג זוג?",
    weekly_riddle_answer: "בעלי החיים",
    activities: ["מסיבת סיום", "חידון"],
    notes: "",
    startDate: "2026-08-02",
    endDate: "2026-08-08",
    ...over,
  } as BulletinArg;
}

function makeRow(over: Partial<CertificateTextRow> = {}): CertificateTextRow {
  return {
    name: "יוסף כהן",
    subjects: [
      { subject: "גמרא", label: "מעולה", note: "מתמיד" },
      { subject: "חומש", label: "טוב מאוד", note: "" },
    ],
    conducts: [{ key: "דרך ארץ", label: "מצוין" }],
    attendance: { present: 40, absent: 2, late: 1 },
    teacherNote: "המשך כך",
    principalNote: "ברכות",
    ...over,
  };
}

const meta: CertificateTextMeta = {
  className: "כיתה ג׳",
  period: "מחצית א׳ – תשפ״ז",
  schoolName: "תלמוד תורה אור",
};

/** No line may be blank twice in a row anywhere in the output. */
function hasDoubleBlank(text: string) {
  return /\n[ \t]*\n[ \t]*\n/.test(text);
}

describe("bulletinToMarkdown", () => {
  it("uses # for the title and ## for every section", () => {
    const md = bulletinToMarkdown(makeBulletin(), "כיתה ג׳");
    expect(md.startsWith("# עלון שבועי — פרשת נח")).toBe(true);
    expect(md).toContain("**כיתה:** כיתה ג׳");
    expect(md).toContain("**טווח תאריכים:** 2026-08-02 — 2026-08-08");
    for (const h of ["## סיכום השבוע", "## נקודות לימוד", "## שאלות חזרה להורים", "## חידה שבועית", "## פעילויות ויוזמות"]) {
      expect(md).toContain(h);
    }
    // exactly one H1
    expect(md.split("\n").filter((l) => /^# /.test(l))).toHaveLength(1);
  });

  it("formats lists and numbered questions consistently", () => {
    const md = bulletinToMarkdown(makeBulletin(), "כיתה ג׳");
    expect(md).toContain("- גמרא: דף ג");
    expect(md).toContain("1. מה שם הפרשה?");
    expect(md).toContain("   - תשובה: נח");
    // empty answer produces no answer line
    expect(md).toContain("2. מי בנה את התיבה?");
    expect(md).not.toContain("תשובה: \n");
    expect(md).toContain("**תשובה:** בעלי החיים");
  });

  it("falls back to a default title when the title is empty", () => {
    const md = bulletinToMarkdown(makeBulletin({ title: "" }), "כיתה ג׳");
    expect(md.startsWith("# עלון שבועי")).toBe(true);
  });

  it("omits sections entirely when their fields are empty", () => {
    const md = bulletinToMarkdown(
      makeBulletin({
        digest_summary: "",
        study_points: [],
        recap_questions: [],
        weekly_riddle: "",
        weekly_riddle_answer: "",
        activities: [],
      }),
      "כיתה ג׳",
    );
    for (const h of ["## סיכום השבוע", "## נקודות לימוד", "## שאלות חזרה להורים", "## חידה שבועית", "## פעילויות ויוזמות"]) {
      expect(md).not.toContain(h);
    }
    expect(md).not.toContain("- \n");
    expect(hasDoubleBlank(md)).toBe(false);
  });

  it("omits only the riddle answer when the answer alone is empty", () => {
    const md = bulletinToMarkdown(makeBulletin({ weekly_riddle_answer: "" }), "כיתה ג׳");
    expect(md).toContain("## חידה שבועית");
    expect(md).not.toContain("**תשובה:**");
  });

  it("never emits double blank lines and is deterministic", () => {
    const a = bulletinToMarkdown(makeBulletin(), "כיתה ג׳");
    const b = bulletinToMarkdown(makeBulletin(), "כיתה ג׳");
    expect(a).toBe(b);
    expect(hasDoubleBlank(a)).toBe(false);
  });
});

describe("certificateToText", () => {
  it("keeps a fixed line-by-line structure", () => {
    const lines = certificateToText(makeRow(), meta).split("\n");
    expect(lines[0]).toBe("תעודת הערכה");
    expect(lines[1]).toBe("מוסד: תלמוד תורה אור");
    expect(lines[2]).toBe("כיתה: כיתה ג׳");
    expect(lines[3]).toBe("תקופה: מחצית א׳ – תשפ״ז");
    expect(lines[4]).toBe("שם התלמיד: יוסף כהן");
    expect(lines).toContain("הישגים לימודיים:");
    expect(lines).toContain("הליכות ומידות:");
    expect(lines).toContain("נוכחות:");
    expect(lines).toContain("נוכח: 40");
    expect(lines).toContain("נעדר: 2");
    expect(lines).toContain("איחורים: 1");
    expect(lines).toContain("הערות המחנך / הרב:");
    expect(lines).toContain("הערות ההנהלה:");
  });

  it("adds a subject note in parentheses only when it has content", () => {
    const text = certificateToText(makeRow(), meta);
    expect(text).toContain("גמרא: מעולה (מתמיד)");
    expect(text).toContain("חומש: טוב מאוד");
    expect(text).not.toContain("חומש: טוב מאוד (");
  });

  it("handles a missing note property and whitespace-only notes", () => {
    const text = certificateToText(
      makeRow({ subjects: [{ subject: "הלכה", label: "טוב" }, { subject: "מוסר", label: "טוב", note: "   " }] }),
      meta,
    );
    expect(text).toContain("הלכה: טוב");
    expect(text).toContain("מוסר: טוב");
    expect(text).not.toContain("(");
  });

  it("does not throw or add empty sections for empty data", () => {
    const text = certificateToText(
      makeRow({ subjects: [], conducts: [], teacherNote: "", principalNote: "" }),
      meta,
    );
    expect(text).not.toContain("הערות המחנך / הרב:");
    expect(text).not.toContain("הערות ההנהלה:");
    expect(text.trimEnd()).toBe(text.trimEnd());
    expect(hasDoubleBlank(text)).toBe(false);
  });

  it("is deterministic for the same input", () => {
    const row = makeRow();
    expect(certificateToText(row, meta)).toBe(certificateToText(row, meta));
    expect(hasDoubleBlank(certificateToText(row, meta))).toBe(false);
  });
});