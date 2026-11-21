import { beforeEach, describe, expect, it, vi } from "vitest";
import { claudeExamInput, validateClaudeExam, type ClaudeExam } from "@/lib/claude-exam.schemas";

const mocks = vi.hoisted(() => ({ run: vi.fn(), trial: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/claude-tools.server", () => ({ runClaude: mocks.run, parseClaudeJson: JSON.parse }));
vi.mock("@/lib/ai-entitlement.server", () => ({ requireActiveAITrial: mocks.trial }));
import { generateClaudeExam } from "@/lib/claude-tools.functions";

const input = claudeExamInput.parse({ subject: "משנה", gradeLevel: "ד׳", topic: "השבת אבדה", knowledgeCount: 1, depthCount: 1, durationMinutes: 30, totalPoints: 100 });
const result = (): ClaudeExam => ({ title: "השבת אבדה", instructions: "ענו על כל השאלות", sourceCaution: "נדרשת בדיקת מקור", questions: [
  { kind: "בקיאות", question: "מהם סימני האבדה?", points: 40, answer: "תיאור הסימנים", criteria: [{ description: "זיהוי סימן", points: 20 }, { description: "הסבר סימן", points: 20 }] },
  { kind: "העמקה", question: "הסבר כיצד הסימנים מסייעים להשבה", points: 60, answer: "זיהוי הבעלים", criteria: [{ description: "הסבר", points: 30 }, { description: "יישום", points: 30 }] },
] });
describe("Claude exam input and marking scheme", () => {
  it("accepts a topic without source text", () => { expect(claudeExamInput.safeParse(input).success).toBe(true); });
  it("accepts source text without a topic", () => {
    expect(claudeExamInput.safeParse({ ...input, topic: "", source: "אלו מציאות שלו ואלו חייב להכריז. מצא פירות מפוזרין הרי אלו שלו." }).success).toBe(true);
  });
  it("rejects a request with neither topic nor source", () => {
    expect(claudeExamInput.safeParse({ ...input, topic: "", source: "" }).success).toBe(false);
  });
  it("validates a 100-point exam with knowledge and depth questions", () => {
    const exam = validateClaudeExam(result(), input);
    expect(exam.questions.map((q) => q.kind)).toEqual(["בקיאות", "העמקה"]);
    expect(exam.questions.reduce((s, q) => s + q.points, 0)).toBe(100);
  });
  it("rejects incorrect question counts", () => {
    expect(() => validateClaudeExam(result(), { ...input, knowledgeCount: 2 })).toThrow("מספר שאלות");
  });
  it("rejects a total different from the selected score", () => {
    expect(() => validateClaudeExam(result(), { ...input, totalPoints: 80 })).toThrow("סכום נקודות");
  });
  it("rejects partial-credit criteria that do not add up to the question score", () => {
    const exam = result();
    const question = exam.questions[0];
    if (!question) throw new Error("Missing fixture question");
    question.criteria = [{ description: "תשובה מלאה", points: 39 }];
    expect(() => validateClaudeExam(exam, input)).toThrow("נקודות המחוון");
  });
  it("rejects questions without an expected answer", () => {
    const exam = result();
    const question = exam.questions[0];
    if (!question) throw new Error("Missing fixture question");
    question.answer = "";
    expect(() => validateClaudeExam(exam, input)).toThrow("אינו שלם");
  });
});

describe("Claude exam generation", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("LOVABLE_API_KEY", "test-key"); mocks.trial.mockResolvedValue(undefined); mocks.run.mockResolvedValue(JSON.stringify(result())); });
  const invoke = () => (generateClaudeExam as unknown as (args: unknown) => Promise<ClaudeExam>)({ data: input, context: { supabase: {}, userId: "teacher" } });
  it("checks trial access before spending credits and returns a validated rubric", async () => {
    await expect(invoke()).resolves.toEqual(result());
    expect(mocks.trial).toHaveBeenCalledWith({}, "teacher");
    expect(mocks.trial.mock.invocationCallOrder[0]).toBeLessThan(mocks.run.mock.invocationCallOrder[0] ?? 0);
    const call = mocks.run.mock.calls[0];
    if (!call) throw new Error("Missing Claude call");
    expect(call[2]).toEqual(input);
    expect(call[3].properties.questions.items.properties.kind.enum).toEqual(["בקיאות", "העמקה"]);
  });
  it("does not call Claude when trial access is denied", async () => {
    mocks.trial.mockRejectedValue(new Error("תקופת הניסיון הסתיימה"));
    await expect(invoke()).rejects.toThrow("תקופת הניסיון הסתיימה");
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("does not return an inconsistent model output", async () => {
    const exam = result();
    exam.questions.pop();
    mocks.run.mockResolvedValue(JSON.stringify(exam));
    await expect(invoke()).rejects.toThrow("אינו שלם");
  });
});