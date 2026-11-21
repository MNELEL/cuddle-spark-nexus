import { z } from "zod";
import { KODESH_SUBJECTS } from "./kodesh-subjects";

export const sugyaInput = z.object({
  subject: z.enum(KODESH_SUBJECTS),
  location: z.string().trim().min(2, "יש להזין מקום לימוד").max(200),
  source: z.string().trim().max(12000).default(""),
});
export const advisorInput = z.object({ dilemma: z.string().trim().min(10, "יש לפרט את הדילמה").max(5000) });
export const interventionPlan = z.object({
  summary: z.string(),
  steps: z.array(z.object({ title: z.string(), action: z.string(), success: z.string() })).length(3),
});
export const sugyaResult = z.object({ title: z.string(), introduction: z.string(), discussion: z.array(z.string()), nextLesson: z.string(), sourceCaution: z.string() });

export const lessonPlanInput = z.object({
  subject: z.enum(KODESH_SUBJECTS),
  gradeLevel: z.string().trim().min(1, "יש לבחור שכבת גיל").max(60),
  topic: z.string().trim().min(2, "יש להזין נושא או מקום לימוד").max(200),
  durationMinutes: z.number().int().min(20).max(180),
  source: z.string().trim().max(12000).default(""),
});
export const lessonPlanResult = z.object({
  title: z.string(),
  objectives: z.array(z.string()).min(1),
  opening: z.string(),
  timeline: z.array(z.object({ minutes: z.number(), activity: z.string() })).min(1),
  guidingQuestions: z.array(z.string()).min(1),
  worksheetLevels: z.array(z.object({ level: z.string(), questions: z.array(z.string()).min(1) })).length(3),
  homework: z.string(),
  sourceCaution: z.string(),
});