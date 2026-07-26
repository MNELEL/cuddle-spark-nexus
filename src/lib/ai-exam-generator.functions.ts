import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

export type ExamDifficulty = "easy" | "medium" | "hard";
export type ExamQuestionType = "open" | "mc";

export type GeneratedQuestion = {
  id: string;
  type: ExamQuestionType;
  prompt: string;
  points: number;
  /** For MC: 4 choices, index of the correct one. */
  choices?: string[];
  correctIndex?: number;
  /** For open: model answer / rubric hint. */
  modelAnswer?: string;
};

export type GeneratedExam = {
  subject: string;
  difficulty: ExamDifficulty;
  totalMax: number;
  questions: GeneratedQuestion[];
};

const inputSchema = z.object({
  subjects: z.string().min(1).max(200),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  numQuestions: z.number().int().min(1).max(30).default(10),
  openCount: z.number().int().min(0).max(30).default(3),
  mcCount: z.number().int().min(0).max(30).default(7),
  totalMax: z.number().int().min(1).max(1000).default(100),
  feedback: z.string().max(1200).default(""),
  language: z.string().max(20).default("he"),
});

const DIFF_LABEL: Record<ExamDifficulty, string> = {
  easy: "קל", medium: "בינוני", hard: "קשה",
};

/**
 * Generate an exam via AI. Returns open + multiple-choice questions with
 * correct answers marked, so closed questions can be auto-graded downstream.
 */
export const generateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<GeneratedExam> => {
    const totalRequested = Math.max(1, data.openCount + data.mcCount);
    const numQ = Math.max(1, Math.min(30, totalRequested));

    const system = `אתה מלמד בכיר בתלמוד תורה / חיידר / בית ספר יהודי, כותב מבחנים בעברית.
כתוב מבחן ברמת קושי ${DIFF_LABEL[data.difficulty]} במקצועות: ${data.subjects}.
כלול בדיוק ${data.openCount} שאלות פתוחות ו-${data.mcCount} שאלות אמריקאיות (סגורות עם 4 אפשרויות).
לכל שאלה סגורה — 4 אפשרויות (choices) ומדד correctIndex (0-3) של האפשרות הנכונה.
לכל שאלה פתוחה — תשובה מודלית קצרה בשדה modelAnswer, שתשמש להערכה ידנית של המלמד.
חלק את סך הנקודות (${data.totalMax}) בין השאלות בצורה הוגנת (points שלמים; הסכום = ${data.totalMax}).
טרמינולוגיה חרדית ("המלמד", "התלמיד"). ${data.feedback ? `הנחיה מיוחדת: ${data.feedback}` : ""}

החזר JSON בלבד במבנה:
{"questions":[{"id":"q1","type":"open|mc","prompt":"","points":10,"choices":["","","",""],"correctIndex":0,"modelAnswer":""}]}`;

    const raw = (await callLovableAI({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `בנה עכשיו את המבחן. ${numQ} שאלות סה"כ.` },
      ],
      jsonResponse: true,
    })) || "{}";

    let parsed: { questions?: unknown } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    const rawList = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions: GeneratedQuestion[] = rawList.slice(0, 30).map((q, i) => {
      const item = q as Record<string, unknown>;
      const isMc = String(item.type ?? "open") === "mc";
      const rawChoices = Array.isArray(item.choices) ? item.choices : [];
      const choices = isMc
        ? rawChoices.slice(0, 4).map((c) => String(c ?? "").slice(0, 300))
        : undefined;
      const correctIndex = isMc
        ? Math.max(0, Math.min(3, Number(item.correctIndex) || 0))
        : undefined;
      return {
        id: String(item.id ?? `q${i + 1}`).slice(0, 20),
        type: isMc ? "mc" : "open",
        prompt: String(item.prompt ?? `שאלה ${i + 1}`).slice(0, 1000),
        points: Math.max(1, Math.min(1000, Number(item.points) || 1)),
        choices: choices && choices.length === 4 ? choices : (isMc ? ["", "", "", ""] : undefined),
        correctIndex,
        modelAnswer: item.modelAnswer ? String(item.modelAnswer).slice(0, 800) : undefined,
      };
    });

    // Normalize points so they sum to totalMax (proportional rounding).
    const rawSum = questions.reduce((s, q) => s + q.points, 0) || questions.length;
    if (questions.length > 0 && rawSum !== data.totalMax) {
      let acc = 0;
      questions.forEach((q, i) => {
        const share = i === questions.length - 1
          ? data.totalMax - acc
          : Math.max(1, Math.round((q.points / rawSum) * data.totalMax));
        q.points = Math.max(1, share);
        acc += q.points;
      });
    }

    return {
      subject: data.subjects,
      difficulty: data.difficulty,
      totalMax: data.totalMax,
      questions,
    };
  });