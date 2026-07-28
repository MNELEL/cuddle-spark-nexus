import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

export type PollSuggestion = { question: string; options: string[] };

export const suggestPollQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      topic: z.string().max(200).optional(),
      className: z.string().max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<PollSuggestion> => {
    const topicLine = data.topic ? `נושא: ${data.topic}.` : "בחר נושא מעניין לדיון כיתתי.";
    const classLine = data.className ? `שם הכיתה: ${data.className}.` : "";

    const content = await callLovableAI({
      jsonResponse: true,
      messages: [
        {
          role: "system",
          content:
            'אתה עוזר להרב/מלמד לייצר שאלת סקר כיתתי לדיון בת"ת/חיידר חרדי. ' +
            'השאלה חייבת להיות מכבדת, חינוכית, בעברית, ומתאימה לרוח יהדות התורה. ' +
            'החזר JSON בלבד עם המבנה: { "question": string, "options": string[] } ' +
            'שים 2-4 אפשרויות תשובה קצרות (עד 40 תווים כל אחת).',
        },
        { role: "user", content: `${classLine} ${topicLine} החזר JSON בלבד.` },
      ],
    });

    try {
      const parsed = JSON.parse(content) as PollSuggestion;
      const question = String(parsed.question ?? "").trim().slice(0, 500);
      const options = Array.isArray(parsed.options)
        ? parsed.options.map((o) => String(o).trim().slice(0, 200)).filter(Boolean).slice(0, 4)
        : [];
      if (!question || options.length < 2) throw new Error("bad shape");
      return { question, options };
    } catch {
      return {
        question: "מהי המידה החשובה ביותר לעבודה עצמית בת״ת?",
        options: ["התמדה", "סבלנות", "אהבת חברים", "יראת שמיים"],
      };
    }
  });