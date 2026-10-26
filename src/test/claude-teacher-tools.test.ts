import { describe, it, expect } from "vitest";
import { interventionPlan } from "@/lib/claude-tools.schemas";
import { dailySnapshotDescription } from "@/lib/daily-portfolio-snapshot";
describe("requested teacher tools rules", () => {
  it("requires exactly three intervention steps", () => {
    const step = { title: "בירור", action: "שיחה פרטית", success: "שיתוף פעולה" };
    expect(interventionPlan.safeParse({ summary: "מצב", steps: [step, step, step] }).success).toBe(true);
    expect(interventionPlan.safeParse({ summary: "מצב", steps: [step, step] }).success).toBe(false);
    expect(interventionPlan.safeParse({ summary: "מצב", steps: [step, step, step, step] }).success).toBe(false);
  });
  it("captures Hebrew attendance, grade, summary and Jerusalem time", () => {
    const result = dailySnapshotDescription({ attendance: { status: "present", notes: "" }, grades: [{ id: "g", subject: "גמרא", value: 92, max_value: 100, notes: "" }], insights: [{ id: "i", severity: "low", title: "התקדמות", description: "השתתף בדיון" }] }, "2026-10-26", "2026-10-26T19:33:00Z");
    expect(result).toContain("נוכחות: נוכח"); expect(result).toContain("92/100 גמרא"); expect(result).toContain("השתתף בדיון"); expect(result).toContain("21:33"); expect(result).not.toContain("2026-10-26");
  });
});