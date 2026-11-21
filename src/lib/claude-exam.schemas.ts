import { z } from "zod";
import { KODESH_SUBJECTS } from "./kodesh-subjects";

export const claudeExamInput = z.object({
  subject: z.enum(KODESH_SUBJECTS),
  gradeLevel: z.string().trim().min(1).max(60),
  topic: z.string().trim().max(200).default(""),
  source: z.string().trim().max(12000).default(""),
  knowledgeCount: z.number().int().min(1).max(8),
  depthCount: z.number().int().min(1).max(4),
  durationMinutes: z.number().int().min(15).max(180),
  totalPoints: z.number().int().min(20).max(200),
}).refine((d) => d.topic.length >= 2 || d.source.length >= 20, {
  message: "יש להזין נושא של שני תווים לפחות או קטע מקור של 20 תווים לפחות.", path: ["topic"],
});

const nonEmpty = z.string().trim().min(1);
export const claudeExamResult = z.object({
  title: nonEmpty,
  instructions: nonEmpty,
  sourceCaution: z.string(),
  questions: z.array(z.object({
    kind: z.enum(["בקיאות", "העמקה"]),
    question: nonEmpty,
    points: z.number().int().positive(),
    answer: nonEmpty,
    criteria: z.array(z.object({ description: nonEmpty, points: z.number().int().positive() })).min(1).max(6),
  })).min(2).max(12),
});
export type ClaudeExam = z.infer<typeof claudeExamResult>;
export type ClaudeExamInput = z.infer<typeof claudeExamInput>;

/** Reject incomplete or inconsistent marking schemes rather than silently rescaling them. */
export function validateClaudeExam(raw: unknown, input: ClaudeExamInput): ClaudeExam {
  const parsed = claudeExamResult.safeParse(raw);
  if (!parsed.success) throw new Error("המבחן שהתקבל אינו שלם. לא הוצגה תוצאה חלקית.");
  const exam = parsed.data;
  if (exam.questions.filter((q) => q.kind === "בקיאות").length !== input.knowledgeCount ||
      exam.questions.filter((q) => q.kind === "העמקה").length !== input.depthCount) {
    throw new Error("מספר שאלות הבקיאות וההעמקה אינו תואם לבחירה.");
  }
  if (exam.questions.reduce((sum, q) => sum + q.points, 0) !== input.totalPoints) {
    throw new Error("סכום נקודות המבחן אינו תואם לציון הכולל שנבחר.");
  }
  if (exam.questions.some((q) => q.criteria.reduce((sum, c) => sum + c.points, 0) !== q.points)) {
    throw new Error("נקודות המחוון אינן תואמות לניקוד השאלות.");
  }
  return exam;
}

export const claudeExamOutputSchema = {
  type: "object", additionalProperties: false,
  required: ["title", "instructions", "sourceCaution", "questions"],
  properties: {
    title: { type: "string" }, instructions: { type: "string" }, sourceCaution: { type: "string" },
    questions: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["kind", "question", "points", "answer", "criteria"],
      properties: {
        kind: { type: "string", enum: ["בקיאות", "העמקה"] }, question: { type: "string" },
        points: { type: "integer" }, answer: { type: "string" },
        criteria: { type: "array", items: {
          type: "object", additionalProperties: false, required: ["description", "points"],
          properties: { description: { type: "string" }, points: { type: "integer" } },
        } },
      },
    } },
  },
};