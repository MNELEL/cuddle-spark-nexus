import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_reminder",
  title: "יצירת תזכורת",
  description: "Create a follow-up reminder for one student in a class.",
  inputSchema: {
    class_id: z.string().uuid().describe("The class id."),
    student_id: z.string().uuid().describe("The student id."),
    title: z.string().describe("Short reminder title."),
    description: z.string().optional().describe("Optional details."),
    due_date: z.string().optional().describe("Due date, YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ class_id, student_id, title, description, due_date }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const clean = title.trim();
    if (!clean) return { content: [{ type: "text", text: "כותרת התזכורת חסרה" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("reminders")
      .insert({
        class_id,
        student_id,
        title: clean,
        ...(description ? { description } : {}),
        ...(due_date ? { due_date } : {}),
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { reminder: data },
    };
  },
});